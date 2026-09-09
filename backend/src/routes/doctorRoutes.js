const express = require("express");
const router = express.Router();
const doctorController = require("../controllers/doctorController");
const authenticateToken = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/rbacMiddleware");

// All doctor routes require authentication
router.use(authenticateToken);

// Queue and consultation confirmation require 'doctor' role
router.get("/directory", doctorController.getPublicDoctors);
router.patch("/profile", authorizeRoles("doctor"), doctorController.updateOwnProfile);
router.get("/queue", authorizeRoles("doctor"), doctorController.getDoctorQueue);
router.get("/patient/:id/unified-history", authorizeRoles("doctor"), doctorController.getPatientUnifiedHistory);
router.post("/consultations/:appointmentId/confirm", authorizeRoles("doctor"), doctorController.confirmConsultation);

// Doctor QR Patient Pairing & Patient Management
router.post("/patients/pair/preview", authorizeRoles("doctor"), doctorController.previewPatientPairing);
router.post("/patients/pair/confirm", authorizeRoles("doctor"), doctorController.confirmPatientPairing);
router.get("/patients", authorizeRoles("doctor"), doctorController.getDoctorPatients);
router.delete("/patients/:patientId", authorizeRoles("doctor"), doctorController.revokePatientConnection);

// Admin: Doctor Verification (only doctors can verify other doctors)
router.get("/admin/pending", require("../middleware/platformAdminMiddleware"), doctorController.getPendingDoctors);
router.patch("/admin/verify/:doctorId", require("../middleware/platformAdminMiddleware"), doctorController.verifyDoctor);

module.exports = router;
