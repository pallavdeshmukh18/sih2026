const express = require("express");
const router = express.Router();
const appointmentController = require("../controllers/appointmentController");
const authenticateToken = require("../middleware/authMiddleware");

// All appointment routes require authentication
router.use(authenticateToken);

router.post("/", appointmentController.createAppointment);
router.get("/available", appointmentController.getAvailableSlots);
router.get("/patient", appointmentController.getPatientAppointments);
router.get("/:id", appointmentController.getAppointmentById);
router.patch("/:id/status", appointmentController.updateAppointmentStatus);

module.exports = router;
