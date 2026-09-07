const pool = require("../config/db");

/**
 * 1. Get Doctor's Appointment & Triage Queue
 * GET /api/doctor/queue
 */
async function getDoctorQueue(req, res, next) {
    try {
        const doctorId = req.user.id;

        const result = await pool.query(
            `SELECT a.id AS appointment_id, a.scheduled_at, a.duration_minutes, a.appointment_type, a.status AS appointment_status, a.reason,
                    u.id AS patient_id, u.first_name AS patient_first_name, u.last_name AS patient_last_name, u.phone AS patient_phone, u.email AS patient_email,
                    p.date_of_birth, p.gender, p.abha_id,
                    cs.id AS session_id, cs.status AS intake_status, cs.chief_complaint, cs.current_state->>'red_flags' AS red_flags_json,
                    cs.summary AS ai_intake_summary
             FROM appointments a
             JOIN users u ON a.patient_id = u.id
             LEFT JOIN patient_profiles p ON u.id = p.user_id
             LEFT JOIN clinical_sessions cs ON a.id = cs.appointment_id
             WHERE a.doctor_id = $1
             ORDER BY a.scheduled_at ASC;`,
            [doctorId]
        );

        // Format and parse red flags
        const queue = result.rows.map(row => {
            let redFlags = [];
            try {
                if (row.red_flags_json) {
                    redFlags = JSON.parse(row.red_flags_json);
                }
            } catch (e) {}

            return {
                appointmentId: row.appointment_id,
                scheduledAt: row.scheduled_at,
                durationMinutes: row.duration_minutes,
                appointmentType: row.appointment_type,
                appointmentStatus: row.appointment_status,
                patient: {
                    id: row.patient_id,
                    firstName: row.patient_first_name,
                    lastName: row.patient_last_name,
                    phone: row.patient_phone,
                    email: row.patient_email,
                    dateOfBirth: row.date_of_birth,
                    gender: row.gender,
                    abhaId: row.abha_id,
                },
                intake: {
                    sessionId: row.session_id,
                    status: row.intake_status || "not_started",
                    chiefComplaint: row.chief_complaint || row.reason,
                    redFlags: Array.isArray(redFlags) ? redFlags : [],
                    aiSummary: row.ai_intake_summary,
                },
            };
        });

        return res.status(200).json({
            success: true,
            queue,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * 2. Get Unified Patient History for Doctor Review
 * GET /api/doctor/patient/:id/unified-history
 */
async function getPatientUnifiedHistory(req, res, next) {
    try {
        const patientId = req.params.id;

        // 1. Fetch Patient Demographics & Profile
        const userRes = await pool.query(
            `SELECT u.id, u.first_name, u.last_name, u.email, u.phone,
                    p.date_of_birth, p.gender, p.abha_id
             FROM users u
             LEFT JOIN patient_profiles p ON u.id = p.user_id
             WHERE u.id = $1;`,
            [patientId]
        );

        if (userRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Patient not found",
            });
        }

        const patient = userRes.rows[0];

        // 2. Fetch Medical History (conditions, allergies, surgeries, family history)
        const medHistoryRes = await pool.query(
            `SELECT * FROM medical_history WHERE patient_id = $1 ORDER BY created_at DESC;`,
            [patientId]
        );

        // 3. Fetch Clinical Intake Sessions
        const sessionsRes = await pool.query(
            `SELECT * FROM clinical_sessions WHERE patient_id = $1 ORDER BY created_at DESC;`,
            [patientId]
        );

        // 4. Fetch Documents and OCR text
        const docsRes = await pool.query(
            `SELECT d.*, o.extracted_text, o.status AS ocr_status, s.summary AS doc_summary
             FROM documents d
             LEFT JOIN document_ocr o ON d.id = o.document_id
             LEFT JOIN ai_summaries s ON d.id = s.document_id
             WHERE d.patient_id = $1
             ORDER BY d.created_at DESC;`,
            [patientId]
        );

        // 5. Fetch Past Consultations
        const consultationsRes = await pool.query(
            `SELECT c.*, a.scheduled_at, u.first_name AS doctor_first_name, u.last_name AS doctor_last_name
             FROM consultations c
             JOIN appointments a ON c.appointment_id = a.id
             JOIN users u ON a.doctor_id = u.id
             WHERE a.patient_id = $1
             ORDER BY c.created_at DESC;`,
            [patientId]
        );

        return res.status(200).json({
            success: true,
            unifiedHistory: {
                patient,
                medicalHistory: medHistoryRes.rows,
                clinicalSessions: sessionsRes.rows,
                documents: docsRes.rows,
                pastConsultations: consultationsRes.rows,
            },
        });
    } catch (error) {
        next(error);
    }
}

/**
 * 3. Doctor Review, Edit and Confirm Consultation
 * POST /api/doctor/consultations/:appointmentId/confirm
 */
async function confirmConsultation(req, res, next) {
    const client = await pool.connect();
    try {
        const appointmentId = req.params.appointmentId;
        const doctorId = req.user.id;
        const { chiefComplaint, clinicalNotes, diagnosis, treatmentNotes, startedAt } = req.body;

        if (!diagnosis && !clinicalNotes) {
            return res.status(400).json({
                success: false,
                message: "Diagnosis or clinical notes are required to confirm consultation.",
            });
        }

        // Verify appointment exists and belongs to doctor
        const apptRes = await client.query(
            `SELECT id, patient_id, doctor_id, status FROM appointments WHERE id = $1;`,
            [appointmentId]
        );
        if (apptRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Appointment not found.",
            });
        }

        const appointment = apptRes.rows[0];
        if (appointment.doctor_id !== doctorId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized: You are not the assigned doctor for this appointment.",
            });
        }

        // Check if there is an associated clinical session
        const sessionRes = await client.query(
            `SELECT id FROM clinical_sessions WHERE appointment_id = $1 ORDER BY created_at DESC LIMIT 1;`,
            [appointmentId]
        );
        const sessionId = sessionRes.rows.length > 0 ? sessionRes.rows[0].id : null;

        await client.query("BEGIN;");

        // Insert or Update consultation record
        const consultQuery = `
            INSERT INTO consultations (appointment_id, started_at, ended_at, chief_complaint, clinical_notes, diagnosis, treatment_notes, session_id)
            VALUES ($1, COALESCE($2, CURRENT_TIMESTAMP - INTERVAL '15 minutes'), CURRENT_TIMESTAMP, $3, $4, $5, $6, $7)
            ON CONFLICT (appointment_id) 
            DO UPDATE SET 
                ended_at = CURRENT_TIMESTAMP,
                chief_complaint = EXCLUDED.chief_complaint,
                clinical_notes = EXCLUDED.clinical_notes,
                diagnosis = EXCLUDED.diagnosis,
                treatment_notes = EXCLUDED.treatment_notes,
                session_id = COALESCE(consultations.session_id, EXCLUDED.session_id),
                updated_at = CURRENT_TIMESTAMP
            RETURNING *;
        `;
        const consultRes = await client.query(consultQuery, [
            appointmentId,
            startedAt || null,
            chiefComplaint || null,
            clinicalNotes || null,
            diagnosis || null,
            treatmentNotes || null,
            sessionId,
        ]);

        // Mark appointment as completed
        await client.query(
            `UPDATE appointments SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = $1;`,
            [appointmentId]
        );

        await client.query("COMMIT;");

        return res.status(200).json({
            success: true,
            message: "Consultation successfully confirmed and recorded.",
            consultation: consultRes.rows[0],
        });
    } catch (error) {
        await client.query("ROLLBACK;");
        next(error);
    } finally {
        client.release();
    }
}

/**
 * 4. List all pending doctor verification requests
 * GET /api/doctor/admin/pending
 * Access: doctor (superadmin acting as platform admin)
 */
async function getPendingDoctors(req, res) {
    try {
        const result = await pool.query(
            `SELECT u.id, u.first_name, u.last_name, u.email, u.created_at,
                    d.registration_number, d.specialization, d.department, d.verification_status
             FROM users u
             JOIN doctor_profiles d ON u.id = d.user_id
             WHERE d.verification_status = 'pending'
             ORDER BY u.created_at DESC;`
        );

        return res.status(200).json({
            pending: result.rows.map(r => ({
                id: r.id,
                name: `${r.first_name} ${r.last_name || ''}`.trim(),
                email: r.email,
                registrationNumber: r.registration_number,
                specialization: r.specialization,
                department: r.department,
                verificationStatus: r.verification_status,
                createdAt: r.created_at,
            })),
        });
    } catch (error) {
        console.error('Error in getPendingDoctors:', error.message);
        return res.status(500).json({ message: 'Internal server error.' });
    }
}

/**
 * 5. Verify or reject a doctor
 * PATCH /api/doctor/admin/verify/:doctorId
 * Body: { action: 'verify' | 'reject' }
 * Access: doctor (superadmin)
 */
async function verifyDoctor(req, res) {
    try {
        const { doctorId } = req.params;
        const { action } = req.body; // 'verify' | 'reject'

        if (!['verify', 'reject'].includes(action)) {
            return res.status(400).json({ message: "action must be 'verify' or 'reject'" });
        }

        const newStatus = action === 'verify' ? 'verified' : 'rejected';

        const result = await pool.query(
            `UPDATE doctor_profiles
             SET verification_status = $1,
                 verified_at = $2
             WHERE user_id = $3
             RETURNING user_id;`,
            [newStatus, action === 'verify' ? new Date() : null, doctorId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Doctor not found.' });
        }

        return res.status(200).json({
            message: `Doctor has been ${newStatus}.`,
            doctorId,
            verificationStatus: newStatus,
        });
    } catch (error) {
        console.error('Error in verifyDoctor:', error.message);
        return res.status(500).json({ message: 'Internal server error.' });
    }
}

module.exports = {
    getDoctorQueue,
    getPatientUnifiedHistory,
    confirmConsultation,
    getPendingDoctors,
    verifyDoctor,
};
