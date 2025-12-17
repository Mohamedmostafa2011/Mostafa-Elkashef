import { auth, db } from "./config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { state } from "./state.js";
import { initAuth, switchTab } from "./auth.js";
import { renderAdminHome, renderApprovals, approveUser, openModalForCreate, openModalForEdit, handleSaveCourse, handleDeleteCourse, enterCourseLogic, deleteStudentAccount, toggleCourseModal } from "./admin.js";
import { renderStudentDashboard } from "./student.js";
import { renderTab, openCourseDashboard, navigateToFolder, filterVideoItems, toggleContentModal, openContentModal, openEditContentModal, handleSaveContent, deleteContent, toggleSettingsModal, saveSettings } from "./dashboard.js";
import { showToast } from "./utils.js";

// --- EXPOSE GLOBAL FUNCTIONS (Bridge for HTML onclick) ---
window.switchTab = switchTab;
window.renderAdminHome = renderAdminHome;
window.renderApprovals = renderApprovals;
window.approveUser = approveUser;
window.openModalForCreate = openModalForCreate;
window.openModalForEdit = openModalForEdit;
window.handleSaveCourse = handleSaveCourse;
window.handleDeleteCourse = handleDeleteCourse;
window.toggleCourseModal = toggleCourseModal;
window.enterCourseLogic = enterCourseLogic;
window.renderTab = renderTab;
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
window.deleteStudentAccount = deleteStudentAccount;

// Sidebar Toggles
document.getElementById('open-sidebar').onclick = () => { document.getElementById('sidebar').classList.remove('-translate-x-full'); document.getElementById('mobile-overlay').classList.remove('hidden'); };
document.getElementById('close-sidebar').onclick = () => { document.getElementById('sidebar').classList.add('-translate-x-full'); document.getElementById('mobile-overlay').classList.add('hidden'); };
document.getElementById('mobile-overlay').onclick = () => { document.getElementById('sidebar').classList.add('-translate-x-full'); document.getElementById('mobile-overlay').classList.add('hidden'); };

// Logout
const handleLogout = () => signOut(auth);
document.getElementById('logout-btn').onclick = handleLogout;
document.getElementById('logout-pending').onclick = handleLogout;

// --- DARK MODE LOGIC ---
if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
} else {
    document.documentElement.classList.remove('dark');
}

window.toggleDarkMode = () => {
    if (document.documentElement.classList.contains('dark')) {
        document.documentElement.classList.remove('dark');
        localStorage.theme = 'light';
    } else {
        document.documentElement.classList.add('dark');
        localStorage.theme = 'dark';
    }
    updateToggleIcon();
};

function updateToggleIcon() {
    const icon = document.getElementById('dark-mode-icon');
    if (!icon) return;
    const isDark = document.documentElement.classList.contains('dark');
    icon.className = isDark ? "fas fa-sun" : "fas fa-moon";
    const text = document.getElementById('dark-mode-text');
    if (text) text.innerText = isDark ? "Light Mode" : "Dark Mode";
}

// --- INITIALIZE ---
initAuth();
updateToggleIcon();

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
            state.currentUserData = snap.data();
            document.getElementById('auth-screen').classList.add('hidden');

            if (state.currentUserData.status === 'pending') {
                document.getElementById('pending-screen').classList.remove('hidden');
            } else {
                document.getElementById('app-screen').classList.remove('hidden');
                document.getElementById('header-user').innerText = state.currentUserData.name;
                document.getElementById('header-role').innerText = state.currentUserData.role === 'admin' ? 'Instructor' : 'Student';
                if (state.currentUserData.role === 'admin') renderAdminHome();
                else renderStudentDashboard();
            }
        } else {
            await signOut(auth);
            showToast("Account not found. Please register.", "error");
            document.getElementById('auth-screen').classList.remove('hidden');
            document.getElementById('app-screen').classList.add('hidden');
        }
    } else {
        document.getElementById('auth-screen').classList.remove('hidden');
        document.getElementById('app-screen').classList.add('hidden');
        document.getElementById('pending-screen').classList.add('hidden');
    }
});

// --- HISTORY HANDLING ---
window.onpopstate = (event) => {
    if (event.state) {
        if (event.state.folderId !== undefined) {
            // It's a folder navigation
            // We need to find the title for breadcrumbs if possible, but for 'back' often we just need to go to ID
            // The simple logic in navigateToFolder might need 'title' if it's a new push, but for 'back' 
            // we might rely on existing state OR redundant calls.
            // Simplification: logic to restore folder state is complex without full breadcrumb history.
            // For now, let's at least switch tabs.
            // If folderId is present, we try to open it.
            navigateToFolder(event.state.folderId, null, null, true);
        } else if (event.state.tab) {
            renderTab(event.state.tab, true);
        }
    } else {
        // Default
        renderTab('home', true);
    }
};
