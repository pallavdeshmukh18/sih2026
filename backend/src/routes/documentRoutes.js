const express = require("express");
const router = express.Router();
const documentController = require("../controllers/documentController");
const authorizeRoles = require("../middleware/rbacMiddleware");
const authenticateToken = require("../middleware/authMiddleware");
const { uploadDocument } = require("../middleware/uploadMiddleware");

// All document routes require authentication
router.use(authenticateToken);
router.use(authorizeRoles("patient", "doctor"));

router.post("/upload", authorizeRoles("patient"), uploadDocument.single("file"), documentController.uploadDocument);
router.post("/search", authorizeRoles("patient"), documentController.searchDocuments);
router.post("/:documentId/ask", documentController.askDocumentQuestion);
router.get("/patient/:patientId", documentController.getPatientDocuments);
router.get("/:id/access", authorizeRoles("patient"), documentController.getDocumentAccess);
router.put("/:id/access", authorizeRoles("patient"), documentController.setDocumentAccess);
router.get("/:id/file", documentController.downloadLocalDocument);
router.get("/:id/url", documentController.getDocumentDownloadUrl);
router.get("/:id", documentController.getDocumentById);
router.delete("/:id", authorizeRoles("patient"), documentController.deleteDocument);

module.exports = router;
