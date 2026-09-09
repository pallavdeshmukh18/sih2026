const pool = require('../config/db');

// A clinical relationship or appointment is never document consent.
function documentConsentSql(documentAlias, userParameter, download = false) {
    return `EXISTS (
        SELECT 1 FROM document_access da
        WHERE da.document_id = ${documentAlias}.id AND da.user_id = ${userParameter}
          AND da.granted_by = ${documentAlias}.patient_id
          AND EXISTS (SELECT 1 FROM patient_doctor_relationships r
                      WHERE r.patient_id = ${documentAlias}.patient_id AND r.doctor_id = ${userParameter} AND r.status = 'active')
          AND da.revoked_at IS NULL
          AND (da.expires_at IS NULL OR da.expires_at > CURRENT_TIMESTAMP)
          ${download ? "AND da.access_type = 'download'" : ""}
    )`;
}

async function canAccessDocument(user, document, download = false) {
    if (user.role === 'patient') return document.patient_id === user.id;
    if (user.role !== 'doctor') return false;
    const result = await pool.query(
        `SELECT 1 FROM documents d WHERE d.id = $1 AND ${documentConsentSql('d', '$2', download)}`,
        [document.id, user.id]
    );
    return result.rows.length > 0;
}

module.exports = { canAccessDocument, documentConsentSql };
