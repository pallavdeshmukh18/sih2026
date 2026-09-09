const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { JWT_SECRET } = require('../config/auth');

module.exports = async function authenticateToken(req, res, next) {
    const match = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization || '');
    if (!match) return res.status(401).json({ message: 'Authentication token required' });
    let decoded;
    try {
        decoded = jwt.verify(match[1], JWT_SECRET, { algorithms: ['HS256'] });
    } catch {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
    const id = decoded.sub || decoded.id;
    if (typeof id !== 'string' || !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id)) {
        return res.status(401).json({ message: 'Invalid account token' });
    }
    try {
        const result = await pool.query(
            `SELECT u.id, u.role, u.is_active, d.verification_status
             FROM users u LEFT JOIN doctor_profiles d ON d.user_id = u.id WHERE u.id = $1`, [id]
        );
        const user = result.rows[0];
        if (!user?.is_active || user.role !== decoded.role) {
            return res.status(401).json({ message: 'Account is inactive or the session is no longer valid.' });
        }
        if (user.role === 'doctor' && user.verification_status !== 'verified') {
            return res.status(403).json({ message: 'Doctor verification is required.' });
        }
        req.user = { id: user.id, role: user.role };
        res.setHeader('Cache-Control', 'no-store');
        next();
    } catch (error) { next(error); }
};
