const express = require("express");
const router = express.Router();
const sessionController = require("../controllers/sessionController");
const authenticateToken = require("../middleware/authMiddleware");
const { uploadAudio } = require("../middleware/uploadMiddleware");

// All session routes require authentication
router.use(authenticateToken);
router.use(require("../middleware/rbacMiddleware")("patient"));

router.get("/booking-assessments", async (req, res, next) => {
    try {
        const result = await require("../config/db").query(
            "SELECT id, chief_complaint, created_at FROM clinical_sessions WHERE patient_id = $1 AND status = 'completed' AND appointment_id IS NULL ORDER BY created_at DESC", [req.user.id]
        );
        res.json({ success: true, assessments: result.rows });
    } catch (error) { next(error); }
});
router.post("/start", sessionController.startSession);
router.post("/:id/voice-turn", uploadAudio.single("file"), sessionController.processVoiceTurn);
router.post("/:id/text-turn", sessionController.processTextTurn);
router.get("/:id", sessionController.getSessionById);
router.post("/:id/finalize", sessionController.finalizeSession);

module.exports = router;
