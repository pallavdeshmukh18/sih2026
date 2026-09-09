const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const { normalizeEmail, isValidEmail } = require("../utils/emailUtils");

const { JWT_SECRET } = require("../config/auth");
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

// Valid roles that a doctor can create
const ALLOWED_STAFF_ROLES = ["admin", "receptionist", "nurse"];

// ============================================================
// CREATE STAFF ACCOUNT
// POST /api/doctor/staff/create
// Access: doctor only
// ============================================================
async function createStaffAccount(req, res) {
    try {
        const doctorUserId = req.user.id; // from JWT (set by authMiddleware)
        const { firstName, lastName, email, phone, password, role } = req.body;

        // --- Validation ---
        if (!firstName || !email || !password || !role) {
            return res.status(400).json({
                message: "Missing required fields: firstName, email, password, role",
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                message: "Password must be at least 8 characters.",
            });
        }

        if (!ALLOWED_STAFF_ROLES.includes(role)) {
            return res.status(400).json({
                message: `Invalid role '${role}'. Allowed roles: ${ALLOWED_STAFF_ROLES.join(", ")}`,
            });
        }

        const normalizedEmail = normalizeEmail(email);
        if (!isValidEmail(normalizedEmail)) {
            return res.status(400).json({
                message: "Invalid email address format.",
            });
        }

        // --- Check if email is already taken ---
        const existingUser = await pool.query(
            "SELECT id FROM users WHERE email = $1;",
            [normalizedEmail]
        );
        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                message: "An account with this email address already exists.",
            });
        }

        // --- Hash password ---
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // --- Insert into users table ---
        const insertResult = await pool.query(
            `INSERT INTO users (first_name, last_name, email, phone, password_hash, role, login_method, is_active, created_by_doctor_id)
             VALUES ($1, $2, $3, $4, $5, $6, 'email', TRUE, $7)
             RETURNING id, first_name, last_name, email, phone, role, is_active, created_at;`,
            [firstName, lastName || null, normalizedEmail, phone || null, passwordHash, role, doctorUserId]
        );

        const newStaff = insertResult.rows[0];

        return res.status(201).json({
            message: `${role} account created successfully.`,
            staff: {
                id: newStaff.id,
                firstName: newStaff.first_name,
                lastName: newStaff.last_name,
                email: newStaff.email,
                phone: newStaff.phone,
                role: newStaff.role,
                isActive: newStaff.is_active,
                createdAt: newStaff.created_at,
            },
        });
    } catch (error) {
        console.error("Error in createStaffAccount:", error.message);
        return res.status(500).json({
            message: "Internal server error while creating staff account.",
        });
    }
}

// ============================================================
// GET STAFF LIST
// GET /api/doctor/staff
// Access: doctor only — returns all staff created by this doctor
// ============================================================
async function getStaffList(req, res) {
    try {
        const doctorUserId = req.user.id;

        const result = await pool.query(
            `SELECT id, first_name, last_name, email, phone, role, is_active, created_at
             FROM users
             WHERE created_by_doctor_id = $1
               AND role = ANY($2::text[])
             ORDER BY created_at DESC;`,
            [doctorUserId, ALLOWED_STAFF_ROLES]
        );

        const staff = result.rows.map((s) => ({
            id: s.id,
            firstName: s.first_name,
            lastName: s.last_name,
            email: s.email,
            phone: s.phone,
            role: s.role,
            isActive: s.is_active,
            createdAt: s.created_at,
        }));

        return res.status(200).json({ staff });
    } catch (error) {
        console.error("Error in getStaffList:", error.message);
        return res.status(500).json({
            message: "Internal server error while fetching staff list.",
        });
    }
}

// ============================================================
// DELETE STAFF ACCOUNT
// DELETE /api/doctor/staff/:staffId
// Access: doctor only — can only remove staff they created
// ============================================================
async function deleteStaffAccount(req, res) {
    try {
        const doctorUserId = req.user.id;
        const { staffId } = req.params;

        if (!staffId || !/^[0-9a-f-]{36}$/i.test(staffId)) {
            return res.status(400).json({ message: "Invalid staff ID." });
        }

        // Verify ownership: doctor can only delete staff they created
        const staffResult = await pool.query(
            `SELECT id, role, first_name, last_name
             FROM users
             WHERE id = $1 AND created_by_doctor_id = $2 AND role = ANY($3::text[]);`,
            [parseInt(staffId), doctorUserId, ALLOWED_STAFF_ROLES]
        );

        if (staffResult.rows.length === 0) {
            return res.status(404).json({
                message: "Staff member not found or you do not have permission to remove them.",
            });
        }

        const staff = staffResult.rows[0];

        // Soft-delete: deactivate account rather than hard delete
        await pool.query(
            "UPDATE users SET is_active = FALSE WHERE id = $1;",
            [staffId]
        );

        return res.status(200).json({
            message: `${staff.first_name} ${staff.last_name || ""} has been removed.`,
            staffId: staff.id,
        });
    } catch (error) {
        console.error("Error in deleteStaffAccount:", error.message);
        return res.status(500).json({
            message: "Internal server error while deleting staff account.",
        });
    }
}

// ============================================================
// TOGGLE STAFF ACTIVE STATUS
// PATCH /api/doctor/staff/:staffId/toggle
// Access: doctor only
// ============================================================
async function toggleStaffStatus(req, res) {
    try {
        const doctorUserId = req.user.id;
        const { staffId } = req.params;

        const staffResult = await pool.query(
            `SELECT id, is_active, first_name, last_name
             FROM users
             WHERE id = $1 AND created_by_doctor_id = $2 AND role = ANY($3::text[]);`,
            [parseInt(staffId), doctorUserId, ALLOWED_STAFF_ROLES]
        );

        if (staffResult.rows.length === 0) {
            return res.status(404).json({ message: "Staff member not found." });
        }

        const staff = staffResult.rows[0];
        const newStatus = !staff.is_active;

        await pool.query(
            "UPDATE users SET is_active = $1 WHERE id = $2;",
            [newStatus, staffId]
        );

        return res.status(200).json({
            message: `${staff.first_name} is now ${newStatus ? "active" : "deactivated"}.`,
            staffId: staff.id,
            isActive: newStatus,
        });
    } catch (error) {
        console.error("Error in toggleStaffStatus:", error.message);
        return res.status(500).json({
            message: "Internal server error while toggling staff status.",
        });
    }
}

// ============================================================
// STAFF LOGIN
// POST /api/auth/staff/login
// Access: public — allows receptionist/nurse/admin to log in
// ============================================================
async function loginStaff(req, res) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required.",
            });
        }

        const normalizedEmail = normalizeEmail(email);

        const userResult = await pool.query(
            `SELECT id, first_name, last_name, email, password_hash, role, is_active, created_by_doctor_id
             FROM users
             WHERE email = $1 AND role = ANY($2::text[]);`,
            [normalizedEmail, ALLOWED_STAFF_ROLES]
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: "Invalid email or password." });
        }

        const user = userResult.rows[0];

        if (!user.is_active) {
            return res.status(403).json({
                message: "Your account has been deactivated. Please contact your doctor.",
            });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid email or password." });
        }

        const token = jwt.sign(
            {
                sub: user.id,
                role: user.role,
                doctorId: user.created_by_doctor_id,
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        return res.status(200).json({
            message: "Login successful.",
            token,
            user: {
                id: user.id,
                firstName: user.first_name,
                lastName: user.last_name,
                email: user.email,
                role: user.role,
                doctorId: user.created_by_doctor_id,
            },
        });
    } catch (error) {
        console.error("Error in loginStaff:", error.message);
        return res.status(500).json({
            message: "Internal server error during staff login.",
        });
    }
}

module.exports = {
    createStaffAccount,
    getStaffList,
    deleteStaffAccount,
    toggleStaffStatus,
    loginStaff,
};
