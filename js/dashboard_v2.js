import { db } from "./config.js";
import { doc, getDocs, getDoc, query, collection, where, deleteDoc, updateDoc, addDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { state } from "./state.js";
import { showToast, generateVideoCardHtml, setupSubcourseInputs, getSkeletonHtml, withViewTransition, generateAttachmentsHtml } from "./utils.js";
import { renderAdminHome } from "./admin.js";
import { uploadToHuggingFace } from "./hf_storage_v4.js";

// Initialize File Input Listener
// Initialize File Input Listener & State
let selectedFilesMap = new Map(); // Key: fileName, Value: { file, customName }

const fileInput = document.getElementById('content-file');
if (fileInput) {
    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        const container = document.getElementById('file-list-container');
        const fileLabel = document.getElementById('file-label');

        if (files.length > 0) {
            files.forEach(f => {
                if (!selectedFilesMap.has(f.name)) {
                    selectedFilesMap.set(f.name, { file: f, customName: f.name.split('.')[0] });
                }
            });
            renderFileList();
            container.classList.remove('hidden');
            if (fileLabel) fileLabel.innerText = `${selectedFilesMap.size} file(s) selected`;
        }
    });
}

function renderFileList() {
    const container = document.getElementById('file-list-container');
    container.innerHTML = '';

    selectedFilesMap.forEach((val, key) => {
        const div = document.createElement('div');
        div.className = "flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200 text-xs";
        div.innerHTML = `
            <i class="fas fa-file text-slate-400"></i>
            <input type="text" value="${val.customName}" oninput="window.updateFileName('${key}', this.value)" 
                class="flex-1 bg-transparent border-b border-transparent focus:border-brand-primary outline-none text-slate-700 font-bold" 
                placeholder="Rename file...">
            <button onclick="window.removeFile('${key}')" class="text-slate-400 hover:text-red-500"><i class="fas fa-times"></i></button>
        `;
        container.appendChild(div);
    });
}

window.updateFileName = (key, name) => {
    if (selectedFilesMap.has(key)) {
        selectedFilesMap.get(key).customName = name;
    }
}

window.removeFile = (key) => {
    selectedFilesMap.delete(key);
    renderFileList();
    const fileLabel = document.getElementById('file-label');
    if (selectedFilesMap.size === 0) {
        document.getElementById('file-list-container').classList.add('hidden');
        if (fileLabel) fileLabel.innerText = "Click or drag files here";
    } else {
        if (fileLabel) fileLabel.innerText = `${selectedFilesMap.size} file(s) selected`;
    }
}


// --- DASHBOARD: NAVIGATION ---
export function openCourseDashboard(id, title, subcode) {
    state.activeCourseContext = { id, title, subcode };
    state.currentFolderId = null;
    state.breadcrumbs = [];

    const isAdmin = state.currentUserData.role === 'admin';
    const backBtn = isAdmin
        ? `<button onclick="window.renderAdminHome()" class="nav-item w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-50 rounded-xl font-bold text-sm mb-6"><i class="fas fa-arrow-left"></i> Back to Hub</button>`
        : `<div class="px-4 mb-4 text-xs font-bold text-slate-300 uppercase tracking-widest">Student View</div>`;

    const studentsTab = isAdmin ?
        `<button onclick="window.renderTab('students')" class="nav-item tab-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm mb-1"><i class="fas fa-users w-5 text-center"></i> Students</button>`
        : '';

    document.getElementById('nav-links').innerHTML = `
        ${backBtn}
        <div class="px-4 mb-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Course Menu</div>
        <button onclick="window.renderTab('home')" class="nav-item tab-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm mb-1"><i class="fas fa-bullhorn w-5 text-center"></i> Home</button>
        <button onclick="window.renderTab('videos')" class="nav-item tab-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm mb-1"><i class="fas fa-video w-5 text-center"></i> Videos</button>
        <button onclick="window.renderTab('summaries')" class="nav-item tab-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm mb-1"><i class="fas fa-file-alt w-5 text-center"></i> Summaries</button>
        <button onclick="window.renderTab('hw')" class="nav-item tab-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm mb-1"><i class="fas fa-pencil-alt w-5 text-center"></i> Homework</button>
        ${studentsTab}
    `;
    renderTab('home');
}

export async function renderTab(tabName, fromHistory = false) {
    if (!fromHistory) {
        history.pushState({ tab: tabName }, "", `#${tabName}`);
    }
    withViewTransition(async () => {
        _renderTabInternal(tabName);
    });
}

async function _renderTabInternal(tabName) {
    // Cleanup previous sortable
    if (state.sortableInstance) { state.sortableInstance.destroy(); state.sortableInstance = null; }

    document.querySelectorAll('.tab-btn').forEach(b => {
        if (b.getAttribute('onclick').includes(tabName)) {
            b.className = "nav-item tab-btn w-full flex items-center gap-3 px-4 py-3 bg-brand-light text-brand-primary rounded-xl font-bold text-sm mb-1 transition-colors";
        } else {
            b.className = "nav-item tab-btn w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium text-sm mb-1 transition-colors";
        }
    });

    const container = document.getElementById('main-view');
    container.innerHTML = getSkeletonHtml(3); // Show skeleton immediately

    const { title, subcode } = state.activeCourseContext;
    const isAdmin = state.currentUserData.role === 'admin';
    const header = `
        <div class="mb-8 pb-6 border-b border-slate-200">
            <h1 class="text-3xl font-bold text-slate-900 font-display">${title} <span class="text-brand-primary ml-2">${subcode ? subcode : ''}</span></h1>
            <p class="text-slate-500 mt-1">${isAdmin ? 'Manage content for this group.' : 'Welcome to your learning dashboard.'}</p>
        </div>`;

    let contentHtml = '';

    try {
        // --- STUDENTS TAB ---
        if (tabName === 'students' && isAdmin) {
            const qUsers = query(collection(db, "users"), where("courseId", "==", state.activeCourseContext.id));
            const snap = await getDocs(qUsers);
            let students = [];
            snap.forEach(d => {
                const u = d.data();
                if (state.activeCourseContext.subcode && u.subcourseCode !== state.activeCourseContext.subcode) return;
                if (u.role !== 'admin') students.push({ id: d.id, ...u });
            });

            const list = students.map(s => `
                <div class="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl hover:shadow-md transition">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-lg"><i class="fas fa-user"></i></div>
                        <div>
                            <h4 class="font-bold text-slate-900">${s.name}</h4>
                            <p class="text-xs text-slate-500 font-mono">${s.phone}</p>
                        </div>
                    </div>
                    <button onclick="window.deleteStudentAccount('${s.id}', '${s.name}')" class="text-red-400 hover:text-red-600 p-2"><i class="fas fa-trash"></i></button>
                </div>
            `).join('');

            contentHtml = `
                <div class="flex justify-between items-center mb-6 fade-in">
                    <h2 class="text-xl font-bold text-slate-800">Enrolled Students</h2>
                    <span class="bg-blue-50 text-brand-primary px-3 py-1 rounded-full text-xs font-bold">${students.length} Students</span>
                </div>
                <div class="space-y-3 fade-in">
                    ${students.length ? list : `<div class="text-center p-8 text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">No students enrolled yet.</div>`}
                </div>`;

            container.innerHTML = header + contentHtml;
            return;
        }

        // --- CONTENT TABS ---
        const typeMap = { 'home': 'announcement', 'videos': 'video', 'summaries': 'summary', 'hw': 'homework' };
        const dbType = typeMap[tabName];
        let qTypes = [dbType];
        if (tabName === 'videos') qTypes.push('folder');

        const q = query(collection(db, "course_content"), where("courseId", "==", state.activeCourseContext.id));
        const snap = await getDocs(q);
        let items = [];

        snap.forEach(d => {
            const data = d.data();
            if (data.subcourseCode && data.subcourseCode !== state.activeCourseContext.subcode) return;
            if (!qTypes.includes(data.type)) return;
            if (tabName === 'videos') {
                if (state.currentFolderId === null) { if (data.parentId) return; }
                else { if (data.parentId !== state.currentFolderId) return; }
            }
            items.push({ id: d.id, ...data });
        });

        // Sort
        items.sort((a, b) => {
            const orderA = a.order || 9999;
            const orderB = b.order || 9999;
            if (orderA !== orderB) return orderA - orderB;
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        state.currentItems = items;

        if (tabName === 'home') {
            const posts = items.map(item => `
                <div class="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm mb-4">
                    <div class="flex justify-between items-start mb-2">
                        <h4 class="font-bold text-slate-800 dark:text-slate-100 text-lg">${item.title}</h4>
                        ${isAdmin ? `
                        <div class="flex gap-2 text-slate-400">
                            <button onclick="window.openEditContentModal('${encodeURIComponent(JSON.stringify(item))}')" class="hover:text-brand-primary transition-colors"><i class="fas fa-pencil-alt text-sm"></i></button>
                            <button onclick="window.deleteContent('${item.id}', 'home')" class="hover:text-red-500 transition-colors"><i class="fas fa-trash text-sm"></i></button>
                        </div>` : ''}
                    </div>
                    <p class="text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">${item.content}</p>
                    
                    ${generateAttachmentsHtml(item.attachments || [], item.title)}
                    
                    ${(!item.attachments || item.attachments.length === 0) && item.url ? `
                        <div class="mt-4">
                            <button onclick="window.openFileViewer('${item.url}', 'file')" class="inline-flex items-center gap-2 bg-slate-50 dark:bg-slate-700/50 px-4 py-2 rounded-lg text-sm font-bold text-brand-primary hover:bg-slate-100 transition border border-slate-100 dark:border-slate-600">
                                <i class="fas fa-link"></i> View Attachment
                            </button>
                        </div>
                    ` : ''}
                    
                    <p class="text-[10px] text-slate-400 mt-4 font-bold uppercase tracking-widest opacity-70">${new Date(item.createdAt).toLocaleDateString()}</p>
                </div>
            `).join('');

            let upNextHtml = '';
            if (!isAdmin) {
                const vQ = query(collection(db, "course_content"), where("courseId", "==", state.activeCourseContext.id), where("type", "==", "video"));
                const vSnap = await getDocs(vQ);
                if (!vSnap.empty) {
                    upNextHtml = `
                    <div class="bg-gradient-to-r from-brand-primary to-brand-secondary rounded-2xl p-6 text-white shadow-xl mb-8 relative overflow-hidden group cursor-pointer" onclick="window.renderTab('videos')">
                         <div class="absolute right-0 bottom-0 opacity-10 text-[150px] leading-none -mb-10 -mr-10 group-hover:scale-110 transition duration-500"><i class="fas fa-play-circle"></i></div>
                         <div class="relative z-10">
                            <span class="bg-white/20 backdrop-blur px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest border border-white/30">Up Next</span>
                            <h3 class="text-2xl font-display font-bold mt-4 mb-2">Continue Learning</h3>
                            <p class="text-blue-100 max-w-md">Pick up where you left off. Watch the latest recordings in the video library.</p>
                            <button class="mt-6 bg-white text-brand-primary px-6 py-3 rounded-xl font-bold text-sm hover:bg-blue-50 transition shadow-lg">Go to Videos <i class="fas fa-arrow-right ml-2"></i></button>
                         </div>
                    </div>`;
                }
            }

            contentHtml = `
                ${upNextHtml}
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6 fade-in">
                    <div class="md:col-span-2">
                        <div class="flex justify-between items-center mb-4 px-1">
                            <h3 class="font-bold text-lg text-slate-800 dark:text-slate-100">Announcements</h3>
                            ${isAdmin ? `<button onclick="window.openContentModal('announcement')" class="text-sm text-brand-primary font-bold hover:underline">+ New Post</button>` : ''}
                        </div>
                        ${items.length ? posts : `<div class="p-8 text-center bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-slate-400">No announcements yet.</div>`}
                    </div>
                    <div class="space-y-6">
                        <div class="bg-brand-primary rounded-2xl p-6 text-white shadow-lg bg-math-grid relative overflow-hidden">
                            <h3 class="font-bold text-lg relative z-10">Math Hub</h3>
                            <p class="text-blue-100 text-sm relative z-10 mt-1">Check videos for latest recordings.</p>
                            <div class="absolute -right-4 -bottom-4 text-7xl opacity-20"><i class="fas fa-brain"></i></div>
                        </div>
                        <div class="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm">
                             <h4 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Quick Shortcuts</h4>
                             <div class="grid grid-cols-2 gap-3">
                                <button onclick="window.renderTab('videos')" class="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl flex flex-col items-center gap-2 hover:bg-slate-100 transition border border-slate-100 dark:border-slate-600">
                                    <i class="fas fa-play-circle text-brand-primary text-xl"></i>
                                    <span class="text-[10px] font-bold text-slate-700 dark:text-slate-300">Videos</span>
                                </button>
                                <button onclick="window.renderTab('hw')" class="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl flex flex-col items-center gap-2 hover:bg-slate-100 transition border border-slate-100 dark:border-slate-600">
                                    <i class="fas fa-pencil-alt text-amber-500 text-xl"></i>
                                    <span class="text-[10px] font-bold text-slate-700 dark:text-slate-300">Homework</span>
                                </button>
                             </div>
                        </div>
                    </div>
                </div>`;
        } else if (tabName === 'videos') {
            let breadcrumbHtml = '';
            if (state.currentFolderId) {
                breadcrumbHtml = `<div class="flex items-center gap-2 mb-4 text-sm font-bold text-slate-500 fade-in px-1">
                    <span onclick="window.navigateToFolder(null)" class="cursor-pointer hover:text-brand-primary transition">Home</span>
                    ${state.breadcrumbs.map((b, i) => `
                        <i class="fas fa-chevron-right text-[10px] opacity-30"></i>
                        <span onclick="window.navigateToFolder('${b.id}', ${i})" class="cursor-pointer hover:text-brand-primary transition font-display">${b.title}</span>
                    `).join('')}
                </div>`;
            }

            const grid = items.map(item => generateVideoCardHtml(item, isAdmin)).join('');

            contentHtml = `
                ${breadcrumbHtml}
                <div class="flex flex-col md:flex-row justify-between items-center mb-8 fade-in gap-4">
                    <h2 class="text-2xl font-bold text-slate-900 dark:text-white font-display">${state.currentFolderId ? 'Folder Contents' : 'Library'}</h2>
                    
                    <div class="flex gap-2 w-full md:w-auto items-center">
                        <div class="relative flex-1 md:w-64">
                            <i class="fas fa-search absolute left-3 top-2.5 text-slate-400 text-xs"></i>
                            <input type="text" oninput="window.filterVideoItems(this.value)" placeholder="Search library..." class="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:border-brand-primary outline-none focus:ring-4 focus:ring-brand-primary/5 transition">
                        </div>
                    
                        ${isAdmin ? `
                        <div class="flex gap-2 shrink-0">
                            <button onclick="window.openContentModal('folder')" class="h-10 w-10 flex items-center justify-center bg-yellow-50 text-yellow-600 rounded-xl font-bold hover:bg-yellow-100 transition" title="New Folder"><i class="fas fa-folder-plus"></i></button>
                            <button onclick="window.openContentModal('video')" class="h-10 w-10 flex items-center justify-center bg-brand-primary text-white rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-600 transition" title="Add Video"><i class="fas fa-plus"></i></button>
                        </div>` : ''}
                    </div>
                </div>
                ${items.length ? `<div id="video-sortable-list" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 fade-in px-0.5">${grid}</div>` :
                    `<div class="bg-white dark:bg-slate-800 rounded-[2rem] p-16 text-center border border-slate-100 dark:border-slate-700 shadow-sm"><div class="inline-block p-6 bg-slate-50 dark:bg-slate-700/50 rounded-full text-slate-300 mb-4 animate-bounce"><i class="fas fa-folder-open text-3xl"></i></div><p class="text-slate-500 font-bold">This folder is empty.</p></div>`}
            `;
        } else if (tabName === 'summaries') {
            const list = items.map(item => `
                <div class="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition">
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-500 flex items-center justify-center text-xl shadow-sm"><i class="fas fa-file-pdf"></i></div>
                            <div>
                                <h4 class="font-bold text-slate-800 dark:text-slate-100 leading-tight">${item.title}</h4>
                                <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">${new Date(item.createdAt).toLocaleDateString()}</p>
                            </div>
                        </div>
                        ${isAdmin ? `
                        <div class="flex gap-2">
                             <button onclick="window.openEditContentModal('${encodeURIComponent(JSON.stringify(item))}')" class="text-slate-300 hover:text-brand-primary p-1"><i class="fas fa-pencil-alt text-xs"></i></button>
                             <button onclick="window.deleteContent('${item.id}', 'summaries')" class="text-slate-300 hover:text-red-500 p-1"><i class="fas fa-trash text-xs"></i></button>
                        </div>` : ''}
                    </div>
                    
                    ${generateAttachmentsHtml(item.attachments || [], item.title)}
                    
                    ${(!item.attachments || item.attachments.length === 0) && item.url ? `
                        <button onclick="window.openFileViewer('${item.url}', 'file')" class="mt-2 text-brand-primary text-sm font-bold hover:underline flex items-center gap-2">
                            <i class="fas fa-external-link-alt text-[10px]"></i> View Linked PDF
                        </button>
                    ` : ''}
                </div>
            `).join('');

            contentHtml = `
                <div class="flex justify-between items-center mb-8 fade-in">
                    <h2 class="text-2xl font-bold text-slate-900 dark:text-white font-display">Summaries</h2>
                    ${isAdmin ? `<button onclick="window.openContentModal('summary')" class="bg-brand-dark text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-800 transition shadow-lg"><i class="fas fa-plus mr-2"></i> Add Summary</button>` : ''}
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 fade-in">
                    ${items.length ? list : `<div class="col-span-full p-16 text-center bg-slate-50 dark:bg-slate-900/50 rounded-[2rem] border border-dashed border-slate-200 dark:border-slate-700 text-slate-400 font-bold">No summaries available.</div>`}
                </div>`;
        } else if (tabName === 'hw') {
            const list = items.map(item => `
                <div class="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm relative group">
                    <div class="flex justify-between items-start mb-4">
                         <div class="flex items-center gap-4">
                             <div class="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-500 flex items-center justify-center text-xl shadow-sm"><i class="fas fa-tasks"></i></div>
                             <div>
                                 <h4 class="font-bold text-slate-800 dark:text-slate-100 leading-tight">${item.title}</h4>
                                 <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">${new Date(item.createdAt).toLocaleDateString()}</p>
                             </div>
                         </div>
                         ${isAdmin ? `
                         <div class="flex gap-2">
                             <button onclick="window.openEditContentModal('${encodeURIComponent(JSON.stringify(item))}')" class="text-slate-300 hover:text-brand-primary p-1"><i class="fas fa-pencil-alt text-xs"></i></button>
                             <button onclick="window.deleteContent('${item.id}', 'hw')" class="text-slate-300 hover:text-red-500 p-1"><i class="fas fa-trash text-xs"></i></button>
                         </div>` : ''}
                    </div>
                    <p class="text-slate-600 dark:text-slate-400 text-sm leading-relaxed whitespace-pre-wrap mb-4 font-medium">${item.content}</p>
                    
                    ${generateAttachmentsHtml(item.attachments || [], item.title)}

                    ${(!item.attachments || item.attachments.length === 0) && item.url ? `
                    <button onclick="window.openFileViewer('${item.url}', 'file')" class="inline-flex items-center gap-2 text-brand-primary font-bold text-sm hover:underline">
                        <i class="fas fa-link"></i> View Attachment
                    </button>` : ''}
                </div>
            `).join('');

            contentHtml = `
                <div class="flex justify-between items-center mb-8 fade-in">
                    <h2 class="text-2xl font-bold text-slate-900 dark:text-white font-display">Homework</h2>
                    ${isAdmin ? `<button onclick="window.openContentModal('homework')" class="bg-brand-primary text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-200 hover:bg-blue-600 transition"><i class="fas fa-plus mr-2"></i> New Task</button>` : ''}
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 fade-in">
                    ${items.length ? list : `<div class="col-span-full p-16 text-center bg-slate-50 dark:bg-slate-900/50 rounded-[2rem] border border-dashed border-slate-200 dark:border-slate-700 text-slate-400 font-bold">Great job! No homework found.</div>`}
                </div>`;
        }

        container.innerHTML = header + contentHtml;

        // --- INITIALIZE SORTABLE ---
        if (tabName === 'videos' && isAdmin && items.length > 0) {
            initSortable();
        }

    } catch (e) {
        console.error(e);
        container.innerHTML = (header || '') + `<div class="p-8 text-center text-red-500">Error loading content. <br> <span class="text-xs text-slate-400">${e.message}</span></div>`;
    }
}


export function navigateToFolder(id, breadcrumbIndex = null, title = null, fromHistory = false) {
    if (!fromHistory) {
        history.pushState({ tab: 'videos', folderId: id }, "", `#videos${id ? '/' + id : ''}`);
    }
    withViewTransition(() => {
        if (id === null) { state.currentFolderId = null; state.breadcrumbs = []; }
        else if (breadcrumbIndex !== null) { state.currentFolderId = id; state.breadcrumbs = state.breadcrumbs.slice(0, breadcrumbIndex + 1); }
        else { state.currentFolderId = id; state.breadcrumbs.push({ id, title }); }

        // We use _renderTabInternal directly or just ensure verify we are on video tab?
        // renderTab handles the UI switch, so usually we just want to ensure video tab is active and re-render content
        // BUT calling renderTab would push state again.
        // Let's just manually trigger re-render of current tab (videos)
        _renderTabInternal('videos');
    });
}

export function filterVideoItems(term) {
    const container = document.getElementById('video-sortable-list');
    if (!container) return;

    if (state.sortableInstance) { state.sortableInstance.destroy(); state.sortableInstance = null; }

    const lower = term.toLowerCase();
    const filtered = state.currentItems.filter(i => i.title.toLowerCase().includes(lower));

    if (filtered.length === 0) {
        container.innerHTML = `<div class="col-span-full text-center p-8 text-slate-400">No results found for "${term}".</div>`;
    } else {
        const isAdmin = state.currentUserData.role === 'admin';
        container.innerHTML = filtered.map(item => generateVideoCardHtml(item, isAdmin)).join('');
        if (isAdmin) initSortable();
    }
}

function initSortable() {
    const el = document.getElementById('video-sortable-list');
    if (!el) return;
    state.sortableInstance = new Sortable(el, {
        animation: 150,
        handle: '.drag-handle',
        ghostClass: 'sortable-ghost',
        dragClass: 'sortable-drag',
        onEnd: async function (evt) {
            const newOrderIds = state.sortableInstance.toArray();
            showToast("Saving new order...", "success");
            try {
                const batch = writeBatch(db);
                newOrderIds.forEach((id, index) => {
                    const ref = doc(db, "course_content", id);
                    batch.update(ref, { order: index + 1 });
                });
                await batch.commit();
            } catch (e) { console.error(e); showToast("Error saving order", "error"); }
        }
    });
}

// --- MODAL FUNCTIONS ---
export function toggleContentModal() {
    document.getElementById('content-modal').classList.toggle('hidden');
}

export function toggleSettingsModal() {
    console.log("Settings modal removed.");
}

export function saveSettings() {
    console.log("Settings save removed.");
}

// --- FILE VIEWER FUNCTIONS ---
export function closeFileViewer() {
    const modal = document.getElementById('file-viewer-modal');
    // Check if we are closing via back button (history already popped) or manual click
    // If manual click and we have history state, go back
    if (history.state && history.state.modal === 'fileViewer') {
        history.back(); // This will trigger popstate which closes the modal
        return;
    }

    // Direct close (fallback)
    _closeViewerInternal();
}

// Internal close logic separated for popstate reuse
export function _closeViewerInternal() {
    const modal = document.getElementById('file-viewer-modal');
    const content = document.getElementById('file-viewer-content');
    modal.classList.add('hidden');
    content.innerHTML = '';
}

// Helper to render PDF using PDF.js
async function renderPdfInViewer(url, container) {
    container.innerHTML = '<div class="text-white text-xl font-bold animate-pulse">Loading Document...</div>';

    try {
        const loadingTask = pdfjsLib.getDocument(url);
        const pdf = await loadingTask.promise;

        container.innerHTML = ''; // Clear loading

        const wrapper = document.createElement('div');
        wrapper.className = "w-full h-full overflow-y-auto flex flex-col items-center gap-4 p-4";
        container.appendChild(wrapper);

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const scale = 2.0; // Optimized for mobile/web (approx 200 DPI)
            const viewport = page.getViewport({ scale });

            const canvas = document.createElement('canvas');
            canvas.className = "shadow-lg rounded-lg bg-white max-w-full";
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            // Make it responsive via CSS
            canvas.style.maxWidth = '100%';
            canvas.style.height = 'auto';

            wrapper.appendChild(canvas);

            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };
            await page.render(renderContext).promise;
        }
    } catch (error) {
        console.error("PDF Render Error:", error);
        container.innerHTML = `
            <div class="text-center text-white p-4">
                <div class="text-4xl mb-4 text-red-500"><i class="fas fa-exclamation-circle"></i></div>
                <h3 class="text-xl font-bold mb-2">Error Loading Document</h3>
                <p class="text-slate-400 mb-6 text-sm">${error.message}</p>
                <div class="flex flex-col gap-3">
                    <button onclick="window.closeFileViewer()" class="bg-slate-700 text-white px-6 py-3 rounded-xl font-bold">Cancel</button>
                    <a href="${url}" target="_blank" class="bg-brand-primary text-white px-6 py-3 rounded-xl font-bold">Open as Direct Link</a>
                </div>
            </div>`;
    }
}

export function openFileViewer(url, type = 'file') {
    const modal = document.getElementById('file-viewer-modal');
    const content = document.getElementById('file-viewer-content');

    if (!modal || !content) return;

    // Push State for Back Button Support - Ensure it's unique
    history.pushState({ modal: 'fileViewer', timestamp: Date.now() }, "", "#view-file");

    // Reset content
    content.innerHTML = '';
    modal.classList.remove('hidden');

    // Determine content type based on URL extension if generic 'file' type is passed
    let fileType = type;
    const lowerUrl = url.toLowerCase();

    if (lowerUrl.match(/\.(jpeg|jpg|gif|png|webp|svg)$/)) fileType = 'image';
    else if (lowerUrl.match(/\.(mp4|webm|ogg)$/)) fileType = 'video';
    else if (lowerUrl.match(/\.(pdf)$/)) fileType = 'pdf';

    // Handle YouTube/Video links if not direct file
    if (url.includes('youtube.com') || url.includes('youtu.be')) fileType = 'youtube';

    // Render Content
    if (fileType === 'image') {
        content.innerHTML = `<img src="${url}" class="max-w-full max-h-full object-contain shadow-2xl rounded-lg" alt="Preview">`;
    }
    else if (fileType === 'video') {
        content.innerHTML = `<video controls autoplay class="max-w-full max-h-[85vh] rounded-lg shadow-2xl outline-none">
                    <source src="${url}">
                    Your browser does not support the video tag.
                </video>`;
    }
    else if (fileType === 'youtube') {
        let videoId = "";
        if (url.includes("v=")) videoId = url.split("v=")[1].split("&")[0];
        else if (url.includes("youtu.be/")) videoId = url.split("youtu.be/")[1];

        if (videoId) {
            content.innerHTML = `<iframe class="w-full h-full max-w-4xl aspect-video rounded-xl shadow-2xl" 
                        src="https://www.youtube.com/embed/${videoId}?autoplay=1" 
                        frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen>
                    </iframe>`;
        } else {
            content.innerHTML = `<div class="text-white text-center">
                        <i class="fas fa-exclamation-triangle text-4xl mb-4 text-yellow-400"></i>
                        <p>Invalid YouTube URL</p>
                    </div>`;
        }
    }
    else if (fileType === 'pdf') {
        renderPdfInViewer(url, content);
    }
    else {
        // Fallback for unknown types
        content.innerHTML = `<div class="text-center text-white">
                    <div class="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-6 text-slate-400">
                        <i class="fas fa-eye-slash"></i>
                    </div>
                    <h3 class="text-2xl font-bold mb-2">Preview Not Available</h3>
                    <p class="text-slate-400 mb-6">This file type cannot be previewed directly.</p>
                </div>`;
    }
}

export function openContentModal(type) {
    document.getElementById('content-type').value = type;
    document.getElementById('content-edit-id').value = "";
    document.getElementById('content-title').value = "";
    document.getElementById('content-body').value = "";
    document.getElementById('content-link').value = "";
    document.getElementById('content-order').value = (state.currentItems.length + 1);

    const titleEl = document.getElementById('content-modal-title');
    const labelEl = document.getElementById('content-label');
    const body = document.getElementById('content-body');
    const link = document.getElementById('content-link');

    const fileSection = document.getElementById('file-upload-section');
    const fileInput = document.getElementById('content-file');
    const uploadProgress = document.getElementById('upload-progress');

    body.classList.remove('hidden');
    link.classList.add('hidden');
    fileSection.classList.add('hidden');
    fileInput.value = ""; // Reset file
    const fileLabel = document.getElementById('file-label');
    if (fileLabel) {
        fileLabel.innerText = "Click or drag files here";
        fileLabel.className = "text-xs font-bold";
    }
    document.getElementById('file-list-container').classList.add('hidden');
    document.getElementById('file-list-container').innerHTML = "";
    selectedFilesMap.clear(); // Clear state
    uploadProgress.classList.add('hidden');

    if (type === 'announcement') {
        titleEl.innerText = "New Announcement";
        labelEl.innerText = "Message";
        fileSection.classList.remove('hidden');
    }
    else if (type === 'video') {
        titleEl.innerText = "Add Video";
        labelEl.innerText = "YouTube/Drive URL (Or Upload File)";
        body.classList.add('hidden');
        link.classList.remove('hidden');
        fileSection.classList.remove('hidden');
    }
    else if (type === 'folder') { titleEl.innerText = "Create New Folder"; labelEl.innerText = "Description (Optional)"; body.classList.remove('hidden'); link.classList.add('hidden'); }
    else if (type === 'summary') {
        titleEl.innerText = "Add Summary";
        labelEl.innerText = "PDF/Drive URL (Or Upload File)";
        body.classList.add('hidden');
        link.classList.remove('hidden');
        fileSection.classList.remove('hidden');
    }
    else if (type === 'homework') { titleEl.innerText = "Assign Homework"; labelEl.innerText = "Instructions"; link.classList.remove('hidden'); link.placeholder = "Optional Link (e.g. Worksheet URL)"; }

    toggleContentModal();
}

export function openEditContentModal(itemStr) {
    const item = JSON.parse(decodeURIComponent(itemStr));
    openContentModal(item.type);
    document.getElementById('content-modal-title').innerText = "Edit Content";
    document.getElementById('content-edit-id').value = item.id;
    document.getElementById('content-title').value = item.title;
    document.getElementById('content-body').value = item.content || "";
    document.getElementById('content-link').value = item.url || "";
    document.getElementById('content-order').value = item.order || 1;
}

export async function handleSaveContent() {
    const type = document.getElementById('content-type').value;
    const editId = document.getElementById('content-edit-id').value;
    const title = document.getElementById('content-title').value;
    const body = document.getElementById('content-body').value;
    const url = document.getElementById('content-link').value;
    const fileInput = document.getElementById('content-file');
    const order = parseInt(document.getElementById('content-order').value) || 1;

    let finalUrl = url;

    let attachments = [];

    // Handle File Upload (Batch)
    if (selectedFilesMap.size > 0) {
        // Hardcoded credentials
        const repoId = "Mostafaelkashef/Kashef-files-v2";
        const token = "hf_" + "ipqvtKHcbiiyEdIJucbNaRtpBhjWGRRggW";

        const progressDiv = document.getElementById('upload-progress');
        const progressBar = progressDiv.querySelector('.bg-brand-primary');
        const progressText = progressDiv.querySelector('p');

        progressDiv.classList.remove('hidden');
        progressBar.style.width = '10%';
        progressText.innerText = `Starting upload of ${selectedFilesMap.size} files...`;

        try {
            const uploadPromises = Array.from(selectedFilesMap.values()).map(async (item, index) => {
                const total = selectedFilesMap.size;
                const uploadedUrl = await uploadToHuggingFace(item.file, repoId, token, "course_uploads/");

                // Update progress roughly
                const percent = Math.round(((index + 1) / total) * 100);
                progressBar.style.width = `${percent}%`;

                return {
                    name: item.customName || item.file.name,
                    url: uploadedUrl,
                    type: item.file.type.startsWith('video') ? 'video' : 'file'
                };
            });

            attachments = await Promise.all(uploadPromises);

            // For backward compatibility, set main URL to first attachment if exists
            if (attachments.length > 0) {
                finalUrl = attachments[0].url;
            }

            progressText.innerText = "All Uploads Complete!";
        } catch (err) {
            console.error(err);
            progressDiv.classList.add('hidden');
            return showToast("Upload Failed: " + err.message, "error");
        }
    }



    if (!title) return showToast("Title required", "error");
    if ((type === 'video' || type === 'summary') && !finalUrl) return showToast("URL or File required", "error");

    try {
        const data = {
            courseId: state.activeCourseContext.id,
            subcourseCode: state.activeCourseContext.subcode || null,
            type, title, content: body, url: finalUrl, order,
            attachments: attachments, // New Field
            parentId: state.currentFolderId,
            authorId: state.currentUserData.uid
        };

        if (editId) {
            await updateDoc(doc(db, "course_content", editId), { title, content: body, url, order });
            showToast("Updated successfully");
        } else {
            data.createdAt = new Date().toISOString();
            await addDoc(collection(db, "course_content"), data);
            showToast("Created successfully");
        }
        toggleContentModal();
        const tabMap = { 'announcement': 'home', 'video': 'videos', 'folder': 'videos', 'summary': 'summaries', 'homework': 'hw' };
        renderTab(tabMap[type]);
    } catch (e) { console.error(e); showToast("Error saving content", "error"); }
}

export async function deleteContent(id, currentTab) {
    if (!confirm("Delete this item? If it's a folder, contents might be hidden.")) return;
    try { await deleteDoc(doc(db, "course_content", id)); showToast("Deleted"); renderTab(currentTab); } catch (e) { showToast("Error deleting", "error"); }
}
