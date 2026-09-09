const express = require("express");
const router = express.Router();
const appointmentController = require("../controllers/appointmentController");
const authorizeRoles = require("../middleware/rbacMiddleware");
const authenticateToken = require("../middleware/authMiddleware");

// All appointment routes require authentication
router.use(authenticateToken);

router.post("/", authorizeRoles("patient"), appointmentController.createAppointment);
router.get("/available", appointmentController.getAvailableSlots);
router.get("/patient", authorizeRoles("patient"), appointmentController.getPatientAppointments);
router.get("/:id", authorizeRoles("patient", "doctor"), appointmentController.getAppointmentById);
router.patch("/:id/status", authorizeRoles("patient", "doctor"), appointmentController.updateAppointmentStatus);

module.exports = router;
