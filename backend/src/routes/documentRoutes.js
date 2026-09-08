const express = require("express");
const router = express.Router();
const documentController = require("../controllers/documentController");
const authenticateToken = require("../middleware/authMiddleware");
const { uploadDocument } = require("../middleware/uploadMiddleware");

// All document routes require authentication
router.use(authenticateToken);

router.post("/upload", uploadDocument.single("file"), documentController.uploadDocument);
router.post("/search", documentController.searchDocuments);
router.post("/:documentId/ask", documentController.askDocumentQuestion);
router.get("/patient/:patientId", documentController.getPatientDocuments);
router.get("/:id/url", documentController.getDocumentDownloadUrl);
router.get("/:id", documentController.getDocumentById);
router.delete("/:id", documentController.deleteDocument);

module.exports = router;
