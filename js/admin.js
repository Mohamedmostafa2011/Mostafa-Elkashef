import { db, auth } from "./config.js";
import { collection, query, orderBy, getDocs, doc, getDoc, updateDoc, deleteDoc, where, addDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { state } from "./state.js";
import { showToast, setupSubcourseInputs, getSkeletonHtml, withViewTransition } from "./utils_v7.js";
import { openCourseDashboard, renderTab } from "./dashboard_v9.js";
import { uploadToHuggingFace } from "./hf_storage_v4.js";

export async function renderAdminHome() {
    withViewTransition(async () => {
        _renderAdminInternal();
    });
}
async function _renderAdminInternal() {
    updateAdminNavigation('courses');
    const container = document.getElementById('main-view');
    container.innerHTML = getSkeletonHtml(3);

    if (state.availableCourses.length === 0) {
        const snap = await getDocs(query(collection(db, "courses"), orderBy("createdAt", "asc")));
        state.availableCourses = [];
        snap.forEach(d => state.availableCourses.push({ id: d.id, ...d.data() }));
    }
    const snap = state.availableCourses;

    let html = `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 fade-in">
            <div onclick="window.openModalForCreate()" class="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-[2rem] h-64 flex flex-col items-center justify-center cursor-pointer hover:border-brand-primary hover:bg-blue-50/50 dark:hover:bg-slate-800 transition group">
                <div class="w-16 h-16 bg-white dark:bg-slate-800 rounded-full shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition"><i class="fas fa-plus text-2xl text-brand-primary"></i></div>
                <h3 class="font-bold text-slate-500 dark:text-slate-400 group-hover:text-brand-primary">Create New Course</h3>
            </div>
    `;

    const icons = ['fa-square-root-variable', 'fa-chart-pie', 'fa-calculator', 'fa-superscript', 'fa-infinity'];

    snap.forEach((c, i) => {
        const safeCourse = encodeURIComponent(JSON.stringify({ id: c.id, ...c }));
        const icon = icons[i % icons.length];

        html += `
            <div class="relative h-64 rounded-[2rem] overflow-hidden shadow-lg hover:shadow-2xl transition hover:scale-[1.02] text-white p-6 flex flex-col justify-between group" style="background: ${c.theme}">
                <div class="absolute inset-0 bg-math-grid opacity-20"></div>
                <div class="absolute -right-4 -bottom-8 text-[100px] opacity-10 transform rotate-12"><i class="fas ${icon}"></i></div>
                
                <button onclick="window.openModalForEdit('${safeCourse}', event)" class="absolute top-4 right-4 w-8 h-8 bg-white/20 hover:bg-white text-white hover:text-brand-dark rounded-full flex items-center justify-center backdrop-blur transition z-20"><i class="fas fa-cog"></i></button>

                <div class="absolute inset-0 z-10 cursor-pointer" onclick="window.enterCourseLogic('${c.id}', ${c.subcourses ? c.subcourses.length : 0})"></div>

                <div class="relative z-0 mt-4">
                    ${c.subcourses && c.subcourses.length > 0 ? `<span class="bg-white/20 backdrop-blur px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-white/30">${c.subcourses.length} Groups</span>` : ''}
                    <h3 class="text-3xl font-display font-bold mt-3 drop-shadow-md leading-tight">${c.title}</h3>
                </div>
                <div class="relative z-0 flex justify-between items-end">
                    <p class="text-sm font-medium opacity-80">Math &bull; IG</p>
                    <div class="w-10 h-10 bg-white text-brand-primary rounded-full flex items-center justify-center shadow-lg group-hover:translate-x-1 transition"><i class="fas fa-arrow-right"></i></div>
                </div>
            </div>
        `;
    });
    html += `</div>`;
    container.innerHTML = html;
}

export async function enterCourseLogic(courseId, subCount) {
    // Use cached course data instead of fetching from Firestore again
    let course = state.availableCourses.find(c => c.id === courseId);
    if (!course) {
        const snap = await getDoc(doc(db, "courses", courseId));
        course = { id: courseId, ...snap.data() };
    }

    if (subCount > 0) {
        const container = document.getElementById('main-view');

        let html = `
            <button onclick="window.renderAdminHome()" class="mb-6 flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-brand-primary font-bold transition"><i class="fas fa-arrow-left"></i> Back to Courses</button>
            <h2 class="text-3xl font-display font-bold text-slate-900 dark:text-white mb-2">Select Group</h2>
            <p class="text-slate-500 dark:text-slate-400 mb-8">Managing <b>${course.title}</b></p>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 fade-in">`;

        course.subcourses.forEach(code => {
            html += `
                <div onclick="window.openCourseDashboard('${courseId}', '${course.title}', '${code}')" class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8 rounded-2xl shadow-sm hover:shadow-lg hover:border-brand-primary cursor-pointer transition text-center group">
                    <div class="text-3xl font-bold text-slate-800 dark:text-white group-hover:text-brand-primary mb-2">${code}</div>
                    <span class="text-xs text-slate-400 font-bold uppercase tracking-widest">Class Group</span>
                </div>`;
        });
        html += `</div>`;
        container.innerHTML = html;
    } else {
        openCourseDashboard(courseId, course.title, null);
    }
}

export async function renderApprovals() {
    updateAdminNavigation('approvals');
    if (state.availableCourses.length === 0) { const cSnap = await getDocs(query(collection(db, "courses"))); cSnap.forEach(d => state.availableCourses.push({ id: d.id, ...d.data() })); }
    
    // We add limit(50) to prevent unbound queries of pending users
    const { limit } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
    const snap = await getDocs(query(collection(db, "users"), where("status", "==", "pending"), limit(50)));
    let html = `<div class="max-w-4xl mx-auto"><h2 class="text-2xl font-bold mb-6 text-slate-800">Requests (Top 50)</h2><div class="space-y-4">`;
    if (snap.empty) html += `<p class="text-slate-400">No pending requests.</p>`;
    snap.forEach(d => {
        const u = d.data();
        const userCourseIds = u.courseIds || (u.courseId ? [u.courseId] : []);
        const enrolledCourses = state.availableCourses.filter(c => userCourseIds.includes(c.id));
        const courseNames = enrolledCourses.length > 0 ? enrolledCourses.map(c => c.title).join(', ') : "No Courses Selected";


        html += `
        <div class="bg-white p-5 rounded-xl border shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                <h4 class="font-bold text-slate-900 text-lg">${u.name}</h4>
                <div class="flex flex-wrap gap-2 mt-1">
                    <span class="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold"><i class="fas fa-phone-alt mr-1"></i> ${u.phone}</span>
                    <span class="text-xs bg-blue-50 text-brand-primary px-2 py-0.5 rounded font-bold"><i class="fas fa-book mr-1"></i> ${courseNames}</span>
                    ${u.subcourseCode ? `<span class="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-bold">Group: ${u.subcourseCode}</span>` : ''}
                </div>
            </div>
            <div class="flex gap-2 w-full sm:w-auto mt-3 sm:mt-0">
                <button onclick="window.rejectUser('${d.id}')" class="flex-1 sm:flex-none bg-red-50 hover:bg-red-100 text-red-600 px-6 py-2 rounded-xl text-sm font-bold transition-colors border border-red-100">Reject</button>
                <button onclick="window.approveUser('${d.id}')" class="flex-1 sm:flex-none bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-green-100 transition-all">Approve</button>
            </div>
        </div>`;
    });
    html += `</div></div>`;
    document.getElementById('main-view').innerHTML = html;
}

export async function approveUser(uid) {
    await updateDoc(doc(db, "users", uid), { status: 'approved' });
    showToast("Approved");
    state.cachedApprovedUsers = null; // Invalidate cache
    renderApprovals();
}

export async function rejectUser(uid) {
    if (!confirm("Are you sure you want to reject this request? The user account will be permanently deleted.")) return;
    try {
        await deleteDoc(doc(db, "users", uid));
        showToast("User rejected");
        state.cachedApprovedUsers = null; // Invalidate cache
        renderApprovals();
    } catch (e) {
        showToast("Error rejecting user", "error");
    }
}

export async function deleteStudentAccount(uid, name) {
    if (!confirm(`Are you sure you want to delete ${name}? This cannot be undone.`)) return;
    try {
        await deleteDoc(doc(db, "users", uid));
        showToast("Student deleted");
        state.cachedApprovedUsers = null; // Invalidate cache
        renderTab('students');
    } catch (e) { showToast("Error deleting student", "error"); }
}

// --- COURSE MODALS ---
export function toggleCourseModal() {
    document.getElementById('course-modal').classList.toggle('hidden');
}

export function openModalForCreate() {
    document.getElementById('modal-title').innerText = "Create New Course";
    document.getElementById('edit-course-id').value = "";
    document.getElementById('new-course-title').value = "";
    document.getElementById('btn-delete-course').classList.add('hidden');
    setupSubcourseInputs(['']);
    document.getElementById('course-modal').classList.remove('hidden');
}

export function openModalForEdit(courseStr, e) {
    e.stopPropagation();
    const course = JSON.parse(decodeURIComponent(courseStr));
    document.getElementById('modal-title').innerText = "Edit Course";
    document.getElementById('edit-course-id').value = course.id;
    document.getElementById('new-course-title').value = course.title;
    document.getElementById('btn-delete-course').classList.remove('hidden');
    let subs = course.subcourses || [];
    if (subs.length === 0 || subs[subs.length - 1] !== '') subs.push('');
    setupSubcourseInputs(subs);
    document.getElementById('course-modal').classList.remove('hidden');
}

export async function handleSaveCourse() {
    const title = document.getElementById('new-course-title').value;
    const id = document.getElementById('edit-course-id').value;
    if (!title) return showToast("Title required", "error");
    const subs = [];
    document.querySelectorAll('.subcourse-input').forEach(input => {
        if (input.value.trim()) subs.push(input.value.trim().toUpperCase());
    });
    try {
        if (id) {
            await updateDoc(doc(db, "courses", id), { title, subcourses: subs });
            showToast("Updated");
        } else {
            const themes = ['linear-gradient(135deg, #1e293b, #334155)', 'linear-gradient(135deg, #1e40af, #3b82f6)', 'linear-gradient(135deg, #0f766e, #10b981)', 'linear-gradient(135deg, #b91c1c, #ef4444)', 'linear-gradient(135deg, #7c3aed, #8b5cf6)'];
            const theme = themes[Math.floor(Math.random() * themes.length)];
            await addDoc(collection(db, "courses"), { title, subcourses: subs, theme, createdAt: new Date().toISOString() });
            showToast("Created");
        }
        state.availableCourses = []; // Invalidate cache
        toggleCourseModal();
        renderAdminHome();
    } catch (e) { showToast("Error", "error"); }
}

export async function handleDeleteCourse() {
    if (!confirm("Delete?")) return;
    await deleteDoc(doc(db, "courses", document.getElementById('edit-course-id').value));
    state.availableCourses = []; // Invalidate cache
    toggleCourseModal();
    renderAdminHome();
    showToast("Deleted");
}

// --- ANALYTICS ---
// Video Analytics removed.

// --- ADMIN NAVIGATION HELPER ---
export function updateAdminNavigation(activeTab) {
    const coursesClass = activeTab === 'courses' 
        ? 'bg-brand-light text-brand-primary rounded-xl font-bold text-sm' 
        : 'text-slate-500 hover:bg-slate-50 rounded-xl font-medium text-sm';
    const approvalsClass = activeTab === 'approvals' 
        ? 'bg-brand-light text-brand-primary rounded-xl font-bold text-sm' 
        : 'text-slate-500 hover:bg-slate-50 rounded-xl font-medium text-sm';
    const qrClass = activeTab === 'qrcode' 
        ? 'bg-brand-light text-brand-primary rounded-xl font-bold text-sm' 
        : 'text-slate-500 hover:bg-slate-50 rounded-xl font-medium text-sm';

    document.getElementById('nav-links').innerHTML = `
        <button onclick="window.renderAdminHome()" class="nav-item w-full flex items-center gap-3 px-4 py-3 ${coursesClass}"><i class="fas fa-th-large"></i> Courses</button>
        <button onclick="window.renderApprovals()" class="nav-item w-full flex items-center gap-3 px-4 py-3 ${approvalsClass}"><i class="fas fa-user-check"></i> Approvals</button>
        <button onclick="window.renderQrCodes()" class="nav-item w-full flex items-center gap-3 px-4 py-3 ${qrClass}"><i class="fas fa-qrcode"></i> QR Codes</button>
    `;
}

// --- QR CODES DASHBOARD ---
let selectedQrFile = null;
let currentQrTab = 'create'; // 'create' or 'history'

export async function renderQrCodes() {
    withViewTransition(async () => {
        updateAdminNavigation('qrcode');
        selectedQrFile = null; // reset state
        _renderQrCodesInternal();
    });
}

function _renderQrCodesInternal() {
    const container = document.getElementById('main-view');
    
    const tabsHtml = `
        <div class="max-w-4xl mx-auto fade-in">
            <h2 class="text-3xl font-display font-bold text-slate-900 dark:text-white mb-2">QR Codes Manager</h2>
            <p class="text-slate-500 dark:text-slate-400 mb-8">Generate watermarked QR codes for files or URLs. Access is restricted to authenticated users only.</p>

            <div class="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-8 w-fit">
                <button onclick="window.toggleQrTab('create')" id="qr-tab-create"
                    class="px-6 py-2.5 text-sm font-bold rounded-lg transition-all ${currentQrTab === 'create' ? 'bg-white dark:bg-slate-700 text-brand-primary dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}">Generate New</button>
                <button onclick="window.toggleQrTab('history')" id="qr-tab-history"
                    class="px-6 py-2.5 text-sm font-bold rounded-lg transition-all ${currentQrTab === 'history' ? 'bg-white dark:bg-slate-700 text-brand-primary dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}">Saved QR Codes</button>
            </div>

            <div id="qr-tab-content" class="space-y-6">
                <!-- Dynamic Content based on tab -->
            </div>
        </div>
    `;
    
    container.innerHTML = tabsHtml;
    renderSelectedQrTab();
}

export function toggleQrTab(tab) {
    currentQrTab = tab;
    // Highlight the active tab button
    const createBtn = document.getElementById('qr-tab-create');
    const historyBtn = document.getElementById('qr-tab-history');
    if (createBtn && historyBtn) {
        if (tab === 'create') {
            createBtn.className = "px-6 py-2.5 text-sm font-bold rounded-lg transition-all bg-white dark:bg-slate-700 text-brand-primary dark:text-white shadow-sm";
            historyBtn.className = "px-6 py-2.5 text-sm font-bold rounded-lg transition-all text-slate-500 hover:text-slate-700 dark:hover:text-slate-300";
        } else {
            historyBtn.className = "px-6 py-2.5 text-sm font-bold rounded-lg transition-all bg-white dark:bg-slate-700 text-brand-primary dark:text-white shadow-sm";
            createBtn.className = "px-6 py-2.5 text-sm font-bold rounded-lg transition-all text-slate-500 hover:text-slate-700 dark:hover:text-slate-300";
        }
    }
    renderSelectedQrTab();
}

function renderSelectedQrTab() {
    const contentContainer = document.getElementById('qr-tab-content');
    if (!contentContainer) return;

    if (currentQrTab === 'create') {
        renderCreateQrTab(contentContainer);
    } else {
        renderHistoryQrTab(contentContainer);
    }
}

function renderCreateQrTab(container) {
    container.innerHTML = `
        <div class="bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-8 border border-slate-100 dark:border-slate-700 shadow-sm space-y-6">
            <div>
                <label class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">QR Code Title / Name</label>
                <input type="text" id="qr-input-name"
                    class="w-full p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-light transition dark:text-white"
                    placeholder="e.g. Session 1 Video Tutorial">
            </div>

            <div>
                <label class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2">Select Source Type</label>
                <div class="flex gap-4">
                    <label class="flex-1 flex items-center justify-center gap-2 p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                        <input type="radio" name="qr-source-type" value="file" checked onchange="window.toggleQrSourceType('file')" class="text-brand-primary">
                        <span class="text-sm font-bold text-slate-700 dark:text-slate-200 font-sans">Upload File (Video/PDF)</span>
                    </label>
                    <label class="flex-1 flex items-center justify-center gap-2 p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                        <input type="radio" name="qr-source-type" value="url" onchange="window.toggleQrSourceType('url')" class="text-brand-primary">
                        <span class="text-sm font-bold text-slate-700 dark:text-slate-200 font-sans">Enter Link / URL</span>
                    </label>
                </div>
            </div>

            <!-- File Upload section -->
            <div id="qr-file-section" class="space-y-2">
                <label class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Upload File (Unlimited Size via HuggingFace)</label>
                <div class="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center hover:bg-slate-50 dark:hover:bg-slate-900 transition cursor-pointer relative" id="qr-drop-zone">
                    <input type="file" id="qr-file-input" class="absolute inset-0 opacity-0 cursor-pointer" onchange="window.handleQrFileSelect(event)">
                    <div class="text-slate-400">
                        <i class="fas fa-cloud-upload-alt text-4xl mb-2 text-brand-primary"></i>
                        <p class="text-sm font-bold text-slate-600 dark:text-slate-300" id="qr-file-label">Click or drag file here</p>
                        <p class="text-[10px] text-slate-400 mt-1">Supports Video (mp4, webm), Document (pdf, txt), Image (jpg, png, svg)</p>
                    </div>
                </div>
                <!-- Selected File Display -->
                <div id="qr-selected-file" class="hidden flex items-center justify-between p-3.5 bg-blue-50 dark:bg-slate-700/50 border border-blue-100 dark:border-slate-600 rounded-xl">
                    <div class="flex items-center gap-3">
                        <i class="fas fa-file-alt text-brand-primary text-xl"></i>
                        <div>
                            <p class="text-sm font-bold text-slate-700 dark:text-white" id="qr-selected-file-name"></p>
                            <p class="text-[10px] text-slate-400" id="qr-selected-file-size"></p>
                        </div>
                    </div>
                    <button onclick="window.clearSelectedQrFile()" class="w-8 h-8 rounded-full hover:bg-red-50 hover:text-red-500 flex items-center justify-center text-slate-400 transition">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>

            <!-- URL Input section -->
            <div id="qr-url-section" class="hidden">
                <label class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Destination URL</label>
                <input type="url" id="qr-input-url"
                    class="w-full p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-light transition dark:text-white"
                    placeholder="https://example.com/or-youtube-link">
            </div>

            <!-- Progress Bar -->
            <div id="qr-upload-progress" class="hidden mt-2">
                <div class="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div class="h-full bg-brand-primary w-0 transition-all duration-300" id="qr-progress-bar" style="width: 0%"></div>
                </div>
                <p class="text-[10px] text-right text-brand-primary font-bold mt-1" id="qr-progress-text">Uploading file to Hugging Face...</p>
            </div>

            <!-- Generate Button -->
            <button onclick="window.handleCreateQr()" id="qr-generate-btn"
                class="w-full bg-brand-primary text-white font-bold py-4 rounded-xl hover:bg-blue-700 transition shadow-xl shadow-blue-200 dark:shadow-none active:scale-[0.98] flex justify-center items-center gap-2">
                <i class="fas fa-qrcode"></i> Generate QR Code & Link
            </button>
        </div>
    `;

    // Add drag-and-drop listener to drop zone
    setTimeout(() => {
        const dropZone = document.getElementById('qr-drop-zone');
        if (dropZone) {
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('border-brand-primary', 'bg-blue-50/50');
            });
            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('border-brand-primary', 'bg-blue-50/50');
            });
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('border-brand-primary', 'bg-blue-50/50');
                if (e.dataTransfer.files.length > 0) {
                    const file = e.dataTransfer.files[0];
                    setQrSelectedFile(file);
                }
            });
        }
    }, 100);
}

window.toggleQrSourceType = function(type) {
    const fileSec = document.getElementById('qr-file-section');
    const urlSec = document.getElementById('qr-url-section');
    if (!fileSec || !urlSec) return;

    if (type === 'file') {
        fileSec.classList.remove('hidden');
        urlSec.classList.add('hidden');
    } else {
        fileSec.classList.add('hidden');
        urlSec.classList.remove('hidden');
    }
};

window.handleQrFileSelect = function(e) {
    if (e.target.files.length > 0) {
        setQrSelectedFile(e.target.files[0]);
    }
};

function setQrSelectedFile(file) {
    selectedQrFile = file;
    const selectDiv = document.getElementById('qr-selected-file');
    const labelDiv = document.getElementById('qr-drop-zone');
    const nameP = document.getElementById('qr-selected-file-name');
    const sizeP = document.getElementById('qr-selected-file-size');

    if (selectDiv && labelDiv && nameP && sizeP) {
        nameP.innerText = file.name;
        // Format size
        const sizeKB = (file.size / 1024).toFixed(1);
        sizeP.innerText = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`;
        
        selectDiv.classList.remove('hidden');
        labelDiv.classList.add('hidden');
    }
}

window.clearSelectedQrFile = function() {
    selectedQrFile = null;
    const selectDiv = document.getElementById('qr-selected-file');
    const labelDiv = document.getElementById('qr-drop-zone');
    const fileInput = document.getElementById('qr-file-input');
    if (fileInput) fileInput.value = '';

    if (selectDiv && labelDiv) {
        selectDiv.classList.add('hidden');
        labelDiv.classList.remove('hidden');
    }
};

export async function handleCreateQr() {
    const name = document.getElementById('qr-input-name').value.trim();
    if (!name) return showToast("Name is required", "error");

    const sourceType = document.querySelector('input[name="qr-source-type"]:checked').value;
    let finalUrl = "";
    let fileType = "file";

    const btn = document.getElementById('qr-generate-btn');
    const originalText = btn.innerHTML;

    try {
        if (sourceType === 'file') {
            if (!selectedQrFile) return showToast("Please select a file to upload", "error");

            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Uploading File...';

            const progressBar = document.getElementById('qr-upload-progress');
            const progressInner = document.getElementById('qr-progress-bar');
            if (progressBar) progressBar.classList.remove('hidden');
            if (progressInner) progressInner.style.width = '50%'; // fake starting

            const repoId = "Mostafaelkashef/Kashef-files-v2";
            // Token should be passed from environment variable or secure backend
            const token = window.HF_TOKEN || localStorage.getItem('hf_token') || '';
            if (!token) {
                showToast('HuggingFace token not configured. Please set HF_TOKEN.', 'error');
                btn.innerHTML = 'Create QR';
                return;
            }

            finalUrl = await uploadToHuggingFace(selectedQrFile, repoId, token, "qr_uploads/");
            if (progressInner) progressInner.style.width = '100%';
            
            // Detect file type
            const lowerUrl = finalUrl.toLowerCase();
            if (lowerUrl.match(/\.(jpeg|jpg|gif|png|webp|svg)(\?.*)?$/)) fileType = 'image';
            else if (lowerUrl.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/)) fileType = 'video';
            else if (lowerUrl.match(/\.(pdf)(\?.*)?$/)) fileType = 'pdf';
            else if (lowerUrl.match(/\.(doc|docx|xls|xlsx|ppt|pptx)(\?.*)?$/)) fileType = 'office';
            else if (lowerUrl.match(/\.(txt|md|js|css|html|json|csv)(\?.*)?$/)) fileType = 'text';

        } else {
            finalUrl = document.getElementById('qr-input-url').value.trim();
            if (!finalUrl) return showToast("URL is required", "error");
            if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
                finalUrl = 'https://' + finalUrl;
            }

            // Detect url type
            const lowerUrl = finalUrl.toLowerCase();
            if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) fileType = 'youtube';
            else if (lowerUrl.includes('drive.google.com')) fileType = 'drive';
            else if (lowerUrl.match(/\.(jpeg|jpg|gif|png|webp|svg)(\?.*)?$/)) fileType = 'image';
            else if (lowerUrl.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/)) fileType = 'video';
            else if (lowerUrl.match(/\.(pdf)(\?.*)?$/)) fileType = 'pdf';
            else if (lowerUrl.match(/\.(doc|docx|xls|xlsx|ppt|pptx)(\?.*)?$/)) fileType = 'office';
            else if (lowerUrl.match(/\.(txt|md|js|css|html|json|csv)(\?.*)?$/)) fileType = 'text';
            else fileType = 'link';
        }

        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Registering QR Code...';

        // Save to Firestore
        const docRef = await addDoc(collection(db, "qr_codes"), {
            name,
            url: finalUrl,
            type: sourceType,
            fileType,
            createdAt: new Date().toISOString(),
            creatorId: auth.currentUser ? auth.currentUser.uid : "unknown"
        });

        // Hide progress
        const progressBar = document.getElementById('qr-upload-progress');
        if (progressBar) progressBar.classList.add('hidden');

        showToast("QR Code data saved! Generating canvas...");

        // Generate the watermarked QR Code and show in modal
        const scanUrl = `${window.location.origin}${window.location.pathname}?qrId=${docRef.id}`;
        
        await generateWatermarkedQr(scanUrl, name, (canvas) => {
            showQrModal(name, scanUrl, canvas);
            // Invalidate state & switch to history to see it
            toggleQrTab('history');
        });

    } catch (e) {
        console.error(e);
        showToast("Error generating QR code: " + e.message, "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

window.createQrForExistingItem = async function(itemId, itemTitle, itemUrl, itemType, courseId) {
    const name = itemTitle || 'QR Code';
    if (!itemUrl) return showToast('Unable to determine item URL.', 'error');

    let finalUrl = itemUrl;
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
        finalUrl = 'https://' + finalUrl;
    }

    const lowerUrl = finalUrl.toLowerCase();
    let fileType = 'link';
    if (lowerUrl.match(/\.(jpeg|jpg|gif|png|webp|svg)(\?.*)?$/)) fileType = 'image';
    else if (lowerUrl.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/)) fileType = 'video';
    else if (lowerUrl.match(/\.(pdf)(\?.*)?$/)) fileType = 'pdf';
    else if (lowerUrl.match(/\.(doc|docx|xls|xlsx|ppt|pptx)(\?.*)?$/)) fileType = 'office';
    else if (lowerUrl.match(/\.(txt|md|js|css|html|json|csv)(\?.*)?$/)) fileType = 'text';
    else if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) fileType = 'youtube';

    try {
        const docRef = await addDoc(collection(db, 'qr_codes'), {
            name,
            url: finalUrl,
            type: itemType === 'file' ? 'file' : 'link',
            fileType,
            createdAt: new Date().toISOString(),
            creatorId: auth.currentUser ? auth.currentUser.uid : 'unknown',
            attachedItemId: itemId,
            courseId: courseId || null
        });

        await updateDoc(doc(db, 'course_content', itemId), {
            qrCodes: arrayUnion(docRef.id)
        });

        // Invalidate cached QR map for this course so UI updates immediately
        if (state.cachedQrCodesByCourse && courseId && state.cachedQrCodesByCourse[courseId]) {
            state.cachedQrCodesByCourse[courseId] = null;
        }

        showToast('QR Code created for this item!');
        const scanUrl = `${window.location.origin}${window.location.pathname}?qrId=${docRef.id}`;
        await generateWatermarkedQr(scanUrl, name, (canvas) => {
            showQrModal(name, scanUrl, canvas);
            toggleQrTab('history');
        });
    } catch (e) {
        console.error(e);
        showToast('Error creating QR code for item: ' + e.message, 'error');
    }
};

window.viewItemQr = async function(itemId, itemTitle) {
    try {
        // Use a simple equality query and pick the most recent result client-side
        // to avoid requiring a composite Firestore index for where+orderBy.
        const q = query(collection(db, 'qr_codes'), where('attachedItemId', '==', itemId));
        const snap = await getDocs(q);
        if (snap.empty) {
            return showToast('No QR code exists for this item yet.', 'error');
        }

        // Choose the latest QR by createdAt (ISO string) if multiple exist
        let latestDoc = null;
        snap.forEach(d => {
            if (!latestDoc) latestDoc = d;
            else {
                const a = d.data().createdAt || '';
                const b = latestDoc.data().createdAt || '';
                if (new Date(a) > new Date(b)) latestDoc = d;
            }
        });

        const qrDoc = latestDoc;
        const qrData = qrDoc.data();
        const scanUrl = `${window.location.origin}${window.location.pathname}?qrId=${qrDoc.id}`;
        await generateWatermarkedQr(scanUrl, itemTitle || qrData.name, (canvas) => {
            showQrModal(itemTitle || qrData.name, scanUrl, canvas);
        });
    } catch (e) {
        console.error('viewItemQr error', e);
        showToast('Error loading item QR code: ' + (e.message || e), 'error');
    }
};

function roundRect(ctx, x, y, width, height, radius) {
    if (radius === undefined) radius = 10;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

async function generateWatermarkedQr(text, name, callback) {
    const qrCanvas = document.createElement('canvas');
    qrCanvas.width = 400;
    qrCanvas.height = 400;

    QRCode.toCanvas(qrCanvas, text, {
        width: 400,
        errorCorrectionLevel: 'H',
        margin: 2
    }, function(err) {
        if (err) {
            console.error(err);
            showToast("QRCode generation error", "error");
            return;
        }

        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = 400;
        finalCanvas.height = 460;
        const ctx = finalCanvas.getContext('2d');

        // Rounded white background with transparent corners.
        ctx.clearRect(0, 0, finalCanvas.width, finalCanvas.height);
        ctx.fillStyle = '#ffffff';
        roundRect(ctx, 0, 0, finalCanvas.width, finalCanvas.height, 40);
        ctx.fill();

        // Clip to rounded corners for everything drawn on top.
        ctx.save();
        roundRect(ctx, 0, 0, finalCanvas.width, finalCanvas.height, 40);
        ctx.clip();

        // Draw QR code at the top
        ctx.drawImage(qrCanvas, 0, 0);

        // Center watermark badge inside the QR code
        const badgeWidth = 260;
        const badgeHeight = 42;
        const badgeX = (finalCanvas.width - badgeWidth) / 2;
        const badgeY = (400 - badgeHeight) / 2;

        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 2;
        roundRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 18);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#0f172a';
        ctx.font = "bold 13px 'Plus Jakarta Sans', sans-serif";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('www.mostafaelkashef.com', finalCanvas.width / 2, badgeY + badgeHeight / 2);

        ctx.restore();

        // Bottom banner
        const bannerHeight = 60;
        const bannerY = finalCanvas.height - bannerHeight;
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, bannerY, finalCanvas.width, bannerHeight);

        ctx.fillStyle = '#f8fafc';
        ctx.font = "bold 16px 'Plus Jakarta Sans', sans-serif";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const maxTextWidth = 360;
        let displayName = name || '';

        if (ctx.measureText(displayName).width > maxTextWidth) {
            const words = displayName.split(' ');
            let firstLine = '';
            let secondLine = '';
            words.forEach(word => {
                const testFirst = firstLine ? `${firstLine} ${word}` : word;
                if (ctx.measureText(testFirst).width <= maxTextWidth) {
                    firstLine = testFirst;
                } else {
                    secondLine = secondLine ? `${secondLine} ${word}` : word;
                }
            });
            if (!secondLine) {
                secondLine = firstLine;
                firstLine = displayName.substring(0, 24) + '...';
            }
            ctx.fillText(firstLine, finalCanvas.width / 2, bannerY + bannerHeight / 2 - 10);
            ctx.fillText(secondLine, finalCanvas.width / 2, bannerY + bannerHeight / 2 + 14);
        } else {
            ctx.fillText(displayName, finalCanvas.width / 2, bannerY + bannerHeight / 2);
        }

        callback(finalCanvas);
    });
}

// History tab renderer
async function renderHistoryQrTab(container) {
    container.innerHTML = `
        <div class="flex items-center justify-between mb-4 gap-4">
            <div class="relative flex-1 max-w-md">
                <i class="fas fa-search absolute left-3 top-3.5 text-slate-400 text-sm"></i>
                <input type="text" id="qr-search-input" oninput="window.filterQrCodes(this.value)" placeholder="Search QR Codes..." class="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:border-brand-primary outline-none transition focus:ring-2 focus:ring-brand-light dark:text-white">
            </div>
        </div>
        <div id="qr-history-list" class="space-y-4">
            <p class="text-slate-400 italic text-center py-8 font-bold">Loading saved QR Codes...</p>
        </div>
    `;

    try {
        const snap = await getDocs(query(collection(db, "qr_codes"), orderBy("createdAt", "desc")));
        window.allSavedQrCodes = [];
        snap.forEach(d => {
            window.allSavedQrCodes.push({ id: d.id, ...d.data() });
        });

        displayQrHistoryList(window.allSavedQrCodes);
    } catch (e) {
        console.error(e);
        document.getElementById('qr-history-list').innerHTML = `<p class="text-red-500 text-center py-8">Error loading history: ${e.message}</p>`;
    }
}

function displayQrHistoryList(items) {
    const listDiv = document.getElementById('qr-history-list');
    if (!listDiv) return;

    if (items.length === 0) {
        listDiv.innerHTML = `
            <div class="bg-white dark:bg-slate-800 rounded-[2rem] p-12 text-center border border-slate-100 dark:border-slate-700 shadow-sm">
                <p class="text-slate-500 font-bold">No saved QR Codes found.</p>
            </div>
        `;
        return;
    }

    let html = "";
    items.forEach(item => {
        const scanUrl = `${window.location.origin}${window.location.pathname}?qrId=${item.id}`;
        const dateStr = new Date(item.createdAt).toLocaleDateString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        const safeName = item.name.replace(/'/g, "\\'");
        const safeUrl = item.url.replace(/'/g, "\\'");
        const typeBadge = item.type === 'file' 
            ? `<span class="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 text-xs px-3 py-1 rounded-full font-bold uppercase tracking-widest"><i class="fas fa-file-alt mr-1 font-sans"></i> File</span>`
            : `<span class="bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 text-xs px-3 py-1 rounded-full font-bold uppercase tracking-widest"><i class="fas fa-link mr-1 font-sans"></i> Link</span>`;

        html += `
            <div class="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-md transition duration-200">
                <div class="flex-1 space-y-2 min-w-0">
                    <div class="flex items-center gap-3">
                        <h4 class="font-bold text-slate-900 dark:text-white text-lg truncate">${item.name}</h4>
                        ${typeBadge}
                    </div>
                    <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                        <span><i class="far fa-calendar-alt mr-1"></i> ${dateStr}</span>
                        <span class="truncate max-w-xs md:max-w-md"><i class="fas fa-external-link-alt mr-1"></i> Destination: <a href="${item.url}" target="_blank" class="text-brand-primary hover:underline">${item.url}</a></span>
                    </div>
                </div>
                
                <div class="flex gap-2 w-full md:w-auto shrink-0 flex-wrap sm:flex-nowrap">
                    <!-- Preview Direct Content -->
                    <button onclick="window.previewQrContent('${safeUrl}', '${item.fileType || 'file'}')" class="flex-1 sm:flex-none border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 p-3 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5" title="Preview Content">
                        <i class="fas fa-eye"></i> View Content
                    </button>

                    <!-- View QR Code Modal -->
                    <button onclick="window.viewSavedQr('${safeName}', '${scanUrl}')" class="flex-1 sm:flex-none bg-blue-50 hover:bg-blue-100 text-brand-primary dark:bg-slate-750 dark:text-white p-3 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5">
                        <i class="fas fa-qrcode"></i> Get QR
                    </button>

                    <!-- Delete QR Code -->
                    <button onclick="window.deleteQrCode('${item.id}', '${safeName}')" class="flex-none bg-red-50 hover:bg-red-100 text-red-500 dark:bg-red-950/20 dark:text-red-400 p-3 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
        `;
    });

    listDiv.innerHTML = html;
}

window.filterQrCodes = function(term) {
    if (!window.allSavedQrCodes) return;
    const lower = term.toLowerCase();
    const filtered = window.allSavedQrCodes.filter(qr => qr.name.toLowerCase().includes(lower));
    displayQrHistoryList(filtered);
};

window.previewQrContent = function(url, fileType) {
    if (typeof window.openFileViewer === 'function') {
        window.openFileViewer(url, fileType);
    } else {
        window.open(url, '_blank');
    }
};

window.viewSavedQr = async function(name, scanUrl) {
    showToast("Generating QR Canvas...");
    await generateWatermarkedQr(scanUrl, name, (canvas) => {
        showQrModal(name, scanUrl, canvas);
    });
};

export async function deleteQrCode(id, name) {
    if (!confirm(`Are you sure you want to delete the QR Code "${name}"? This will disable any printed scans of this QR code. The file itself remains in Hugging Face.`)) return;

    try {
        await deleteDoc(doc(db, "qr_codes", id));
        showToast("QR Code deleted successfully");
        if (currentQrTab === 'history') {
            const container = document.getElementById('qr-tab-content');
            renderHistoryQrTab(container);
        }
    } catch (e) {
        console.error(e);
        showToast("Error deleting QR code", "error");
    }
};

// QR MODAL LOGIC
export function showQrModal(name, scanUrl, canvas) {
    const modal = document.getElementById('qr-display-modal');
    const title = document.getElementById('qr-modal-title');
    const container = document.getElementById('qr-modal-canvas-container');
    const dlBtn = document.getElementById('qr-modal-download-btn');
    const copyBtn = document.getElementById('qr-modal-copy-btn');

    if (!modal || !container) return;

    title.innerText = name;
    container.innerHTML = "";
    
    canvas.className = "w-full max-w-[320px] mx-auto select-none rounded-lg";
    container.appendChild(canvas);

    dlBtn.onclick = () => {
        const link = document.createElement('a');
        link.download = `${name.replace(/\s+/g, '_')}_qr_code.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        showToast("Download started!");
    };

    copyBtn.onclick = () => {
        navigator.clipboard.writeText(scanUrl).then(() => {
            showToast("Scanner Link copied to clipboard!");
        }).catch(err => {
            console.error("Clipboard error", err);
            showToast("Failed to copy link automatically.", "error");
        });
    };

    modal.classList.remove('hidden');
}

export function closeQrModal() {
    const modal = document.getElementById('qr-display-modal');
    if (modal) modal.classList.add('hidden');
}
