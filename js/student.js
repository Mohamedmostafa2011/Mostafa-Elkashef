import { db } from "./config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { state } from "./state.js";
import { openCourseDashboard, renderCourseSelection } from "./dashboard_v9.js";

export async function renderStudentDashboard() {
    const u = state.currentUserData;
    const courseIds = u.courseIds || (u.courseId ? [u.courseId] : []);

    if (courseIds.length === 0) return;

    if (!state.activeCourseContext) {
        // Always show the Course Hub (Dashboard) if no specific course is selected
        renderCourseSelection(courseIds);
    } else {
        // A course is already active (e.g. state preserved or navigating back)
        const activeId = state.activeCourseContext.id;
        const cSnap = await getDoc(doc(db, "courses", activeId));
        const title = cSnap.exists() ? cSnap.data().title : "Unknown Course";
        state.activeCourseContext = { id: activeId, title, subcode: u.subcourseCode };
        openCourseDashboard(activeId, title, u.subcourseCode);
    }
}
