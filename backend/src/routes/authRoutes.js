const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const staffController = require("../controllers/staffController");
const authenticateToken = require("../middleware/authMiddleware");

// Patient Phone Registration Flow
router.post("/patient/register/phone", authController.registerPhone);
router.post("/patient/verify-phone", authController.verifyPhone);

// Patient Phone Login Flow
router.post("/patient/login/phone", authController.loginPhone);
router.post("/patient/login/phone/verify", authController.verifyLoginPhone);

// Patient Email Registration Flow
router.post("/patient/register/email", authController.registerEmail);
router.post("/patient/verify-email", authController.verifyEmail);

// Patient Email Login Flow
router.post("/patient/login/email", authController.loginEmail);
router.post("/patient/login/email/verify", authController.verifyLoginEmail);

// Patient Google OAuth 2.0 Flow
router.get("/patient/google", authController.initiateGoogleAuth);
router.get("/patient/google/callback", authController.handleGoogleCallback);
router.post("/patient/google/exchange", authController.exchangeGoogleCode);

// Doctor Email + Password Register & Login Flow
router.post("/doctor/register", authController.registerDoctor);
router.post("/doctor/login", authController.loginDoctor);

// Staff (Admin, Receptionist, Nurse) Login Flow
router.post("/staff/login", staffController.loginStaff);

// Authenticated User Identity (Shared for all login methods)
router.get("/me", authenticateToken, authController.getMe);

module.exports = router;
