const express = require("express");
const router = express.Router();
const sessionController = require("../controllers/sessionController");
const authenticateToken = require("../middleware/authMiddleware");
const { uploadAudio } = require("../middleware/uploadMiddleware");

// All session routes require authentication
router.use(authenticateToken);

router.post("/start", sessionController.startSession);
router.post("/:id/voice-turn", uploadAudio.single("file"), sessionController.processVoiceTurn);
router.post("/:id/text-turn", sessionController.processTextTurn);
router.get("/:id", sessionController.getSessionById);
router.post("/:id/finalize", sessionController.finalizeSession);

module.exports = router;
