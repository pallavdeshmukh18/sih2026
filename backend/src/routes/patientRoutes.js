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

module.exports = router;
