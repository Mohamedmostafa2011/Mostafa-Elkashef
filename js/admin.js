import { db } from "./config.js";
import { collection, query, orderBy, getDocs, doc, getDoc, updateDoc, deleteDoc, where, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { state } from "./state.js";
import { showToast, setupSubcourseInputs, getSkeletonHtml, withViewTransition } from "./utils.js";
import { openCourseDashboard, renderTab } from "./dashboard_v2.js";

export async function renderAdminHome() {
    withViewTransition(async () => {
        _renderAdminInternal();
    });
}

async function _renderAdminInternal() {
    document.getElementById('nav-links').innerHTML = `
        <button onclick="window.renderAdminHome()" class="nav-item w-full flex items-center gap-3 px-4 py-3 bg-brand-light text-brand-primary rounded-xl font-bold text-sm"><i class="fas fa-th-large"></i> Courses</button>
        <button onclick="window.renderApprovals()" class="nav-item w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-50 rounded-xl font-medium text-sm"><i class="fas fa-user-check"></i> Approvals</button>
    `;

    const container = document.getElementById('main-view');
    container.innerHTML = getSkeletonHtml(3);

    const snap = await getDocs(query(collection(db, "courses"), orderBy("createdAt", "asc")));
    state.availableCourses = [];
    snap.forEach(d => state.availableCourses.push({ id: d.id, ...d.data() }));

    let html = `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 fade-in">
            <div onclick="window.openModalForCreate()" class="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-[2rem] h-64 flex flex-col items-center justify-center cursor-pointer hover:border-brand-primary hover:bg-blue-50/50 dark:hover:bg-slate-800 transition group">
                <div class="w-16 h-16 bg-white dark:bg-slate-800 rounded-full shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition"><i class="fas fa-plus text-2xl text-brand-primary"></i></div>
                <h3 class="font-bold text-slate-500 dark:text-slate-400 group-hover:text-brand-primary">Create New Course</h3>
            </div>
    `;

    const icons = ['fa-square-root-variable', 'fa-chart-pie', 'fa-calculator', 'fa-superscript', 'fa-infinity'];

    snap.forEach((doc, i) => {
        const c = doc.data();
        const safeCourse = encodeURIComponent(JSON.stringify({ id: doc.id, ...c }));
        const icon = icons[i % icons.length];

        html += `
            <div class="relative h-64 rounded-[2rem] overflow-hidden shadow-lg hover:shadow-2xl transition hover:scale-[1.02] text-white p-6 flex flex-col justify-between group" style="background: ${c.theme}">
                <div class="absolute inset-0 bg-math-grid opacity-20"></div>
                <div class="absolute -right-4 -bottom-8 text-[100px] opacity-10 transform rotate-12"><i class="fas ${icon}"></i></div>
                
                <button onclick="window.openModalForEdit('${safeCourse}', event)" class="absolute top-4 right-4 w-8 h-8 bg-white/20 hover:bg-white text-white hover:text-brand-dark rounded-full flex items-center justify-center backdrop-blur transition z-20"><i class="fas fa-cog"></i></button>

                <div class="absolute inset-0 z-10 cursor-pointer" onclick="window.enterCourseLogic('${doc.id}', ${c.subcourses ? c.subcourses.length : 0})"></div>

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
    if (subCount > 0) {
        const snap = await getDoc(doc(db, "courses", courseId));
        const course = snap.data();
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
        const snap = await getDoc(doc(db, "courses", courseId));
        openCourseDashboard(courseId, snap.data().title, null);
    }
}

export async function renderApprovals() {
    document.getElementById('nav-links').innerHTML = `
        <button onclick="window.renderAdminHome()" class="nav-item w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-50 rounded-xl font-medium text-sm"><i class="fas fa-th-large"></i> Courses</button>
        <button onclick="window.renderApprovals()" class="nav-item w-full flex items-center gap-3 px-4 py-3 bg-brand-light text-brand-primary rounded-xl font-bold text-sm"><i class="fas fa-user-check"></i> Approvals</button>
    `;
    if (state.availableCourses.length === 0) { const cSnap = await getDocs(query(collection(db, "courses"))); cSnap.forEach(d => state.availableCourses.push({ id: d.id, ...d.data() })); }
    const snap = await getDocs(query(collection(db, "users"), where("status", "==", "pending")));
    let html = `<div class="max-w-4xl mx-auto"><h2 class="text-2xl font-bold mb-6 text-slate-800">Requests</h2><div class="space-y-4">`;
    if (snap.empty) html += `<p class="text-slate-400">No pending requests.</p>`;
    snap.forEach(d => {
        const u = d.data();
        const course = state.availableCourses.find(c => c.id === u.courseId);
        const courseName = course ? course.title : "Unknown Course";
        html += `
        <div class="bg-white p-5 rounded-xl border shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                <h4 class="font-bold text-slate-900 text-lg">${u.name}</h4>
                <div class="flex flex-wrap gap-2 mt-1">
                    <span class="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold"><i class="fas fa-phone-alt mr-1"></i> ${u.phone}</span>
                    <span class="text-xs bg-blue-50 text-brand-primary px-2 py-0.5 rounded font-bold"><i class="fas fa-book mr-1"></i> ${courseName}</span>
                    ${u.subcourseCode ? `<span class="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-bold">Group: ${u.subcourseCode}</span>` : ''}
                </div>
            </div>
            <button onclick="window.approveUser('${d.id}')" class="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-green-100">Approve</button>
        </div>`;
    });
    html += `</div></div>`;
    document.getElementById('main-view').innerHTML = html;
}

export async function approveUser(uid) {
    await updateDoc(doc(db, "users", uid), { status: 'approved' });
    showToast("Approved");
    renderApprovals();
}

export async function deleteStudentAccount(uid, name) {
    if (!confirm(`Are you sure you want to delete ${name}? This cannot be undone.`)) return;
    try {
        await deleteDoc(doc(db, "users", uid));
        showToast("Student deleted");
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
        toggleCourseModal();
        renderAdminHome();
    } catch (e) { showToast("Error", "error"); }
}

export async function handleDeleteCourse() {
    if (!confirm("Delete?")) return;
    await deleteDoc(doc(db, "courses", document.getElementById('edit-course-id').value));
    toggleCourseModal();
    renderAdminHome();
    showToast("Deleted");
}
