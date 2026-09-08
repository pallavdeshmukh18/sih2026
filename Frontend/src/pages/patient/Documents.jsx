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
import medicalDocsHero from "../../assets/medical_docs_hero.jpg";
import smarterDocsCard from "../../assets/smarter_docs_card.jpg";

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

      const res = await synthesizeSpeech(text, langCode, "simran", 1.0);
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
    <div className={`${styles.page} workspacePage`} style={{ paddingBottom: "16px" }}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        style={{ display: "flex", flexDirection: "column", gap: "24px" }}
      >
        {/* Banner */}
        <div className={styles.banner}>
          <div className={styles.bannerContent}>
            <span>Medical Documents</span>
            <h1>Medical Documents & Intelligence</h1>
            <p>Upload, view, and ask grounded questions about your prescriptions, lab reports, and medical records.</p>
          </div>
          <img src={medicalDocsHero} alt="Medical Documents Hero" className={styles.bannerImage} />
          <div className={styles.bannerQuote}>
            "Organized<br />Today.<br />Healthier<br />Tomorrow."
          </div>
        </div>

        {/* Upload Zone */}
        <div
          className={`${styles.uploadZone} ${isDragOver ? styles.dragOver : ""}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={32} className={styles.uploadIcon} />
          <h3>Upload Medical File</h3>
          <p>Drag and drop your file here, or <b>click to browse</b></p>
          <small>Supported formats: PDF, JPG, JPEG, PNG • Maximum size: 15MB</small>

          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".pdf,.jpg,.jpeg,.png"
            style={{ display: "none" }}
          />

          {uploadState !== "idle" && (
            <div style={{ marginTop: "16px", color: uploadState === "error" ? "#ef4444" : "#0d9488", fontSize: "14px", fontWeight: "600", display: "flex", alignItems: "center", justify: "center", gap: "8px" }}>
              {uploadState === "error" ? <AlertCircle size={16} /> : uploadState === "success" ? <CheckCircle2 size={16} /> : <Loader2 size={16} className="spin" />}
              {uploadState === "error" ? uploadErrorMsg : uploadStageText}
            </div>
          )}
        </div>

        <div className={styles.workspaceGrid}>
          {/* Main Content Area */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

            {/* Search and Filters */}
            <div className={styles.searchBar}>
              <div className={styles.searchWrapper}>
                <Search size={18} className={styles.searchIcon} />
                <input type="text" placeholder="Search documents by name, type, or description..." className={styles.searchInput} />
              </div>
              <select className={styles.filterSelect}>
                <option value="all">All Types</option>
                <option value="lab">Lab Reports</option>
                <option value="prescription">Prescriptions</option>
              </select>
              <select className={styles.filterSelect}>
                <option value="recent">Last Updated</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>

            {/* Document Records Table */}
            <div className={styles.sectionBlock}>
              <div className={styles.sectionHeader}>
                <h3>Your Document Records</h3>
                <p>{documents.length} documents • Sorted by most recent</p>
              </div>

              {loading ? (
                <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
                  <Loader2 size={24} className="spin" style={{ margin: "0 auto 12px" }} />
                  Loading your medical records...
                </div>
              ) : error ? (
                <div style={{ padding: "24px", color: "#ef4444", textAlign: "center" }}>{error}</div>
              ) : documents.length === 0 ? (
                <div style={{ padding: "60px 24px", textAlign: "center", color: "#64748b" }}>
                  <FileText size={48} color="#cbd5e1" style={{ margin: "0 auto 16px" }} />
                  <h4 style={{ fontSize: "16px", color: "#0f172a", marginBottom: "8px" }}>No documents found</h4>
                  <p>Upload a document to see it listed here.</p>
                </div>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Type</th>
                      <th>Uploaded On</th>
                      <th>Size</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc) => {
                      const isPdf = doc.file_type?.includes("pdf");
                      let typeBadge = { class: "other", label: "Other", iconClass: "default" };

                      // Very basic mock typing for UI demo purposes based on file name or type
                      if (doc.file_name.toLowerCase().includes("blood") || doc.file_name.toLowerCase().includes("lab")) {
                        typeBadge = { class: "lab", label: "Lab Report", iconClass: "pdf" };
                      } else if (doc.file_name.toLowerCase().includes("prescription") || doc.file_name.toLowerCase().includes("dr")) {
                        typeBadge = { class: "prescription", label: "Prescription", iconClass: "pdf" };
                      } else if (doc.file_name.toLowerCase().includes("x-ray") || doc.file_type?.includes("image")) {
                        typeBadge = { class: "imaging", label: "Imaging", iconClass: "image" };
                      } else if (doc.file_name.toLowerCase().includes("discharge")) {
                        typeBadge = { class: "discharge", label: "Discharge Summary", iconClass: "doc" };
                      }

                      return (
                        <tr key={doc.id}>
                          <td>
                            <div className={styles.docNameCell}>
                              <div className={`${styles.docIcon} ${styles[typeBadge.iconClass]}`}>
                                {isPdf ? <FileText size={20} /> : <FileSignature size={20} />}
                              </div>
                              <div>
                                <b>{doc.file_name}</b>
                                <span>{doc.ocr_status === "completed" ? "Processed" : "Processing"}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={`${styles.badge} ${styles[typeBadge.class]}`}>
                              {typeBadge.label}
                            </span>
                          </td>
                          <td>
                            <div className={styles.dateCell}>
                              {new Date(doc.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              <span>{new Date(doc.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
                            </div>
                          </td>
                          <td>{formatBytes(doc.file_size)}</td>
                          <td>
                            <div className={styles.actionsCell}>
                              <button className={styles.viewBtn} onClick={() => setSelectedDoc(doc)}>
                                <ExternalLink size={14} /> View
                              </button>
                              <button className={styles.moreBtn} onClick={() => {
                                if (window.confirm(`Delete record "${doc.file_name}"?`)) {
                                  handleDeleteDoc(doc.id);
                                }
                              }}>
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Right Sidebar */}
          <div>
            <div className={styles.sideCard}>
              <h3>Quick Actions</h3>
              <div className={styles.actionList}>
                <div className={styles.actionItem} onClick={() => fileInputRef.current?.click()}>
                  <div className={styles.actionItemLeft}>
                    <Upload size={18} /> Upload Document
                  </div>
                  <ChevronRight size={16} color="#94a3b8" />
                </div>
                <div className={styles.actionItem}>
                  <div className={styles.actionItemLeft}>
                    <FileSignature size={18} /> Scan Document
                  </div>
                  <ChevronRight size={16} color="#94a3b8" />
                </div>
                <div className={styles.actionItem}>
                  <div className={styles.actionItemLeft}>
                    <Sparkles size={18} /> Ask AI about Document
                  </div>
                  <ChevronRight size={16} color="#94a3b8" />
                </div>
                <div className={styles.actionItem}>
                  <div className={styles.actionItemLeft}>
                    <FileText size={18} /> Organize Files
                  </div>
                  <ChevronRight size={16} color="#94a3b8" />
                </div>
              </div>
            </div>

            <div className={styles.sideCard}>
              <h3>Storage Usage</h3>
              <div className={styles.storageUsage}>
                <div className={styles.storageRing}>
                  <span>23%</span>
                </div>
                <div className={styles.storageText}>
                  <b>3.4 MB used of 15 MB</b>
                  <div className={styles.storageBar}>
                    <div className={styles.storageBarFill}></div>
                  </div>
                  <a href="#" className={styles.storageLink} onClick={(e) => e.preventDefault()}>Manage Storage <ChevronRight size={14} /></a>
                </div>
              </div>
            </div>

            <div className={styles.decorativeCard}>
              <img src={smarterDocsCard} alt="Smarter Documents Better Care" />
              <div style={{ position: "absolute", left: "24px", bottom: "24px", zIndex: 2, fontFamily: "var(--font-serif)", fontSize: "20px", fontStyle: "italic", color: "#064e3b", maxWidth: "150px", lineHeight: 1.2 }}>
                Smarter<br />Documents.<br />Better Care.
              </div>
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

