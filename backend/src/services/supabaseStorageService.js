const path = require("path");
const fs = require("fs");

const BUCKET_NAME = "medical-documents";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

// Local upload storage directory fallback for dev/testing
const LOCAL_STORAGE_DIR = path.join(__dirname, "../../uploads/medical-documents");

/**
 * Ensures local storage directory exists
 */
function ensureLocalDir(subDir = "") {
    const fullPath = path.join(LOCAL_STORAGE_DIR, subDir);
    if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
    }
    return fullPath;
}

/**
 * Uploads a document to Supabase Storage or Local Storage Fallback
 */
async function uploadMedicalDocument(patientId, documentId, filename, fileBuffer, mimeType) {
    const storagePath = `${patientId}/${documentId}/${filename}`;

    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
        try {
            const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET_NAME}/${storagePath}`;
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
                    "Content-Type": mimeType || "application/octet-stream",
                    "x-upsert": "true",
                },
                body: fileBuffer,
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("Supabase Storage upload failed:", response.status, errorText);
                throw new Error(`Failed to upload to Supabase Storage: ${errorText}`);
            }

            console.log(`[STORAGE] Uploaded document to Supabase bucket: ${storagePath}`);
            return {
                storagePath,
                bucket: BUCKET_NAME,
                provider: "supabase",
            };
        } catch (err) {
            console.warn("[STORAGE] Falling back to local storage provider due to:", err.message);
        }
    }

    // Local file fallback
    const targetDir = ensureLocalDir(`${patientId}/${documentId}`);
    const filePath = path.join(targetDir, filename);
    fs.writeFileSync(filePath, fileBuffer);

    console.log(`[LOCAL STORAGE] Saved document: ${filePath}`);
    return {
        storagePath,
        bucket: BUCKET_NAME,
        provider: "local_filesystem",
        localPath: filePath,
    };
}

/**
 * Generates a signed or accessible download URL
 */
async function getDocumentDownloadUrl(storagePath, expiresInSeconds = 3600) {
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
        try {
            const url = `${SUPABASE_URL}/storage/v1/object/sign/${BUCKET_NAME}/${storagePath}`;
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ expiresIn: expiresInSeconds }),
            });

            if (response.ok) {
                const data = await response.json();
                return `${SUPABASE_URL}/storage/v1${data.signedURL}`;
            }
        } catch (err) {
            console.error("Error creating signed URL:", err.message);
        }
    }

    // Local signed mock URL
    return `/api/documents/raw/${encodeURIComponent(storagePath)}`;
}

module.exports = {
    uploadMedicalDocument,
    getDocumentDownloadUrl,
    BUCKET_NAME,
};
