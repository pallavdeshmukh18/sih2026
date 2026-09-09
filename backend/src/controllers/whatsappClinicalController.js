const pool = require("../config/db");
const {
    startSessionCore,
    processTextTurnCore,
    finalizeSessionCore,
    determineRequiredSpecialization,
} = require("../services/clinicalSessionService");

/**
 * Helper to resolve authenticated WhatsApp identity to MediKiosk user_id, authoritative account language,
 * and accessibility preference.
 * Enforces that arbitrary patient_id, language, or preferences from the client are NEVER trusted.
 */
async function resolveWhatsAppUser(whatsappId) {
    if (!whatsappId || typeof whatsappId !== "string" || !whatsappId.trim()) {
        const err = new Error("whatsapp_id is required.");
        err.statusCode = 400;
        throw err;
    }

    const normalizedId = whatsappId.trim();
    const result = await pool.query(
        `SELECT w.user_id, p.preferred_language, p.accessibility_preference
         FROM whatsapp_accounts w
         LEFT JOIN patient_profiles p ON w.user_id = p.user_id
         WHERE w.whatsapp_id = $1;`,
        [normalizedId]
    );

    if (result.rows.length === 0) {
        const err = new Error("WhatsApp account is not linked to a MediKiosk user account.");
        err.statusCode = 403;
        throw err;
    }

    return {
        userId: result.rows[0].user_id,
        language: result.rows[0].preferred_language || "en",
        accessibilityPreference: result.rows[0].accessibility_preference || "none",
    };
}

/**
 * Helper to get current or next clinic date in Asia/Kolkata timezone
 */
function getKolkataDateString(daysOffset = 0) {
    const now = new Date();
    // Add days offset
    const target = new Date(now.getTime() + daysOffset * 24 * 60 * 60 * 1000);
    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
    return formatter.format(target); // YYYY-MM-DD
}

/**
 * Helper to get current hour & minute in Asia/Kolkata timezone
 */
function getKolkataTime() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString("en-US", {
        timeZone: "Asia/Kolkata",
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
    });
    const [h, m] = timeStr.split(":").map(Number);
    return { hour: h, minute: m };
}

/**
 * 1. Start Clinical Intake Session for Linked WhatsApp User
 * POST /api/whatsapp/clinical/session/start
 */
async function startSession(req, res, next) {
    try {
        const { whatsapp_id, whatsappId } = req.body;
        const targetWhatsappId = whatsapp_id || whatsappId;
        const userAccount = await resolveWhatsAppUser(targetWhatsappId);

        const chiefComplaint = req.body.chief_complaint || req.body.chiefComplaint;
        // The user account is the sole source of truth for language
        const language = userAccount.language || "en";
        const consultationType = req.body.consultation_type || req.body.consultationType || "allopathic";
        const appointmentId = req.body.appointment_id || req.body.appointmentId || null;

        const result = await startSessionCore({
            patientId: userAccount.userId,
            appointmentId,
            language,
            consultationType,
            chiefComplaint,
        });

        const status = result.isExisting ? 200 : 201;
        return res.status(status).json({
            success: true,
            sessionId: result.sessionId,
            session_id: result.sessionId,
            nextQuestion: result.nextQuestion,
            next_question: result.nextQuestion,
            state: result.state,
            isExisting: result.isExisting,
        });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message,
            });
        }
        next(error);
    }
}

/**
 * 2. Process Text Turn for Linked WhatsApp User
 * POST /api/whatsapp/clinical/session/:id/text-turn
 */
async function processTextTurn(req, res, next) {
    try {
        const sessionId = req.params.id;
        const { whatsapp_id, whatsappId } = req.body;
        const targetWhatsappId = whatsapp_id || whatsappId;
        const { userId } = await resolveWhatsAppUser(targetWhatsappId);

        const patientText = req.body.patient_text || req.body.patientText;

        const result = await processTextTurnCore({
            sessionId,
            patientId: userId,
            patientText,
        });

        return res.status(200).json({
            success: true,
            sessionId: result.sessionId,
            session_id: result.sessionId,
            nextQuestion: result.nextQuestion,
            next_question: result.nextQuestion,
            extractedEntities: result.extractedEntities,
            extracted_entities: result.extractedEntities,
            redFlags: result.redFlags,
            red_flags: result.redFlags,
            isComplete: result.isComplete,
            is_complete: result.isComplete,
        });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message,
            });
        }
        next(error);
    }
}

/**
 * 3. Finalize Clinical Session for Linked WhatsApp User
 * POST /api/whatsapp/clinical/session/:id/finalize
 */
async function finalizeSession(req, res, next) {
    try {
        const sessionId = req.params.id;
        const { whatsapp_id, whatsappId } = req.body;
        const targetWhatsappId = whatsapp_id || whatsappId;
        const { userId } = await resolveWhatsAppUser(targetWhatsappId);

        const documentData = req.body.document_data || req.body.documentData || null;

        const result = await finalizeSessionCore({
            sessionId,
            patientId: userId,
            documentData,
        });

        return res.status(200).json({
            success: true,
            sessionId: result.sessionId,
            session_id: result.sessionId,
            summary: result.summary,
            message: "Clinical intake session finalized and summarized.",
        });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message,
            });
        }
        next(error);
    }
}

/**
 * 4. Get Recommended Doctors for a Completed Clinical Intake Session
 * POST /api/whatsapp/clinical/recommendations
 * Body: { whatsapp_id: string, session_id: string }
 */
async function getDoctorRecommendations(req, res, next) {
    try {
        const { whatsapp_id, whatsappId, session_id, sessionId } = req.body;
        const targetWhatsappId = whatsapp_id || whatsappId;
        const targetSessionId = session_id || sessionId;

        if (!targetSessionId) {
            return res.status(400).json({
                success: false,
                message: "session_id is required.",
            });
        }

        const userAccount = await resolveWhatsAppUser(targetWhatsappId);

        // Verify clinical session exists, belongs to patient, and is completed
        const sessionRes = await pool.query(
            `SELECT id, patient_id, status, chief_complaint, current_state, summary
             FROM clinical_sessions
             WHERE id = $1;`,
            [targetSessionId]
        );

        if (sessionRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Clinical session not found.",
            });
        }

        const session = sessionRes.rows[0];
        if (session.patient_id !== userAccount.userId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized: Clinical session belongs to another patient.",
            });
        }

        if (session.status !== "completed") {
            return res.status(400).json({
                success: false,
                message: "Clinical intake session is not yet completed.",
            });
        }

        // Determine required specialization
        const requiredSpecialty = determineRequiredSpecialization(
            session.chief_complaint,
            session.current_state,
            session.summary
        );

        // Query up to 5 verified, active doctors from database
        let docRes = await pool.query(
            `SELECT u.id, u.first_name, u.last_name, u.email, u.phone,
                    d.specialization, d.department, d.verification_status
             FROM users u
             JOIN doctor_profiles d ON u.id = d.user_id
             WHERE u.role = 'doctor'
               AND u.is_active = true
               AND d.verification_status = 'verified'
               AND d.specialization ILIKE $1
             ORDER BY u.first_name ASC, u.id ASC
             LIMIT 5;`,
            [`%${requiredSpecialty}%`]
        );

        // Fallback: If no specialist found, search for General Medicine / Internal Medicine
        if (docRes.rows.length === 0 && requiredSpecialty !== "General Medicine") {
            docRes = await pool.query(
                `SELECT u.id, u.first_name, u.last_name, u.email, u.phone,
                        d.specialization, d.department, d.verification_status
                 FROM users u
                 JOIN doctor_profiles d ON u.id = d.user_id
                 WHERE u.role = 'doctor'
                   AND u.is_active = true
                   AND d.verification_status = 'verified'
                   AND (d.specialization ILIKE '%General Medicine%' OR d.specialization ILIKE '%Internal Medicine%')
                 ORDER BY u.first_name ASC, u.id ASC
                 LIMIT 5;`
            );
        }

        const doctors = docRes.rows.map(r => ({
            id: r.id,
            name: `Dr. ${r.first_name} ${r.last_name || ""}`.trim(),
            firstName: r.first_name,
            lastName: r.last_name || "",
            specialization: r.specialization || "General Medicine",
            department: r.department || "Clinical Care",
        }));

        return res.status(200).json({
            success: true,
            sessionId: targetSessionId,
            specialization: requiredSpecialty,
            language: userAccount.language,
            accessibilityPreference: userAccount.accessibilityPreference,
            doctors,
        });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message,
            });
        }
        next(error);
    }
}

/**
 * 5. Get Real Available Slots for Doctor on WhatsApp
 * GET /api/whatsapp/clinical/doctors/:doctorId/slots?whatsapp_id=...&date=YYYY-MM-DD
 */
async function getDoctorAvailableSlots(req, res, next) {
    try {
        const { doctorId } = req.params;
        const targetWhatsappId = req.query.whatsapp_id || req.query.whatsappId;
        await resolveWhatsAppUser(targetWhatsappId);

        if (!doctorId) {
            return res.status(400).json({
                success: false,
                message: "doctorId is required.",
            });
        }

        // Verify active, verified doctor
        const docCheck = await pool.query(
            `SELECT u.id, u.first_name, u.last_name, d.specialization
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
                message: "Verified active doctor not found.",
            });
        }

        const doctor = docCheck.rows[0];
        const doctorName = `Dr. ${doctor.first_name} ${doctor.last_name || ""}`.trim();

        // Target date resolution: default to today (Asia/Kolkata)
        let targetDate = req.query.date;
        if (!targetDate || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
            const kolkataTime = getKolkataTime();
            // If after 16:30 IST today, roll to tomorrow
            if (kolkataTime.hour > 16 || (kolkataTime.hour === 16 && kolkataTime.minute >= 30)) {
                targetDate = getKolkataDateString(1);
            } else {
                targetDate = getKolkataDateString(0);
            }
        }

        // Standard clinic hours: 09:00 to 17:00 (30-min slots)
        const standardSlotTimes = [
            "09:00", "09:30", "10:00", "10:30",
            "11:00", "11:30", "12:00", "12:30",
            "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"
        ];

        // Query booked appointments for doctor on target date
        const bookedRes = await pool.query(
            `SELECT scheduled_at, duration_minutes
             FROM appointments
             WHERE doctor_id = $1
               AND DATE(scheduled_at AT TIME ZONE 'Asia/Kolkata') = $2
               AND status IN ('scheduled', 'confirmed');`,
            [doctorId, targetDate]
        );

        const now = new Date();

        const slots = [];
        for (const timeStr of standardSlotTimes) {
            const [h, m] = timeStr.split(":").map(Number);
            const slotDateTime = new Date(`${targetDate}T${timeStr}:00+05:30`);

            const isPast = slotDateTime <= now;
            const isBooked = bookedRes.rows.some(row => {
                const start = new Date(row.scheduled_at).getTime();
                const end = start + row.duration_minutes * 60000;
                return slotDateTime.getTime() < end && slotDateTime.getTime() + 30 * 60000 > start;
            });

            if (!isPast && !isBooked) {
                const period = h >= 12 ? "PM" : "AM";
                const displayH = h % 12 === 0 ? 12 : h % 12;
                const time12 = `${String(displayH).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;

                slots.push({
                    time: timeStr,
                    time12,
                    scheduledAt: slotDateTime.toISOString(),
                    available: true,
                });
            }
        }

        // If today has zero remaining slots, roll over to tomorrow and fetch available slots
        if (slots.length === 0 && targetDate === getKolkataDateString(0)) {
            const nextDate = getKolkataDateString(1);
            const nextBookedRes = await pool.query(
                `SELECT scheduled_at, duration_minutes
                 FROM appointments
                 WHERE doctor_id = $1
                   AND DATE(scheduled_at AT TIME ZONE 'Asia/Kolkata') = $2
                   AND status IN ('scheduled', 'confirmed');`,
                [doctorId, nextDate]
            );

            for (const timeStr of standardSlotTimes) {
                const [h, m] = timeStr.split(":").map(Number);
                const slotDateTime = new Date(`${nextDate}T${timeStr}:00+05:30`);
                const isBooked = nextBookedRes.rows.some(row => {
                    const start = new Date(row.scheduled_at).getTime();
                    const end = start + row.duration_minutes * 60000;
                    return slotDateTime.getTime() < end && slotDateTime.getTime() + 30 * 60000 > start;
                });
                if (!isBooked) {
                    const period = h >= 12 ? "PM" : "AM";
                    const displayH = h % 12 === 0 ? 12 : h % 12;
                    const time12 = `${String(displayH).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
                    slots.push({
                        time: timeStr,
                        time12,
                        scheduledAt: slotDateTime.toISOString(),
                        available: true,
                    });
                }
            }
            targetDate = nextDate;
        }

        return res.status(200).json({
            success: true,
            doctorId,
            doctorName,
            specialization: doctor.specialization,
            date: targetDate,
            slots: slots.slice(0, 6), // Return next 4-6 real available slots
        });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message,
            });
        }
        next(error);
    }
}

/**
 * 6. Book WhatsApp Appointment with Double-Booking Protection & Clinical Session Association
 * POST /api/whatsapp/clinical/book
 * Body: { whatsapp_id: string, sessionId: string, doctorId: string, scheduledAt: string }
 */
async function bookWhatsAppAppointment(req, res, next) {
    try {
        const {
            whatsapp_id,
            whatsappId,
            sessionId,
            session_id,
            doctorId,
            doctor_id,
            scheduledAt,
            scheduled_at,
            appointmentType = "in_person",
            durationMinutes = 30,
            notes,
        } = req.body;

        const targetWhatsappId = whatsapp_id || whatsappId;
        const targetSessionId = sessionId || session_id;
        const targetDoctorId = doctorId || doctor_id;
        const targetScheduledAt = scheduledAt || scheduled_at;

        if (!targetSessionId || !targetDoctorId || !targetScheduledAt) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: sessionId, doctorId, and scheduledAt are required.",
            });
        }

        const userAccount = await resolveWhatsAppUser(targetWhatsappId);
        const patientId = userAccount.userId;

        const scheduledDate = new Date(targetScheduledAt);
        if (!Number.isFinite(scheduledDate.getTime()) || scheduledDate <= new Date()) {
            return res.status(400).json({
                success: false,
                message: "Appointment must be scheduled for a future valid date and time.",
            });
        }

        // Verify completed clinical intake session belongs to patient
        const sessionCheck = await pool.query(
            `SELECT id, patient_id, status, chief_complaint, appointment_id
             FROM clinical_sessions
             WHERE id = $1;`,
            [targetSessionId]
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
                message: "Clinical intake assessment is incomplete.",
            });
        }

        if (session.appointment_id) {
            return res.status(409).json({
                success: false,
                message: "This clinical assessment is already linked to an appointment.",
            });
        }

        // Verify doctor exists, is active, and verified
        const docCheck = await pool.query(
            `SELECT u.id, u.first_name, u.last_name, d.specialization
             FROM users u
             JOIN doctor_profiles d ON u.id = d.user_id
             WHERE u.id = $1
               AND u.role = 'doctor'
               AND u.is_active = true
               AND d.verification_status = 'verified';`,
            [targetDoctorId]
        );

        if (docCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Verified active doctor not found.",
            });
        }

        const doctor = docCheck.rows[0];
        const doctorName = `Dr. ${doctor.first_name} ${doctor.last_name || ""}`.trim();

        // Double-booking check: verify slot is still available
        const conflictCheck = await pool.query(
            `SELECT id FROM appointments
             WHERE doctor_id = $1
               AND scheduled_at = $2
               AND status IN ('scheduled', 'confirmed');`,
            [targetDoctorId, scheduledDate.toISOString()]
        );

        if (conflictCheck.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: "That appointment slot is no longer available.",
            });
        }

        const activeReason = session.chief_complaint || "Clinical Consultation";

        const client = await pool.connect();
        try {
            await client.query("BEGIN;");

            const insertQuery = `
                INSERT INTO appointments (patient_id, doctor_id, scheduled_at, duration_minutes, appointment_type, reason, notes, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled')
                RETURNING *;
            `;
            const apptRes = await client.query(insertQuery, [
                patientId,
                targetDoctorId,
                scheduledDate.toISOString(),
                durationMinutes,
                appointmentType,
                activeReason,
                notes || null,
            ]);

            const newAppointment = apptRes.rows[0];

            // Link clinical session to appointment
            const linkRes = await client.query(
                `UPDATE clinical_sessions
                 SET appointment_id = $1, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $2 AND appointment_id IS NULL
                 RETURNING id;`,
                [newAppointment.id, targetSessionId]
            );

            if (linkRes.rows.length === 0) {
                await client.query("ROLLBACK;");
                return res.status(409).json({
                    success: false,
                    message: "This clinical assessment was already linked to another appointment.",
                });
            }

            await client.query("COMMIT;");

            return res.status(201).json({
                success: true,
                message: "Appointment booked successfully",
                appointment: {
                    id: newAppointment.id,
                    patientId: newAppointment.patient_id,
                    doctorId: newAppointment.doctor_id,
                    doctorName,
                    specialization: doctor.specialization,
                    scheduledAt: newAppointment.scheduled_at,
                    durationMinutes: newAppointment.duration_minutes,
                    status: newAppointment.status,
                    reason: newAppointment.reason,
                },
            });
        } catch (dbErr) {
            await client.query("ROLLBACK;");
            if (["23505", "23P01"].includes(dbErr.code)) {
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
        if (error.statusCode) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message,
            });
        }
        next(error);
    }
}

module.exports = {
    startSession,
    processTextTurn,
    finalizeSession,
    getDoctorRecommendations,
    getDoctorAvailableSlots,
    bookWhatsAppAppointment,
};

