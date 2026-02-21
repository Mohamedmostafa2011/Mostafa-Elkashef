import { auth, db } from "./config.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc, getDocs, query, collection, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { showToast } from "./utils.js";
import { state } from "./state.js";

// Phone Input Config
const itiConfig = { initialCountry: "eg", preferredCountries: ["eg", "sa", "ae", "kw", "us"], utilsScript: "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.19/js/utils.js", separateDialCode: true };
let loginPhone, regPhone;

export function initAuth() {
    loginPhone = window.intlTelInput(document.querySelector("#login-phone"), itiConfig);
    regPhone = window.intlTelInput(document.querySelector("#reg-phone"), itiConfig);

    document.getElementById('btn-login').onclick = handleLogin;
    document.getElementById('btn-create-account').onclick = handleSignup;
    document.getElementById('reg-course').addEventListener('change', handleCourseChange);
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
    const select = document.getElementById('reg-course');
    select.innerHTML = '<option disabled selected>Loading...</option>';
    const snap = await getDocs(query(collection(db, "courses"), orderBy("createdAt")));
    select.innerHTML = '<option value="" disabled selected>Select Your Course</option>';
    state.availableCourses = [];
    snap.forEach(d => {
        state.availableCourses.push({ id: d.id, ...d.data() });
        const opt = document.createElement('option'); opt.value = d.id; opt.innerText = d.data().title; select.appendChild(opt);
    });
}

function handleCourseChange(e) {
    const course = state.availableCourses.find(c => c.id === e.target.value);
    if (course && course.subcourses && course.subcourses.length > 0) document.getElementById('course-code-field').classList.remove('hidden');
    else { document.getElementById('course-code-field').classList.add('hidden'); document.getElementById('reg-code').value = ""; }
}

async function handleLogin() {
    const pass = document.getElementById('login-pass').value;
    if (!loginPhone.isValidNumber()) return showToast("Invalid Phone", "error");
    try { await signInWithEmailAndPassword(auth, loginPhone.getNumber().replace('+', '') + "@igmath.com", pass); }
    catch (e) { showToast("Login Failed", "error"); }
}

async function handleSignup() {
    const name = document.getElementById('reg-name').value;
    const pass = document.getElementById('reg-pass').value;
    const courseId = document.getElementById('reg-course').value;

    if (!name || !pass || !courseId) return showToast("All fields required", "error");
    if (!regPhone.isValidNumber()) return showToast("Invalid Phone", "error");

    const course = state.availableCourses.find(c => c.id === courseId);
    let subcourseCode = null;

    if (course && course.subcourses && course.subcourses.length > 0) {
        const code = document.getElementById('reg-code').value.trim().toUpperCase();
        if (!course.subcourses.includes(code)) return showToast("Invalid Group Code", "error");
        subcourseCode = code;
    }

    const phone = regPhone.getNumber();
    const email = phone.replace('+', '') + "@igmath.com";
    const isAdmin = phone === '+11234567890'; // Hardcoded admin

    // --- RECOVERY / REGISTRATION LOGIC ---
    // Try to create a new user. If failure due to "email-already-in-use", 
    // it implies the Auth User exists but the student might have been deleted from Firestore.
    // In that case, we try to recover by signing them in and recreating the Firestore doc.
    try {
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        // Regular Success Path (New Auth + New Firestore)
        await createFirestoreUser(cred.user.uid, name, phone, courseId, subcourseCode, isAdmin);
        showToast("Account Created!");
    } catch (e) {
        if (e.code === 'auth/email-already-in-use') {
            console.log("User exists in Auth. Checking for recovery...");
            // Attempt to sign in with provided password to verify ownership
            try {
                const credential = await signInWithEmailAndPassword(auth, email, pass);
                // Check if Firestore document exists
                const userDoc = await getDoc(doc(db, "users", credential.user.uid));

                if (!userDoc.exists()) {
                    // RECOVERY PATH: Auth exists, Firestore missing (deleted student).
                    // Re-create the Firestore record with the NEW data they just entered.
                    await createFirestoreUser(credential.user.uid, name, phone, courseId, subcourseCode, isAdmin);
                    showToast("Account Restored!");
                    // Force reload/redirect handled by auth state listener
                } else {
                    // User already exists fully.
                    showToast("Account already exists. Please Log In.", "info");
                    switchTab('login');
                }
            } catch (signInErr) {
                // Password didn't match or other error
                console.error(signInErr);
                showToast("Phone number registered. Wrong password?", "error");
            }
        } else {
            // Other registration (e.g., weak password)
            console.error(e);
            showToast(e.message, "error");
        }
    }
}

async function createFirestoreUser(uid, name, phone, courseId, subcourseCode, isAdmin) {
    await setDoc(doc(db, "users", uid), {
        name,
        phone,
        role: isAdmin ? 'admin' : 'student',
        status: isAdmin ? 'approved' : 'pending',
        courseId,
        subcourseCode,
        uid,
        createdAt: new Date().toISOString()
    });
}
