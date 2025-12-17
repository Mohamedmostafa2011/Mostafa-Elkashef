import { db } from "./config.js";
import { doc, getDocs, getDoc, query, collection, where, deleteDoc, updateDoc, addDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { state } from "./state.js";
import { showToast, generateVideoCardHtml, setupSubcourseInputs, getSkeletonHtml, withViewTransition } from "./utils.js";
import { renderAdminHome } from "./admin.js";
import { uploadToHuggingFace } from "./hf_storage.js";

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
                        <div class="flex gap-2">
                            <button onclick="window.openEditContentModal('${encodeURIComponent(JSON.stringify(item))}')" class="text-slate-400 hover:text-brand-primary text-xs"><i class="fas fa-pencil-alt"></i></button>
                            <button onclick="window.deleteContent('${item.id}', 'home')" class="text-red-400 hover:text-red-600 text-xs"><i class="fas fa-trash"></i></button>
                        </div>` : ''}
                    </div>
                    <p class="text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">${item.content}</p>
                    ${item.url ? (item.url.match(/\.(jpeg|jpg|gif|png)$/) != null ?
                    `<img src="${item.url}" class="mt-4 rounded-xl max-h-96 w-full object-cover border border-slate-100 dark:border-slate-700" loading="lazy">` :
                    `<div class="mt-4"><a href="${item.url}" target="_blank" class="inline-flex items-center gap-2 bg-slate-50 dark:bg-slate-700 px-4 py-2 rounded-lg text-sm font-bold text-brand-primary hover:bg-slate-100 transition"><i class="fas fa-download"></i> Attached File</a></div>`
                ) : ''}
                    <p class="text-[10px] text-slate-400 mt-4 font-bold uppercase">${new Date(item.createdAt).toLocaleDateString()}</p>
                </div>
            `).join('');

            // Personalize "Up Next" Logic (Mock: Pick first video or latest announcement)
            let upNextHtml = '';
            if (!isAdmin) {
                // Fetch first video to show as "Continue Learning"
                const vQ = query(collection(db, "course_content"), where("courseId", "==", state.activeCourseContext.id), where("type", "==", "video"));
                const vSnap = await getDocs(vQ); // Note: In real app, optimize this query or cache it
                if (!vSnap.empty) {
                    const nextVid = vSnap.docs[0].data();
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
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="font-bold text-lg text-slate-800 dark:text-slate-100">Announcements</h3>
                            ${isAdmin ? `<button onclick="window.openContentModal('announcement')" class="text-sm text-brand-primary font-bold hover:underline">+ New Post</button>` : ''}
                        </div>
                        ${items.length ? posts : `<div class="p-8 text-center bg-slate-50 dark:bg-slate-800 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-slate-400">No announcements yet.</div>`}
                    </div>
                    <div class="bg-brand-primary rounded-2xl p-6 text-white shadow-lg bg-math-grid relative overflow-hidden h-fit">
                        <h3 class="font-bold text-lg relative z-10">Math Info</h3>
                        <p class="text-blue-100 text-sm relative z-10 mt-1">Check videos for latest recordings.</p>
                        <div class="absolute -right-4 -bottom-4 text-6xl opacity-20"><i class="fas fa-clock"></i></div>
                    </div>
                </div>`;
        } else if (tabName === 'videos') {
            let breadcrumbHtml = '';
            if (state.currentFolderId) {
                breadcrumbHtml = `<div class="flex items-center gap-2 mb-2 text-sm font-bold text-slate-500 fade-in">
                    <span onclick="window.navigateToFolder(null)" class="cursor-pointer hover:text-brand-primary">Home</span>
                    ${state.breadcrumbs.map((b, i) => `
                        <i class="fas fa-chevron-right text-[10px]"></i>
                        <span onclick="window.navigateToFolder('${b.id}', ${i})" class="cursor-pointer hover:text-brand-primary">${b.title}</span>
                    `).join('')}
                </div>`;
            }

            const grid = items.map(item => generateVideoCardHtml(item, isAdmin)).join('');

            contentHtml = `
                ${breadcrumbHtml}
                <div class="flex flex-col md:flex-row justify-between items-center mb-6 fade-in gap-4">
                    <h2 class="text-xl font-bold text-slate-800">${state.currentFolderId ? 'Folder Contents' : 'Videos & Folders'}</h2>
                    
                    <div class="flex gap-2 w-full md:w-auto items-center">
                        <div class="relative flex-1 md:w-64">
                            <i class="fas fa-search absolute left-3 top-3 text-slate-400 text-xs"></i>
                            <input type="text" oninput="window.filterVideoItems(this.value)" placeholder="Search here..." class="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold focus:border-brand-primary outline-none focus:ring-2 focus:ring-brand-light transition">
                        </div>
                    
                        ${isAdmin ? `
                        <div class="flex gap-2 shrink-0">
                            <button onclick="window.openContentModal('folder')" class="bg-yellow-100 text-yellow-700 px-3 py-2 rounded-lg font-bold text-sm hover:bg-yellow-200 transition"><i class="fas fa-folder-plus"></i></button>
                            <button onclick="window.openContentModal('video')" class="bg-brand-primary text-white px-3 py-2 rounded-lg font-bold text-sm shadow-lg shadow-blue-200 hover:bg-blue-600 transition"><i class="fas fa-upload"></i></button>
                        </div>` : ''}
                    </div>
                </div>
                ${items.length ? `<div id="video-sortable-list" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 fade-in">${grid}</div>` :
                    `<div class="bg-white rounded-2xl p-10 text-center border border-slate-100 shadow-sm"><div class="inline-block p-4 bg-slate-50 rounded-full text-slate-300 mb-3"><i class="fas fa-folder-open text-2xl"></i></div><p class="text-slate-500">This folder is empty.</p></div>`}
            `;
        } else if (tabName === 'summaries') {
            const list = items.map(item => `
                <div class="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl hover:border-brand-primary/30 transition group">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-lg bg-red-50 text-red-500 flex items-center justify-center text-lg"><i class="fas fa-file-pdf"></i></div>
                        <div>
                            <h4 class="font-bold text-slate-800">${item.title}</h4>
                            <p class="text-xs text-slate-500">${new Date(item.createdAt).toLocaleDateString()}</p>
                        </div>
                    </div>
                    <div class="flex gap-2">
                        <a href="${item.url}" target="_blank" class="px-4 py-2 bg-slate-50 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-100">View</a>
                        ${isAdmin ? `
                        <button onclick="window.openEditContentModal('${encodeURIComponent(JSON.stringify(item))}')" class="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-brand-primary rounded-lg border border-slate-100"><i class="fas fa-pencil-alt"></i></button>
                        <button onclick="window.deleteContent('${item.id}', 'summaries')" class="w-9 h-9 flex items-center justify-center text-red-400 hover:bg-red-50 rounded-lg"><i class="fas fa-trash"></i></button>` : ''}
                    </div>
                </div>
            `).join('');
            contentHtml = `
                <div class="flex justify-between items-center mb-6 fade-in">
                    <h2 class="text-xl font-bold text-slate-800">Class Summaries</h2>
                    ${isAdmin ? `<button onclick="window.openContentModal('summary')" class="bg-brand-dark text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-slate-700 transition"><i class="fas fa-file-upload mr-2"></i> Add PDF Link</button>` : ''}
                </div>
                <div class="space-y-3 fade-in">
                    ${items.length ? list : `<div class="text-center p-8 text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">No summaries found.</div>`}
                </div>`;
        } else if (tabName === 'hw') {
            const list = items.map(item => `
                <div class="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition relative">
                    ${isAdmin ? `
                    <div class="absolute top-4 right-4 flex gap-2">
                        <button onclick="window.openEditContentModal('${encodeURIComponent(JSON.stringify(item))}')" class="text-slate-300 hover:text-brand-primary"><i class="fas fa-pencil-alt"></i></button>
                        <button onclick="window.deleteContent('${item.id}', 'hw')" class="text-slate-300 hover:text-red-500"><i class="fas fa-trash"></i></button>
                    </div>` : ''}
                    <div class="flex items-start gap-4">
                        <div class="w-12 h-12 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center text-xl shrink-0"><i class="fas fa-pencil-alt"></i></div>
                        <div class="flex-1">
                            <h4 class="font-bold text-slate-800 text-lg mb-1">${item.title}</h4>
                            <p class="text-slate-600 text-sm mb-3 whitespace-pre-wrap">${item.content}</p>
                            ${item.url ? `<a href="${item.url}" target="_blank" class="inline-flex items-center text-brand-primary font-bold text-sm hover:underline"><i class="fas fa-link mr-1"></i> Attached Resource</a>` : ''}
                        </div>
                    </div>
                </div>
            `).join('');
            contentHtml = `
                <div class="flex justify-between items-center mb-6 fade-in">
                    <h2 class="text-xl font-bold text-slate-800">Homework & Tasks</h2>
                    ${isAdmin ? `<button onclick="window.openContentModal('homework')" class="bg-brand-primary text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-600 transition"><i class="fas fa-plus mr-2"></i> New Task</button>` : ''}
                </div>
                <div class="space-y-4 fade-in">
                    ${items.length ? list : `<div class="text-center p-8 text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">No active homework.</div>`}
                </div>`;
        }
        container.innerHTML = header + contentHtml;

        // --- INITIALIZE SORTABLE ---
        if (tabName === 'videos' && isAdmin && items.length > 0) {
            initSortable();
        }

    } catch (e) {
        console.error(e);
        container.innerHTML = header + `<div class="p-8 text-center text-red-500">Error loading content. <br> <span class="text-xs text-slate-400">${e.message}</span></div>`;
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

    // Handle File Upload
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        // Hardcoded credentials (Hidden from settings UI)
        const repoId = "Mostafaelkashef/Kashef-files";
        const token = "hf_" + "ipqvtKHcbiiyEdIJucbNaRtpBhjWGRRggW";

        const progressDiv = document.getElementById('upload-progress');
        const progressBar = progressDiv.querySelector('.bg-brand-primary');
        const progressText = progressDiv.querySelector('p');

        progressDiv.classList.remove('hidden');
        progressText.innerText = `Uploading ${file.name}...`;
        progressBar.style.width = '30%'; // Fake progress for start

        try {
            finalUrl = await uploadToHuggingFace(file, repoId, token, "course_uploads/");
            progressBar.style.width = '100%';
            progressText.innerText = "Upload Complete!";
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
