
// Helper to convert Blob/File to Base64
const blobToBase64 = blob => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]); // Remove "data:*/*;base64," prefix
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

export async function uploadToHuggingFace(file, repoId, token, pathPrefix = "") {
    if (!repoId || !token) throw new Error("Missing Repo ID or Token");

    const filename = `${pathPrefix}${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    const commitUrl = `https://huggingface.co/api/datasets/${repoId}/commit/main`;

    // Convert file to base64
    const base64Content = await blobToBase64(file);

    const payload = {
        operations: [
            {
                operation: "add_or_update",
                path: filename,
                content: base64Content,
                encoding: "base64"
            }
        ],
        commit_message: `Upload ${file.name} (via Kashef Dashboard)`,
        summary: `Upload ${file.name} (via Kashef Dashboard)`
    };

    const response = await fetch(commitUrl, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Upload Failed: ${err}`);
    }

    // Return the resolve URL
    return `https://huggingface.co/datasets/${repoId}/resolve/main/${filename}`;
}
