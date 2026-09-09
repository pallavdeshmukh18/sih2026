const express = require("express");
const router = express.Router();
const receptionistController = require("../controllers/receptionistController");
const authenticateToken = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/rbacMiddleware");

// All receptionist routes require authentication and staff/doctor/receptionist/admin role
router.use(authenticateToken);
router.use(authorizeRoles("receptionist", "admin", "doctor", "nurse"));
router.use(require("../middleware/practiceMiddleware"));

router.get("/stats", receptionistController.getReceptionistStats);
router.get("/appointments", receptionistController.getReceptionistAppointments);
router.get("/patients", receptionistController.getReceptionistPatients);
router.post("/check-in/:appointmentId", receptionistController.checkInAppointment);
router.post("/patients/walk-in", receptionistController.registerWalkInPatient);

module.exports = router;
