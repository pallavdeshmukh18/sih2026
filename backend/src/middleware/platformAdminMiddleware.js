// Clinic staff roles are not platform verification authority.
module.exports = function requirePlatformAdmin(req, res, next) {
    const administrators = (process.env.PLATFORM_ADMIN_USER_IDS || '').split(',').map(id => id.trim()).filter(Boolean);
    if (!administrators.includes(req.user.id)) {
        return res.status(403).json({ message: 'Platform administrator authorization is required.' });
    }
    next();
};
