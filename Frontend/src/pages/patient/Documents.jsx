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
  MessageSquare,
  HelpCircle,
  Send,
  Volume2,
  RefreshCw,
  X,
  FileCode,
  Info,
  ChevronRight
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../i18n";
import {
  getPatientDocuments,
  uploadMedicalDocument,
  deleteMedicalDocument,
  getDocumentDownloadUrl,
  askDocumentQuestion,
  synthesizeSpeech
} from "../../services/api";
import DocumentDetailModal from "../../components/DocumentDetailModal";
import styles from "./Documents.module.css";

export default function Documents() {
  const { user, token } = useAuth();
  const { t, currentLanguage } = useLanguage();
  const fileInputRef = useRef(null);
  const qaSectionRef = useRef(null);

  // Document List State
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Upload State
  const [uploadState, setUploadState] = useState("idle"); // idle | uploading | processing | success | error
  const [uploadStageText, setUploadStageText] = useState("");
  const [uploadErrorMsg, setUploadErrorMsg] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);

  // Modal State
  const [selectedDoc, setSelectedDoc] = useState(null);

  // Grounded Document Q&A State
  const [selectedDocForQA, setSelectedDocForQA] = useState(null);
  const [qaQuestion, setQaQuestion] = useState("");
  const [qaLoading, setQaLoading] = useState(false);
  const [qaHistory, setQaHistory] = useState([]); // [{ question, answer, what_report_says, what_it_means, questions_for_doctor, disclaimer }]
  const [qaError, setQaError] = useState(null);

  // Audio TTS State for Answer Reading
  const [playingAudioIdx, setPlayingAudioIdx] = useState(null);
  const [audioLoadingIdx, setAudioLoadingIdx] = useState(null);
  const audioRef = useRef(null);

  // Load Patient Documents from Authenticated Backend
  const fetchDocuments = async () => {
    if (!token || !user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getPatientDocuments(user.id, token);
      if (res.success && Array.isArray(res.documents)) {
        setDocuments(res.documents);
        // Default select latest processed document if none selected
        if (!selectedDocForQA && res.documents.length > 0) {
          const completedDoc = res.documents.find(d => d.ocr_status === "completed") || res.documents[0];
          setSelectedDocForQA(completedDoc);
        }
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

  // Handle Document Switching
  const handleSelectDocumentForQA = (doc) => {
    if (selectedDocForQA?.id === doc.id) return;
    setSelectedDocForQA(doc);
    setQaHistory([]); // Clear previous document conversation context
    setQaError(null);
    setQaQuestion("");
  };

  // Handle Document File Upload
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
      setTimeout(() => {
        setUploadState("processing");
        setUploadStageText("Running OCR & structuring medical report...");
      }, 900);

      const res = await uploadMedicalDocument(formData, token);

      if (res.success && res.document) {
        setUploadState("success");
        setUploadStageText(t("dashboard.uploadSuccess") || "Record uploaded and processed successfully!");
        
        await fetchDocuments();
        
        // Automatically select the newly uploaded document for Q&A
        setSelectedDocForQA(res.document);
        setQaHistory([]);
        setQaError(null);
        
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
      if (selectedDoc?.id === documentId) setSelectedDoc(null);
      if (selectedDocForQA?.id === documentId) {
        const remaining = documents.filter((d) => d.id !== documentId);
        setSelectedDocForQA(remaining.length > 0 ? remaining[0] : null);
        setQaHistory([]);
      }
    } catch (err) {
      console.error("Delete document error:", err);
    }
  };

  // Handle Opening Original Document Download URL
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

  // Submit Grounded Question about Selected Record
  const handleAskQuestion = async (queryText) => {
    const textToAsk = (queryText || qaQuestion).trim();
    if (!textToAsk || !selectedDocForQA) return;

    setQaLoading(true);
    setQaError(null);

    // Build conversation history for current document
    const previousHistory = qaHistory.map(h => ({
      question: h.question,
      answer: h.answer
    }));

    try {
      const res = await askDocumentQuestion(
        selectedDocForQA.id,
        textToAsk,
        currentLanguage || "en",
        previousHistory,
        token
      );

      if (res.success) {
        const newTurn = {
          question: textToAsk,
          answer: res.answer,
          what_report_says: res.what_report_says || [],
          what_it_means: res.what_it_means || "",
          questions_for_doctor: res.questions_for_doctor || [],
          sources: res.sources || [],
          disclaimer: res.disclaimer || "Educational purpose only."
        };
        setQaHistory((prev) => [...prev, newTurn]);
        setQaQuestion("");
      } else {
        throw new Error(res.message || "Failed to get an explanation.");
      }
    } catch (err) {
      console.error("Document QA error:", err);
      setQaError(err.message || "Unable to answer your question right now. Please try again.");
    } finally {
      setQaLoading(false);
    }
  };

  // TTS Speech Synthesis for AI Answers
  const handleSpeakAnswer = async (text, idx) => {
    if (playingAudioIdx === idx && audioRef.current) {
      audioRef.current.pause();
      setPlayingAudioIdx(null);
      return;
    }

    setAudioLoadingIdx(idx);
    try {
      const langCodeMap = {
        en: "en-IN", hi: "hi-IN", mr: "mr-IN", gu: "gu-IN",
        bn: "bn-IN", ta: "ta-IN", te: "te-IN", kn: "kn-IN",
        ml: "ml-IN", pa: "pa-IN", or: "od-IN", as: "as-IN"
      };
      const langCode = langCodeMap[currentLanguage] || "en-IN";

      const res = await synthesizeSpeech(text, langCode, "shubh", 1.0);
      if (res.audio_b64) {
        const audioUrl = `data:audio/wav;base64,${res.audio_b64}`;
        if (audioRef.current) {
          audioRef.current.pause();
        }
        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        audio.onended = () => setPlayingAudioIdx(null);
        audio.onerror = () => setPlayingAudioIdx(null);

        await audio.play();
        setPlayingAudioIdx(idx);
      }
    } catch (err) {
      console.error("TTS audio play error:", err);
    } finally {
      setAudioLoadingIdx(null);
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
            <h1
              data-speak="Medical Documents and Intelligence"
              style={{ fontSize: "28px", fontFamily: "var(--font-sans)", fontWeight: "700", color: "var(--color-dark)" }}
            >
              {t("documents.title")}
            </h1>
            <p style={{ color: "var(--color-text-muted)", marginTop: "6px", fontSize: "14px" }}>
              {t("documents.subtitle")}
            </p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadState === "uploading" || uploadState === "processing"}
            data-speak="Upload medical file"
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

        {/* 1. DOCUMENT-AWARE Q&A CORE INTERFACE */}
        <div
          ref={qaSectionRef}
          style={{
            background: "#ffffff",
            borderRadius: "20px",
            border: "1px solid var(--color-border)",
            padding: "26px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
            display: "flex",
            flexDirection: "column",
            gap: "20px"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ background: "#ccfbf1", padding: "10px", borderRadius: "12px", color: "#0d9488" }}>
                <Sparkles size={22} />
              </div>
              <div>
                <h3
                  data-speak="Ask About Your Medical Records"
                  style={{ fontSize: "18px", fontWeight: "700", color: "var(--color-dark)", margin: 0 }}
                >
                  {t("documents.askAboutRecord")}
                </h3>
                <p style={{ fontSize: "13px", color: "var(--color-text-muted)", marginTop: "2px", margin: 0 }}>
                  {t("documents.askSubtitle")}
                </p>
              </div>
            </div>

            {/* Document Selector Dropdown */}
            {documents.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "12px", fontWeight: "600", color: "#64748b" }}>
                  Active Record:
                </span>
                <select
                  value={selectedDocForQA?.id || ""}
                  onChange={(e) => {
                    const doc = documents.find((d) => d.id === e.target.value);
                    if (doc) handleSelectDocumentForQA(doc);
                  }}
                  data-speak="Select a medical record"
                  style={{
                    padding: "8px 14px",
                    borderRadius: "10px",
                    border: "1px solid var(--color-border)",
                    fontSize: "13px",
                    fontWeight: "600",
                    background: "#f8fafc",
                    color: "var(--color-dark)",
                    outline: "none",
                    cursor: "pointer"
                  }}
                >
                  <option value="" disabled>{t("documents.selectRecordPlaceholder")}</option>
                  {documents.map((d) => (
                    <option key={d.id} value={d.id}>
                      📄 {d.file_name} ({d.ocr_status === "completed" ? "OCR Ready" : "Processing"})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Active Record Selection Banner */}
          {selectedDocForQA ? (
            <div
              style={{
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: "14px",
                padding: "14px 18px",
                display: "flex",
                justify: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <CheckCircle2 size={18} color="#166534" />
                <div>
                  <span style={{ fontSize: "14px", fontWeight: "700", color: "#166534" }}>
                    {selectedDocForQA.file_name}
                  </span>
                  <span style={{ fontSize: "12px", color: "#15803d", marginLeft: "10px" }}>
                    Uploaded {new Date(selectedDocForQA.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span
                  style={{
                    background: selectedDocForQA.ocr_status === "completed" ? "#dcfce7" : "#fef9c3",
                    color: selectedDocForQA.ocr_status === "completed" ? "#15803d" : "#854d0e",
                    padding: "2px 10px",
                    borderRadius: "12px",
                    fontSize: "11px",
                    fontWeight: "700"
                  }}
                >
                  {selectedDocForQA.ocr_status === "completed" ? "OCR Ready" : "OCR Processing"}
                </span>

                <button
                  onClick={() => handleOpenOriginal(selectedDocForQA.id)}
                  data-speak="View original document"
                  style={{
                    background: "none",
                    border: "none",
                    color: "#0d9488",
                    fontSize: "12px",
                    fontWeight: "600",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                >
                  View Original <ExternalLink size={12} />
                </button>
              </div>
            </div>
          ) : (
            <div style={{ padding: "20px", background: "#f8fafc", borderRadius: "14px", border: "1px dashed #cbd5e1", textAlign: "center" }}>
              <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
                {t("documents.noRecordSelected")}
              </p>
            </div>
          )}

          {/* Suggested Questions Pills */}
          {selectedDocForQA && (
            <div>
              <span style={{ fontSize: "12px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                {t("documents.suggestedQuestions")}
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "8px" }}>
                {[
                  t("documents.suggestedQ1"),
                  t("documents.suggestedQ2"),
                  t("documents.suggestedQ3"),
                  t("documents.suggestedQ4"),
                ].map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setQaQuestion(q);
                      handleAskQuestion(q);
                    }}
                    disabled={qaLoading}
                    data-speak={q}
                    style={{
                      background: "#f1f5f9",
                      color: "var(--color-dark)",
                      border: "1px solid #e2e8f0",
                      padding: "6px 14px",
                      borderRadius: "20px",
                      fontSize: "12px",
                      fontWeight: "500",
                      cursor: "pointer",
                      transition: "all 0.15s ease"
                    }}
                  >
                    💡 {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Box for Question */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAskQuestion();
            }}
            style={{ position: "relative" }}
          >
            <input
              type="text"
              value={qaQuestion}
              onChange={(e) => setQaQuestion(e.target.value)}
              disabled={!selectedDocForQA || qaLoading}
              placeholder={selectedDocForQA ? t("documents.askQuestionPlaceholder") : t("documents.noRecordSelected")}
              data-speak="Ask anything about this report"
              style={{
                width: "100%",
                padding: "14px 120px 14px 44px",
                borderRadius: "14px",
                border: "1px solid var(--color-border)",
                fontSize: "14px",
                outline: "none",
                color: "var(--color-dark)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
                background: selectedDocForQA ? "#ffffff" : "#f8fafc"
              }}
            />
            <MessageSquare size={18} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />

            <button
              type="submit"
              disabled={!selectedDocForQA || !qaQuestion.trim() || qaLoading}
              data-speak="Ask AI"
              style={{
                position: "absolute",
                right: "8px",
                top: "7px",
                background: !selectedDocForQA || !qaQuestion.trim() || qaLoading ? "#94a3b8" : "#0f172a",
                color: "#ffffff",
                border: "none",
                padding: "9px 20px",
                borderRadius: "10px",
                cursor: !selectedDocForQA || !qaQuestion.trim() || qaLoading ? "not-allowed" : "pointer",
                fontWeight: "600",
                fontSize: "13px",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              {qaLoading ? <Loader2 size={14} className="spin" /> : <><Send size={13} /> {t("documents.askButton")}</>}
            </button>
          </form>

          {/* Error Banner */}
          {qaError && (
            <div style={{ padding: "12px 16px", background: "#fef2f2", color: "#991b1b", borderRadius: "10px", fontSize: "13px", border: "1px solid #fecaca" }}>
              ⚠️ {qaError}
            </div>
          )}

          {/* Grounded QA History stream */}
          {qaHistory.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginTop: "10px" }}>
              {qaHistory.map((turn, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "16px",
                    padding: "20px"
                  }}
                >
                  {/* Patient Question Header */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", color: "var(--color-dark)" }}>
                    <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "#0f172a", color: "#ffffff", display: "grid", placeItems: "center", fontSize: "11px", fontWeight: "700" }}>
                      Q
                    </div>
                    <span style={{ fontWeight: "700", fontSize: "15px" }}>{turn.question}</span>
                  </div>

                  {/* Grounded Answer Body */}
                  <div style={{ background: "#ffffff", padding: "18px", borderRadius: "12px", border: "1px solid #cbd5e1" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <span style={{ fontSize: "12px", fontWeight: "700", color: "#0d9488", textTransform: "uppercase", letterSpacing: "0.5px", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <Sparkles size={15} /> AI Grounded Explanation
                      </span>

                      <button
                        onClick={() => handleSpeakAnswer(turn.answer, idx)}
                        data-speak="Read answer aloud"
                        style={{
                          background: playingAudioIdx === idx ? "#0d9488" : "#f1f5f9",
                          color: playingAudioIdx === idx ? "#ffffff" : "#475569",
                          border: "none",
                          padding: "5px 10px",
                          borderRadius: "8px",
                          fontSize: "12px",
                          fontWeight: "600",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px"
                        }}
                      >
                        {audioLoadingIdx === idx ? (
                          <Loader2 size={13} className="spin" />
                        ) : (
                          <Volume2 size={13} />
                        )}
                        {playingAudioIdx === idx ? "Pause" : "Listen"}
                      </button>
                    </div>

                    <p style={{ fontSize: "14px", color: "#1e293b", lineHeight: "1.6", fontWeight: "500", margin: "0 0 14px" }}>
                      {turn.answer}
                    </p>

                    {/* What the Report Says */}
                    {turn.what_report_says && turn.what_report_says.length > 0 && (
                      <div style={{ marginTop: "12px" }}>
                        <span style={{ fontSize: "12px", fontWeight: "700", color: "#0f766e" }}>
                          📋 {t("documents.whatReportSays")}:
                        </span>
                        <ul style={{ margin: "6px 0 0", paddingLeft: "20px", fontSize: "13px", color: "#334155", display: "flex", flexDirection: "column", gap: "4px" }}>
                          {turn.what_report_says.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* What this generally means */}
                    {turn.what_it_means && (
                      <div style={{ marginTop: "12px", background: "#f0f9ff", border: "1px solid #bae6fd", padding: "10px 14px", borderRadius: "8px" }}>
                        <span style={{ fontSize: "12px", fontWeight: "700", color: "#0369a1" }}>
                          💡 {t("documents.whatItMeans")}:
                        </span>
                        <p style={{ fontSize: "13px", color: "#0284c7", margin: "4px 0 0" }}>
                          {turn.what_it_means}
                        </p>
                      </div>
                    )}

                    {/* Things to ask your doctor */}
                    {turn.questions_for_doctor && turn.questions_for_doctor.length > 0 && (
                      <div style={{ marginTop: "12px" }}>
                        <span style={{ fontSize: "12px", fontWeight: "700", color: "#7e22ce" }}>
                          🩺 {t("documents.questionsForDoctor")}:
                        </span>
                        <ul style={{ margin: "6px 0 0", paddingLeft: "20px", fontSize: "13px", color: "#6b21a8", display: "flex", flexDirection: "column", gap: "4px" }}>
                          {turn.questions_for_doctor.map((q, i) => (
                            <li key={i}>{q}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Grounding Source & Disclaimer */}
                    <div style={{ marginTop: "14px", paddingTop: "10px", borderTop: "1px dashed #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                      <span style={{ fontSize: "11px", color: "#64748b", fontWeight: "600" }}>
                        Source: <strong>{selectedDocForQA.file_name}</strong>
                      </span>
                      <span style={{ fontSize: "11px", color: "#94a3b8", fontStyle: "italic" }}>
                        {turn.disclaimer}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Workspace Grid for Document List & Pipeline Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "24px" }} className={styles.workspaceGrid}>
          {/* Main Files Section */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            
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
                    const isSelected = selectedDocForQA?.id === doc.id;
                    const isCompleted = doc.ocr_status === "completed";

                    return (
                      <div
                        key={doc.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "16px",
                          border: isSelected ? "2px solid #0d9488" : "1px solid var(--color-border)",
                          borderRadius: "14px",
                          background: isSelected ? "#f0fdf4" : "#ffffff",
                          transition: "all 0.15s ease",
                          flexWrap: "wrap",
                          gap: "12px"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: "220px" }}>
                          <div style={{ background: isSelected ? "#0d9488" : "#ccfbf1", padding: "12px", borderRadius: "12px", color: isSelected ? "#ffffff" : "#0d9488" }}>
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
                          {/* "Ask About This Record" CTA */}
                          <button
                            onClick={() => {
                              handleSelectDocumentForQA(doc);
                              qaSectionRef.current?.scrollIntoView({ behavior: "smooth" });
                            }}
                            data-speak={`Ask questions about ${doc.file_name}`}
                            style={{
                              background: isSelected ? "#0d9488" : "#f1f5f9",
                              color: isSelected ? "#ffffff" : "#0f766e",
                              border: "none",
                              padding: "6px 14px",
                              borderRadius: "8px",
                              fontSize: "12px",
                              fontWeight: "700",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px"
                            }}
                          >
                            <Sparkles size={13} /> {t("documents.askAboutThis")}
                          </button>

                          <button
                            onClick={() => setSelectedDoc(doc)}
                            data-speak="View document details"
                            style={{
                              background: "#f1f5f9",
                              color: "#475569",
                              border: "none",
                              padding: "6px 12px",
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
                            data-speak="View original file"
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
                            data-speak="Delete record"
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
                Grounded Document Intelligence
              </h4>
              <p style={{ fontSize: "13px", lineHeight: "1.6", color: "#cbd5e1", margin: 0 }}>
                When you ask a question about your report, MediKiosk uses vector retrieval (RAG) and Groq LLMs to give simple, grounded explanations using ONLY your selected document.
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>
                <ShieldCheck size={14} color="#2dd4bf" /> Server-side security & privacy protected
              </div>
            </div>

            {/* Recent Extractions Card */}
            <div style={{ background: "#ffffff", padding: "24px", borderRadius: "18px", border: "1px solid var(--color-border)", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
              <h4 style={{ fontSize: "16px", fontWeight: "700", color: "var(--color-dark)", marginBottom: "16px", margin: 0 }}>
                Recent Report Summaries
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
