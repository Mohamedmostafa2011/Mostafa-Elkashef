
export async function uploadToHuggingFace(file, repoId, token, pathPrefix = "") {
    if (!repoId || !token) throw new Error("Missing Repo ID or Token");

    const filename = `${pathPrefix}${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    const url = `https://huggingface.co/api/datasets/${repoId}/upload/main/${filename}`;

    // Read file as ArrayBuffer
    const buffer = await file.arrayBuffer();

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": file.type,
            "X-HuggingFace-Commit-Message": `Upload ${file.name}`
        },
        body: buffer
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Upload Failed: ${err}`);
    }

    // Construct the view URL (Resolve URL)
    // For datasets, raw file is at: https://huggingface.co/datasets/{repoId}/resolve/main/{filename}
    return `https://huggingface.co/datasets/${repoId}/resolve/main/${filename}`;
}
