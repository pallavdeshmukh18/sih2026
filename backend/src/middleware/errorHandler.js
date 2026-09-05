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

    const statusCode = err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);

    return res.status(statusCode).json({
        success: false,
        message: err.message || "An internal server error occurred",
        ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
    });
}

module.exports = errorHandler;
