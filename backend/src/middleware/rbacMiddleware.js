/**
 * Role-Based Access Control (RBAC) Middleware for MediKiosk
 * Ensures the authenticated user has one of the allowed roles.
 */
function authorizeRoles(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Requires one of roles: [${allowedRoles.join(", ")}]. Current role: ${req.user.role}`,
            });
        }

        next();
    };
}

module.exports = authorizeRoles;
