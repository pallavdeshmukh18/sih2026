const pool = require("../config/db");

/**
 * 1. Create a new Appointment
 * POST /api/appointments
 */
async function createAppointment(req, res, next) {
    try {
        const { doctorId, scheduledAt, durationMinutes = 30, appointmentType = "in_person", reason, notes } = req.body;
        const patientId = req.user.role === "patient" ? req.user.id : req.body.patientId;

        if (!patientId || !doctorId || !scheduledAt) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: doctorId, scheduledAt",
            });
        }

        // Verify doctor exists and has doctor profile
        const doctorCheck = await pool.query(
            `SELECT user_id FROM doctor_profiles WHERE user_id = $1 AND verification_status = 'verified';`,
            [doctorId]
        );
        if (doctorCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Verified doctor not found with the provided ID.",
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

        const insertQuery = `
            INSERT INTO appointments (patient_id, doctor_id, scheduled_at, duration_minutes, appointment_type, reason, notes, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled')
            RETURNING *;
        `;
        const result = await pool.query(insertQuery, [
            patientId,
            doctorId,
            scheduledAt,
            durationMinutes,
            appointmentType,
            reason || null,
            notes || null,
        ]);

        return res.status(201).json({
            success: true,
            message: "Appointment booked successfully",
            appointment: result.rows[0],
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

        const result = await pool.query(
            `SELECT a.*, 
                    u.first_name AS doctor_first_name, u.last_name AS doctor_last_name,
                    d.specialization, d.department,
                    cs.id AS clinical_session_id, cs.status AS clinical_session_status
             FROM appointments a
             JOIN users u ON a.doctor_id = u.id
             LEFT JOIN doctor_profiles d ON a.doctor_id = d.user_id
             LEFT JOIN clinical_sessions cs ON a.id = cs.appointment_id
             WHERE a.patient_id = $1
             ORDER BY a.scheduled_at DESC;`,
            [patientId]
        );

        return res.status(200).json({
            success: true,
            appointments: result.rows,
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
             LEFT JOIN clinical_sessions cs ON a.id = cs.appointment_id
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

        const result = await pool.query(
            `UPDATE appointments
             SET status = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING *;`,
            [status, appointmentId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Appointment not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: `Appointment status updated to '${status}'`,
            appointment: result.rows[0],
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    createAppointment,
    getPatientAppointments,
    getAppointmentById,
    updateAppointmentStatus,
};
