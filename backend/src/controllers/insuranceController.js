const pool = require("../config/db");
const { estimateClaim } = require("../services/claimEstimatorService");
const { extractPolicyDataFromDocument } = require("../services/policyExtractionService");

const POLICY_FIELDS = ["insurer_name", "policy_number", "member_id", "plan_name", "policy_type", "policy_start_date", "policy_end_date", "sum_insured", "remaining_sum_insured", "deductible", "copay_percent", "room_rent_limit_per_day", "icu_limit_per_day", "pre_hospitalization_days", "post_hospitalization_days", "network_required", "waiting_period_general_days", "waiting_period_preexisting_days", "source_document_id"];
const moneyFields = ["sum_insured", "remaining_sum_insured", "deductible", "room_rent_limit_per_day", "icu_limit_per_day"];
const dayFields = ["pre_hospitalization_days", "post_hospitalization_days", "waiting_period_general_days", "waiting_period_preexisting_days"];

function validatePolicy(body, partial = false) {
    if (!partial && !String(body.insurer_name || "").trim()) throw Object.assign(new Error("Insurer name is required."), { statusCode: 400 });
    for (const field of moneyFields) if (body[field] != null && (!Number.isFinite(Number(body[field])) || Number(body[field]) < 0)) throw Object.assign(new Error(`${field} must be zero or greater.`), { statusCode: 400 });
    for (const field of dayFields) if (body[field] != null && (!Number.isInteger(Number(body[field])) || Number(body[field]) < 0)) throw Object.assign(new Error(`${field} must be a non-negative whole number.`), { statusCode: 400 });
    if (body.copay_percent != null && (Number(body.copay_percent) < 0 || Number(body.copay_percent) > 100)) throw Object.assign(new Error("Co-pay must be between 0 and 100."), { statusCode: 400 });
    if (body.policy_start_date && body.policy_end_date && body.policy_end_date < body.policy_start_date) throw Object.assign(new Error("Policy end date cannot be before its start date."), { statusCode: 400 });
}
const selected = body => Object.fromEntries(POLICY_FIELDS.filter(key => Object.hasOwn(body, key)).map(key => [key, body[key] === "" ? null : body[key]]));

async function createPolicy(req, res, next) {
    try {
        validatePolicy(req.body); const data = selected(req.body); data.insurer_name = String(data.insurer_name).trim();
        if (data.source_document_id) { const owned = await pool.query("SELECT 1 FROM documents WHERE id=$1 AND patient_id=$2 AND document_type='insurance'", [data.source_document_id, req.user.id]); if (!owned.rows.length) return res.status(400).json({ message: "Source insurance document is invalid." }); }
        const keys = Object.keys(data); const values = [req.user.id, ...keys.map(k => data[k])];
        const result = await pool.query(`INSERT INTO insurance_policies (patient_id, ${keys.join(",")}) VALUES ($1, ${keys.map((_, i) => `$${i + 2}`).join(",")}) RETURNING *`, values);
        res.status(201).json({ success: true, policy: result.rows[0] });
    } catch (error) { next(error); }
}
async function listPolicies(req, res, next) { try { const result = await pool.query(`SELECT p.*, COUNT(DISTINCT l.id)::int AS procedure_limit_count, COUNT(DISTINCT e.id)::int AS exclusion_count FROM insurance_policies p LEFT JOIN insurance_procedure_limits l ON l.policy_id=p.id LEFT JOIN insurance_exclusions e ON e.policy_id=p.id WHERE p.patient_id=$1 GROUP BY p.id ORDER BY p.created_at DESC`, [req.user.id]); res.json({ success: true, policies: result.rows }); } catch (error) { next(error); } }
async function getPolicy(req, res, next) { try { const policy = await pool.query("SELECT * FROM insurance_policies WHERE id=$1 AND patient_id=$2", [req.params.id, req.user.id]); if (!policy.rows.length) return res.status(404).json({ message: "Policy not found." }); const [limits, exclusions] = await Promise.all([pool.query("SELECT * FROM insurance_procedure_limits WHERE policy_id=$1 ORDER BY procedure_name", [req.params.id]), pool.query("SELECT * FROM insurance_exclusions WHERE policy_id=$1 ORDER BY exclusion_name", [req.params.id])]); res.json({ success: true, policy: { ...policy.rows[0], procedure_limits: limits.rows, exclusions: exclusions.rows } }); } catch (error) { next(error); } }
async function updatePolicy(req, res, next) {
    try {
        const current = await pool.query("SELECT * FROM insurance_policies WHERE id=$1 AND patient_id=$2", [req.params.id, req.user.id]);
        if (!current.rows.length) return res.status(404).json({ message: "Policy not found." });
        const data = selected(req.body);
        if (!Object.keys(data).length) return res.status(400).json({ message: "No supported policy fields supplied." });
        validatePolicy({ ...current.rows[0], ...data });
        if (data.source_document_id) {
            const owned = await pool.query("SELECT 1 FROM documents WHERE id=$1 AND patient_id=$2 AND document_type='insurance'", [data.source_document_id, req.user.id]);
            if (!owned.rows.length) return res.status(400).json({ message: "Source insurance document is invalid." });
        }
        const keys = Object.keys(data);
        const result = await pool.query(`UPDATE insurance_policies SET ${keys.map((key, i) => `${key}=$${i + 1}`).join(",")} WHERE id=$${keys.length + 1} AND patient_id=$${keys.length + 2} RETURNING *`, [...keys.map(key => data[key]), req.params.id, req.user.id]);
        res.json({ success: true, policy: result.rows[0] });
    } catch (error) { next(error); }
}
async function deletePolicy(req, res, next) { try { const used = await pool.query("SELECT 1 FROM claim_estimates c JOIN insurance_policies p ON p.id=c.policy_id WHERE p.id=$1 AND p.patient_id=$2 LIMIT 1", [req.params.id, req.user.id]); if (used.rows.length) return res.status(409).json({ message: "Policies with saved estimates cannot be deleted." }); const result = await pool.query("DELETE FROM insurance_policies WHERE id=$1 AND patient_id=$2 RETURNING id", [req.params.id, req.user.id]); if (!result.rows.length) return res.status(404).json({ message: "Policy not found." }); res.json({ success: true }); } catch (error) { next(error); } }
async function addProcedureLimit(req, res, next) { try { const owned = await pool.query("SELECT 1 FROM insurance_policies WHERE id=$1 AND patient_id=$2", [req.params.id, req.user.id]); if (!owned.rows.length) return res.status(404).json({ message: "Policy not found." }); const { procedure_name, procedure_code=null, max_eligible_amount=null, waiting_period_days=0, notes=null }=req.body; if (!String(procedure_name||"").trim() || (max_eligible_amount != null && Number(max_eligible_amount)<0) || !Number.isInteger(Number(waiting_period_days)) || Number(waiting_period_days)<0) return res.status(400).json({ message: "Valid procedure limit details are required." }); const result=await pool.query("INSERT INTO insurance_procedure_limits (policy_id,procedure_name,procedure_code,max_eligible_amount,waiting_period_days,notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",[req.params.id,procedure_name.trim(),procedure_code,max_eligible_amount,waiting_period_days,notes]); res.status(201).json({success:true,procedure_limit:result.rows[0]}); } catch(error){next(error);} }
async function addExclusion(req,res,next){try{const owned=await pool.query("SELECT 1 FROM insurance_policies WHERE id=$1 AND patient_id=$2",[req.params.id,req.user.id]);if(!owned.rows.length)return res.status(404).json({message:"Policy not found."});if(!String(req.body.exclusion_name||"").trim())return res.status(400).json({message:"Exclusion name is required."});const result=await pool.query("INSERT INTO insurance_exclusions (policy_id,exclusion_name,description) VALUES ($1,$2,$3) RETURNING *",[req.params.id,req.body.exclusion_name.trim(),req.body.description||null]);res.status(201).json({success:true,exclusion:result.rows[0]});}catch(error){next(error);}}
async function extractDocument(req,res,next){try{res.json({success:true,extracted:await extractPolicyDataFromDocument(req.params.documentId,req.user.id),review_required:true});}catch(error){next(error);}}

async function createEstimate(req, res, next) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const policyResult = await client.query("SELECT * FROM insurance_policies WHERE id=$1 AND patient_id=$2", [req.body.policy_id, req.user.id]);
        if (!policyResult.rows.length) { await client.query("ROLLBACK"); return res.status(404).json({ message: "Policy not found." }); }
        if (!String(req.body.treatment_name || "").trim()) throw Object.assign(new Error("Treatment name is required."), { statusCode: 400 });
        const limitResult = req.body.procedure_code
            ? await client.query("SELECT * FROM insurance_procedure_limits WHERE policy_id=$1 AND lower(procedure_code)=lower($2) ORDER BY max_eligible_amount ASC NULLS LAST LIMIT 1", [req.body.policy_id, req.body.procedure_code])
            : await client.query("SELECT * FROM insurance_procedure_limits WHERE policy_id=$1 AND (lower(procedure_name)=lower($2) OR lower($2) LIKE '%'||lower(procedure_name)||'%') ORDER BY max_eligible_amount ASC NULLS LAST LIMIT 1", [req.body.policy_id, req.body.treatment_name.trim()]);
        const output = estimateClaim({ policy: policyResult.rows[0], procedureLimit: limitResult.rows[0] || null, estimatedBill: req.body.estimated_bill, roomRentPerDay: req.body.room_rent_per_day, roomDays: req.body.room_days, icuRentPerDay: req.body.icu_rent_per_day, icuDays: req.body.icu_days, nonPayableItems: req.body.non_payable_items, otherExcludedAmount: req.body.other_excluded_amount, networkHospital: req.body.network_hospital });
        const values = [req.user.id, req.body.policy_id, req.body.treatment_name.trim(), req.body.procedure_code || null, req.body.hospital_name || null, Boolean(req.body.network_hospital), req.body.estimated_bill, req.body.room_rent_per_day || 0, req.body.room_days || 0, req.body.icu_rent_per_day || 0, req.body.icu_days || 0, req.body.non_payable_items || 0, req.body.other_excluded_amount || 0, output.baseEligibleAmount, output.procedureLimitApplied, output.roomRentDeduction, output.icuRentDeduction, output.deductibleApplied, output.copayApplied, output.exclusionsApplied, output.finalEstimatedClaim, output.estimatedPatientOutOfPocket, JSON.stringify(output.breakdown), JSON.stringify(output.warnings), JSON.stringify(output.assumptions), output.confidence];
        const insert = await client.query(`INSERT INTO claim_estimates (patient_id,policy_id,treatment_name,procedure_code,hospital_name,network_hospital,estimated_bill,room_rent_per_day,room_days,icu_rent_per_day,icu_days,non_payable_items,other_excluded_amount,base_eligible_amount,procedure_limit_applied,room_rent_deduction,icu_rent_deduction,deductible_applied,copay_applied,exclusions_applied,final_estimated_claim,estimated_patient_out_of_pocket,breakdown_json,warnings_json,assumptions_json,confidence) VALUES (${values.map((_, i) => `$${i + 1}`).join(",")}) RETURNING *`, values);
        await client.query("COMMIT");
        res.status(201).json({ success: true, estimate: { ...insert.rows[0], remaining_sum_insured_after_claim: output.remainingSumInsuredAfterClaim, disclaimer: output.disclaimer, procedure_limit: limitResult.rows[0] || null } });
    } catch (error) { await client.query("ROLLBACK").catch(() => {}); next(error); }
    finally { client.release(); }
}
async function listEstimates(req,res,next){try{const result=await pool.query(`SELECT c.*,p.insurer_name,p.plan_name FROM claim_estimates c JOIN insurance_policies p ON p.id=c.policy_id WHERE c.patient_id=$1 ORDER BY c.created_at DESC`,[req.user.id]);res.json({success:true,estimates:result.rows});}catch(error){next(error);}}
async function getEstimate(req,res,next){try{const result=await pool.query(`SELECT c.*,p.insurer_name,p.plan_name,p.policy_number FROM claim_estimates c JOIN insurance_policies p ON p.id=c.policy_id WHERE c.id=$1 AND c.patient_id=$2`,[req.params.id,req.user.id]);if(!result.rows.length)return res.status(404).json({message:"Claim estimate not found."});res.json({success:true,estimate:result.rows[0]});}catch(error){next(error);}}

module.exports={createPolicy,listPolicies,getPolicy,updatePolicy,deletePolicy,addProcedureLimit,addExclusion,extractDocument,createEstimate,listEstimates,getEstimate};
