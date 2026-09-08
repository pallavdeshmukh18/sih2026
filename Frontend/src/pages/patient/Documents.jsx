import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Search,
  Sparkles,
  Upload,
  FileSignature,
  Download,
  Trash2,
  ExternalLink,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  FileCode,
  Info
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../i18n";
import {
  getPatientDocuments,
  uploadMedicalDocument,
  deleteMedicalDocument,
  getDocumentDownloadUrl,
  searchMedicalDocuments
} from "../../services/api";
import DocumentDetailModal from "../../components/DocumentDetailModal";
import styles from "./Documents.module.css";

export default function Documents() {
  const { user, token } = useAuth();
  const { t } = useLanguage();
  const fileInputRef = useRef(null);

  // Document List State
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Upload State
  const [uploadState, setUploadState] = useState("idle"); // idle | uploading | processing | success | error
  const [uploadStageText, setUploadStageText] = useState("");
  const [uploadErrorMsg, setUploadErrorMsg] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);

  // Selected Document for Structured Detail Modal
  const [selectedDoc, setSelectedDoc] = useState(null);

  // Semantic History Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResult, setSearchResult] = useState(null);

  // Load Patient Documents from Authenticated Backend
  const fetchDocuments = async () => {
    if (!token || !user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getPatientDocuments(user.id, token);
      if (res.success && Array.isArray(res.documents)) {
        setDocuments(res.documents);
      } else {
        throw new Error(res.message || "Failed to load medical records.");
      }
    } catch (err) {
      console.error("Failed to fetch documents:", err);
      setError(err.message || "Unable to load your medical documents.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [token, user?.id]);

  // Handle File Upload Process
  const processUpload = async (file) => {
    if (!file) return;

    const allowedTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      setUploadState("error");
      setUploadErrorMsg("Only PDF, JPG, JPEG, and PNG medical files are supported.");
      return;
    }

    setUploadState("uploading");
    setUploadStageText("Uploading document to secure medical storage...");
    setUploadErrorMsg("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("patientId", user.id);
    formData.append("documentType", "other");

    try {
      // Transition processing feedback
      setTimeout(() => {
        setUploadState("processing");
        setUploadStageText("Running OCR & structuring medical report...");
      }, 900);

      const res = await uploadMedicalDocument(formData, token);

      if (res.success) {
        setUploadState("success");
        setUploadStageText(t("dashboard.uploadSuccess") || "Record uploaded and structured successfully!");
        await fetchDocuments();
        setTimeout(() => setUploadState("idle"), 4000);
      } else {
        throw new Error(res.message || "Document upload failed.");
      }
    } catch (err) {
      console.error("Document upload error:", err);
      setUploadState("error");
      setUploadErrorMsg(err.message || "We couldn't process this document. Please try uploading a clearer copy.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) processUpload(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processUpload(file);
  };

  // Handle Document Deletion
  const handleDeleteDoc = async (documentId) => {
    try {
      await deleteMedicalDocument(documentId, token);
      setDocuments((prev) => prev.filter((d) => d.id !== documentId));
      if (selectedDoc?.id === documentId) {
        setSelectedDoc(null);
      }
    } catch (err) {
      console.error("Delete document error:", err);
    }
  };

  // Handle Opening Original Signed Download URL
  const handleOpenOriginal = async (docId) => {
    try {
      const res = await getDocumentDownloadUrl(docId, token);
      if (res.downloadUrl) {
        window.open(res.downloadUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      console.error("Open original document error:", err);
    }
  };

  // Handle Semantic Document Search / Ask History
  const handleSearchHistory = async (e) => {
    e?.preventDefault();
    if (!searchQuery.trim()) return;

    setSearchLoading(true);
    setSearchResult(null);
    try {
      const res = await searchMedicalDocuments(searchQuery.trim(), token);
      if (res.success) {
        setSearchResult(res);
      }
    } catch (err) {
      console.error("Search error:", err);
      setSearchResult({
        query: searchQuery,
        summary: "Unable to complete document search right now. Please try again.",
        results: [],
        sources: []
      });
    } finally {
      setSearchLoading(false);
    }
  };

  // Format File Size
  const formatBytes = (bytes) => {
    if (!bytes || isNaN(bytes)) return "0 KB";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  // Filter recent extractions from real documents
  const recentExtractions = documents
    .filter((d) => d.extracted_text || d.ai_summary || d.extracted_entities)
    .slice(0, 3);

  return (
    <div className="workspacePage" style={{ paddingBottom: "32px" }}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        style={{ display: "flex", flexDirection: "column", gap: "24px" }}
      >
        {/* Page Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <h1 style={{ fontSize: "28px", fontFamily: "var(--font-sans)", fontWeight: "700", color: "var(--color-dark)" }}>
              {t("documents.title")}
            </h1>
            <p style={{ color: "var(--color-text-muted)", marginTop: "6px", fontSize: "14px" }}>
              {t("documents.subtitle")}
            </p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadState === "uploading" || uploadState === "processing"}
            style={{
              background: "#0d9488",
              color: "#ffffff",
              padding: "10px 22px",
              borderRadius: "10px",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              cursor: "pointer",
              border: "none",
              fontWeight: "600",
              fontSize: "14px",
              boxShadow: "0 4px 14px rgba(13, 148, 136, 0.25)"
            }}
          >
            {uploadState === "uploading" || uploadState === "processing" ? (
              <>
                <Loader2 size={18} className="spin" /> Processing...
              </>
            ) : (
              <>
                <Upload size={18} /> {t("documents.uploadTitle")}
              </>
            )}
          </button>
        </div>

        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".pdf,.jpg,.jpeg,.png"
          style={{ display: "none" }}
        />

        {/* Drag & Drop Upload Zone & Live Pipeline Banner */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          style={{
            background: isDragOver ? "#f0fdf4" : "#ffffff",
            border: `2px dashed ${isDragOver ? "#0d9488" : "#cbd5e1"}`,
            borderRadius: "16px",
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            transition: "all 0.2s ease"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Upload size={20} color="#0d9488" />
            <span style={{ fontSize: "14px", fontWeight: "600", color: "#1e293b" }}>
              {t("documents.dragDropText")}
            </span>
          </div>
          <span style={{ fontSize: "12px", color: "#64748b" }}>
            Supported formats: PDF, JPG, JPEG, PNG • Maximum size: 15MB
          </span>

          {/* Live Pipeline Status Display */}
          {uploadState !== "idle" && (
            <div
              style={{
                marginTop: "12px",
                padding: "10px 16px",
                borderRadius: "10px",
                fontSize: "13px",
                display: "inline-flex",
                alignItems: "center",
                gap: "10px",
                width: "100%",
                maxWidth: "520px",
                background: uploadState === "error" ? "#fef2f2" : uploadState === "success" ? "#f0fdf4" : "#eff6ff",
                color: uploadState === "error" ? "#991b1b" : uploadState === "success" ? "#166534" : "#1e40af",
                border: `1px solid ${uploadState === "error" ? "#fecaca" : uploadState === "success" ? "#bbf7d0" : "#bfdbfe"}`
              }}
            >
              {uploadState === "error" ? (
                <AlertCircle size={18} />
              ) : uploadState === "success" ? (
                <CheckCircle2 size={18} />
              ) : (
                <Loader2 size={18} className="spin" />
              )}
              <span style={{ fontWeight: "500" }}>
                {uploadState === "error" ? uploadErrorMsg : uploadStageText}
              </span>
            </div>
          )}
        </div>

        {/* Workspace Main Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "24px" }} className={styles.workspaceGrid}>
          {/* Main Content Area: Search + Files */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            
            {/* 1. Grounded Medical Search ("Ask about your history") */}
            <div style={{ background: "#ffffff", padding: "24px", borderRadius: "18px", border: "1px solid var(--color-border)", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
              <form onSubmit={handleSearchHistory}>
                <div style={{ position: "relative" }}>
                  <Search size={20} style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)" }} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder='Ask about your medical history (e.g. "Has my report shown low hemoglobin?")'
                    style={{
                      width: "100%",
                      padding: "14px 110px 14px 48px",
                      borderRadius: "12px",
                      border: "1px solid var(--color-border)",
                      fontSize: "14px",
                      outline: "none",
                      color: "#0f172a"
                    }}
                  />
                  <button
                    type="submit"
                    disabled={searchLoading || !searchQuery.trim()}
                    style={{
                      position: "absolute",
                      right: "8px",
                      top: "7px",
                      background: "#0f172a",
                      color: "#ffffff",
                      border: "none",
                      padding: "8px 18px",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontWeight: "600",
                      fontSize: "13px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    {searchLoading ? <Loader2 size={14} className="spin" /> : "Search"}
                  </button>
                </div>
              </form>

              {/* Grounded AI Search Result Card */}
              {searchResult && (
                <div style={{ marginTop: "20px", padding: "18px 20px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px", color: "#0d9488" }}>
                    <Sparkles size={18} />
                    <span style={{ fontWeight: "700", fontSize: "14px" }}>AI Summary Result</span>
                  </div>

                  <p style={{ fontSize: "14px", fontWeight: "600", color: "#1e293b", marginBottom: "8px" }}>
                    {searchResult.summary}
                  </p>

                  {searchResult.results?.length > 0 ? (
                    <ul style={{ paddingLeft: "20px", fontSize: "13px", color: "#334155", display: "flex", flexDirection: "column", gap: "6px", lineHeight: "1.5" }}>
                      {searchResult.results.map((res, i) => (
                        <li key={i}>{res}</li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ fontSize: "13px", color: "#64748b", fontStyle: "italic" }}>
                      No matching records found for this query.
                    </p>
                  )}

                  {/* Sources Grounding Trace */}
                  {searchResult.sources?.length > 0 && (
                    <div style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px dashed #cbd5e1", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                      <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "500" }}>
                        Source Record: <strong>{searchResult.sources[0].filename}</strong> ({new Date(searchResult.sources[0].date).toLocaleDateString()})
                      </span>
                      <button
                        onClick={() => handleOpenOriginal(searchResult.sources[0].documentId)}
                        style={{ background: "none", border: "none", color: "#0d9488", fontSize: "12px", fontWeight: "700", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                      >
                        View Original <ExternalLink size={12} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. Your Files (Real Patient Documents) */}
            <div style={{ background: "#ffffff", padding: "24px", borderRadius: "18px", border: "1px solid var(--color-border)", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
                <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--color-dark)", margin: 0 }}>
                  {t("documents.recentDocuments")}
                </h3>
                <span style={{ fontSize: "12px", color: "#64748b", background: "#f1f5f9", padding: "2px 10px", borderRadius: "12px", fontWeight: "600" }}>
                  {documents.length} Files
                </span>
              </div>

              {loading ? (
                <div style={{ padding: "30px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>
                  <Loader2 size={24} className="spin" style={{ margin: "0 auto 8px" }} />
                  Loading your medical documents...
                </div>
              ) : error ? (
                <div style={{ padding: "16px", background: "#fef2f2", color: "#991b1b", borderRadius: "10px", fontSize: "13px" }}>
                  {error}
                </div>
              ) : documents.length === 0 ? (
                // Clean Empty State — NO fake hardcoded demo data!
                <div style={{ padding: "36px 20px", textAlign: "center", background: "#f8fafc", borderRadius: "14px", border: "1px solid #e2e8f0" }}>
                  <FileText size={36} color="#cbd5e1" style={{ margin: "0 auto 10px" }} />
                  <h4 style={{ fontSize: "15px", fontWeight: "600", color: "#1e293b", margin: "0 0 4px" }}>
                    No medical records uploaded yet.
                  </h4>
                  <p style={{ fontSize: "12px", color: "#64748b", margin: 0 }}>
                    Click "Upload Medical File" to upload your prescriptions, lab reports, or discharge summaries.
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {documents.map((doc) => {
                    const docTypeLabel = doc.document_type ? doc.document_type.replace("_", " ").toUpperCase() : "RECORD";
                    const isCompleted = doc.ocr_status === "completed";

                    return (
                      <div
                        key={doc.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "16px",
                          border: "1px solid var(--color-border)",
                          borderRadius: "14px",
                          background: "#ffffff",
                          transition: "all 0.15s ease",
                          flexWrap: "wrap",
                          gap: "12px"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: "220px" }}>
                          <div style={{ background: "#ccfbf1", padding: "12px", borderRadius: "12px", color: "#0d9488" }}>
                            {doc.file_type?.includes("pdf") ? <FileText size={22} /> : <FileSignature size={22} />}
                          </div>
                          <div>
                            <p style={{ fontSize: "14px", fontWeight: "700", color: "var(--color-dark)", margin: 0 }}>
                              {doc.file_name}
                            </p>
                            <p style={{ fontSize: "12px", color: "var(--color-text-muted)", marginTop: "3px", margin: 0 }}>
                              {formatBytes(doc.file_size)} • Uploaded {new Date(doc.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <span
                            style={{
                              background: isCompleted ? "#dcfce7" : "#fef9c3",
                              color: isCompleted ? "#166534" : "#854d0e",
                              padding: "4px 12px",
                              borderRadius: "20px",
                              fontSize: "11px",
                              fontWeight: "700"
                            }}
                          >
                            {isCompleted ? "Processed (OCR)" : "Processing"}
                          </span>

                          <button
                            onClick={() => setSelectedDoc(doc)}
                            style={{
                              background: "#f1f5f9",
                              color: "#0f766e",
                              border: "none",
                              padding: "6px 14px",
                              borderRadius: "8px",
                              fontSize: "12px",
                              fontWeight: "600",
                              cursor: "pointer"
                            }}
                          >
                            {t("documents.viewDetails")}
                          </button>

                          <button
                            onClick={() => handleOpenOriginal(doc.id)}
                            title="View Original File"
                            style={{
                              background: "none",
                              border: "none",
                              color: "#64748b",
                              cursor: "pointer",
                              padding: "6px",
                              display: "grid",
                              placeItems: "center"
                            }}
                          >
                            <ExternalLink size={16} />
                          </button>

                          <button
                            onClick={() => {
                              if (window.confirm(`Delete record "${doc.file_name}"?`)) {
                                handleDeleteDoc(doc.id);
                              }
                            }}
                            title="Delete Record"
                            style={{
                              background: "none",
                              border: "none",
                              color: "#94a3b8",
                              cursor: "pointer",
                              padding: "6px",
                              display: "grid",
                              placeItems: "center"
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar: Pipeline Explanation & Recent Extractions */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            
            {/* How This Works Card */}
            <div style={{ background: "var(--color-dark)", color: "#ffffff", padding: "24px", borderRadius: "18px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <Sparkles size={26} color="var(--color-teal)" />
              <h4 style={{ fontSize: "17px", fontWeight: "700", color: "#ffffff", margin: 0 }}>
                How this works
              </h4>
              <p style={{ fontSize: "13px", lineHeight: "1.6", color: "#cbd5e1", margin: 0 }}>
                When you upload a medical report or prescription, MediKiosk uses high-accuracy OCR to extract text, structures clinical entities, and securely indexes records for your physician.
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>
                <ShieldCheck size={14} color="#2dd4bf" /> End-to-end encrypted & HIPAA compliant
              </div>
            </div>

            {/* Recent Extractions Card (Driven by Patient's Real Records) */}
            <div style={{ background: "#ffffff", padding: "24px", borderRadius: "18px", border: "1px solid var(--color-border)", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
              <h4 style={{ fontSize: "16px", fontWeight: "700", color: "var(--color-dark)", marginBottom: "16px", margin: 0 }}>
                Recent Extractions
              </h4>

              {recentExtractions.length === 0 ? (
                <p style={{ fontSize: "12px", color: "#64748b", fontStyle: "italic", margin: 0 }}>
                  Upload a document to view structured AI extractions.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {recentExtractions.map((doc) => {
                    const textSnippet = doc.ai_summary || (doc.extracted_text ? doc.extracted_text.substring(0, 100) + "..." : "Extracted medical record data.");
                    return (
                      <div
                        key={doc.id}
                        onClick={() => setSelectedDoc(doc)}
                        style={{ borderLeft: "3px solid #0d9488", paddingLeft: "12px", cursor: "pointer" }}
                      >
                        <p style={{ fontSize: "13px", color: "var(--color-dark)", fontWeight: "500", margin: "0 0 2px" }}>
                          "{textSnippet}"
                        </p>
                        <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
                          From {doc.file_name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </div>
      </motion.div>

      {/* Structured Medical Record Modal */}
      {selectedDoc && (
        <DocumentDetailModal
          doc={selectedDoc}
          onClose={() => setSelectedDoc(null)}
          onDelete={handleDeleteDoc}
        />
      )}
    </div>
  );
}
