const express = require("express");
const router = express.Router();
const whatsappAuthMiddleware = require("../middleware/whatsappAuthMiddleware");
const whatsappClinicalController = require("../controllers/whatsappClinicalController");

// All WhatsApp clinical routes require valid server-to-server X-WhatsApp-Service-Key authentication
router.use("/clinical", whatsappAuthMiddleware);

// WhatsApp Clinical Intake Endpoints
router.post("/clinical/session/start", whatsappClinicalController.startSession);
router.post("/clinical/session/:id/text-turn", whatsappClinicalController.processTextTurn);
router.post("/clinical/session/:id/finalize", whatsappClinicalController.finalizeSession);

module.exports = router;
