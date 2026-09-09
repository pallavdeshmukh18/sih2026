const pool = require("../config/db");
const AgoraService = require("../utils/agoraService");
const crypto = require("crypto");

/**
 * 1. Patient requests a new teleconsultation (Video / Voice call)
 * POST /api/teleconsult/request
 */
async function requestCallSession(req, res, next) {
    const client = await pool.connect();
    try {
        const patientId = req.user.id;
        const { doctorId, callType = "video", scheduledAt, reason, patientNotes } = req.body;

        if (!doctorId) {
            return res.status(400).json({
                success: false,
                message: "Doctor ID is required to request a teleconsultation.",
            });
        }

        const validCallTypes = ["video", "voice"];
        if (!validCallTypes.includes(callType)) {
            return res.status(400).json({
                success: false,
                message: "callType must be either 'video' or 'voice'.",
            });
        }

        // Verify doctor exists and is verified
        const docCheck = await client.query(
            `SELECT u.id, u.first_name, u.last_name, dp.specialization 
             FROM users u 
             JOIN doctor_profiles dp ON u.id = dp.user_id 
             WHERE u.id = $1 AND u.role = 'doctor' AND u.is_active = true;`,
            [doctorId]
        );

        if (docCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Verified doctor not found.",
            });
        }

        const doctor = docCheck.rows[0];
        const uniqueChannel = `teleconsult_${crypto.randomBytes(8).toString("hex")}`;
        const targetScheduledAt = scheduledAt ? new Date(scheduledAt).toISOString() : new Date().toISOString();

        await client.query("BEGIN;");

        const sessionInsert = `
            INSERT INTO teleconsult_sessions (
                patient_id, doctor_id, channel_name, call_type, status,
                requested_time, scheduled_at, reason, patient_notes
            )
            VALUES ($1, $2, $3, $4, 'pending_approval', CURRENT_TIMESTAMP, $5, $6, $7)
            RETURNING *;
        `;
        const sessionRes = await client.query(sessionInsert, [
            patientId,
            doctorId,
            uniqueChannel,
            callType,
            targetScheduledAt,
            reason || "Teleconsultation Request",
            patientNotes || null,
        ]);

        const session = sessionRes.rows[0];

        // Insert initial system message into thread
        await client.query(
            `INSERT INTO teleconsult_messages (session_id, sender_id, sender_role, message, message_type)
             VALUES ($1, $2, 'system', $3, 'system');`,
            [
                session.id,
                patientId,
                `Call request (${callType === "video" ? "Video Call" : "Voice Call"}) submitted by patient. Awaiting Dr. ${doctor.first_name} ${doctor.last_name || ""}'s approval.`,
            ]
        );

        await client.query("COMMIT;");

        return res.status(201).json({
            success: true,
            message: "Teleconsultation request submitted successfully. Awaiting doctor approval.",
            session,
        });
    } catch (error) {
        await client.query("ROLLBACK;");
        next(error);
    } finally {
        client.release();
    }
}

/**
 * 2. Get Teleconsultation Sessions for current user
 * GET /api/teleconsult/sessions
 */
async function getCallSessions(req, res, next) {
    try {
        const userId = req.user.id;
        const role = req.user.role;

        let query = "";
        let values = [userId];

        if (role === "doctor") {
            query = `
                SELECT s.*,
                       pu.first_name AS patient_first_name, pu.last_name AS patient_last_name,
                       pu.email AS patient_email, pu.phone AS patient_phone,
                       pp.date_of_birth, pp.gender, pp.abha_id,
                       (SELECT COUNT(*) FROM teleconsult_messages WHERE session_id = s.id AND is_read = false AND sender_role = 'patient') AS unread_messages_count
                FROM teleconsult_sessions s
                JOIN users pu ON s.patient_id = pu.id
                LEFT JOIN patient_profiles pp ON pu.id = pp.user_id
                WHERE s.doctor_id = $1
                ORDER BY 
                    CASE 
                        WHEN s.status = 'in_call' THEN 1
                        WHEN s.status = 'pending_approval' THEN 2
                        WHEN s.status = 'approved' THEN 3
                        ELSE 4
                    END,
                    s.created_at DESC;
            `;
        } else {
            query = `
                SELECT s.*,
                       du.first_name AS doctor_first_name, du.last_name AS doctor_last_name,
                       du.email AS doctor_email, du.phone AS doctor_phone,
                       dp.specialization, dp.department,
                       (SELECT COUNT(*) FROM teleconsult_messages WHERE session_id = s.id AND is_read = false AND sender_role = 'doctor') AS unread_messages_count
                FROM teleconsult_sessions s
                JOIN users du ON s.doctor_id = du.id
                LEFT JOIN doctor_profiles dp ON du.id = dp.user_id
                WHERE s.patient_id = $1
                ORDER BY 
                    CASE 
                        WHEN s.status = 'in_call' THEN 1
                        WHEN s.status = 'approved' THEN 2
                        WHEN s.status = 'pending_approval' THEN 3
                        ELSE 4
                    END,
                    s.created_at DESC;
            `;
        }

        const result = await pool.query(query, values);

        const sessions = result.rows.map(row => ({
            id: row.id,
            channelName: row.channel_name,
            callType: row.call_type,
            status: row.status,
            requestedTime: row.requested_time,
            scheduledAt: row.scheduled_at,
            startedAt: row.started_at,
            endedAt: row.ended_at,
            durationSeconds: row.duration_seconds || 0,
            reason: row.reason,
            patientNotes: row.patient_notes,
            doctorNotes: row.doctor_notes,
            prescription: row.prescription,
            createdAt: row.created_at,
            unreadCount: parseInt(row.unread_messages_count || 0, 10),
            patient: role === "doctor" ? {
                id: row.patient_id,
                name: `${row.patient_first_name || ""} ${row.patient_last_name || ""}`.trim() || "Patient",
                firstName: row.patient_first_name,
                lastName: row.patient_last_name,
                email: row.patient_email,
                phone: row.patient_phone,
                dateOfBirth: row.date_of_birth,
                gender: row.gender,
                abhaId: row.abha_id,
            } : undefined,
            doctor: role === "patient" ? {
                id: row.doctor_id,
                name: `Dr. ${row.doctor_first_name || ""} ${row.doctor_last_name || ""}`.trim(),
                firstName: row.doctor_first_name,
                lastName: row.doctor_last_name,
                email: row.doctor_email,
                phone: row.doctor_phone,
                specialization: row.specialization || "Medical Specialist",
                department: row.department,
            } : undefined,
        }));

        return res.status(200).json({
            success: true,
            sessions,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * 3. Doctor responds to a call request (Approve or Reject)
 * PATCH /api/teleconsult/:id/respond
 */
async function respondToCallRequest(req, res, next) {
    const client = await pool.connect();
    try {
        const sessionId = req.params.id;
        const doctorId = req.user.id;
        const { action, doctorNotes } = req.body; // action: 'approve' | 'reject'

        if (!["approve", "reject"].includes(action)) {
            return res.status(400).json({
                success: false,
                message: "action must be either 'approve' or 'reject'.",
            });
        }

        const sessionCheck = await client.query(
            `SELECT * FROM teleconsult_sessions WHERE id = $1;`,
            [sessionId]
        );

        if (sessionCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Teleconsultation session not found.",
            });
        }

        const session = sessionCheck.rows[0];
        if (session.doctor_id !== doctorId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized: You are not the assigned doctor for this request.",
            });
        }

        if (session.status !== "pending_approval") {
            return res.status(400).json({
                success: false,
                message: `Cannot respond to a session that is already '${session.status}'.`,
            });
        }

        const newStatus = action === "approve" ? "approved" : "rejected";

        await client.query("BEGIN;");

        const updateRes = await client.query(
            `UPDATE teleconsult_sessions
             SET status = $1, doctor_notes = COALESCE($2, doctor_notes), updated_at = CURRENT_TIMESTAMP
             WHERE id = $3
             RETURNING *;`,
            [newStatus, doctorNotes || null, sessionId]
        );

        // System message notification
        const msgText = action === "approve"
            ? "Doctor approved the call request. Both parties can now join the consultation room."
            : `Doctor declined this call request.${doctorNotes ? ` Reason: ${doctorNotes}` : ""}`;

        await client.query(
            `INSERT INTO teleconsult_messages (session_id, sender_id, sender_role, message, message_type)
             VALUES ($1, $2, 'system', $3, 'system');`,
            [sessionId, doctorId, msgText]
        );

        await client.query("COMMIT;");

        return res.status(200).json({
            success: true,
            message: `Call request has been ${newStatus}.`,
            session: updateRes.rows[0],
        });
    } catch (error) {
        await client.query("ROLLBACK;");
        next(error);
    } finally {
        client.release();
    }
}

/**
 * 4. Join Active / Approved Teleconsultation Call
 * POST /api/teleconsult/:id/join
 */
async function joinCallSession(req, res, next) {
    try {
        const sessionId = req.params.id;
        const userId = req.user.id;
        const userRole = req.user.role;

        const sessionRes = await pool.query(
            `SELECT s.*, 
                    pu.first_name AS patient_first_name, pu.last_name AS patient_last_name,
                    du.first_name AS doctor_first_name, du.last_name AS doctor_last_name,
                    dp.specialization
             FROM teleconsult_sessions s
             JOIN users pu ON s.patient_id = pu.id
             JOIN users du ON s.doctor_id = du.id
             LEFT JOIN doctor_profiles dp ON du.id = dp.user_id
             WHERE s.id = $1;`,
            [sessionId]
        );

        if (sessionRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Teleconsultation session not found.",
            });
        }

        const session = sessionRes.rows[0];

        // Ensure user is participant
        if (session.patient_id !== userId && session.doctor_id !== userId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized: You are not a participant in this call.",
            });
        }

        if (session.status === "pending_approval") {
            return res.status(400).json({
                success: false,
                message: "Call cannot be started until approved by the doctor.",
            });
        }

        if (session.status === "rejected" || session.status === "cancelled") {
            return res.status(400).json({
                success: false,
                message: `This call was ${session.status}.`,
            });
        }

        // If currently 'approved', transition to 'in_call'
        if (session.status === "approved") {
            await pool.query(
                `UPDATE teleconsult_sessions
                 SET status = 'in_call', started_at = COALESCE(started_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1;`,
                [sessionId]
            );
        }

        // Generate Agora RTC Token
        // Hash user UUID to a positive integer UID for Agora compatibility
        const hash = crypto.createHash("md5").update(userId).digest("hex");
        const numericUid = (parseInt(hash.substring(0, 8), 16) % 8999999) + 1000000;

        const agoraData = AgoraService.generateRtcToken(session.channel_name, numericUid, "publisher");

        return res.status(200).json({
            success: true,
            sessionId: session.id,
            channelName: session.channel_name,
            callType: session.call_type,
            status: "in_call",
            agora: {
                appId: agoraData.appId,
                token: agoraData.token,
                uid: agoraData.uid,
                channelName: agoraData.channelName,
                isTestingMode: agoraData.isTestingMode,
            },
            peer: userRole === "doctor" ? {
                id: session.patient_id,
                name: `${session.patient_first_name || ""} ${session.patient_last_name || ""}`.trim() || "Patient",
            } : {
                id: session.doctor_id,
                name: `Dr. ${session.doctor_first_name || ""} ${session.doctor_last_name || ""}`.trim(),
                specialization: session.specialization,
            },
        });
    } catch (error) {
        next(error);
    }
}

/**
 * 5. End Teleconsultation Call Session
 * POST /api/teleconsult/:id/end
 */
async function endCallSession(req, res, next) {
    const client = await pool.connect();
    try {
        const sessionId = req.params.id;
        const userId = req.user.id;
        const role = req.user.role;
        const { doctorNotes, prescription } = req.body;

        const sessionRes = await client.query(
            `SELECT * FROM teleconsult_sessions WHERE id = $1;`,
            [sessionId]
        );

        if (sessionRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Teleconsultation session not found.",
            });
        }

        const session = sessionRes.rows[0];
        if (session.patient_id !== userId && session.doctor_id !== userId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized: You are not a participant in this call.",
            });
        }

        const startedAt = session.started_at ? new Date(session.started_at) : new Date();
        const endedAt = new Date();
        const durationSeconds = Math.max(0, Math.round((endedAt - startedAt) / 1000));

        await client.query("BEGIN;");

        const updateRes = await client.query(
            `UPDATE teleconsult_sessions
             SET status = 'completed',
                 ended_at = CURRENT_TIMESTAMP,
                 duration_seconds = $1,
                 doctor_notes = COALESCE($2, doctor_notes),
                 prescription = COALESCE($3, prescription),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $4
             RETURNING *;`,
            [durationSeconds, doctorNotes || null, prescription || null, sessionId]
        );

        const durationMins = Math.ceil(durationSeconds / 60);
        await client.query(
            `INSERT INTO teleconsult_messages (session_id, sender_id, sender_role, message, message_type)
             VALUES ($1, $2, 'system', $3, 'system');`,
            [
                sessionId,
                userId,
                `Consultation ended. Call duration: ${durationMins} min${durationMins === 1 ? "" : "s"}.`,
            ]
        );

        if (prescription) {
            await client.query(
                `INSERT INTO teleconsult_messages (session_id, sender_id, sender_role, message, message_type)
                 VALUES ($1, $2, 'doctor', $3, 'prescription');`,
                [sessionId, session.doctor_id, prescription]
            );
        }

        await client.query("COMMIT;");

        return res.status(200).json({
            success: true,
            message: "Teleconsultation completed successfully.",
            session: updateRes.rows[0],
        });
    } catch (error) {
        await client.query("ROLLBACK;");
        next(error);
    } finally {
        client.release();
    }
}

/**
 * 6. Get Chat Messages for a Teleconsultation Thread
 * GET /api/teleconsult/:id/messages
 */
async function getSessionMessages(req, res, next) {
    try {
        const sessionId = req.params.id;
        const userId = req.user.id;

        const sessionCheck = await pool.query(
            `SELECT patient_id, doctor_id FROM teleconsult_sessions WHERE id = $1;`,
            [sessionId]
        );

        if (sessionCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Teleconsultation session not found.",
            });
        }

        const session = sessionCheck.rows[0];
        if (session.patient_id !== userId && session.doctor_id !== userId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized to access messages for this session.",
            });
        }

        // Mark unread messages from the other party as read
        await pool.query(
            `UPDATE teleconsult_messages
             SET is_read = true
             WHERE session_id = $1 AND sender_id != $2 AND is_read = false;`,
            [sessionId, userId]
        );

        const result = await pool.query(
            `SELECT m.*, u.first_name, u.last_name
             FROM teleconsult_messages m
             LEFT JOIN users u ON m.sender_id = u.id
             WHERE m.session_id = $1
             ORDER BY m.created_at ASC;`,
            [sessionId]
        );

        const messages = result.rows.map(row => ({
            id: row.id,
            sessionId: row.session_id,
            senderId: row.sender_id,
            senderRole: row.sender_role,
            senderName: row.sender_role === "system" ? "System" : `${row.first_name || ""} ${row.last_name || ""}`.trim(),
            message: row.message,
            messageType: row.message_type,
            isRead: row.is_read,
            createdAt: row.created_at,
            isMe: row.sender_id === userId,
        }));

        return res.status(200).json({
            success: true,
            messages,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * 7. Send Chat Message in Teleconsultation Thread
 * POST /api/teleconsult/:id/messages
 */
async function sendMessage(req, res, next) {
    try {
        const sessionId = req.params.id;
        const senderId = req.user.id;
        const senderRole = req.user.role;
        const { message, messageType = "text" } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({
                success: false,
                message: "Message content cannot be empty.",
            });
        }

        const sessionCheck = await pool.query(
            `SELECT patient_id, doctor_id FROM teleconsult_sessions WHERE id = $1;`,
            [sessionId]
        );

        if (sessionCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Teleconsultation session not found.",
            });
        }

        const session = sessionCheck.rows[0];
        if (session.patient_id !== senderId && session.doctor_id !== senderId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized to send messages in this session.",
            });
        }

        const result = await pool.query(
            `INSERT INTO teleconsult_messages (session_id, sender_id, sender_role, message, message_type)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *;`,
            [sessionId, senderId, senderRole, message.trim(), messageType]
        );

        const newMsg = result.rows[0];

        return res.status(201).json({
            success: true,
            message: {
                id: newMsg.id,
                sessionId: newMsg.session_id,
                senderId: newMsg.sender_id,
                senderRole: newMsg.sender_role,
                senderName: `${req.user.firstName || ""} ${req.user.lastName || ""}`.trim() || "User",
                message: newMsg.message,
                messageType: newMsg.message_type,
                isRead: newMsg.is_read,
                createdAt: newMsg.created_at,
                isMe: true,
            },
        });
    } catch (error) {
        next(error);
    }
}

/**
 * 8. Get Agora Public Configuration
 * GET /api/teleconsult/config
 */
async function getAgoraConfig(req, res) {
    const appId = process.env.AGORA_APP_ID || process.env.VITE_AGORA_APP_ID || "test_app_id";
    return res.status(200).json({
        success: true,
        appId,
        hasCertificate: Boolean(process.env.AGORA_APP_CERTIFICATE),
    });
}

module.exports = {
    requestCallSession,
    getCallSessions,
    respondToCallRequest,
    joinCallSession,
    endCallSession,
    getSessionMessages,
    sendMessage,
    getAgoraConfig,
};
