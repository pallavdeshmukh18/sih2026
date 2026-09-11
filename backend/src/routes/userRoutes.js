const express = require("express");
const authenticateToken = require("../middleware/authMiddleware");
const { uploadProfilePhoto } = require("../controllers/userController");
const { uploadProfilePhoto: uploadMiddleware } = require("../middleware/uploadMiddleware");

const router = express.Router();

router.post("/profile-photo", authenticateToken, uploadMiddleware.single("photo"), uploadProfilePhoto);

module.exports = router;
