const pool = require("../config/db");

const VALID_POLICIES = ["never", "3_months", "6_months", "1_year", "2_years", "5_years"];

const POLICY_INTERVALS = {
  "3_months": "3 months",
  "6_months": "6 months",
  "1_year": "1 year",
  "2_years": "2 years",
  "5_years": "5 years",
};

/**
 * Automatically archives records older than the patient's configured retention policy.
 * Idempotent, safe, and logs non-fatally on error.
 */
async function runAutoArchival(patientId) {
  try {
    const profileRes = await pool.query(
      `SELECT graveyard_retention_policy FROM patient_profiles WHERE user_id = $1`,
      [patientId]
    );
    const policy = profileRes.rows[0]?.graveyard_retention_policy || "1_year";
    if (policy === "never" || !POLICY_INTERVALS[policy]) return;

    const intervalSql = POLICY_INTERVALS[policy];
    const reason = `Auto-archived by ${policy.replace("_", " ")} policy`;

    // 1. Documents older than interval
    await pool.query(
      `INSERT INTO patient_graveyard_items (patient_id, source_type, source_id, archive_mode, archived_reason, archived_by)
       SELECT d.patient_id, 'document', d.id, 'automatic', $2, d.patient_id
       FROM documents d
       WHERE d.patient_id = $1
         AND d.created_at < (CURRENT_TIMESTAMP - INTERVAL '${intervalSql}')
       ON CONFLICT (patient_id, source_type, source_id) DO NOTHING`,
      [patientId, reason]
    );

    // 2. Medical history items older than interval
    await pool.query(
      `INSERT INTO patient_graveyard_items (patient_id, source_type, source_id, archive_mode, archived_reason, archived_by)
       SELECT mh.patient_id, 'medical_history', mh.id, 'automatic', $2, mh.patient_id
       FROM medical_history mh
       WHERE mh.patient_id = $1
         AND COALESCE(mh.diagnosed_at::timestamptz, mh.created_at) < (CURRENT_TIMESTAMP - INTERVAL '${intervalSql}')
       ON CONFLICT (patient_id, source_type, source_id) DO NOTHING`,
      [patientId, reason]
    );

    // 3. Clinical sessions older than interval
    await pool.query(
      `INSERT INTO patient_graveyard_items (patient_id, source_type, source_id, archive_mode, archived_reason, archived_by)
       SELECT cs.patient_id, 'clinical_session', cs.id, 'automatic', $2, cs.patient_id
       FROM clinical_sessions cs
       WHERE cs.patient_id = $1
         AND cs.created_at < (CURRENT_TIMESTAMP - INTERVAL '${intervalSql}')
       ON CONFLICT (patient_id, source_type, source_id) DO NOTHING`,
      [patientId, reason]
    );

    // 4. Consultations older than interval
    await pool.query(
      `INSERT INTO patient_graveyard_items (patient_id, source_type, source_id, archive_mode, archived_reason, archived_by)
       SELECT a.patient_id, 'consultation', c.id, 'automatic', $2, a.patient_id
       FROM consultations c
       JOIN appointments a ON c.appointment_id = a.id
       WHERE a.patient_id = $1
         AND COALESCE(c.started_at, c.created_at) < (CURRENT_TIMESTAMP - INTERVAL '${intervalSql}')
       ON CONFLICT (patient_id, source_type, source_id) DO NOTHING`,
      [patientId, reason]
    );
  } catch (err) {
    console.error("runAutoArchival error:", err.message);
  }
}

/**
 * Move a record/document into the Graveyard.
 * POST /api/patient/graveyard/archive
 * Body: { sourceType, sourceId, reason }
 */
async function archiveItem(req, res) {
  const patientId = req.user.id;
  const { sourceType, sourceId, reason } = req.body;

  if (!sourceType || !sourceId) {
    return res.status(400).json({ error: "sourceType and sourceId are required" });
  }

  const validTypes = ["document", "medical_history", "clinical_session", "consultation"];
  if (!validTypes.includes(sourceType)) {
    return res.status(400).json({ error: `Invalid sourceType. Must be one of: ${validTypes.join(", ")}` });
  }

  try {
    // Validate record exists and belongs to the patient
    let ownershipQuery = "";
    if (sourceType === "document") {
      ownershipQuery = "SELECT id FROM documents WHERE id = $1 AND patient_id = $2";
    } else if (sourceType === "medical_history") {
      ownershipQuery = "SELECT id FROM medical_history WHERE id = $1 AND patient_id = $2";
    } else if (sourceType === "clinical_session") {
      ownershipQuery = "SELECT id FROM clinical_sessions WHERE id = $1 AND patient_id = $2";
    } else if (sourceType === "consultation") {
      ownershipQuery = "SELECT c.id FROM consultations c JOIN appointments a ON c.appointment_id = a.id WHERE c.id = $1 AND a.patient_id = $2";
    }

    const checkRes = await pool.query(ownershipQuery, [sourceId, patientId]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ error: "Record not found or does not belong to this patient" });
    }

    const archiveReason = reason?.trim() || "Moved to Graveyard by patient";

    const insertRes = await pool.query(
      `INSERT INTO patient_graveyard_items (
         patient_id, source_type, source_id, archive_mode, archived_reason, archived_by
       ) VALUES ($1, $2, $3, 'manual', $4, $1)
       ON CONFLICT (patient_id, source_type, source_id)
       DO UPDATE SET 
         archived_at = CURRENT_TIMESTAMP, 
         archive_mode = 'manual', 
         archived_reason = EXCLUDED.archived_reason,
         archived_by = EXCLUDED.archived_by
       RETURNING *`,
      [patientId, sourceType, sourceId, archiveReason]
    );

    res.status(200).json({
      success: true,
      message: "Record moved to Graveyard successfully",
      archivedItem: insertRes.rows[0],
    });
  } catch (err) {
    console.error("archiveItem error:", err);
    res.status(500).json({ error: "Failed to archive record to Graveyard" });
  }
}

/**
 * Restore an archived record from the Graveyard back to active clinical history.
 * POST /api/patient/graveyard/restore
 * Body: { sourceType, sourceId }
 */
async function restoreItem(req, res) {
  const patientId = req.user.id;
  const { sourceType, sourceId } = req.body;

  if (!sourceType || !sourceId) {
    return res.status(400).json({ error: "sourceType and sourceId are required" });
  }

  try {
    const deleteRes = await pool.query(
      `DELETE FROM patient_graveyard_items
       WHERE patient_id = $1 AND source_type = $2 AND source_id = $3
       RETURNING *`,
      [patientId, sourceType, sourceId]
    );

    if (deleteRes.rows.length === 0) {
      return res.status(404).json({ error: "Record not found in Graveyard" });
    }

    res.status(200).json({
      success: true,
      message: "Record restored to active medical history successfully",
      restoredItem: deleteRes.rows[0],
    });
  } catch (err) {
    console.error("restoreItem error:", err);
    res.status(500).json({ error: "Failed to restore record from Graveyard" });
  }
}

/**
 * Retrieve all archived records in the Graveyard for the patient,
 * enriched with their original record details.
 * GET /api/patient/graveyard
 */
async function getGraveyardItems(req, res) {
  const patientId = req.user.id;

  try {
    const graveyardRows = await pool.query(
      `SELECT * FROM patient_graveyard_items
       WHERE patient_id = $1
       ORDER BY archived_at DESC`,
      [patientId]
    );

    if (graveyardRows.rows.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        items: [],
      });
    }

    // Group source_ids by source_type for efficient batch queries
    const docIds = [];
    const mhIds = [];
    const csIds = [];
    const consultIds = [];

    for (const item of graveyardRows.rows) {
      if (item.source_type === "document") docIds.push(item.source_id);
      else if (item.source_type === "medical_history") mhIds.push(item.source_id);
      else if (item.source_type === "clinical_session") csIds.push(item.source_id);
      else if (item.source_type === "consultation") consultIds.push(item.source_id);
    }

    // Query records in parallel
    const [docsRes, mhRes, csRes, consultRes] = await Promise.all([
      docIds.length > 0
        ? pool.query(
            `SELECT d.*, ocr.extracted_text, ocr.extracted_entities
             FROM documents d
             LEFT JOIN document_ocr ocr ON ocr.document_id = d.id
             WHERE d.id = ANY($1)`,
            [docIds]
          )
        : { rows: [] },
      mhIds.length > 0
        ? pool.query(`SELECT * FROM medical_history WHERE id = ANY($1)`, [mhIds])
        : { rows: [] },
      csIds.length > 0
        ? pool.query(`SELECT * FROM clinical_sessions WHERE id = ANY($1)`, [csIds])
        : { rows: [] },
      consultIds.length > 0
        ? pool.query(
            `SELECT c.*, u.first_name AS doctor_first_name, u.last_name AS doctor_last_name,
                    dp.specialization
             FROM consultations c
             JOIN appointments a ON c.appointment_id = a.id
             JOIN users u ON a.doctor_id = u.id
             LEFT JOIN doctor_profiles dp ON u.id = dp.user_id
             WHERE c.id = ANY($1)`,
            [consultIds]
          )
        : { rows: [] },
    ]);

    const docsMap = new Map(docsRes.rows.map((r) => [r.id, r]));
    const mhMap = new Map(mhRes.rows.map((r) => [r.id, r]));
    const csMap = new Map(csRes.rows.map((r) => [r.id, r]));
    const consultMap = new Map(consultRes.rows.map((r) => [r.id, r]));

    const formattedItems = graveyardRows.rows.map((item) => {
      let title = "Archived Record";
      let subtitle = "";
      let category = item.source_type;
      let date = item.archived_at;
      let details = "";
      let originalRecord = null;
      let documentId = null;

      if (item.source_type === "document") {
        const doc = docsMap.get(item.source_id);
        if (doc) {
          originalRecord = doc;
          documentId = doc.id;
          title = doc.title || doc.file_name || "Medical Document";
          subtitle = (doc.document_type || "Document").replace("_", " ");
          category = doc.document_type === "prescription" ? "prescription" : "document";
          date = doc.document_date || doc.created_at;
          details = doc.extracted_text?.slice(0, 200) || "";
        }
      } else if (item.source_type === "medical_history") {
        const mh = mhMap.get(item.source_id);
        if (mh) {
          originalRecord = mh;
          title = mh.name || "Medical History Item";
          subtitle = mh.type ? mh.type.toUpperCase() : "Clinical Record";
          category = mh.type === "allergy" ? "allergy" : mh.type === "procedure" ? "procedure" : "diagnosis";
          date = mh.diagnosed_at || mh.created_at;
          details = mh.notes || "";
        }
      } else if (item.source_type === "clinical_session") {
        const cs = csMap.get(item.source_id);
        if (cs) {
          originalRecord = cs;
          title = cs.chief_complaint ? `Assessment: ${cs.chief_complaint}` : "Clinical AI Assessment";
          subtitle = "AI Triage & Intake Session";
          category = "assessment";
          date = cs.created_at;
          details = cs.summary || "";
        }
      } else if (item.source_type === "consultation") {
        const c = consultMap.get(item.source_id);
        if (c) {
          originalRecord = c;
          const docName = `Dr. ${c.doctor_first_name || ""} ${c.doctor_last_name || ""}`.trim();
          title = docName && docName !== "Dr." ? `Consultation with ${docName}` : "Doctor Consultation";
          subtitle = c.specialization || c.diagnosis || "Medical Consultation";
          category = "consultation";
          date = c.started_at || c.created_at;
          details = c.clinical_notes || c.treatment_notes || "";
        }
      }

      return {
        id: item.id,
        sourceType: item.source_type,
        sourceId: item.source_id,
        archivedAt: item.archived_at,
        archiveMode: item.archive_mode,
        archivedReason: item.archived_reason || "Archived",
        title,
        subtitle,
        category,
        date,
        details,
        documentId,
        originalRecord,
      };
    });

    res.status(200).json({
      success: true,
      count: formattedItems.length,
      items: formattedItems,
    });
  } catch (err) {
    console.error("getGraveyardItems error:", err);
    res.status(500).json({ error: "Failed to retrieve Graveyard items" });
  }
}

/**
 * Get current graveyard retention policy.
 * GET /api/patient/graveyard/policy
 */
async function getGraveyardPolicy(req, res) {
  const patientId = req.user.id;
  try {
    const profileRes = await pool.query(
      `SELECT graveyard_retention_policy FROM patient_profiles WHERE user_id = $1`,
      [patientId]
    );
    const policy = profileRes.rows[0]?.graveyard_retention_policy || "1_year";
    res.status(200).json({ success: true, policy });
  } catch (err) {
    console.error("getGraveyardPolicy error:", err);
    res.status(500).json({ error: "Failed to retrieve Graveyard policy" });
  }
}

/**
 * Update graveyard retention policy.
 * PATCH /api/patient/graveyard/policy
 * Body: { policy }
 */
async function updateGraveyardPolicy(req, res) {
  const patientId = req.user.id;
  const { policy } = req.body;

  if (!VALID_POLICIES.includes(policy)) {
    return res.status(400).json({
      error: `Invalid policy. Must be one of: ${VALID_POLICIES.join(", ")}`,
    });
  }

  try {
    await pool.query(
      `UPDATE patient_profiles SET graveyard_retention_policy = $1 WHERE user_id = $2`,
      [policy, patientId]
    );

    // If a policy is activated, trigger auto-archival immediately
    if (policy !== "never") {
      await runAutoArchival(patientId);
    }

    res.status(200).json({
      success: true,
      message: `Graveyard policy updated to ${policy.replace("_", " ")}`,
      policy,
    });
  } catch (err) {
    console.error("updateGraveyardPolicy error:", err);
    res.status(500).json({ error: "Failed to update Graveyard policy" });
  }
}

module.exports = {
  runAutoArchival,
  archiveItem,
  restoreItem,
  getGraveyardItems,
  getGraveyardPolicy,
  updateGraveyardPolicy,
};
