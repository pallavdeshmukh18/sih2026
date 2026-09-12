const pool = require("../config/db");

/**
 * 1. Create a new Appointment
 * POST /api/appointments
 */
/**
 * 1. Create a new Appointment
 * POST /api/appointments
 */
async function createAppointment(req, res, next) {
    try {
        const { doctorId, scheduledAt, durationMinutes = 30, appointmentType = "in_person", reason, notes, sessionId, clinicalSessionId } = req.body;
        const patientId = req.user.role === "patient" ? req.user.id : req.body.patientId;
        const activeSessionId = sessionId || clinicalSessionId;

        if (!patientId || !doctorId || !scheduledAt) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: doctorId, scheduledAt",
            });
        }

        const scheduledDate = new Date(scheduledAt);
        if (!Number.isFinite(scheduledDate.getTime()) || scheduledDate <= new Date()
            || !Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 240
            || !["in_person", "video", "follow_up"].includes(appointmentType)) {
            return res.status(400).json({ message: "Choose a future appointment, a valid type, and duration between 1 and 240 minutes." });
        }

        // REQUIREMENT 5 & 12: Enforce completed AI clinical assessment before booking
        if (!activeSessionId) {
            return res.status(400).json({
                success: false,
                message: "An AI clinical intake assessment must be completed before booking an appointment.",
            });
        }

        // Verify clinical session exists, belongs to patient, and is completed
        const sessionCheck = await pool.query(
            `SELECT id, patient_id, status, chief_complaint FROM clinical_sessions WHERE id = $1;`,
            [activeSessionId]
        );
        if (sessionCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Clinical intake assessment session not found.",
            });
        }

        const session = sessionCheck.rows[0];
        if (session.patient_id !== patientId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized: Clinical intake session belongs to another patient.",
            });
        }

        if (session.status !== "completed") {
            return res.status(400).json({
                success: false,
                message: "Clinical intake assessment is incomplete. Please finish the assessment before booking.",
            });
        }

        // REQUIREMENT 2: Verify doctor exists, is active, and verified
        const doctorCheck = await pool.query(
            `SELECT u.id
             FROM users u
             JOIN doctor_profiles d ON u.id = d.user_id
             WHERE u.id = $1
               AND u.role = 'doctor'
               AND u.is_active = true
               AND d.verification_status = 'verified';`,
            [doctorId]
        );
        if (doctorCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Verified active doctor not found with the provided ID.",
            });
        }

        // Verify patient profile exists
        const patientCheck = await pool.query(
            `SELECT user_id FROM patient_profiles WHERE user_id = $1;`,
            [patientId]
        );
        if (patientCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Patient profile not found.",
            });
        }

        // REQUIREMENT 13: Prevent double booking for same doctor and scheduled_at
        const conflictCheck = await pool.query(
            `SELECT id FROM appointments
             WHERE doctor_id = $1
               AND scheduled_at = $2
               AND status IN ('scheduled', 'confirmed');`,
            [doctorId, scheduledDate.toISOString()]
        );
        if (conflictCheck.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: "That appointment slot is no longer available.",
            });
        }

        const activeReason = reason || session.chief_complaint || "Clinical Consultation";

        const client = await pool.connect();
        try {
            await client.query("BEGIN;");

            const insertQuery = `
                INSERT INTO appointments (patient_id, doctor_id, scheduled_at, duration_minutes, appointment_type, reason, notes, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled')
                RETURNING *;
            `;
            const result = await client.query(insertQuery, [
                patientId,
                doctorId,
                scheduledDate.toISOString(),
                durationMinutes,
                appointmentType,
                activeReason,
                notes || null,
            ]);

            const newAppointment = result.rows[0];

            // Link clinical session to new appointment
            const linkedSession = await client.query(
                `UPDATE clinical_sessions SET appointment_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND appointment_id IS NULL RETURNING id;`,
                [newAppointment.id, activeSessionId]
            );

            if (!linkedSession.rows.length) {
                await client.query("ROLLBACK;");
                return res.status(409).json({ message: "This assessment is already linked to an appointment." });
            }
            await client.query("COMMIT;");

            return res.status(201).json({
                success: true,
                message: "Appointment booked successfully",
                appointment: newAppointment,
            });
        } catch (dbErr) {
            await client.query("ROLLBACK;");
            if (["23505", "23P01"].includes(dbErr.code)) { // unique constraint violation
                return res.status(409).json({
                    success: false,
                    message: "That appointment slot is no longer available.",
                });
            }
            throw dbErr;
        } finally {
            client.release();
        }
    } catch (error) {
        next(error);
    }
}

/**
 * 2. Get Available Slots for a Doctor on a Date
 * GET /api/appointments/available?doctorId=...&date=YYYY-MM-DD
 */
async function getAvailableSlots(req, res, next) {
    try {
        const { doctorId, date } = req.query;

        if (!doctorId || !date) {
            return res.status(400).json({
                success: false,
                message: "Missing required query parameters: doctorId and date (YYYY-MM-DD) are required.",
            });
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(new Date(`${date}T00:00:00Z`).getTime())) {
            return res.status(400).json({ message: "Invalid date. Use YYYY-MM-DD." });
        }
        // Verify doctor
        const docCheck = await pool.query(
            `SELECT u.id
             FROM users u
             JOIN doctor_profiles d ON u.id = d.user_id
             WHERE u.id = $1
               AND u.role = 'doctor'
               AND u.is_active = true
               AND d.verification_status = 'verified';`,
            [doctorId]
        );
        if (docCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Verified doctor not found.",
            });
        }

        // Standard clinic hours: 09:00 to 17:00, 30-min slots
        const standardSlotTimes = [
            "09:00", "09:30", "10:00", "10:30",
            "11:00", "11:30", "12:00", "12:30",
            "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"
        ];

        // Query existing booked appointments for doctor on target date
        const bookedRes = await pool.query(
            `SELECT scheduled_at, duration_minutes
             FROM appointments
             WHERE doctor_id = $1
               AND DATE(scheduled_at AT TIME ZONE 'Asia/Kolkata') = $2
               AND status IN ('scheduled', 'confirmed');`,
            [doctorId, date]
        );

        const now = new Date();

        const slots = standardSlotTimes.map(timeStr => {
            const [h, m] = timeStr.split(":").map(Number);
            const slotDateTime = new Date(`${date}T${timeStr}:00+05:30`);

            const isPast = slotDateTime <= now;
            const isBooked = bookedRes.rows.some(row => {
                const start = new Date(row.scheduled_at).getTime();
                const end = start + row.duration_minutes * 60000;
                return slotDateTime.getTime() < end && slotDateTime.getTime() + 30 * 60000 > start;
            });
            const available = !isPast && !isBooked;

            const period = h >= 12 ? "PM" : "AM";
            const displayH = h % 12 === 0 ? 12 : h % 12;
            const time12 = `${String(displayH).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;

            return {
                time: timeStr,
                time24: timeStr,
                time12,
                scheduledAt: slotDateTime.toISOString(),
                available,
            };
        });

        return res.status(200).json({
            success: true,
            doctorId,
            date,
            slots,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * 2. Get Appointments for Authenticated Patient
 * GET /api/appointments/patient
 */
async function getPatientAppointments(req, res, next) {
    try {
        const patientId = req.user.id;
        const { status } = req.query;

        let queryText = `
            SELECT a.id, a.patient_id, a.doctor_id, a.scheduled_at, a.duration_minutes, a.appointment_type, a.status, a.reason, a.notes,
                    u.first_name AS doctor_first_name, u.last_name AS doctor_last_name,
                    d.specialization, d.department,
                    cs.id AS clinical_session_id, cs.status AS clinical_session_status
             FROM appointments a
             JOIN users u ON a.doctor_id = u.id
             LEFT JOIN doctor_profiles d ON a.doctor_id = d.user_id
             LEFT JOIN LATERAL (
                 SELECT id, status FROM clinical_sessions WHERE appointment_id = a.id ORDER BY updated_at DESC LIMIT 1
             ) cs ON true
             WHERE a.patient_id = $1`;
        
        const params = [patientId];
        if (status === "upcoming") {
            queryText += ` AND a.status IN ('scheduled', 'confirmed')`;
            queryText += ` ORDER BY a.scheduled_at ASC;`;
        } else if (status) {
            queryText += ` AND a.status = $2 ORDER BY a.scheduled_at DESC;`;
            params.push(status);
        } else {
            queryText += ` ORDER BY a.scheduled_at DESC;`;
        }

        const result = await pool.query(queryText, params);

        const appointments = result.rows.map(row => ({
            id: row.id,
            patientId: row.patient_id,
            doctorId: row.doctor_id,
            scheduledAt: row.scheduled_at,
            durationMinutes: row.duration_minutes,
            appointmentType: row.appointment_type,
            status: row.status,
            reason: row.reason,
            notes: row.notes,
            doctor: {
                id: row.doctor_id,
                firstName: row.doctor_first_name,
                lastName: row.doctor_last_name,
                name: `Dr. ${row.doctor_first_name || ''} ${row.doctor_last_name || ''}`.trim(),
                specialization: row.specialization,
                department: row.department,
            },
            clinicalSession: {
                id: row.clinical_session_id,
                status: row.clinical_session_status,
            }
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
 * 3. Get Appointment Details by ID
 * GET /api/appointments/:id
 */
async function getAppointmentById(req, res, next) {
    try {
        const appointmentId = req.params.id;

        const result = await pool.query(
            `SELECT a.*,
                    pu.first_name AS patient_first_name, pu.last_name AS patient_last_name, pu.phone AS patient_phone,
                    du.first_name AS doctor_first_name, du.last_name AS doctor_last_name,
                    dp.specialization, dp.department,
                    cs.id AS clinical_session_id, cs.status AS clinical_session_status, cs.summary AS ai_intake_summary
             FROM appointments a
             JOIN users pu ON a.patient_id = pu.id
             JOIN users du ON a.doctor_id = du.id
             LEFT JOIN doctor_profiles dp ON a.doctor_id = dp.user_id
             LEFT JOIN LATERAL (
                 SELECT id, status, summary FROM clinical_sessions WHERE appointment_id = a.id ORDER BY updated_at DESC LIMIT 1
             ) cs ON true
             WHERE a.id = $1;`,
            [appointmentId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Appointment not found",
            });
        }

        const appointment = result.rows[0];

        // Access check: User must be the patient, doctor, or staff
        if (req.user.role === "patient" && appointment.patient_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized access to this appointment.",
            });
        }
        if (req.user.role === "doctor" && appointment.doctor_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized access to this appointment.",
            });
        }

        return res.status(200).json({
            success: true,
            appointment,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * 4. Update Appointment Status
 * PATCH /api/appointments/:id/status
 */
async function updateAppointmentStatus(req, res, next) {
    try {
        const appointmentId = req.params.id;
        const { status } = req.body;

        const validStatuses = ["scheduled", "confirmed", "completed", "cancelled", "no_show"];
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status. Allowed: ${validStatuses.join(", ")}`,
            });
        }

        const existing = await pool.query("SELECT * FROM appointments WHERE id = $1", [appointmentId]);
        const appointment = existing.rows[0];
        if (!appointment) return res.status(404).json({ message: "Appointment not found" });
        const isPatient = req.user.role === "patient" && appointment.patient_id === req.user.id;
        const isDoctor = req.user.role === "doctor" && appointment.doctor_id === req.user.id;
        if (!isPatient && !isDoctor) return res.status(403).json({ message: "Access denied to this appointment." });
        if (isPatient && status !== "cancelled") return res.status(403).json({ message: "Patients may only cancel appointments." });
        if (!["scheduled", "confirmed"].includes(appointment.status)) {
            return res.status(409).json({ message: "This appointment is already closed." });
        }
        const result = await pool.query(
            `UPDATE appointments SET status = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2 AND status = $3 RETURNING *;`,
            [status, appointmentId, appointment.status]
        );
        if (!result.rows.length) return res.status(409).json({ message: "Appointment changed. Please refresh." });

        return res.status(200).json({
            success: true,
            message: `Appointment status updated to '${status}'`,
            appointment: result.rows[0],
        });
    } catch (error) {
        next(error);
    }
}

async function deleteAppointment(req, res, next) {
    try {
        const appointmentId = req.params.id;
        const patientId = req.user.id;

        const check = await pool.query(
            "SELECT id FROM appointments WHERE id = $1 AND patient_id = $2;",
            [appointmentId, patientId]
        );
        if (check.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Appointment not found." });
        }

        await pool.query("UPDATE appointments SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1;", [appointmentId]);
        return res.status(200).json({ success: true, message: "Appointment cancelled successfully." });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    createAppointment,
    getAvailableSlots,
    getPatientAppointments,
    getAppointmentById,
    updateAppointmentStatus,
    deleteAppointment,
};
