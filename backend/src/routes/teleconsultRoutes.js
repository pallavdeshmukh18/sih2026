const express = require("express");
const router = express.Router();
const teleconsultController = require("../controllers/teleconsultController");
const authenticateToken = require("../middleware/authMiddleware");

// All teleconsultation endpoints require authentication
router.use(authenticateToken);
router.use(require("../middleware/rbacMiddleware")("patient", "doctor"));

// Config
router.get("/config", teleconsultController.getAgoraConfig);

// Call request & session management
router.post("/request", require("../middleware/rbacMiddleware")("patient"), teleconsultController.requestCallSession);
router.get("/sessions", teleconsultController.getCallSessions);
router.patch("/:id/respond", teleconsultController.respondToCallRequest);
router.post("/:id/join", teleconsultController.joinCallSession);
router.post("/:id/end", teleconsultController.endCallSession);

// Messaging in consultation thread
router.get("/:id/messages", teleconsultController.getSessionMessages);
router.post("/:id/messages", teleconsultController.sendMessage);

module.exports = router;
