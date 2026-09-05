const multer = require("multer");
const path = require("path");

const storage = multer.memoryStorage();

// Audio upload filter
const audioFileFilter = (req, file, cb) => {
    const allowedExtensions = [".wav", ".mp3", ".m4a", ".webm", ".ogg", ".flac"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error(`Unsupported audio format '${ext}'. Allowed: ${allowedExtensions.join(", ")}`), false);
    }
};

// Document upload filter
const documentFileFilter = (req, file, cb) => {
    const allowedExtensions = [".pdf", ".png", ".jpg", ".jpeg"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error(`Unsupported document format '${ext}'. Allowed: ${allowedExtensions.join(", ")}`), false);
    }
};

const uploadAudio = multer({
    storage,
    limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
    fileFilter: audioFileFilter,
});

const uploadDocument = multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
    fileFilter: documentFileFilter,
});

module.exports = {
    uploadAudio,
    uploadDocument,
};
