const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const authenticateToken = require("../middleware/authMiddleware");

// Patient Phone Registration Flow
router.post("/patient/register/phone", authController.registerPhone);
router.post("/patient/verify-phone", authController.verifyPhone);

// Patient Phone Login Flow
router.post("/patient/login/phone", authController.loginPhone);
router.post("/patient/login/phone/verify", authController.verifyLoginPhone);

// Authenticated User Identity
router.get("/me", authenticateToken, authController.getMe);

module.exports = router;
