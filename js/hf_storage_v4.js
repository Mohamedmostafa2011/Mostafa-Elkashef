
import { commit } from "https://cdn.jsdelivr.net/npm/@huggingface/hub@0.12.1/+esm";

export async function uploadToHuggingFace(file, repoId, token, pathPrefix = "") {
    if (!repoId || !token) throw new Error("Missing Repo ID or Token");

    const filename = `${pathPrefix}${Date.now()}_${file.name.replace(/\s+/g, '_')}`;

    // Read file as ArrayBuffer for the SDK
    const buffer = await file.arrayBuffer();
    const blob = new Blob([buffer]);

    const response = await commit({
        credentials: {
            accessToken: token
        },
        repo: {
            type: "dataset",
            name: repoId
        },
        operations: [
            {
                operation: "addOrUpdate",
                path: filename,
                content: blob
            }
        ],
        title: `Upload ${file.name} (via Kashef Dashboard)`,
        branch: "main"
    });

    // The SDK returns the commit info, but we construct the URL manually to ensure it points to the file
    // response.commit.oid could be used, but "main" is safer for immediate linking if cached
    return `https://huggingface.co/datasets/${repoId}/resolve/main/${filename}`;
}
