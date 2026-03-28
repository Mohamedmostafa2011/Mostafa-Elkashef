export const state = {
    currentUserData: null,
    availableCourses: [],
    activeCourseContext: null,
    currentFolderId: null,
    breadcrumbs: [],
    currentItems: [],
    sortableInstance: null,
    isSelectionMode: false,
    selectedItems: [],
    cachedApprovedUsers: null, // to prevent re-fetching the entire users collection
    cachedCourseContent: {}    // to cache tabs content like { "courseId": [...] }
};
