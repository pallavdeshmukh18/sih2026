/**
 * Centralized Error Handling Middleware
 */
function errorHandler(err, req, res, next) {
    console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, err.message || err);

    if (err.name === "MulterError") {
        if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
                success: false,
                message: "Uploaded file exceeds maximum allowed size.",
            });
        }
        return res.status(400).json({
            success: false,
            message: `File upload error: ${err.message}`,
        });
    }

    if (err.code === "23P01") return res.status(409).json({ success: false, message: "This appointment overlaps another active booking." });
    if (err.code === "22P02" || err.code === "22007" || err.code === "22008") return res.status(400).json({ success: false, message: "Invalid identifier or date." });
    const statusCode = err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);

    return res.status(statusCode).json({
        success: false,
        message: statusCode >= 500 ? "An internal server error occurred. Please try again." : (err.message || "Request failed."),
        ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
    });
}

module.exports = errorHandler;
