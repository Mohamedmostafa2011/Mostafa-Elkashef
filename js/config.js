import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBSO1WWLoQkWgtpGGhHV6MCegePEErijO0",
    authDomain: "mostafa-elkashef.firebaseapp.com",
    projectId: "mostafa-elkashef",
    storageBucket: "mostafa-elkashef.firebasestorage.app",
    messagingSenderId: "1029862762774",
    appId: "1:1029862762774:web:b8852c7e0be74b1ca88837"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
