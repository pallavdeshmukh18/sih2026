const express = require("express");
const router = express.Router();
const patientController = require("../controllers/patientController");
const authenticateToken = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/rbacMiddleware");

// All patient profile routes require JWT authentication and 'patient' role
router.use(authenticateToken);
router.use(authorizeRoles("patient"));

router.patch("/profile", patientController.updatePatientProfile);
router.patch("/profile/onboarding", patientController.saveOnboardingPreferences);
router.get("/profile/onboarding", patientController.getOnboardingPreferences);
router.get("/history", patientController.getPatientMedicalHistory);
router.post("/history", patientController.addMedicalHistoryItem);
router.delete("/history/:id", patientController.deleteMedicalHistoryItem);
router.delete("/history", patientController.clearAllMedicalHistory);
router.get("/medical-id", patientController.getPatientMedicalId);
router.post("/medical-id/qr", patientController.generatePatientQrToken);
router.get("/connected-doctors", patientController.getConnectedDoctors);
router.delete("/connected-doctors/:relationshipId", patientController.revokeDoctorAccess);

module.exports = router;
