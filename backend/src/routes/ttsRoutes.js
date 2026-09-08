const express = require("express");
const router = express.Router();
const ttsController = require("../controllers/ttsController");

// POST /api/tts/synthesize
router.post("/synthesize", ttsController.synthesizeSpeech);

module.exports = router;
