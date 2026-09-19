const router=require("express").Router();
const authenticate=require("../middleware/authMiddleware");
const roles=require("../middleware/rbacMiddleware");
const c=require("../controllers/insuranceController");
router.use(authenticate);

router.get("/shared-policies",roles("doctor","receptionist"),c.listSharedPolicies);
router.get("/shared-policies/:id",roles("doctor","receptionist"),c.getSharedPolicy);

router.get("/share-candidates",roles("patient"),c.listShareCandidates);
router.get("/policies/:id/access",roles("patient"),c.listPolicyAccess);
router.put("/policies/:id/access",roles("patient"),c.setPolicyAccess);
router.post("/policies",roles("patient"),c.createPolicy);
router.get("/policies",roles("patient"),c.listPolicies);
router.get("/policies/:id",roles("patient"),c.getPolicy);
router.patch("/policies/:id",roles("patient"),c.updatePolicy);
router.delete("/policies/:id",roles("patient"),c.deletePolicy);
router.post("/policies/:id/procedure-limits",roles("patient"),c.addProcedureLimit);
router.post("/policies/:id/exclusions",roles("patient"),c.addExclusion);
router.post("/documents/:documentId/extract",roles("patient"),c.extractDocument);
router.post("/claim-estimates",roles("patient"),c.createEstimate);
router.get("/claim-estimates",roles("patient"),c.listEstimates);
router.get("/claim-estimates/:id",roles("patient"),c.getEstimate);
module.exports=router;
