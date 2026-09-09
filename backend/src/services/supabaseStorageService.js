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
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw Object.assign(new Error('Private document storage is not configured.'), { statusCode: 503 });
    return { url, key };
}

async function storageRequest(resource, options = {}) {
    const { url, key } = storageConfig();
    const response = await fetch(`${url}/storage/v1/${resource}`, {
        ...options,
        headers: { Authorization: `Bearer ${key}`, ...options.headers },
        signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw Object.assign(new Error('Private document storage request failed.'), { statusCode: 502 });
    return response;
}

const encodePath = value => value.split('/').map(encodeURIComponent).join('/');

async function uploadMedicalDocument(patientId, documentId, filename, fileBuffer, mimeType) {
    const safeName = path.basename(filename.replaceAll('\\', '/')).replace(/[\x00-\x1f]/g, '_');
    const storagePath = `${patientId}/${documentId}/${safeName}`;
    // Local storage is deliberate development configuration, never a cloud-failure fallback.
    if (process.env.DOCUMENT_STORAGE_PROVIDER === 'local' && process.env.NODE_ENV !== 'production') {
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
    if (local) { await fs.unlink(local); return; }
    if (storagePath.startsWith('local:')) return;
    await storageRequest(`object/${BUCKET_NAME}`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefixes: [storagePath] }),
    });
}

module.exports = { uploadMedicalDocument, getDocumentDownloadUrl, deleteMedicalDocument, getLocalDocumentPath, BUCKET_NAME };
