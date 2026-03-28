import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/**
 * FIREBASE CONFIGURATION
 * 
 * SECURITY WARNING: 
 * This API Key is public by design in client-side applications. 
 * To prevent unauthorized use, you MUST restrict this key in the 
 * Google Cloud Console (APIs & Services > Credentials) to only 
 * allow requests from your authorized domains (e.g., localhost, your-domain.com).
 */
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

enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
        console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
    } else if (err.code === 'unimplemented') {
        console.warn('The current browser does not support all of the features required to enable persistence');
    }
});
