import { db } from "./config.js";
import { doc, getDocs, getDoc, query, collection, where, deleteDoc, updateDoc, addDoc, writeBatch, setDoc, increment } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { state } from "./state.js";
import { showToast, generateVideoCardHtml, setupSubcourseInputs, getSkeletonHtml, withViewTransition, generateAttachmentsHtml } from "./utils_v7.js?v=7";
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


// --- DASHBOARD: COURSE SELECTION (Multi-Course Support) ---
export async function renderCourseSelection(courseIds) {
    const container = document.getElementById('main-view');
    // Hide sidebar on selection screen for students
    if (state.currentUserData.role !== 'admin') {
        document.getElementById('sidebar').classList.add('-translate-x-full');
        document.getElementById('mobile-overlay').classList.add('hidden');
    }

    container.innerHTML = getSkeletonHtml(3);

    let courses = [];
    for (const id of courseIds) {
        const snap = await getDoc(doc(db, "courses", id));
        if (snap.exists()) courses.push({ id, ...snap.data() });
    }

    const cards = courses.map(c => `
        <div onclick="window.openCourseDashboard('${c.id}', '${c.title}', '${state.currentUserData.subcourseCode}')" 
             class="group relative bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-700 shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all cursor-pointer overflow-hidden flex flex-col justify-between h-64">
            <div class="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-600/10 opacity-50 group-hover:opacity-100 transition-opacity"></div>
            
            <div class="relative z-10">
                <div class="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center text-3xl shadow-sm mb-4">
                    <i class="fas fa-graduation-cap"></i>
                </div>
                <h2 class="text-2xl font-black text-slate-900 dark:text-white font-display tracking-tight line-clamp-2">${c.title}</h2>
            </div>

            <div class="relative z-10 flex justify-between items-center mt-4">
                <span class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border border-slate-100 dark:border-slate-700 px-3 py-1 rounded-full bg-white/50 dark:bg-slate-800/50">Enter Course</span>
                <div class="w-10 h-10 rounded-full bg-brand-primary text-white flex items-center justify-center shadow-lg group-hover:translate-x-1 transition-transform">
                    <i class="fas fa-arrow-right"></i>
                </div>
            </div>
        </div>
    `).join('');

    container.innerHTML = `
        <div class="max-w-6xl mx-auto py-10 fade-in">
            <div class="mb-12 text-center">
                <h1 class="text-4xl font-black text-slate-900 dark:text-white font-display tracking-tight mb-2">My Courses</h1>
                <p class="text-slate-500 font-bold uppercase tracking-widest text-xs">Select a course to continue</p>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                ${cards}
            </div>
        </div>
    `;

    // Hide sidebar content when on selection screen
    document.getElementById('nav-links').innerHTML = `
        <div class="p-6 text-center">
            <p class="text-slate-400 text-xs font-bold uppercase tracking-widest">Select a course</p>
        </div>
    `;
}

// --- DASHBOARD: NAVIGATION ---
export function openCourseDashboard(id, title, subcode) {
    state.activeCourseContext = { id, title, subcode };
    state.currentFolderId = null;
    state.breadcrumbs = [];

    const isAdmin = state.currentUserData.role === 'admin';
    let topAction = '';

    if (isAdmin) {
        topAction = `<button onclick="window.renderAdminHome()" class="nav-item w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-50 rounded-xl font-bold text-sm mb-6"><i class="fas fa-arrow-left"></i> Back to Hub</button>`;
    } else {
        topAction = `<button onclick="window.switchToCourseSelection()" class="nav-item w-full flex items-center gap-3 px-4 py-3 text-brand-primary bg-blue-50 hover:bg-blue-100 rounded-xl font-bold text-sm mb-6"><i class="fas fa-th-large"></i> Back to Dashboard</button>`;
    }

    // Updated Navigation: Home + 6 New Sections + Students
    document.getElementById('nav-links').innerHTML = `
        ${topAction}
        <div class="px-4 mb-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Course Menu</div>
        <button data-tab="home" onclick="window.renderTab('home')" class="nav-item tab-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm mb-1"><i class="fas fa-home w-5 text-center"></i> Home</button>
        
        <div class="my-2 border-t border-slate-100 dark:border-slate-800 mx-4"></div>
        
        <button data-tab="content" onclick="window.renderTab('content')" class="nav-item tab-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm mb-1"><i class="fas fa-book-open w-5 text-center"></i> Content</button>
        <button data-tab="homework" onclick="window.renderTab('homework')" class="nav-item tab-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm mb-1"><i class="fas fa-pencil-alt w-5 text-center"></i> Homework</button>
        <button data-tab="summary" onclick="window.renderTab('summary')" class="nav-item tab-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm mb-1"><i class="fas fa-list-alt w-5 text-center"></i> Summary</button>
        <button data-tab="classified" onclick="window.renderTab('classified')" class="nav-item tab-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm mb-1"><i class="fas fa-layer-group w-5 text-center"></i> Classified</button>
        <button data-tab="revision" onclick="window.renderTab('revision')" class="nav-item tab-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm mb-1"><i class="fas fa-undo w-5 text-center"></i> Final Revision</button>
        <button data-tab="papers" onclick="window.renderTab('papers')" class="nav-item tab-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm mb-1"><i class="fas fa-scroll w-5 text-center"></i> Past Papers</button>
        
        ${isAdmin ? `
            <div class="my-2 border-t border-slate-100 dark:border-slate-800 mx-4"></div>
            <button data-tab="students" onclick="window.renderTab('students')" class="nav-item tab-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm mb-1"><i class="fas fa-users w-5 text-center"></i> Students</button>
        ` : ''}
    `;
    renderTab('home');
}

export async function renderTab(tabName, fromHistory = false) {
    if (!fromHistory) {
        history.pushState({ tab: tabName }, "", `#${tabName}`);
    }
    state.activeTab = tabName; // Track active tab for navigation
    state.isSelectionMode = false;
    state.selectedItems = [];
    withViewTransition(async () => {
        _renderTabInternal(tabName);
    });
}

async function _renderTabInternal(tabName) {
    // Cleanup previous sortable
    if (state.sortableInstance) { state.sortableInstance.destroy(); state.sortableInstance = null; }

    document.querySelectorAll('.tab-btn').forEach(b => {
        b.className = (b.getAttribute('data-tab') === tabName)
            ? "nav-item tab-btn w-full flex items-center gap-3 px-4 py-3 bg-brand-light text-brand-primary rounded-xl font-bold text-sm mb-1 transition-colors"
            : "nav-item tab-btn w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium text-sm mb-1 transition-colors";
    });

    const container = document.getElementById('main-view');
    container.innerHTML = getSkeletonHtml(3); // Show skeleton immediately

    const { title, subcode } = state.activeCourseContext;
    const isAdmin = state.currentUserData.role === 'admin';
    const header = `
        <div class="mb-8 pb-6 border-b border-slate-200">
            <h1 class="text-3xl font-bold text-slate-900 font-display">${title} <span class="text-brand-primary ml-2">${(subcode && String(subcode).toLowerCase() !== 'null') ? subcode : ''}</span></h1>
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
            const qUsers = query(collection(db, "users"), where("status", "==", "approved"));
            const snap = await getDocs(qUsers);
            let students = [];
            snap.forEach(d => {
                const u = d.data();
                if (u.role === 'admin') return;

                const userCourseIds = u.courseIds || (u.courseId ? [u.courseId] : []);
                if (userCourseIds.includes(state.activeCourseContext.id)) {
                    if (state.activeCourseContext.subcode && u.subcourseCode !== state.activeCourseContext.subcode) return;
                    students.push({ id: d.id, ...u });
                }
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
                
                if (state.currentUserData.role !== 'admin' && data.isHidden) {
                    return;
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

            let floatingToolbar = '';
            if (isAdmin && state.isSelectionMode) {
                const count = state.selectedItems.length;
                floatingToolbar = `
                <div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-white dark:bg-slate-900 shadow-2xl rounded-full border border-slate-200 dark:border-slate-700 p-2 flex items-center gap-2 animate-bounce-short backdrop-blur-md">
                    <span class="text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-full whitespace-nowrap">${count} Selected</span>
                    
                    <button onclick="window.handleBulkAction('hide')" class="w-10 h-10 flex items-center justify-center bg-purple-50 text-purple-600 hover:bg-purple-100 rounded-full font-bold transition" title="Hide/Unhide"><i class="fas fa-eye-slash"></i></button>
                    <button onclick="window.handleBulkAction('lock')" class="w-10 h-10 flex items-center justify-center bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-full font-bold transition" title="Lock/Unlock"><i class="fas fa-lock"></i></button>
                    <button onclick="window.handleBulkAction('copy')" class="w-10 h-10 flex items-center justify-center bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-full font-bold transition" title="Copy"><i class="fas fa-copy"></i></button>
                    <button onclick="window.handleBulkAction('move')" class="w-10 h-10 flex items-center justify-center bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-full font-bold transition" title="Move"><i class="fas fa-arrow-right"></i></button>
                    <button onclick="window.handleBulkAction('delete')" class="w-10 h-10 flex items-center justify-center bg-red-50 text-red-600 hover:bg-red-100 rounded-full font-bold transition" title="Delete"><i class="fas fa-trash"></i></button>
                </div>`;
            }

            contentHtml = `
                ${breadcrumbHtml}
                <div class="flex flex-col md:flex-row justify-between items-center mb-8 fade-in gap-4 bg-transparent py-2">
                    <h2 class="text-2xl font-bold text-slate-900 dark:text-white font-display flex items-center gap-3">
                        ${!state.currentFolderId ? `<div class="w-10 h-10 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center text-lg"><i class="fas ${conf.icon}"></i></div>` : ''}
                        ${sectionTitle}
                    </h2>
                    
                    <div class="flex gap-2 w-full md:w-auto items-center">
                        <div class="relative flex-1 md:w-64">
                            <i class="fas fa-search absolute left-3 top-2.5 text-slate-400 text-xs"></i>
                            <input type="text" oninput="window.filterVideoItems(this.value)" placeholder="Search..." class="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:border-brand-primary outline-none focus:ring-4 focus:ring-brand-primary/5 transition" ${state.isSelectionMode ? 'disabled opacity-50' : ''}>
                        </div>
                    
                        ${isAdmin ? `
                        <button onclick="window.toggleSelectionMode()" class="px-5 py-2.5 rounded-xl text-sm font-bold transition-colors ${state.isSelectionMode ? 'bg-brand-primary text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'} shrink-0">
                            ${state.isSelectionMode ? 'Cancel' : 'Select'}
                        </button>
                        ` : ''}

                        ${isAdmin && !state.isSelectionMode ? `
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
                
                ${floatingToolbar}
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
    state.isSelectionMode = false;
    state.selectedItems = [];
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

export async function toggleItemState(id, field, currentValue) {
    if (state.currentUserData.role !== 'admin') return;
    try {
        const newValue = !currentValue;
        const ref = doc(db, "course_content", id);
        await updateDoc(ref, { [field]: newValue });
        showToast(`Item ${field === 'isLocked' ? (newValue ? 'Locked' : 'Unlocked') : (newValue ? 'Hidden' : 'Visible')}`, "success");
        _renderTabInternal(state.activeTab || 'content');
    } catch (e) {
        console.error("Error toggling state:", e);
        showToast("Error updating item state.", "error");
    }
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

    console.log("Opening viewer for:", url, "Type:", type);

    // Push State for Back Button Support - Ensure it's unique
    history.pushState({ modal: 'fileViewer', timestamp: Date.now() }, "", "#view-file");

    // Reset content
    content.innerHTML = '';
    modal.classList.remove('hidden');

    // Determine content type based on URL extension if generic 'file' type is passed
    let fileType = type;
    const lowerUrl = url.toLowerCase();

    // Enhanced detection (handles Hugging Face resolve URLs better)
    if (lowerUrl.match(/\.(jpeg|jpg|gif|png|webp|svg)(\?.*)?$/)) fileType = 'image';
    else if (lowerUrl.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/)) fileType = 'video';
    else if (lowerUrl.match(/\.(pdf)(\?.*)?$/)) fileType = 'pdf';
    else if (lowerUrl.match(/\.(doc|docx|xls|xlsx|ppt|pptx)(\?.*)?$/)) fileType = 'office';
    else if (lowerUrl.match(/\.(txt|md|js|css|html|json|csv)(\?.*)?$/)) fileType = 'text';

    // Handle YouTube/Video links if not direct file
    if (url.includes('youtube.com') || url.includes('youtu.be')) fileType = 'youtube';
    else if (url.includes('drive.google.com')) fileType = 'drive';

    // Render Content
    if (fileType === 'image') {
        content.innerHTML = `<img src="${url}" class="max-w-full max-h-full object-contain shadow-2xl rounded-lg" alt="Preview">`;
    }
    else if (fileType === 'video') {
        content.innerHTML = `<video controls controlsList="nodownload" autoplay class="max-w-full max-h-[85vh] rounded-lg shadow-2xl outline-none">
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
    else if (fileType === 'office') {
        const encodedUrl = encodeURIComponent(url);
        content.innerHTML = `<iframe src="https://docs.google.com/gview?url=${encodedUrl}&embedded=true" class="w-full h-full max-w-5xl rounded-xl shadow-2xl bg-white" frameborder="0"></iframe>`;
    }
    else if (fileType === 'text') {
        content.innerHTML = '<div class="text-white text-xl font-bold animate-pulse">Loading Text Content...</div>';
        fetch(url).then(res => res.text()).then(text => {
            content.innerHTML = `<div class="w-full h-full max-w-4xl bg-slate-900 text-slate-100 p-8 overflow-auto rounded-xl shadow-2xl font-mono text-sm whitespace-pre-wrap text-left">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`;
        }).catch(err => {
            content.innerHTML = `<div class="text-white text-center"><p class="text-red-500 mb-4">Error loading text file</p><p class="text-xs">${err.message}</p></div>`;
        });
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

    const topicFields = document.getElementById('content-topic-no')?.parentElement?.parentElement;
    if (topicFields) topicFields.classList.add('hidden');

    // Reset validations
    fileSection.classList.remove('hidden', 'border-red-500');
    if (uploadProgress) {
        uploadProgress.classList.add('hidden');
        uploadProgress.style.width = '0%';
    }
    if (fileInput) fileInput.value = '';
    selectedFilesMap.clear();
    renderFileList();

    if (type === 'video') {
        titleEl.innerText = "Add New Video";
        labelEl.innerText = "Video Description (Optional)";
        link.classList.remove('hidden'); // Show URL input

        // Videos can have topic info for thumbnails
        if (topicFields) topicFields.classList.remove('hidden');

        // Ensure Topic Title is VISIBLE for Videos (restoring if hidden by folder logic)
        const topicTitleInput = document.getElementById('content-topic-title');
        if (topicTitleInput && topicTitleInput.parentElement) {
            topicTitleInput.parentElement.classList.remove('hidden');
        }

        // HIDE Description for Video as requested
        body.classList.add('hidden');
        labelEl.classList.add('hidden');
    }
    else if (type === 'file') {
        titleEl.innerText = "Add File";
        labelEl.innerText = "Upload File or Enter URL";
        body.classList.add('hidden'); // No body text for files, usually
        link.classList.remove('hidden'); // SHOW URL INPUT FOR FILES
        fileSection.classList.remove('hidden');
        if (topicFields) topicFields.classList.remove('hidden'); // Enable "Old Thumbnail" fields

        // Ensure Topic Title is VISIBLE for Files
        const topicTitleInput = document.getElementById('content-topic-title');
        if (topicTitleInput && topicTitleInput.parentElement) {
            topicTitleInput.parentElement.classList.remove('hidden');
        }
    }
    else if (type === 'folder') {
        titleEl.innerText = "Create New Folder";
        labelEl.innerText = "Description (Hidden)";
        body.classList.add('hidden'); // HIDE description as requested
        link.classList.add('hidden');

        // Enable "Old Thumbnail" fields for Folders too
        if (topicFields) topicFields.classList.remove('hidden');

        // V8: HIDE Topic Title Input for Folders (keep Index)
        // Access specific input parent and hide it
        const topicTitleInput = document.getElementById('content-topic-title');
        if (topicTitleInput && topicTitleInput.parentElement) {
            topicTitleInput.parentElement.classList.add('hidden');
        }

        // REMOVED Cover Image Upload as per user request
        fileSection.classList.add('hidden');
    }

    toggleContentModal();
}

export function openEditContentModal(itemJson) {
    const item = JSON.parse(decodeURIComponent(itemJson));
    openContentModal(item.type, item.section); // Open generic modal first to reset/set types

    // OVERRIDE fields
    document.getElementById('content-modal-title').innerText = "Edit " + (item.type === 'folder' ? "Folder" : "Content");
    document.getElementById('content-edit-id').value = item.id;
    document.getElementById('content-title').value = item.title;
    document.getElementById('content-body').value = item.body || "";
    document.getElementById('content-link').value = item.url || "";
    document.getElementById('content-topic-no').value = item.topicNo || "";
    document.getElementById('content-topic-title').value = item.topicTitle || "";
    document.getElementById('content-order').value = item.order || 1;

    // Handle existing files if any (visual only, we don't repopulate file input)
    if (item.attachments && item.attachments.length > 0) {
        document.getElementById('file-label').innerText = `${item.attachments.length} existing files (uploading new will append)`;
    }
}

export async function handleSaveContent() {
    const type = document.getElementById('content-type').value;
    const editId = document.getElementById('content-edit-id').value;
    const title = document.getElementById('content-title').value;
    const section = document.getElementById('content-section')?.value || state.activeTab;

    if (!title) return showToast("Title is required", "error");

    const btn = document.getElementById('save-content-btn');
    const originalText = btn.innerText;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    btn.disabled = true;

    try {
        const data = {
            title,
            body: document.getElementById('content-body').value,
            url: document.getElementById('content-link').value,
            type,
            section, // Save the section!
            order: parseInt(document.getElementById('content-order').value) || 9999,
            courseId: state.activeCourseContext.id,
            subcourseCode: state.activeCourseContext.subcode || null,
            parentId: state.currentFolderId,
            topicNo: document.getElementById('content-topic-no').value,
            topicTitle: document.getElementById('content-topic-title').value,
            updatedAt: new Date().toISOString()
        };

        // 1. Upload Files
        const attachments = [];
        if (selectedFilesMap.size > 0) {
            const progressBar = document.getElementById('upload-progress');
            const progressInner = progressBar ? progressBar.firstElementChild : null;
            if (progressBar) progressBar.classList.remove('hidden');

            const repoId = "Mostafaelkashef/Kashef-files-v2";
            const token = "hf_" + "ipqvtKHcbiiyEdIJucbNaRtpBhjWGRRggW";

            let completed = 0;
            for (const [key, val] of selectedFilesMap) {
                try {
                    // Upload each file
                    const url = await uploadToHuggingFace(val.file, repoId, token, "course_uploads/");
                    attachments.push({
                        name: val.customName || val.file.name,
                        url: url,
                        type: val.file.type.startsWith('image') ? 'image' : (val.file.type.startsWith('video') ? 'video' : 'file')
                    });
                    completed++;
                } catch (err) {
                    console.error("Upload failed for " + key, err);
                    showToast(`Failed to upload ${key}`, "error");
                }
            }
        }

        if (editId) {
            // Update
            const ref = doc(db, "course_content", editId);
            // Fetch existing to append attachments
            const snap = await getDoc(ref);
            if (snap.exists()) {
                const existing = snap.data().attachments || [];
                data.attachments = [...existing, ...attachments];
            } else {
                data.attachments = attachments;
            }

            if (!data.url && data.attachments.length > 0) data.url = data.attachments[0].url;

            await updateDoc(ref, data);
            showToast("Content updated successfully");
        } else {
            // Create
            data.createdAt = new Date().toISOString();
            data.attachments = attachments;
            if (!data.url && attachments.length > 0) data.url = attachments[0].url;
            await addDoc(collection(db, "course_content"), data);
            showToast("Content created successfully");
        }

        toggleContentModal();
        if (state.activeTab) _renderTabInternal(state.activeTab); // Refresh

    } catch (e) {
        console.error(e);
        showToast("Error saving content: " + e.message, "error");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

export async function deleteContent(id, section) {
    if (!confirm("Delete this item? This cannot be undone.")) return;
    try {
        await deleteDoc(doc(db, "course_content", id));
        showToast("Item deleted");
        _renderTabInternal(state.activeTab || 'content');
    } catch (e) {
        console.error(e);
        showToast("Error deleting item", "error");
    }
}

// --- BULK ACTION LOGIC ---
export function toggleSelectionMode() {
    state.isSelectionMode = !state.isSelectionMode;
    state.selectedItems = [];
    _renderTabInternal(state.activeTab || 'content');
}

export function toggleCardSelection(id) {
    if (!state.isSelectionMode) return;
    const idx = state.selectedItems.indexOf(id);
    if (idx > -1) {
        state.selectedItems.splice(idx, 1);
    } else {
        state.selectedItems.push(id);
    }
    _renderTabInternal(state.activeTab || 'content');
}

export async function handleBulkAction(action) {
    if (!state.selectedItems || state.selectedItems.length === 0) {
        showToast("No items selected.", "error");
        return;
    }

    if (action === 'delete') {
        if (!confirm(`Are you sure you want to delete ${state.selectedItems.length} selected items?`)) return;
        try {
            const batch = writeBatch(db);
            state.selectedItems.forEach(id => {
                batch.delete(doc(db, "course_content", id));
            });
            await batch.commit();
            showToast("Selected items deleted.", "success");
            toggleSelectionMode();
        } catch (e) {
            console.error(e);
            showToast("Error deleting items.", "error");
        }
    } else if (action === 'hide' || action === 'lock') {
        const field = action === 'hide' ? 'isHidden' : 'isLocked';
        try {
            const toUpdate = state.currentItems.filter(i => state.selectedItems.includes(i.id));
            const allSet = toUpdate.every(i => i[field] === true);
            const newValue = !allSet;

            const batch = writeBatch(db);
            state.selectedItems.forEach(id => {
                batch.update(doc(db, "course_content", id), { [field]: newValue });
            });
            await batch.commit();
            showToast(`Items ${newValue ? (action === 'hide' ? 'Hidden' : 'Locked') : (action === 'hide' ? 'Visible' : 'Unlocked')}`, "success");
            toggleSelectionMode();
        } catch(e) {
            console.error(e);
            showToast("Error updating items.", "error");
        }
    } else if (action === 'copy' || action === 'move') {
        window.bulkActionType = action;
        openDestinationModal();
    }
}

function getDestinationModalHtml() {
    return `
        <div id="destination-modal" class="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4 backdrop-blur-sm shadow-2xl transition-opacity animate-fade-in hidden">
            <div class="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 dark:border-slate-700 max-h-[90vh] flex flex-col relative overflow-hidden">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold text-slate-900 dark:text-white" id="dest-modal-title">Select Destination</h2>
                    <button onclick="window.closeDestinationModal()" class="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"><i class="fas fa-times"></i></button>
                </div>
                <div class="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                    
                    <div>
                        <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Target Course</label>
                        <select id="dest-course" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-brand-primary transition">
                            <option value="">Select a course...</option>
                        </select>
                    </div>

                    <div>
                        <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Target Section</label>
                        <select id="dest-section" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-brand-primary transition">
                            <option value="content">Content</option>
                            <option value="homework">Homework Assignments</option>
                            <option value="summary">Summaries</option>
                            <option value="classified">Classified Questions</option>
                            <option value="revision">Final Revision</option>
                            <option value="papers">Past Papers</option>
                        </select>
                    </div>

                    <div>
                        <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Target Folder (Optional)</label>
                        <select id="dest-folder" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-brand-primary transition">
                            <option value="">Root (No Folder)</option>
                        </select>
                        <p class="text-[10px] text-slate-400 mt-2 font-bold uppercase"><i class="fas fa-info-circle mr-1"></i>Folders load after selecting course and section.</p>
                    </div>
                </div>

                <div class="pt-6 border-t border-slate-100 dark:border-slate-700 mt-6 flex justify-end gap-3">
                    <button onclick="window.closeDestinationModal()" class="px-5 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition">Cancel</button>
                    <button onclick="window.confirmDestinationAction()" class="px-5 py-2.5 rounded-xl font-bold bg-brand-primary text-white shadow-lg hover:shadow-brand-primary/30 transition-all active:scale-95" id="dest-confirm-btn">Confirm</button>
                </div>
            </div>
        </div>
    `;
}

export function openDestinationModal() {
    let modal = document.getElementById('destination-modal');
    if (!modal) {
        document.body.insertAdjacentHTML('beforeend', getDestinationModalHtml());
        modal = document.getElementById('destination-modal');
        setupDestinationListeners();
    }
    
    document.getElementById('dest-modal-title').textContent = window.bulkActionType === 'move' ? 'Move Items To' : 'Copy Items To';
    document.getElementById('dest-confirm-btn').textContent = window.bulkActionType === 'move' ? 'Move' : 'Copy';

    const courseSelect = document.getElementById('dest-course');
    courseSelect.innerHTML = '<option value="">Select a course...</option>' + 
        state.availableCourses.map(c => `<option value="${c.id}">${c.title} ${c.subcode && c.subcode !== 'null' ? `(${c.subcode})` : ''}</option>`).join('');
    
    if(state.activeCourseContext && state.activeCourseContext.id) {
        courseSelect.value = state.activeCourseContext.id;
    }
    
    document.getElementById('dest-section').value = state.activeTab || 'content';
    
    loadDestinationFolders();

    modal.classList.remove('hidden');
}

export function closeDestinationModal() {
    const modal = document.getElementById('destination-modal');
    if (modal) modal.classList.add('hidden');
}

function setupDestinationListeners() {
    document.getElementById('dest-course').addEventListener('change', loadDestinationFolders);
    document.getElementById('dest-section').addEventListener('change', loadDestinationFolders);
}

async function loadDestinationFolders() {
    const courseId = document.getElementById('dest-course').value;
    const section = document.getElementById('dest-section').value;
    const folderSelect = document.getElementById('dest-folder');
    
    folderSelect.innerHTML = '<option value="">Root (No Folder)</option>';
    if (!courseId) return;

    try {
        const q = query(collection(db, "course_content"), 
            where("courseId", "==", courseId), 
            where("type", "in", ["folder", "file_folder"]),
            where("section", "==", section)
        );
        const sn = await getDocs(q);
        const folders = sn.docs.map(d => ({id: d.id, ...d.data()})).sort((a,b)=> (a.order||0) - (b.order||0));
        folders.forEach(f => {
            folderSelect.innerHTML += `<option value="${f.id}">${f.title}</option>`;
        });
    } catch (e) {
        console.error("Error loading folders", e);
    }
}

export async function confirmDestinationAction() {
    const action = window.bulkActionType;
    const courseId = document.getElementById('dest-course').value;
    const section = document.getElementById('dest-section').value;
    const parentId = document.getElementById('dest-folder').value || null;

    if (!courseId) {
        showToast("Please select a target course.", "error");
        return;
    }

    const btn = document.getElementById('dest-confirm-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

    try {
        const toUpdate = state.currentItems.filter(i => state.selectedItems.includes(i.id));
        const batch = writeBatch(db);

        if (action === 'move') {
            toUpdate.forEach(item => {
                const ref = doc(db, "course_content", item.id);
                batch.update(ref, {
                    courseId: courseId,
                    section: section,
                    parentId: parentId
                });
            });
            await batch.commit();
            showToast("Items moved successfully.", "success");
        } else if (action === 'copy') {
            toUpdate.forEach(item => {
                const newData = { ...item };
                delete newData.id;
                newData.courseId = courseId;
                newData.section = section;
                newData.parentId = parentId;
                newData.createdAt = new Date().toISOString();
                const newRef = doc(collection(db, "course_content"));
                batch.set(newRef, newData);
            });
            await batch.commit();
            showToast("Items copied successfully.", "success");
        }

        closeDestinationModal();
        toggleSelectionMode();
    } catch (e) {
        console.error(e);
        showToast("Error processing bulk action.", "error");
    } finally {
        closeDestinationModal();
        btn.disabled = false;
        btn.innerHTML = action === 'move' ? 'Move' : 'Copy';
    }
}
