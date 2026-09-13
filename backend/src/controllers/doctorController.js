const pool = require("../config/db");
const { documentConsentSql } = require("../services/documentAccessService");
const { normalizeEmail, isValidEmail } = require("../utils/emailUtils");

async function updateOwnProfile(req, res, next) {
    const client = await pool.connect();
    try {
        const doctorId = req.user.id;
        const { firstName, lastName, email, registrationNumber, specialization } = req.body;
        const normalizedEmail = normalizeEmail(email);

        if (!firstName?.trim() || !normalizedEmail || !registrationNumber?.trim() || !specialization?.trim()) {
            return res.status(400).json({ message: "First name, email, medical registration number, and specialization are required." });
        }
        if (!isValidEmail(normalizedEmail)) {
            return res.status(400).json({ message: "Invalid email address format." });
        }

        await client.query("BEGIN");
        const emailOwner = await client.query("SELECT id FROM users WHERE email = $1 AND id <> $2", [normalizedEmail, doctorId]);
        if (emailOwner.rows.length) {
            await client.query("ROLLBACK");
            return res.status(409).json({ message: "That email address is already in use." });
        }
        const registrationOwner = await client.query(
            "SELECT user_id FROM doctor_profiles WHERE registration_number = $1 AND user_id <> $2",
            [registrationNumber.trim(), doctorId]
        );
        if (registrationOwner.rows.length) {
            await client.query("ROLLBACK");
            return res.status(409).json({ message: "That medical registration number is already in use." });
        }

        await client.query(
            "UPDATE users SET first_name = $1, last_name = $2, email = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 AND role = 'doctor'",
            [firstName.trim(), lastName?.trim() || null, normalizedEmail, doctorId]
        );
        await client.query(
            "UPDATE doctor_profiles SET registration_number = $1, specialization = $2, updated_at = CURRENT_TIMESTAMP WHERE user_id = $3",
            [registrationNumber.trim(), specialization.trim(), doctorId]
        );
        await client.query("COMMIT");
        return res.status(200).json({ success: true, message: "Doctor profile updated successfully." });
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        next(error);
    } finally {
        client.release();
    }
}

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
             LEFT JOIN LATERAL (
                 SELECT id, status, chief_complaint, current_state, summary FROM clinical_sessions WHERE appointment_id = a.id ORDER BY updated_at DESC LIMIT 1
             ) cs ON true
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

        if (req.user.role === "doctor") {
            const accessCheck = await pool.query(
                `SELECT 1 FROM patient_doctor_relationships WHERE doctor_id = $1 AND patient_id = $2 AND status = 'active';`,
                [req.user.id, patientId]
            );

            if (accessCheck.rows.length === 0) {
                return res.status(403).json({
                    success: false,
                    message: "Access Denied: Patient is not connected with your practice.",
                });
            }
        }

        const patient = userRes.rows[0];
        const includeArchived = req.query.includeArchived === "true";
        const graveyardClause = (sourceType, idCol = "id") => {
            if (includeArchived) return "";
            return `AND ${idCol} NOT IN (SELECT source_id FROM patient_graveyard_items WHERE patient_id = $1 AND source_type = '${sourceType}')`;
        };

        // 2. Fetch Medical History (conditions, allergies, surgeries, family history)
        const medHistoryRes = await pool.query(
            `SELECT * FROM medical_history WHERE patient_id = $1 ${graveyardClause('medical_history')} ORDER BY created_at DESC;`,
            [patientId]
        );

        // 3. Fetch Clinical Intake Sessions
        const sessionsRes = await pool.query(
            `SELECT * FROM clinical_sessions WHERE patient_id = $1 ${graveyardClause('clinical_session')} ORDER BY created_at DESC;`,
            [patientId]
        );

        // 4. Fetch Documents and OCR text
        const docsRes = await pool.query(
            `SELECT d.*, o.extracted_text, o.status AS ocr_status, s.summary AS doc_summary
             FROM documents d
             LEFT JOIN document_ocr o ON d.id = o.document_id
             LEFT JOIN ai_summaries s ON d.id = s.document_id
             WHERE d.patient_id = $1 AND ${documentConsentSql('d', '$2')} ${graveyardClause('document', 'd.id')}
             ORDER BY d.created_at DESC;`,
            [patientId, req.user.id]
        );

        // 5. Fetch Past Consultations
        const consultationsRes = await pool.query(
            `SELECT c.*, a.scheduled_at, u.first_name AS doctor_first_name, u.last_name AS doctor_last_name
             FROM consultations c
             JOIN appointments a ON c.appointment_id = a.id
             JOIN users u ON a.doctor_id = u.id
             WHERE a.patient_id = $1 ${graveyardClause('consultation', 'c.id')}
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

/**
 * 6. Get Public Verified Doctors Directory for Patients
 * GET /api/doctor/directory
 * Access: Authenticated users
 */
async function getPublicDoctors(req, res, next) {
    try {
        const result = await pool.query(
            `SELECT u.id, u.first_name, u.last_name, u.email, u.phone,
                    d.registration_number, d.specialization, d.department, d.verification_status
             FROM users u
             JOIN doctor_profiles d ON u.id = d.user_id
             WHERE u.role = 'doctor'
               AND u.is_active = true
               AND d.verification_status = 'verified'
               AND ($2::text NOT IN ('receptionist', 'nurse', 'admin') OR u.id = (SELECT created_by_doctor_id FROM users WHERE id = $1))
             ORDER BY u.first_name ASC;`, [req.user.id, req.user.role]
        );

        const doctors = result.rows.map(r => ({
            id: r.id,
            name: `Dr. ${r.first_name} ${r.last_name || ''}`.trim(),
            firstName: r.first_name,
            lastName: r.last_name,
            email: r.email,
            phone: r.phone,
            registrationNumber: r.registration_number,
            specialization: r.specialization || "General Medicine",
            department: r.department || "Clinical Care",
            verificationStatus: r.verification_status,
        }));

        return res.status(200).json({
            success: true,
            doctors,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * 7. Preview QR Pairing Token for Doctor
 * POST /api/doctor/patients/pair/preview
 * Access: Authenticated doctor only
 */
async function previewPatientPairing(req, res, next) {
    try {
        const crypto = require("crypto");
        const doctorId = req.user.id;
        const { token, pairingCode } = req.body;

        if (!token && !pairingCode) {
            return res.status(400).json({
                success: false,
                message: "Pairing QR token or pairing code is required.",
            });
        }

        let tokenQuery = "";
        let queryParam = "";

        if (token) {
            tokenQuery = `SELECT * FROM patient_qr_pairing_tokens WHERE token_hash = $1;`;
            queryParam = crypto.createHash("sha256").update(token).digest("hex");
        } else {
            tokenQuery = `SELECT * FROM patient_qr_pairing_tokens WHERE UPPER(token_display_code) = UPPER($1);`;
            queryParam = pairingCode.trim();
        }

        const tokenRes = await pool.query(tokenQuery, [queryParam]);

        if (tokenRes.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid pairing code or QR token.",
            });
        }

        const pairingTokenRow = tokenRes.rows[0];

        if (pairingTokenRow.used_at) {
            return res.status(400).json({
                success: false,
                message: "This pairing QR code has already been used.",
            });
        }

        if (new Date(pairingTokenRow.expires_at) < new Date()) {
            return res.status(400).json({
                success: false,
                message: "This pairing QR code has expired. Please ask the patient to generate a new QR.",
            });
        }

        const patientId = pairingTokenRow.patient_id;

        const relCheck = await pool.query(
            `SELECT * FROM patient_doctor_relationships WHERE patient_id = $1 AND doctor_id = $2;`,
            [patientId, doctorId]
        );

        const isAlreadyConnected = relCheck.rows.length > 0 && relCheck.rows[0].status === "active";

        const userRes = await pool.query(
            `SELECT u.id, u.first_name, u.last_name, u.email, u.phone,
                    p.date_of_birth, p.gender, p.state, p.preferred_language, p.abha_id
             FROM users u
             LEFT JOIN patient_profiles p ON u.id = p.user_id
             WHERE u.id = $1;`,
            [patientId]
        );

        if (userRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Patient profile not found.",
            });
        }

        const pt = userRes.rows[0];
        let age = null;
        if (pt.date_of_birth) {
            const dob = new Date(pt.date_of_birth);
            if (!isNaN(dob.getTime())) {
                const today = new Date();
                age = today.getFullYear() - dob.getFullYear();
            }
        }

        return res.status(200).json({
            success: true,
            alreadyConnected: isAlreadyConnected,
            patient: {
                id: pt.id,
                firstName: pt.first_name,
                lastName: pt.last_name || "",
                patientName: `${pt.first_name} ${pt.last_name || ""}`.trim(),
                medicalId: `MK-${pt.id.slice(0, 6).toUpperCase()}`,
                gender: pt.gender || "Not recorded",
                age: age,
                state: pt.state || "Not recorded",
                preferredLanguage: pt.preferred_language || "en",
                abhaIdMasked: pt.abha_id ? `******${pt.abha_id.slice(-4)}` : null,
            },
        });
    } catch (error) {
        next(error);
    }
}

/**
 * 8. Confirm Patient Doctor Pairing
 * POST /api/doctor/patients/pair/confirm
 * Access: Authenticated doctor only
 */
async function confirmPatientPairing(req, res, next) {
    try {
        const crypto = require("crypto");
        const doctorId = req.user.id;
        const { token, pairingCode } = req.body;

        if (!token && !pairingCode) {
            return res.status(400).json({
                success: false,
                message: "Pairing QR token or pairing code is required.",
            });
        }

        let tokenQuery = "";
        let queryParam = "";

        if (token) {
            tokenQuery = `SELECT * FROM patient_qr_pairing_tokens WHERE token_hash = $1;`;
            queryParam = crypto.createHash("sha256").update(token).digest("hex");
        } else {
            tokenQuery = `SELECT * FROM patient_qr_pairing_tokens WHERE UPPER(token_display_code) = UPPER($1);`;
            queryParam = pairingCode.trim();
        }

        const tokenRes = await pool.query(tokenQuery, [queryParam]);

        if (tokenRes.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid pairing code or QR token.",
            });
        }

        const pairingTokenRow = tokenRes.rows[0];

        if (pairingTokenRow.used_at) {
            return res.status(400).json({
                success: false,
                message: "This pairing QR code has already been used.",
            });
        }

        if (new Date(pairingTokenRow.expires_at) < new Date()) {
            return res.status(400).json({
                success: false,
                message: "This pairing QR code has expired.",
            });
        }

        const patientId = pairingTokenRow.patient_id;

        // Consume once and establish the relationship in the same database statement.
        const relRes = await pool.query(
            `WITH consumed AS (
                UPDATE patient_qr_pairing_tokens
                SET used_at = CURRENT_TIMESTAMP, used_by_doctor_id = $1
                WHERE id = $2 AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP
                RETURNING patient_id
             )
             INSERT INTO patient_doctor_relationships (patient_id, doctor_id, status, consent_method)
             SELECT patient_id, $1, 'active', 'qr_scan' FROM consumed
             ON CONFLICT (patient_id, doctor_id) DO UPDATE
             SET status = 'active', updated_at = CURRENT_TIMESTAMP RETURNING *;`,
            [doctorId, pairingTokenRow.id]
        );
        if (!relRes.rows.length) {
            return res.status(409).json({ message: "Pairing code has already been used or expired." });
        }

        return res.status(200).json({
            success: true,
            message: "Patient successfully connected to your patient list.",
            patientId,
            relationship: relRes.rows[0],
        });
    } catch (error) {
        next(error);
    }
}

/**
 * 9. Get Doctor's Connected Patient List
 * GET /api/doctor/patients
 * Access: Authenticated doctor only
 */
async function getDoctorPatients(req, res, next) {
    try {
        const doctorId = req.user.id;

        const result = await pool.query(
            `SELECT pdr.id AS relationship_id, pdr.status AS access_status, pdr.created_at AS connected_at,
                    u.id AS patient_id, u.first_name, u.last_name, u.email, u.phone,
                    p.date_of_birth, p.gender, p.state, p.abha_id,
                    MAX(a.scheduled_at) AS last_visit,
                    (SELECT cs.summary FROM clinical_sessions cs WHERE cs.patient_id = u.id ORDER BY cs.created_at DESC LIMIT 1) AS latest_intake_summary
             FROM patient_doctor_relationships pdr
             JOIN users u ON pdr.patient_id = u.id
             LEFT JOIN patient_profiles p ON u.id = p.user_id
             LEFT JOIN appointments a ON a.patient_id = u.id AND a.doctor_id = pdr.doctor_id
             WHERE pdr.doctor_id = $1 AND pdr.status = 'active'
             GROUP BY pdr.id, pdr.status, pdr.created_at, u.id, u.first_name, u.last_name, u.email, u.phone, p.date_of_birth, p.gender, p.state, p.abha_id
             ORDER BY pdr.created_at DESC;`,
            [doctorId]
        );

        const patients = result.rows.map((row) => {
            let age = null;
            if (row.date_of_birth) {
                const dob = new Date(row.date_of_birth);
                if (!isNaN(dob.getTime())) {
                    const today = new Date();
                    age = today.getFullYear() - dob.getFullYear();
                }
            }
            return {
                id: row.patient_id,
                relationshipId: row.relationship_id,
                firstName: row.first_name,
                lastName: row.last_name || "",
                patientName: `${row.first_name} ${row.last_name || ""}`.trim(),
                medicalId: `MK-${row.patient_id.slice(0, 6).toUpperCase()}`,
                email: row.email,
                phone: row.phone,
                gender: row.gender || "Not recorded",
                age: age,
                state: row.state || "Not recorded",
                lastVisit: row.last_visit ? new Date(row.last_visit).toLocaleDateString("en-IN") : "No visits recorded",
                status: "Granted",
                connectedAt: row.connected_at,
                latestIntakeSummary: row.latest_intake_summary,
            };
        });

        return res.status(200).json({
            success: true,
            patients,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * 10. Doctor Revokes Patient Connection
 * DELETE /api/doctor/patients/:patientId
 * Access: Authenticated doctor only
 */
async function revokePatientConnection(req, res, next) {
    try {
        const doctorId = req.user.id;
        const { patientId } = req.params;

        const result = await pool.query(
            `WITH revoked AS (
                UPDATE patient_doctor_relationships SET status = 'revoked', updated_at = CURRENT_TIMESTAMP
                WHERE doctor_id = $1 AND patient_id = $2 RETURNING *
             ), revoked_documents AS (
                UPDATE document_access da SET revoked_at = CURRENT_TIMESTAMP
                FROM documents d, revoked r
                WHERE da.document_id = d.id AND d.patient_id = r.patient_id AND da.user_id = r.doctor_id
             ) SELECT * FROM revoked;`,
            [doctorId, patientId]
        );

        return res.status(200).json({
            success: true,
            message: "Patient relationship revoked.",
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    updateOwnProfile,
    getDoctorQueue,
    getPatientUnifiedHistory,
    confirmConsultation,
    getPendingDoctors,
    verifyDoctor,
    getPublicDoctors,
    previewPatientPairing,
    confirmPatientPairing,
    getDoctorPatients,
    revokePatientConnection,
};
