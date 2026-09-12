const path = require('path');
const fs = require('fs/promises');
const BUCKET_NAME = 'medical-documents';
const LOCAL_STORAGE_DIR = path.resolve(__dirname, '../../uploads/medical-documents');

function localPath(storagePath) {
    const relative = storagePath.replace(/^local:/, '');
    const resolved = path.resolve(LOCAL_STORAGE_DIR, relative);
    if (!resolved.startsWith(LOCAL_STORAGE_DIR + path.sep)) throw new Error('Invalid storage path.');
    return resolved;
}

function storageConfig() {
    const rawUrl = process.env.SUPABASE_URL;
    const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!rawUrl || !rawKey) throw Object.assign(new Error('Private document storage is not configured.'), { statusCode: 503 });

    let url;
    try {
        url = new URL(rawUrl.trim().replace(/^['"]|['"]$/g, '')).origin;
    } catch {
        throw Object.assign(new Error('SUPABASE_URL must be a valid project URL.'), { statusCode: 503 });
    }
    const key = rawKey.trim().replace(/^['"]|['"]$/g, '');
    if (!key) throw Object.assign(new Error('Private document storage is not configured.'), { statusCode: 503 });
    return { url, key };
}

async function storageRequest(resource, options = {}) {
    const { url, key } = storageConfig();
    const response = await fetch(`${url}/storage/v1/${resource}`, {
        ...options,
        headers: { Authorization: `Bearer ${key}`, apikey: key, ...options.headers },
        signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
        const detail = await response.text().catch(() => '');
        // Supabase's error body contains the actionable reason, but never log credentials.
        console.error('Supabase medical document storage error:', response.status, detail.slice(0, 1000));
        const messages = {
            400: 'Document storage rejected the upload.',
            401: 'Document storage credentials are invalid.',
            403: 'Document storage access was denied.',
            404: `Document storage bucket '${BUCKET_NAME}' was not found.`,
            409: 'A document already exists at this storage path.',
        };
        throw Object.assign(new Error(messages[response.status] || 'Private document storage request failed.'), { statusCode: response.status >= 400 && response.status < 500 ? response.status : 502 });
    }
    return response;
}

const encodePath = value => value.split('/').map(encodeURIComponent).join('/');

async function uploadMedicalDocument(patientId, documentId, filename, fileBuffer, mimeType) {
    const safeName = path.basename(filename.replaceAll('\\', '/')).replace(/[\x00-\x1f]/g, '_');
    const storagePath = `${patientId}/${documentId}/${safeName}`;
    const useLocal = process.env.DOCUMENT_STORAGE_PROVIDER === 'local' || (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY);
    if (useLocal && process.env.NODE_ENV !== 'production') {
        const target = localPath(storagePath);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, fileBuffer, { mode: 0o600 });
        return { storagePath: `local:${storagePath}`, provider: 'local_filesystem' };
    }
    await storageRequest(`object/${BUCKET_NAME}/${encodePath(storagePath)}`, {
        method: 'POST', headers: { 'Content-Type': mimeType }, body: fileBuffer,
    });
    return { storagePath, provider: 'supabase' };
}

async function getLocalDocumentPath(storagePath) {
    // Also recognize files saved by the old unmarked development fallback.
    const target = localPath(storagePath);
    try { await fs.access(target); return target; } catch { return null; }
}

async function getDocumentDownloadUrl(storagePath, expiresInSeconds = 60) {
    const local = await getLocalDocumentPath(storagePath);
    if (local || storagePath.startsWith('local:')) {
        return null;
    }
    const response = await storageRequest(`object/sign/${BUCKET_NAME}/${encodePath(storagePath)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresIn: expiresInSeconds }),
    });
    const data = await response.json();
    if (!data.signedURL) throw new Error('Storage did not return a download URL.');
    return `${storageConfig().url}/storage/v1${data.signedURL}`;
}

async function deleteMedicalDocument(storagePath) {
    const local = await getLocalDocumentPath(storagePath);
    if (local) {
        try { await fs.unlink(local); } catch (e) {}
        return;
    }
    if (storagePath.startsWith('local:')) return;
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
    await storageRequest(`object/${BUCKET_NAME}`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefixes: [storagePath] }),
    });
}

module.exports = { uploadMedicalDocument, getDocumentDownloadUrl, deleteMedicalDocument, getLocalDocumentPath, BUCKET_NAME };
