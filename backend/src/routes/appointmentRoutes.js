const express = require("express");
const router = express.Router();
const appointmentController = require("../controllers/appointmentController");
const authorizeRoles = require("../middleware/rbacMiddleware");
const authenticateToken = require("../middleware/authMiddleware");

// All appointment routes require authentication
router.use(authenticateToken);

router.post("/", authorizeRoles("patient", "receptionist", "doctor", "admin"), appointmentController.createAppointment);
router.get("/available", appointmentController.getAvailableSlots);
router.get("/patient", authorizeRoles("patient", "receptionist", "doctor", "admin"), appointmentController.getPatientAppointments);
router.get("/:id", authorizeRoles("patient", "doctor", "receptionist", "admin"), appointmentController.getAppointmentById);
router.patch("/:id/status", authorizeRoles("patient", "doctor", "receptionist", "admin"), appointmentController.updateAppointmentStatus);
router.delete("/:id", authorizeRoles("patient", "doctor", "receptionist", "admin"), appointmentController.deleteAppointment);

module.exports = router;
