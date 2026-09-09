const pool = require('../config/db');

module.exports = async function requirePractice(req, res, next) {
    try {
        if (req.user.role === 'doctor') {
            req.practiceDoctorId = req.user.id;
        } else {
            const result = await pool.query(
                'SELECT created_by_doctor_id FROM users WHERE id = $1 AND is_active = true', [req.user.id]
            );
            req.practiceDoctorId = result.rows[0]?.created_by_doctor_id;
        }
        if (!req.practiceDoctorId) return res.status(403).json({ message: 'An active practice assignment is required.' });
        next();
    } catch (error) { next(error); }
};
