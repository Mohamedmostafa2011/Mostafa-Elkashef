import { auth, db } from "./config.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc, getDocs, query, collection, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { showToast } from "./utils_v7.js";
import { state } from "./state.js";

// Phone Input Config
const itiConfig = {
    initialCountry: "eg",
    preferredCountries: ["eg", "sa", "ae", "kw", "us"],
    utilsScript: "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.19/js/utils.js",
    separateDialCode: true
};
let loginPhone, regPhone;

export function initAuth() {
    const loginInput = document.querySelector("#login-phone");
    const regInput = document.querySelector("#reg-phone");

    const init = () => {
        if (window.intlTelInput) {
            console.log("ITI Library v17 found. Initializing...");
            if (loginInput) loginPhone = window.intlTelInput(loginInput, itiConfig);
            if (regInput) regPhone = window.intlTelInput(regInput, itiConfig);
        } else {
            console.warn("ITI Library not found on window. Retrying...");
            setTimeout(init, 500);
        }
    };
    init();

    const loginBtn = document.getElementById('btn-login');
    const signupBtn = document.getElementById('btn-create-account');

    if (loginBtn) loginBtn.onclick = handleLogin;
    if (signupBtn) signupBtn.onclick = handleSignup;
}

export async function switchTab(tab) {
    const tabLogin = document.getElementById('tab-login');
    const tabSignup = document.getElementById('tab-signup');
    const activeClass = "flex-1 py-2.5 text-sm font-bold rounded-lg shadow-sm bg-white text-brand-primary transition-all";
    const inactiveClass = "flex-1 py-2.5 text-sm font-bold rounded-lg text-slate-500 hover:text-slate-700 transition-all";

    if (tab === 'login') {
        document.getElementById('login-form').classList.remove('hidden');
        document.getElementById('signup-form').classList.add('hidden');
        document.getElementById('auth-title').innerText = "Welcome Back";
        tabLogin.className = activeClass;
        tabSignup.className = inactiveClass;
    } else {
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('signup-form').classList.remove('hidden');
        document.getElementById('auth-title').innerText = "Join Class";
        tabSignup.className = activeClass;
        tabLogin.className = inactiveClass;
        await loadCoursesForSignup();
    }
}

async function loadCoursesForSignup() {
    const container = document.getElementById('reg-courses-container');
    container.innerHTML = '<p class="text-slate-400 italic">Loading...</p>';
    const snap = await getDocs(query(collection(db, "courses"), orderBy("createdAt")));
    container.innerHTML = '';
    state.availableCourses = [];
    snap.forEach(d => {
        const course = { id: d.id, ...d.data() };
        state.availableCourses.push(course);

        const div = document.createElement('label');
        div.className = "flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-slate-100";
        div.innerHTML = `
            <input type="checkbox" name="reg-courses" value="${d.id}" class="w-4 h-4 text-brand-primary rounded focus:ring-brand-primary">
            <span class="text-slate-700">${course.title}</span>
        `;
        div.querySelector('input').addEventListener('change', handleCourseSelectionChange);
        container.appendChild(div);
    });
}

function handleCourseSelectionChange() {
    const selectedIds = Array.from(document.querySelectorAll('input[name="reg-courses"]:checked')).map(cb => cb.value);
    const selectedCourses = state.availableCourses.filter(c => selectedIds.includes(c.id));

    const hasSubcourses = selectedCourses.some(c => c.subcourses && c.subcourses.length > 0);

    if (hasSubcourses) {
        document.getElementById('course-code-field').classList.remove('hidden');
    } else {
        document.getElementById('course-code-field').classList.add('hidden');
        document.getElementById('reg-code').value = "";
    }
}

async function handleLogin() {
    const btn = document.getElementById('btn-login');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Logging in...';
    try {
        const pass = document.getElementById('login-pass').value;
        const phoneInput = document.querySelector("#login-phone");

        let phoneNumber;
        if (loginPhone && typeof loginPhone.isValidNumber === 'function' && loginPhone.isValidNumber()) {
            phoneNumber = loginPhone.getNumber().replace('+', '');
        } else {
            console.warn("ITI Login fallback used");
            const val = phoneInput.value.replace(/[^0-9]/g, '');
            if (val.length < 8) { btn.disabled = false; btn.innerHTML = originalText; return showToast("Please enter a valid phone number", "error"); }
            phoneNumber = val;
        }

        await signInWithEmailAndPassword(auth, phoneNumber + "@igmath.com", pass);
    } catch (e) {
        console.error("Login Error:", e);
        showToast("Login Failed: " + (e.message || "Unknown error"), "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

async function handleSignup() {
    const btn = document.getElementById('btn-create-account');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Creating account...';
    try {
        const name = document.getElementById('reg-name').value;
        const pass = document.getElementById('reg-pass').value;
        const courseIds = Array.from(document.querySelectorAll('input[name="reg-courses"]:checked')).map(cb => cb.value);

        if (!name || !pass || courseIds.length === 0) { btn.disabled = false; btn.innerHTML = originalText; return showToast("All fields required", "error"); }

        const phoneInput = document.querySelector("#reg-phone");
        let phoneNumber;

        if (regPhone && typeof regPhone.isValidNumber === 'function' && regPhone.isValidNumber()) {
            phoneNumber = regPhone.getNumber();
        } else {
            console.warn("ITI Signup fallback used");
            const val = phoneInput.value.trim();
            if (val.length < 8) { btn.disabled = false; btn.innerHTML = originalText; return showToast("Please enter a valid phone number", "error"); }
            phoneNumber = val.startsWith('+') ? val : '+20' + val.replace(/^0/, '');
        }

        let subcourseCode = null;
        const selectedCourses = state.availableCourses.filter(c => courseIds.includes(c.id));
        const courseWithSubcourses = selectedCourses.find(c => c.subcourses && c.subcourses.length > 0);

        if (courseWithSubcourses) {
            const code = document.getElementById('reg-code').value.trim().toUpperCase();
            let isValidCode = false;
            selectedCourses.forEach(c => {
                if (c.subcourses && c.subcourses.includes(code)) isValidCode = true;
            });

            if (!isValidCode) { btn.disabled = false; btn.innerHTML = originalText; return showToast("Invalid Group Code for selected courses", "error"); }
            subcourseCode = code;
        }

        const email = phoneNumber.replace('+', '') + "@igmath.com";
        const isAdmin = phoneNumber === '+11234567890';

        try {
            const cred = await createUserWithEmailAndPassword(auth, email, pass);
            await createFirestoreUser(cred.user.uid, name, phoneNumber, courseIds, subcourseCode, isAdmin);
            showToast("Account Created!");
        } catch (e) {
            if (e.code === 'auth/email-already-in-use') {
                const credential = await signInWithEmailAndPassword(auth, email, pass);
                const userDoc = await getDoc(doc(db, "users", credential.user.uid));
                if (!userDoc.exists()) {
                    await createFirestoreUser(credential.user.uid, name, phoneNumber, courseIds, subcourseCode, isAdmin);
                    showToast("Account Restored!");
                } else {
                    showToast("Account already exists. Please Log In.", "info");
                    switchTab('login');
                }
            } else {
                throw e;
            }
        }
    } catch (e) {
        console.error("Signup Error:", e);
        showToast("Signup Failed: " + (e.message || "Error"), "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

async function createFirestoreUser(uid, name, phone, courseIds, subcourseCode, isAdmin) {
    await setDoc(doc(db, "users", uid), {
        name,
        phone,
        role: isAdmin ? 'admin' : 'student',
        status: isAdmin ? 'approved' : 'pending',
        courseId: courseIds[0], // Set primary courseId for BC
        courseIds,
        subcourseCode,
        uid,
        createdAt: new Date().toISOString()
    });
}
