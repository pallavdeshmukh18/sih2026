const pool = require("../config/db");
const profilePhotoStorage = require("../services/profilePhotoStorageService");

async function uploadProfilePhoto(req, res, next) {
    let uploadedPath = null;
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "Please select a profile photo." });
        }

        const existing = await pool.query("SELECT profile_photo_path FROM users WHERE id = $1", [req.user.id]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        uploadedPath = await profilePhotoStorage.uploadProfilePhoto(
            req.user.id,
            req.file.originalname,
            req.file.buffer,
            req.file.mimetype
        );

        const profilePhotoUrl = await profilePhotoStorage.getProfilePhotoUrl(uploadedPath);

        await pool.query(
            "UPDATE users SET profile_photo_path = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
            [uploadedPath, req.user.id]
        );

        const oldPath = existing.rows[0].profile_photo_path;
        if (oldPath && oldPath !== uploadedPath) {
            await profilePhotoStorage.deleteProfilePhoto(oldPath).catch((error) => {
                console.warn("Could not remove previous profile photo:", error.message);
            });
        }
        return res.status(200).json({ success: true, profilePhotoUrl });
    } catch (error) {
        if (uploadedPath) await profilePhotoStorage.deleteProfilePhoto(uploadedPath).catch(() => {});
        next(error);
    }
}

module.exports = { uploadProfilePhoto };
