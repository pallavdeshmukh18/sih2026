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
        cb(Object.assign(new Error(`Unsupported audio format '${ext}'. Allowed: ${allowedExtensions.join(", ")}`), { statusCode: 400 }), false);
    }
};

// Document upload filter
const documentFileFilter = (req, file, cb) => {
    const allowedExtensions = [".pdf", ".png", ".jpg", ".jpeg"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
        cb(null, true);
    } else {
        cb(Object.assign(new Error(`Unsupported document format '${ext}'. Allowed: ${allowedExtensions.join(", ")}`), { statusCode: 400 }), false);
    }
};

const profilePhotoFileFilter = (req, file, cb) => {
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
    if (allowedMimeTypes.includes(file.mimetype)) return cb(null, true);
    return cb(Object.assign(new Error("Profile photos must be JPEG, PNG, or WebP."), { statusCode: 400 }), false);
};

const uploadAudio = multer({
    storage,
    limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
    fileFilter: audioFileFilter,
});

const uploadDocument = multer({
    storage,
    limits: { fileSize: 15 * 1024 * 1024 }, // Match the patient upload limit
    fileFilter: documentFileFilter,
});

const uploadProfilePhoto = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: profilePhotoFileFilter,
});

module.exports = {
    uploadAudio,
    uploadDocument,
    uploadProfilePhoto,
};
