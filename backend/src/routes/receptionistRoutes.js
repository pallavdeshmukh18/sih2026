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
router.post("/appointments", receptionistController.bookReceptionistAppointment);
router.patch("/appointments/:appointmentId/reschedule", receptionistController.rescheduleReceptionistAppointment);
router.patch("/appointments/:appointmentId/cancel", receptionistController.cancelReceptionistAppointment);
router.get("/patients", receptionistController.getReceptionistPatients);
router.post("/check-in/:appointmentId", receptionistController.checkInAppointment);
router.post("/patients/walk-in", receptionistController.registerWalkInPatient);

// Billing & Payments
router.get("/billing", receptionistController.getReceptionistBilling);
router.get("/billing/stats", receptionistController.getBillingStats);
router.post("/billing", receptionistController.createReceptionistInvoice);
router.patch("/billing/:invoiceId/pay", receptionistController.collectInvoicePayment);
router.patch("/billing/:invoiceId/refund", receptionistController.refundInvoice);

// Operational & Clinical Reports
router.get("/reports", receptionistController.getReceptionistReports);

module.exports = router;
