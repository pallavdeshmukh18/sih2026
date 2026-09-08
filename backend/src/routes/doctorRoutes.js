const express = require("express");
const router = express.Router();
const doctorController = require("../controllers/doctorController");
const authenticateToken = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/rbacMiddleware");

// All doctor routes require authentication
router.use(authenticateToken);

// Queue and consultation confirmation require 'doctor' role
router.get("/directory", doctorController.getPublicDoctors);
router.get("/queue", authorizeRoles("doctor"), doctorController.getDoctorQueue);
router.get("/patient/:id/unified-history", authorizeRoles("doctor", "receptionist"), doctorController.getPatientUnifiedHistory);
router.post("/consultations/:appointmentId/confirm", authorizeRoles("doctor"), doctorController.confirmConsultation);

// Admin: Doctor Verification (only doctors can verify other doctors)
router.get("/admin/pending", authorizeRoles("doctor"), doctorController.getPendingDoctors);
router.patch("/admin/verify/:doctorId", authorizeRoles("doctor"), doctorController.verifyDoctor);

module.exports = router;
