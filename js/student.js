import { db } from "./config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { state } from "./state.js";
import { openCourseDashboard } from "./dashboard_v3.js";

export async function renderStudentDashboard() {
    if (!state.currentUserData.courseId) return;
    const cSnap = await getDoc(doc(db, "courses", state.currentUserData.courseId));
    const title = cSnap.exists() ? cSnap.data().title : "Unknown Course";
    state.activeCourseContext = { id: state.currentUserData.courseId, title, subcode: state.currentUserData.subcourseCode };
    openCourseDashboard(state.currentUserData.courseId, title, state.currentUserData.subcourseCode);
}
