const path = require("path");

const BUCKET_NAME = process.env.PROFILE_PHOTOS_BUCKET || "profile-photos";

function storageConfig() {
    const rawUrl = process.env.SUPABASE_URL;
    const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!rawUrl || !rawKey) {
        throw Object.assign(new Error("Profile photo storage is not configured."), { statusCode: 503 });
    }

    let url;
    try {
        url = new URL(rawUrl.trim().replace(/^['\"]|['\"]$/g, "")).origin;
    } catch {
        throw Object.assign(new Error("SUPABASE_URL must be a valid project URL."), { statusCode: 503 });
    }

    const key = rawKey.trim().replace(/^['\"]|['\"]$/g, "");
    return { url, key };
}

const encodePath = (value) => value.split("/").map(encodeURIComponent).join("/");

async function storageRequest(resource, options = {}) {
    const { url, key } = storageConfig();
    const response = await fetch(`${url}/storage/v1/${resource}`, {
        ...options,
        headers: { Authorization: `Bearer ${key}`, apikey: key, ...options.headers },
        signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
        const detail = await response.text().catch(() => "");
        console.error("Supabase profile photo storage error:", response.status, detail);
        throw Object.assign(new Error("Profile photo storage request failed."), { statusCode: 502 });
    }
    return response;
}

async function uploadProfilePhoto(userId, filename, fileBuffer, mimeType) {
    const extensions = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };
    const normalizedMimeType = mimeType.split(";", 1)[0].trim().toLowerCase();
    const extension = extensions[normalizedMimeType] || path.extname(filename).toLowerCase() || ".jpg";
    const storagePath = `${userId}/avatar${extension}`;

    await storageRequest(`object/${BUCKET_NAME}/${encodePath(storagePath)}`, {
        method: "POST",
        headers: { "Content-Type": normalizedMimeType, "x-upsert": "true" },
        body: fileBuffer,
    });
    return storagePath;
}

async function getProfilePhotoUrl(storagePath, expiresInSeconds = 3600) {
    if (!storagePath) return null;
    const response = await storageRequest(`object/sign/${BUCKET_NAME}/${encodePath(storagePath)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiresIn: expiresInSeconds }),
    });
    const data = await response.json();
    if (!data.signedURL) throw new Error("Storage did not return a profile photo URL.");
    return `${storageConfig().url}/storage/v1${data.signedURL}`;
}

async function deleteProfilePhoto(storagePath) {
    if (!storagePath) return;
    await storageRequest(`object/${BUCKET_NAME}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes: [storagePath] }),
    });
}

module.exports = { uploadProfilePhoto, getProfilePhotoUrl, deleteProfilePhoto, BUCKET_NAME };
