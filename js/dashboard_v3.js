import { db } from "./config.js";
import { doc, getDocs, getDoc, query, collection, where, deleteDoc, updateDoc, addDoc, writeBatch, setDoc, increment } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
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

    // Updated Navigation: Home + 6 New Sections
    document.getElementById('nav-links').innerHTML = `
        ${backBtn}
        <div class="px-4 mb-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Course Menu</div>
        <button onclick="window.renderTab('home')" class="nav-item tab-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm mb-1"><i class="fas fa-home w-5 text-center"></i> Home</button>
        
        <div class="my-2 border-t border-slate-100 dark:border-slate-800 mx-4"></div>
        
        <button onclick="window.renderTab('content')" class="nav-item tab-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm mb-1"><i class="fas fa-book-open w-5 text-center"></i> Content</button>
        <button onclick="window.renderTab('homework')" class="nav-item tab-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm mb-1"><i class="fas fa-pencil-alt w-5 text-center"></i> Homework</button>
        <button onclick="window.renderTab('summary')" class="nav-item tab-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm mb-1"><i class="fas fa-list-alt w-5 text-center"></i> Summary</button>
        <button onclick="window.renderTab('classified')" class="nav-item tab-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm mb-1"><i class="fas fa-layer-group w-5 text-center"></i> Classified</button>
        <button onclick="window.renderTab('revision')" class="nav-item tab-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm mb-1"><i class="fas fa-undo w-5 text-center"></i> Final Revision</button>
        <button onclick="window.renderTab('papers')" class="nav-item tab-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm mb-1"><i class="fas fa-scroll w-5 text-center"></i> Past Papers</button>
        
        ${studentsTab}
    `;
    renderTab('home');
}

export async function renderTab(tabName, fromHistory = false) {
    if (!fromHistory) {
        history.pushState({ tab: tabName }, "", `#${tabName}`);
    }
    state.activeTab = tabName; // Track active tab for navigation
    withViewTransition(async () => {
        _renderTabInternal(tabName);
    });
}

async function _renderTabInternal(tabName) {
    // Cleanup previous sortable
    if (state.sortableInstance) { state.sortableInstance.destroy(); state.sortableInstance = null; }

    document.querySelectorAll('.tab-btn').forEach(b => {
        b.className = (b.getAttribute('onclick') && b.getAttribute('onclick').includes(tabName))
            ? "nav-item tab-btn w-full flex items-center gap-3 px-4 py-3 bg-brand-light text-brand-primary rounded-xl font-bold text-sm mb-1 transition-colors"
            : "nav-item tab-btn w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium text-sm mb-1 transition-colors";
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
        // --- PROFILE TAB ---
        if (tabName === 'profile') {
            const u = state.currentUserData;
            const joinedDate = u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A';
            const initials = u.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

            contentHtml = `
                <div class="max-w-2xl mx-auto py-8 fade-in">
                    <!-- Profile Card -->
                    <div class="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-2xl overflow-hidden relative">
                        <!-- Header Background -->
                        <div class="h-32 bg-gradient-to-r from-blue-600 to-purple-600 relative overflow-hidden">
                            <div class="absolute inset-0 opacity-20" style="background-image: url('https://www.transparenttextures.com/patterns/cubes.png');"></div>
                            <div class="absolute -bottom-16 -right-16 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
                        </div>

                        <div class="px-8 pb-10 relative">
                            <!-- Avatar -->
                            <div class="flex justify-center -mt-16 mb-6">
                                <div class="w-32 h-32 rounded-full bg-white dark:bg-slate-800 p-1.5 shadow-2xl relative">
                                    <div class="w-full h-full rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-4xl font-black font-display shadow-inner">
                                        ${initials}
                                    </div>
                                    <div class="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-green-500 border-4 border-white dark:border-slate-800 shadow-lg" title="Online"></div>
                                </div>
                            </div>

                            <!-- Identity -->
                            <div class="text-center mb-10">
                                <h2 class="text-3xl font-black text-slate-900 dark:text-white font-display tracking-tight">${u.name}</h2>
                                <div class="flex items-center justify-center gap-2 mt-2">
                                    <span class="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-brand-primary text-[10px] font-black uppercase tracking-widest rounded-full border border-blue-100 dark:border-blue-800/50">
                                        ${u.role === 'admin' ? 'Instructor' : 'Student'}
                                    </span>
                                    <span class="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-widest">• Joined ${joinedDate}</span>
                                </div>
                            </div>

                            <!-- Details Grid -->
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
                                <div class="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-700/50 group hover:border-brand-primary/30 transition-colors">
                                    <p class="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <i class="fas fa-phone-alt text-brand-primary"></i> Contact
                                    </p>
                                    <p class="font-bold text-slate-700 dark:text-slate-200">${u.phone}</p>
                                </div>
                                <div class="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-700/50 group hover:border-brand-primary/30 transition-colors">
                                    <p class="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <i class="fas fa-graduation-cap text-purple-500"></i> Course Enrollment
                                    </p>
                                    <p class="font-bold text-slate-700 dark:text-slate-200 line-clamp-1">${u.courseTitle || state.activeCourseContext.title || 'N/A'}</p>
                                </div>
                                <div class="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-700/50 group hover:border-brand-primary/30 transition-colors sm:col-span-2">
                                    <p class="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <i class="fas fa-users text-amber-500"></i> Group / Sub-course
                                    </p>
                                    <p class="font-bold text-slate-700 dark:text-slate-200">${u.subcourseCode || 'Global'}</p>
                                </div>
                            </div>

                            <!-- Actions -->
                            <div class="flex flex-col sm:flex-row gap-3 pt-6 border-t border-slate-50 dark:border-slate-800">
                                <button onclick="window.renderTab('home')" class="flex-1 px-6 py-4 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-slate-800 transition shadow-xl active:scale-[0.98]">
                                    Return to Home
                                </button>
                                <button onclick="document.getElementById('logout-btn').click()" class="flex-1 px-6 py-4 bg-red-50 text-red-600 border border-red-100 rounded-2xl font-bold text-sm hover:bg-red-100 transition active:scale-[0.98]">
                                    Log Out Account
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <p class="text-center mt-8 text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em]">Mostafa Elkashef • Learning Platform</p>
                </div>`;

            container.innerHTML = contentHtml;
            return;
        }

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

        // --- NEW HOME (SHORTCUTS 6 SECTIONS) ---
        if (tabName === 'home') {
            const sections = [
                { id: 'content', title: 'Content', icon: 'fa-book-open', color: 'blue', desc: 'Course materials & lessons' },
                { id: 'homework', title: 'Homework', icon: 'fa-pencil-alt', color: 'indigo', desc: 'Assignments & tasks' },
                { id: 'summary', title: 'Summary', icon: 'fa-list-alt', color: 'emerald', desc: 'Quick reviews & notes' },
                { id: 'classified', title: 'Classified', icon: 'fa-layer-group', color: 'amber', desc: 'Topic-based questions' },
                { id: 'revision', title: 'Final Revision', icon: 'fa-undo', color: 'rose', desc: 'Exam prep material' },
                { id: 'papers', title: 'Past Papers', icon: 'fa-scroll', color: 'slate', desc: 'Previous exams' }
            ];

            const gridHtml = sections.map(s => `
                <div onclick="window.renderTab('${s.id}')" class="group relative bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-700 shadow-lg hover:shadow-2xl hover:scale-[1.02] transition-all cursor-pointer overflow-hidden flex flex-col justify-between h-48">
                    <div class="absolute inset-0 bg-gradient-to-br from-${s.color}-50 to-white dark:from-slate-800 dark:to-slate-900 opacity-50 group-hover:opacity-100 transition-opacity"></div>
                    
                    <div class="relative z-10 flex justify-between items-start">
                        <div class="w-14 h-14 bg-${s.color}-100 dark:bg-${s.color}-900/30 text-${s.color}-600 dark:text-${s.color}-400 rounded-2xl flex items-center justify-center text-2xl shadow-sm group-hover:rotate-6 transition-transform duration-300">
                            <i class="fas ${s.icon}"></i>
                        </div>
                        <div class="w-8 h-8 rounded-full bg-white dark:bg-slate-700 flex items-center justify-center text-slate-300 group-hover:text-${s.color}-500 transition shadow-sm">
                            <i class="fas fa-arrow-right text-xs"></i>
                        </div>
                    </div>

                    <div class="relative z-10 mt-4">
                        <h2 class="text-2xl font-black text-slate-900 dark:text-white font-display tracking-tight">${s.title}</h2>
                        <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">${s.desc}</p>
                    </div>
                </div>
            `).join('');

            container.innerHTML = header + `
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 fade-in pb-10">
                    ${gridHtml}
                </div>
            `;
            return;
        }

        // --- SECTION CONTENT TABS ---
        const validSections = ['content', 'homework', 'summary', 'classified', 'revision', 'papers', 'videos', 'files']; // Added legacy for safety
        if (validSections.includes(tabName)) {

            // Query: Fetch ALL items for this course
            // We filter by 'section' client-side or add 'section' to query if indexed
            // For now, let's query all and filter in JS to avoid index requirements immediately, 
            // unless list is huge.
            // BETTER: Query by section if possible. 
            // Let's assume we will add 'section' field to all new items.
            // For legacy items (videos/files tabs), we might need migration or fallback.

            const q = query(collection(db, "course_content"), where("courseId", "==", state.activeCourseContext.id));
            const snap = await getDocs(q);
            let items = [];

            snap.forEach(d => {
                const data = d.data();
                if (data.subcourseCode && data.subcourseCode !== state.activeCourseContext.subcode) return;

                // --- FILTERING LOGIC ---
                // If item has 'section', match it.
                // If item has NO 'section', map legacy types:
                // 'video' -> 'videos' (legacy tab) -> maybe map to 'content'?
                // 'file' -> 'files' (legacy tab) -> maybe map to 'content'?
                // User said "remove videos and files sections but keep the creating...".
                // This implies old content might be lost or needs to be shown somewhere.
                // Let's assume OLD content (no section) shows in 'content' tab by default? 
                // OR we just hide it until migrated.
                // Safest: strict section match. If new item, it has section. 

                let itemSection = data.section;

                // Legacy Fallback (optional, can be removed if we want clean slate)
                if (!itemSection) {
                    if (data.type === 'video') itemSection = 'content'; // Map legacy videos to Content?
                    if (data.type === 'file') itemSection = 'content';  // Map legacy files to Content?
                    if (data.type === 'folder') itemSection = 'content';
                }

                if (itemSection !== tabName) return;

                // Folder Navigation Logic
                if (state.currentFolderId === null) {
                    if (data.parentId) return;
                } else {
                    if (data.parentId !== state.currentFolderId) return;
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

            let breadcrumbHtml = '';
            if (state.currentFolderId) {
                breadcrumbHtml = `<div class="flex items-center gap-2 mb-6 text-sm font-bold text-slate-500 fade-in px-1">
                    <span onclick="window.navigateToFolder(null)" class="cursor-pointer hover:text-brand-primary transition flex items-center gap-1"><i class="fas fa-level-up-alt"></i> Back to Root</span>
                    ${state.breadcrumbs.map((b, i) => `
                        <i class="fas fa-chevron-right text-[10px] opacity-30"></i>
                        <span class="opacity-50">${b.title}</span>
                    `).join('')}
                </div>`;
            }

            const grid = items.map(item => generateVideoCardHtml(item, isAdmin)).join('');

            const sectionConfig = {
                'content': { title: 'Way to Content', icon: 'fa-book-open' },
                'homework': { title: 'Homework Assignments', icon: 'fa-pencil-alt' },
                'summary': { title: 'Summaries', icon: 'fa-list-alt' },
                'classified': { title: 'Classified Questions', icon: 'fa-layer-group' },
                'revision': { title: 'Final Revision', icon: 'fa-undo' },
                'papers': { title: 'Past Papers', icon: 'fa-scroll' },
                'videos': { title: 'Videos (Legacy)', icon: 'fa-video' },
                'files': { title: 'Files (Legacy)', icon: 'fa-folder' }
            };

            const conf = sectionConfig[tabName] || { title: 'Section', icon: 'fa-folder' };
            const sectionTitle = state.currentFolderId ? 'Folder Contents' : conf.title;

            contentHtml = `
                ${breadcrumbHtml}
                <div class="flex flex-col md:flex-row justify-between items-center mb-8 fade-in gap-4 sticky top-20 z-20 bg-surface/95 dark:bg-slate-950/95 backdrop-blur py-2">
                    <h2 class="text-2xl font-bold text-slate-900 dark:text-white font-display flex items-center gap-3">
                        ${!state.currentFolderId ? `<div class="w-10 h-10 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center text-lg"><i class="fas ${conf.icon}"></i></div>` : ''}
                        ${sectionTitle}
                    </h2>
                    
                    <div class="flex gap-2 w-full md:w-auto items-center">
                        <div class="relative flex-1 md:w-64">
                            <i class="fas fa-search absolute left-3 top-2.5 text-slate-400 text-xs"></i>
                            <input type="text" oninput="window.filterVideoItems(this.value)" placeholder="Search..." class="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:border-brand-primary outline-none focus:ring-4 focus:ring-brand-primary/5 transition">
                        </div>
                    
                        ${isAdmin ? `
                        <div class="flex gap-2 shrink-0">
                            <!-- New Folder -->
                            <button onclick="window.openContentModal('folder', '${tabName}')" class="h-10 w-10 flex items-center justify-center bg-amber-50 text-amber-600 rounded-xl font-bold hover:bg-amber-100 transition border border-amber-100" title="New Folder"><i class="fas fa-folder-plus"></i></button>
                            
                            <!-- New Video -->
                            <button onclick="window.openContentModal('video', '${tabName}')" class="h-10 w-10 flex items-center justify-center bg-blue-50 text-blue-600 rounded-xl font-bold hover:bg-blue-100 transition border border-blue-100" title="Add Video"><i class="fas fa-video"></i></button>
                            
                            <!-- New File -->
                            <button onclick="window.openContentModal('file', '${tabName}')" class="h-10 w-10 flex items-center justify-center bg-emerald-50 text-emerald-600 rounded-xl font-bold hover:bg-emerald-100 transition border border-emerald-100" title="Add File"><i class="fas fa-file-upload"></i></button>
                        </div>` : ''}
                    </div>
                </div>
                
                ${items.length ? `<div id="video-sortable-list" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 fade-in px-0.5 pb-20">${grid}</div>` :
                    `<div class="bg-white dark:bg-slate-800 rounded-[2rem] p-16 text-center border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col items-center justify-center opacity-60">
                        <div class="w-20 h-20 bg-slate-50 dark:bg-slate-700/50 rounded-full flex items-center justify-center text-slate-300 mb-4 text-3xl"><i class="fas fa-wind"></i></div>
                        <p class="text-slate-500 font-bold">This section is empty.</p>
                    </div>`}
            `;
            container.innerHTML = header + contentHtml;
            if (isAdmin && items.length > 0) initSortable();
            return;
        }

    } catch (e) {
        console.error(e);
        container.innerHTML = (header || '') + `<div class="p-8 text-center text-red-500">Error loading content. <br> <span class="text-xs text-slate-400">${e.message}</span></div>`;
    }
}


export function navigateToFolder(id, breadcrumbIndex = null, title = null, fromHistory = false) {
    if (!fromHistory) {
        const currentTab = state.activeTab || 'content';
        history.pushState({ tab: currentTab, folderId: id, folderTitle: title }, "", `#${currentTab}${id ? '/' + id : ''}`);
    }

    withViewTransition(() => {
        if (id === null) {
            state.currentFolderId = null;
            state.breadcrumbs = [];
        } else {
            state.currentFolderId = id;
            // If explicit index is provided (from breadcrumb click)
            if (breadcrumbIndex !== null) {
                state.breadcrumbs = state.breadcrumbs.slice(0, breadcrumbIndex + 1);
            } else {
                // Check if already in breadcrumbs to prevent duplicates on back/forward
                const existingIndex = state.breadcrumbs.findIndex(b => b.id === id);
                if (existingIndex !== -1) {
                    state.breadcrumbs = state.breadcrumbs.slice(0, existingIndex + 1);
                    // Update title if it was null before but we have it now
                    if (title && !state.breadcrumbs[existingIndex].title) {
                        state.breadcrumbs[existingIndex].title = title;
                    }
                } else if (title) {
                    // Only push if we have a valid title
                    state.breadcrumbs.push({ id, title });
                }
            }
        }
        _renderTabInternal(state.activeTab || 'content');
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

    // Stop Tracking
    if (typeof playbackInterval !== 'undefined' && playbackInterval) {
        clearInterval(playbackInterval);
        playbackInterval = null;
    }
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
    else if (url.includes('drive.google.com')) fileType = 'drive';

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
    else if (fileType === 'drive') {
        let embedUrl = url;
        // Transform standard view/edit links to preview links for embedding
        if (url.includes('/view')) embedUrl = url.replace('/view', '/preview');
        else if (url.includes('/edit')) embedUrl = url.replace('/edit', '/preview');
        else if (!url.includes('/preview')) {
            // Fallback for raw IDs or other formats
            const match = url.match(/\/d\/([^/]+)/);
            if (match) embedUrl = `https://drive.google.com/file/d/${match[1]}/preview`;
        }

        content.innerHTML = `<iframe src="${embedUrl}" class="w-full h-full max-w-4xl aspect-video rounded-xl shadow-2xl bg-black" frameborder="0" allow="autoplay"></iframe>`;
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
                    <a href="${url}" target="_blank" class="bg-brand-primary text-white px-6 py-3 rounded-xl font-bold inline-flex items-center gap-2 hover:bg-brand-dark transition-colors">
                        <i class="fas fa-download"></i> Download / Open File
                    </a>
                </div>`;
    }

    // --- ANALYTICS TRACKING START ---
    if (state.currentUserData.role !== 'admin') {
        // Only track for VIDEO types
        if (fileType === 'video' || fileType === 'youtube') {
            startVideoTracking(url);
        }
    }
}

// --- VIDEO ANALYTICS LOGIC ---
let playbackInterval = null;
let currentTrackingVideoUrl = null;
let lastVideoTime = 0;

function startVideoTracking(videoUrl) {
    if (playbackInterval) clearInterval(playbackInterval);
    currentTrackingVideoUrl = videoUrl;
    lastVideoTime = 0;

    // Find the video element if it exists (Native Video)
    setTimeout(() => {
        const videoEl = document.querySelector('#file-viewer-content video');
        if (videoEl) {
            videoEl.addEventListener('timeupdate', () => {
                const currentTime = videoEl.currentTime;
                const duration = videoEl.duration;
                if (currentTime > lastVideoTime) {
                    const diff = currentTime - lastVideoTime;
                    if (diff < 2) { // Only count normal playback, not skips
                        updateVideoProgress(videoUrl, diff, currentTime, duration);
                    }
                }
                lastVideoTime = currentTime;
            });

            videoEl.addEventListener('ended', () => {
                updateVideoProgress(videoUrl, 0, videoEl.duration, videoEl.duration, true);
            });
        }

        // For others (YouTube/Drive/PDF), we can only track "Time Spent Open" roughly
        // or just mark as "Viewed"
        if (!videoEl) {
            updateVideoProgress(videoUrl, 0, 0, 0); // Just mark opened
            playbackInterval = setInterval(() => {
                const viewer = document.getElementById('file-viewer-modal');
                if (!viewer.classList.contains('hidden')) {
                    updateVideoProgress(videoUrl, 5, 0, 0); // Add 5 seconds every 5 seconds
                } else {
                    clearInterval(playbackInterval);
                }
            }, 5000);
        }
    }, 1000);
}

async function updateVideoProgress(url, secondsWatched, currentPos, duration, isCompleted = false) {
    if (!state.currentUserData || state.currentUserData.role === 'admin') return;

    // We need a stable ID. URL is okay if it's unique.
    // Ideally we match it to the course content ID.
    // Let's try to find the item ID from state.currentItems if possible
    let itemId = null;
    if (state.currentItems) {
        const item = state.currentItems.find(i => i.url === url || (i.attachments && i.attachments.some(a => a.url === url)));
        if (item) itemId = item.id;
    }

    if (!itemId) itemId = btoa(url).slice(0, 20); // Fallback ID from URL

    const analyticsId = `${itemId}_${state.currentUserData.uid}`;
    const docRef = doc(db, "video_analytics", analyticsId);

    try {
        await setDoc(docRef, {
            videoId: itemId,
            videoTitle: currentTrackingVideoUrl, // We might want a better title
            userId: state.currentUserData.uid,
            userName: state.currentUserData.name,
            lastUpdated: new Date().toISOString(),
            isCompleted: isCompleted,
            secondsWatched: increment(secondsWatched),
            lastPosition: currentPos || 0,
            duration: duration || 0
        }, { merge: true });
    } catch (e) {
        console.error("Analytics Error:", e);
    }
}


export function openContentModal(type, section = null) {
    document.getElementById('content-type').value = type;
    // We reuse content-topic-no field to temporarily store the 'section' if needed, OR we can add a hidden field.
    // Let's add a hidden field for section.
    let sectionInput = document.getElementById('content-section');
    if (!sectionInput) {
        // Create if doesn't exist (hacky but works if we don't want to edit HTML)
        sectionInput = document.createElement('input');
        sectionInput.type = 'hidden';
        sectionInput.id = 'content-section';
        document.getElementById('content-modal').querySelector('div.p-6').appendChild(sectionInput);
    }
    sectionInput.value = section || state.activeTab || 'content'; // Default to active tab

    document.getElementById('content-edit-id').value = "";
    document.getElementById('content-title').value = "";
    document.getElementById('content-body').value = "";
    document.getElementById('content-link').value = "";
    document.getElementById('content-topic-no').value = "";
    document.getElementById('content-topic-title').value = "";
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

    const topicFields = document.getElementById('topic-fields');
    if (topicFields) topicFields.classList.add('hidden');

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
        if (topicFields) topicFields.classList.remove('hidden');
    }
    else if (type === 'file') {
        titleEl.innerText = "Add File";
        labelEl.innerText = "Upload File";
        body.classList.add('hidden'); // No body text for files, usually
        link.classList.add('hidden');
        fileSection.classList.remove('hidden');
        if (topicFields) topicFields.classList.remove('hidden'); // Enable "Old Thumbnail" fields
    }
    else if (type === 'folder') {
        titleEl.innerText = "Create New Folder";
        labelEl.innerText = "Description (Hidden)";
        body.classList.add('hidden'); // HIDE description as requested
        link.classList.add('hidden');

        // Enable "Old Thumbnail" fields for Folders too
        if (topicFields) topicFields.classList.remove('hidden');

        // Optional: Allow uploading a cover image for the folder? 
        // User asked for "thumbnails as videos and files". 
        // Converting folder to support file upload (cover image) might be good, 
        // but let's stick to Topic Fields first as that's the "old thumbnail creating".
        // Let's enable file upload just in case they want a cover image.
        fileSection.classList.remove('hidden');
        if (fileLabel) fileLabel.innerText = "Upload Cover Image (Optional)";
    }

    toggleContentModal();
}

export function openEditContentModal(itemStr) {
    const item = JSON.parse(decodeURIComponent(itemStr));
    openContentModal(item.type, item.section); // PASS SECTION TO TRIGGER UI HIDE/SHOW LOGIC
    document.getElementById('content-modal-title').innerText = "Edit Content";
    document.getElementById('content-edit-id').value = item.id;
    document.getElementById('content-title').value = item.title;
    document.getElementById('content-body').value = item.content || "";
    document.getElementById('content-link').value = item.url || "";
    document.getElementById('content-topic-no').value = item.topicNo || "";
    document.getElementById('content-topic-title').value = item.topicTitle || "";
    document.getElementById('content-order').value = item.order || 1;
}

export async function handleSaveContent() {
    const type = document.getElementById('content-type').value;
    const section = document.getElementById('content-section').value;
    const editId = document.getElementById('content-edit-id').value;
    const title = document.getElementById('content-title').value;
    const body = document.getElementById('content-body').value;
    const url = document.getElementById('content-link').value;
    const topicNo = document.getElementById('content-topic-no').value;
    const topicTitle = document.getElementById('content-topic-title').value;
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
    if ((type === 'video' || type === 'summary' || type === 'file') && !finalUrl) return showToast("URL or File required", "error");

    try {
        const data = {
            courseId: state.activeCourseContext.id,
            subcourseCode: state.activeCourseContext.subcode || null,
            title, content: body, url: finalUrl, order,
            attachments: attachments,
            section: section, // Save Section
            parentId: state.currentFolderId,
            authorId: state.currentUserData.uid
        };

        if (editId) {
            await updateDoc(doc(db, "course_content", editId), {
                title, content: body, url: finalUrl, order,
                topicNo, topicTitle, section: section
            });
            showToast("Updated successfully");
        } else {
            data.createdAt = new Date().toISOString();
            data.topicNo = topicNo;
            data.topicTitle = topicTitle;
            await addDoc(collection(db, "course_content"), data);
            showToast("Created successfully");
        }
        toggleContentModal();

        // Redirect logic
        renderTab(section);
    } catch (e) { console.error(e); showToast("Error saving content", "error"); }
}

export async function deleteContent(id, currentTab) {
    if (!confirm("Delete this item? If it's a folder, contents might be hidden.")) return;
    try { await deleteDoc(doc(db, "course_content", id)); showToast("Deleted"); renderTab(currentTab); } catch (e) { showToast("Error deleting", "error"); }
}

// Global Assignments for HTML Event Handlers
window.renderTab = renderTab;
window.handleHeaderProfileClick = () => {
    if (state.currentUserData?.role !== 'admin') {
        window.renderTab('profile');
    }
};
window.openCourseDashboard = openCourseDashboard;
window.navigateToFolder = navigateToFolder;
window.filterVideoItems = filterVideoItems;
window.toggleContentModal = toggleContentModal;
window.openContentModal = openContentModal;
window.openEditContentModal = openEditContentModal;
window.handleSaveContent = handleSaveContent;
window.deleteContent = deleteContent;
window.toggleSettingsModal = toggleSettingsModal;
window.saveSettings = saveSettings;
window.openFileViewer = openFileViewer;
window.closeFileViewer = closeFileViewer;
window._closeViewerInternal = _closeViewerInternal;
