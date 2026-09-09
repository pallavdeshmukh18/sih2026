const pool = require("../config/db");
const { normalizePhone, isValidIndianPhone } = require("../utils/phoneUtils");
const { normalizeEmail, isValidEmail } = require("../utils/emailUtils");

/**
 * 1. Get Receptionist Front-Desk Stats
 * GET /api/receptionist/stats
 */
async function getReceptionistStats(req, res, next) {
    try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const todayApptsRes = await pool.query(
            `SELECT status, COUNT(*) as count
             FROM appointments
             WHERE scheduled_at >= $1 AND scheduled_at <= $2 AND doctor_id = $3
             GROUP BY status;`,
            [todayStart.toISOString(), todayEnd.toISOString(), req.practiceDoctorId]
        );

        let totalToday = 0;
        let checkedIn = 0;
        let completed = 0;
        let scheduled = 0;
        let cancelled = 0;

        todayApptsRes.rows.forEach(r => {
            const cnt = parseInt(r.count, 10);
            totalToday += cnt;
            if (r.status === 'confirmed' || r.status === 'checked_in') checkedIn += cnt;
            else if (r.status === 'completed') completed += cnt;
            else if (r.status === 'scheduled') scheduled += cnt;
            else if (r.status === 'cancelled') cancelled += cnt;
        });

        const doctorsRes = await pool.query(
            `SELECT COUNT(*) as count
             FROM users u
             JOIN doctor_profiles d ON u.id = d.user_id
             WHERE u.role = 'doctor' AND u.is_active = true AND d.verification_status = 'verified' AND u.id = $1;`, [req.practiceDoctorId]
        );
        const availableDoctors = parseInt(doctorsRes.rows[0]?.count || 0, 10);

        const patientsRes = await pool.query(
            `SELECT COUNT(DISTINCT patient_id) as count FROM appointments WHERE doctor_id = $1;`, [req.practiceDoctorId]
        );
        const totalPatients = parseInt(patientsRes.rows[0]?.count || 0, 10);

        return res.status(200).json({
            success: true,
            stats: {
                totalToday,
                checkedIn,
                waiting: scheduled + checkedIn,
                completed,
                cancelled,
                availableDoctors,
                totalPatients,
            },
        });
    } catch (error) {
        next(error);
    }
}

/**
 * 2. Get Hospital-wide Appointments for Front-Desk
 * GET /api/receptionist/appointments
 */
async function getReceptionistAppointments(req, res, next) {
    try {
        const { date, doctorId, status, search } = req.query;

        let query = `
            SELECT a.id, a.patient_id, a.doctor_id, a.scheduled_at, a.duration_minutes,
                   a.appointment_type, a.status, a.created_at,
                   pu.first_name AS patient_first_name, pu.last_name AS patient_last_name,
                   pu.phone AS patient_phone, pu.email AS patient_email,
                   pp.date_of_birth AS patient_dob, pp.gender AS patient_gender, pp.abha_id,
                   du.first_name AS doctor_first_name, du.last_name AS doctor_last_name,
                   dp.specialization, dp.department,
                   cs.id AS clinical_session_id, cs.status AS clinical_session_status
            FROM appointments a
            JOIN users pu ON a.patient_id = pu.id
            LEFT JOIN patient_profiles pp ON pu.id = pp.user_id
            JOIN users du ON a.doctor_id = du.id
            LEFT JOIN doctor_profiles dp ON du.id = dp.user_id
            LEFT JOIN clinical_sessions cs ON a.id = cs.appointment_id
            WHERE a.doctor_id = $1
        `;

        const values = [req.practiceDoctorId];
        let paramIndex = 2;

        if (date) {
            query += ` AND DATE(a.scheduled_at) = $${paramIndex++}`;
            values.push(date);
        }

        if (doctorId) {
            query += ` AND a.doctor_id = $${paramIndex++}`;
            values.push(doctorId);
        }

        if (status && status !== 'all') {
            query += ` AND a.status = $${paramIndex++}`;
            values.push(status);
        }

        if (search) {
            query += ` AND (
                pu.first_name ILIKE $${paramIndex} OR
                pu.last_name ILIKE $${paramIndex} OR
                pu.phone ILIKE $${paramIndex} OR
                pp.abha_id ILIKE $${paramIndex}
            )`;
            values.push(`%${search}%`);
            paramIndex++;
        }

        query += ` ORDER BY a.scheduled_at ASC;`;

        const result = await pool.query(query, values);

        const appointments = result.rows.map(row => ({
            id: row.id,
            scheduledAt: row.scheduled_at,
            durationMinutes: row.duration_minutes,
            appointmentType: row.appointment_type,
            status: row.status,
            patient: {
                id: row.patient_id,
                firstName: row.patient_first_name,
                lastName: row.patient_last_name,
                name: `${row.patient_first_name} ${row.patient_last_name || ''}`.trim(),
                phone: row.patient_phone,
                email: row.patient_email,
                dateOfBirth: row.patient_dob,
                gender: row.patient_gender,
                abhaId: row.abha_id,
            },
            doctor: {
                id: row.doctor_id,
                firstName: row.doctor_first_name,
                lastName: row.doctor_last_name,
                name: `Dr. ${row.doctor_first_name} ${row.doctor_last_name || ''}`.trim(),
                specialization: row.specialization,
                department: row.department,
            },
            intake: {
                sessionId: row.clinical_session_id,
                status: row.clinical_session_status || 'not_started',
            },
        }));

        return res.status(200).json({
            success: true,
            appointments,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * 3. Quick Check-In Patient for Appointment
 * POST /api/receptionist/check-in/:appointmentId
 */
async function checkInAppointment(req, res, next) {
    try {
        const { appointmentId } = req.params;

        if (!appointmentId) {
            return res.status(400).json({
                success: false,
                message: "Appointment ID is required",
            });
        }

        const result = await pool.query(
            `UPDATE appointments
             SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND doctor_id = $2 AND status = 'scheduled'
             RETURNING id, scheduled_at, status;`,
            [appointmentId, req.practiceDoctorId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Appointment not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Patient successfully checked in.",
            appointment: result.rows[0],
        });
    } catch (error) {
        next(error);
    }
}

/**
 * 4. Register Walk-In Patient and Optionally Book Appointment
 * POST /api/receptionist/patients/walk-in
 */
async function registerWalkInPatient(req, res, next) {
    const client = await pool.connect();
    try {
        const {
            firstName,
            lastName,
            phone,
            email,
            dateOfBirth,
            gender,
            abhaId,
            doctorId,
            scheduledAt,
            reason,
        } = req.body;

        if (!firstName || (!phone && !email)) {
            return res.status(400).json({
                success: false,
                message: "First name and at least one contact (phone or email) are required.",
            });
        }

        let normalizedPhone = null;
        if (phone) {
            normalizedPhone = normalizePhone(phone);
            if (!isValidIndianPhone(normalizedPhone)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid Indian phone number format.",
                });
            }
        }

        let normalizedEmail = null;
        if (email) {
            normalizedEmail = normalizeEmail(email);
            if (!isValidEmail(normalizedEmail)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid email format.",
                });
            }
        }

        await client.query("BEGIN;");

        let existingUser = null;
        if (normalizedPhone) {
            const phoneCheck = await client.query(
                "SELECT id, first_name, last_name, role FROM users WHERE phone = $1;",
                [normalizedPhone]
            );
            if (phoneCheck.rows.length > 0) {
                existingUser = phoneCheck.rows[0];
            }
        }

        if (!existingUser && normalizedEmail) {
            const emailCheck = await client.query(
                "SELECT id, first_name, last_name, role FROM users WHERE email = $1;",
                [normalizedEmail]
            );
            if (emailCheck.rows.length > 0) {
                existingUser = emailCheck.rows[0];
            }
        }

        let patientUserId;
        if (existingUser && existingUser.role !== 'patient') {
            await client.query("ROLLBACK;");
            return res.status(409).json({ message: "This contact belongs to a non-patient account." });
        }
        if (existingUser) {
            patientUserId = existingUser.id;
        } else {
            const loginMethod = normalizedPhone ? 'phone' : 'email';
            const userRes = await client.query(
                `INSERT INTO users (first_name, last_name, phone, email, role, login_method, is_active)
                 VALUES ($1, $2, $3, $4, 'patient', $5, true)
                 RETURNING id;`,
                [firstName, lastName || null, normalizedPhone, normalizedEmail, loginMethod]
            );
            patientUserId = userRes.rows[0].id;

            await client.query(
                `INSERT INTO patient_profiles (user_id, date_of_birth, gender, abha_id)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (user_id) DO UPDATE SET
                    date_of_birth = COALESCE(EXCLUDED.date_of_birth, patient_profiles.date_of_birth),
                    gender = COALESCE(EXCLUDED.gender, patient_profiles.gender),
                    abha_id = COALESCE(EXCLUDED.abha_id, patient_profiles.abha_id);`,
                [patientUserId, dateOfBirth || null, gender || null, abhaId || null]
            );
        }

        let appointment = null;
        if (doctorId) {
            if (doctorId !== req.practiceDoctorId) {
                await client.query("ROLLBACK;");
                return res.status(403).json({ message: "You may only book for your assigned practice." });
            }
            const apptTime = scheduledAt || new Date().toISOString();
            const apptRes = await client.query(
                `INSERT INTO appointments (patient_id, doctor_id, scheduled_at, duration_minutes, appointment_type, reason, status)
                 VALUES ($1, $2, $3, 30, 'in_person', $4, 'confirmed')
                 RETURNING *;`,
                [patientUserId, doctorId, apptTime, reason || "Walk-in Consultation"]
            );
            appointment = apptRes.rows[0];
        }

        await client.query("COMMIT;");

        return res.status(201).json({
            success: true,
            message: existingUser
                ? "Existing patient found and checked in for appointment."
                : "Walk-in patient registered and checked in successfully.",
            patient: {
                id: patientUserId,
                firstName,
                lastName,
                phone: normalizedPhone,
                email: normalizedEmail,
                isExisting: !!existingUser,
            },
            appointment,
        });
    } catch (error) {
        await client.query("ROLLBACK;");
        next(error);
    } finally {
        client.release();
    }
}

/**
 * 5. Get Patients Directory for Front-Desk
 * GET /api/receptionist/patients
 */
async function getReceptionistPatients(req, res, next) {
    try {
        const { search, limit = 50, offset = 0 } = req.query;
        if (!Number.isInteger(Number(limit)) || Number(limit) < 1 || Number(limit) > 100 || !Number.isInteger(Number(offset)) || Number(offset) < 0) {
            return res.status(400).json({ message: "Use a limit between 1 and 100 and a non-negative offset." });
        }
        let query = `
            SELECT u.id, u.first_name, u.last_name, u.phone, u.email, u.created_at,
                   pp.date_of_birth, pp.gender, pp.abha_id, pp.state,
                   COUNT(a.id) as total_appointments
            FROM users u
            LEFT JOIN patient_profiles pp ON u.id = pp.user_id
            LEFT JOIN appointments a ON u.id = a.patient_id
            WHERE u.role = 'patient' AND EXISTS (SELECT 1 FROM appointments practice_a WHERE practice_a.patient_id = u.id AND practice_a.doctor_id = $1)
        `;

        const values = [req.practiceDoctorId];
        let paramIndex = 2;

        if (search) {
            query += ` AND (
                u.first_name ILIKE $${paramIndex} OR
                u.last_name ILIKE $${paramIndex} OR
                u.phone ILIKE $${paramIndex} OR
                u.email ILIKE $${paramIndex} OR
                pp.abha_id ILIKE $${paramIndex}
            )`;
            values.push(`%${search}%`);
            paramIndex++;
        }

        query += ` GROUP BY u.id, pp.date_of_birth, pp.gender, pp.abha_id, pp.state
                   ORDER BY u.created_at DESC
                   LIMIT $${paramIndex++} OFFSET $${paramIndex++};`;
        values.push(parseInt(limit, 10), parseInt(offset, 10));

        const result = await pool.query(query, values);

        const patients = result.rows.map(r => ({
            id: r.id,
            firstName: r.first_name,
            lastName: r.last_name,
            name: `${r.first_name} ${r.last_name || ''}`.trim(),
            phone: r.phone,
            email: r.email,
            dateOfBirth: r.date_of_birth,
            gender: r.gender,
            state: r.state,
            abhaId: r.abha_id,
            createdAt: r.created_at,
            totalAppointments: parseInt(r.total_appointments || 0, 10),
        }));

        return res.status(200).json({
            success: true,
            patients,
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    getReceptionistStats,
    getReceptionistAppointments,
    checkInAppointment,
    registerWalkInPatient,
    getReceptionistPatients,
};
