import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Eye,
  FileImage,
  FileScan,
  FileText,
  FolderOpen,
  Loader2,
  MoreHorizontal,
  Search,
  Send,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../i18n";
import {
  askDocumentQuestion,
  deleteMedicalDocument,
  getPatientDocuments,
  uploadMedicalDocument,
} from "../../services/api";
import DocumentDetailModal from "../../components/DocumentDetailModal";
import medicalDocsHero from "../../assets/medical-documents-hero-v2.png";
import smarterDocsCard from "../../assets/smarter_docs_card.jpg";
import styles from "./Documents.module.css";

const MAX_FILE_SIZE = 15 * 1024 * 1024;

function classifyDocument(doc) {
  const name = `${doc.file_name || ""} ${doc.document_type || ""}`.toLowerCase();
  if (name.includes("blood") || name.includes("lab")) return { key: "lab", label: "Lab Report" };
  if (name.includes("prescription") || name.includes("medicine")) return { key: "prescription", label: "Prescription" };
  if (name.includes("x-ray") || name.includes("scan") || doc.file_type?.includes("image")) return { key: "imaging", label: "Imaging" };
  if (name.includes("discharge")) return { key: "discharge", label: "Discharge Summary" };
  return { key: "other", label: "Medical Record" };
}

function formatBytes(bytes) {
  const value = Number(bytes);
  if (!value) return "—";
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  if (!value) return { date: "—", time: "" };
  const date = new Date(value);
  return {
    date: date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
    time: date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
  };
}

export default function Documents() {
  const { user, token } = useAuth();
  const patientId = user?.id;
  const { currentLanguage, t } = useLanguage();
  const fileInputRef = useRef(null);
  const scanInputRef = useRef(null);
  const aiInputRef = useRef(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploadState, setUploadState] = useState("idle");
  const [uploadMessage, setUploadMessage] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("recent");
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [menuDocId, setMenuDocId] = useState(null);
  const [showAi, setShowAi] = useState(false);
  const [aiDocId, setAiDocId] = useState("");
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const fetchDocuments = useCallback(async (showLoader = true) => {
    if (!token || !patientId) return;
    if (showLoader) setLoading(true);
    setError("");
    try {
      const response = await getPatientDocuments(patientId, token);
      if (!response.success || !Array.isArray(response.documents)) {
        throw new Error(response.message || "Unable to load your medical documents.");
      }
      setDocuments(response.documents);
      setAiDocId((current) => current || response.documents.find((doc) => doc.ocr_status === "completed")?.id || response.documents[0]?.id || "");
    } catch (requestError) {
      setError(requestError.message || "Unable to load your medical documents.");
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [token, patientId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const visibleDocuments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return [...documents]
      .filter((doc) => {
        const type = classifyDocument(doc);
        const matchesType = typeFilter === "all" || type.key === typeFilter;
        const haystack = `${doc.file_name || ""} ${doc.description || ""} ${type.label}`.toLowerCase();
        return matchesType && (!normalizedQuery || haystack.includes(normalizedQuery));
      })
      .sort((a, b) => {
        const difference = new Date(b.created_at || 0) - new Date(a.created_at || 0);
        return sortOrder === "oldest" ? -difference : difference;
      });
  }, [documents, query, sortOrder, typeFilter]);

  const usedBytes = useMemo(
    () => documents.reduce((total, doc) => total + Number(doc.file_size || 0), 0),
    [documents],
  );
  const storagePercent = Math.min(100, Math.round((usedBytes / MAX_FILE_SIZE) * 100));

  const processUpload = async (file) => {
    if (!file) return;
    const allowedTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      setUploadState("error");
      setUploadMessage("Please choose a PDF, JPG, JPEG, or PNG file.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setUploadState("error");
      setUploadMessage("The selected file is larger than 15 MB.");
      return;
    }

    setUploadState("uploading");
    setUploadMessage("Uploading and securely processing your document…");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("patientId", patientId);
    formData.append("documentType", "other");

    try {
      const response = await uploadMedicalDocument(formData, token);
      if (!response.success) throw new Error(response.message || "Upload failed.");
      setUploadState("success");
      setUploadMessage("Document uploaded successfully.");
      await fetchDocuments(false);
      window.setTimeout(() => setUploadState("idle"), 3500);
    } catch (uploadError) {
      setUploadState("error");
      setUploadMessage(uploadError.message || "We could not upload this document.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (scanInputRef.current) scanInputRef.current.value = "";
    }
  };

  const handleDelete = async (documentOrId, skipConfirm = false) => {
    const doc = typeof documentOrId === "object"
      ? documentOrId
      : documents.find((item) => item.id === documentOrId);
    if (!doc) return;
    if (!skipConfirm && !window.confirm(`Delete “${doc.file_name}”? This cannot be undone.`)) return;
    try {
      await deleteMedicalDocument(doc.id, token);
      setDocuments((current) => current.filter((item) => item.id !== doc.id));
      setMenuDocId(null);
      if (selectedDoc?.id === doc.id) setSelectedDoc(null);
    } catch (deleteError) {
      setError(deleteError.message || "Unable to delete this document.");
    }
  };

  const handleAskAi = async (event) => {
    event.preventDefault();
    if (!aiDocId || !aiQuestion.trim()) return;
    setAiLoading(true);
    setAiAnswer("");
    try {
      const response = await askDocumentQuestion(aiDocId, aiQuestion.trim(), currentLanguage || "en", [], token);
      if (!response.success) throw new Error(response.message || "Unable to answer this question.");
      setAiAnswer(response.answer || response.what_it_means || "No answer was returned.");
    } catch (questionError) {
      setAiAnswer(questionError.message || "Unable to answer this question right now.");
    } finally {
      setAiLoading(false);
    }
  };

  const openAiPanel = () => {
    setShowAi(true);
    window.setTimeout(() => aiInputRef.current?.focus(), 180);
  };

  return (
    <motion.main className={`${styles.page} workspacePage`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>{t("navigation.documents", "Medical documents")}</span>
          <h1>{t("documents.vaultTitle", "Medical Documents & Intelligence")}</h1>
          <p>{t("documents.vaultSubtitle", "Upload, organize, and ask grounded questions about your prescriptions, lab reports, and medical records.")}</p>
        </div>
        <img src={medicalDocsHero} alt="Illustrated medical records surrounded by leaves" />
        <blockquote>“Organized today.<br />Healthier tomorrow.”</blockquote>
      </header>

      <div className={styles.workspaceGrid}>
        <section className={styles.mainColumn}>
          <div
            className={`${styles.uploadCard} ${isDragOver ? styles.dragOver : ""}`}
            onDragOver={(event) => { event.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(event) => { event.preventDefault(); setIsDragOver(false); processUpload(event.dataTransfer.files?.[0]); }}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => { if (event.key === "Enter") fileInputRef.current?.click(); }}
          >
            <UploadCloud className={styles.uploadIcon} size={34} strokeWidth={1.8} />
            <strong>{t("documents.uploadTitle", "Upload Medical File")}</strong>
            <span>{t("documents.dropText", "Drag and drop your file here, or")} <u>{t("documents.browseFiles", "click to browse")}</u></span>
            <small>PDF, JPG, JPEG, or PNG · Maximum file size 15 MB</small>
            <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => processUpload(event.target.files?.[0])} hidden />
            <AnimatePresence>
              {uploadState !== "idle" && (
                <motion.div className={`${styles.uploadStatus} ${styles[uploadState]}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  {uploadState === "uploading" && <Loader2 size={15} className={styles.spin} />}
                  {uploadState === "success" && <CheckCircle2 size={15} />}
                  {uploadState === "error" && <AlertCircle size={15} />}
                  {uploadMessage}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className={styles.filters}>
            <label className={styles.searchField}>
              <Search size={18} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("documents.searchPlaceholder", "Search documents by name, type, or description…")} />
            </label>
            <label className={styles.selectField}>
              <FileText size={17} />
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                <option value="all">{t("documents.filterAll", "All Types")}</option>
                <option value="lab">{t("documents.filterLab", "Lab Reports")}</option>
                <option value="prescription">{t("documents.filterPrescription", "Prescriptions")}</option>
                <option value="imaging">{t("documents.filterScan", "Imaging")}</option>
                <option value="discharge">{t("documents.filterDischarge", "Discharge")}</option>
                <option value="other">{t("documents.filterOther", "Other Records")}</option>
              </select>
              <ChevronDown size={15} />
            </label>
            <label className={styles.selectField}>
              <FolderOpen size={17} />
              <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}>
                <option value="recent">{t("appointments.statusCompleted", "Last Updated")}</option>
                <option value="oldest">{t("appointments.rangeAll", "Oldest First")}</option>
              </select>
              <ChevronDown size={15} />
            </label>
          </div>

          <section className={styles.recordsCard}>
            <div className={styles.recordsHeader}>
              <div>
                <h2>{t("documents.recentDocuments", "Your Document Records")}</h2>
                <p>{visibleDocuments.length} {visibleDocuments.length === 1 ? "document" : "documents"}</p>
              </div>
            </div>

            {loading ? (
              <div className={styles.emptyState}><Loader2 className={styles.spin} /><strong>{t("common.loading", "Loading your records…")}</strong></div>
            ) : error ? (
              <div className={`${styles.emptyState} ${styles.errorState}`}><AlertCircle /><strong>{error}</strong><button onClick={() => fetchDocuments()}>{t("common.retry", "Try again")}</button></div>
            ) : visibleDocuments.length === 0 ? (
              <div className={styles.emptyState}><div className={styles.emptyIcon}><FileText /></div><strong>{documents.length ? t("documents.noDocsFound", "No matching documents") : t("documents.noDocsYet", "No documents uploaded yet")}</strong><span>{documents.length ? "Try adjusting your search or filters." : "Upload your first record to keep your health files in one secure place."}</span></div>
            ) : (
              <div className={styles.tableWrap}>
                <table>
                  <thead>
                    <tr>
                      <th>{t("common.name", "Name")}</th>
                      <th>{t("doctors.consultationType", "Type")}</th>
                      <th>{t("appointments.date", "Uploaded on")}</th>
                      <th>Size</th>
                      <th>{t("common.actions", "Actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleDocuments.map((doc) => {
                      const type = classifyDocument(doc);
                      const date = formatDate(doc.created_at);
                      const isImage = doc.file_type?.includes("image");
                      return (
                        <tr key={doc.id}>
                          <td><div className={styles.documentName}><span className={`${styles.fileIcon} ${styles[type.key]}`}>{isImage ? <FileImage /> : <FileText />}</span><span><strong>{doc.file_name || "Untitled document"}</strong><small>{doc.ocr_status === "completed" ? t("documents.ocrCompleted", "Ready for AI questions") : t("documents.processingOcr", "Processing document")}</small></span></div></td>
                          <td><span className={`${styles.typeBadge} ${styles[type.key]}`}>{type.label}</span></td>
                          <td><span className={styles.dateCell}>{date.date}<small>{date.time}</small></span></td>
                          <td className={styles.sizeCell}>{formatBytes(doc.file_size)}</td>
                          <td>
                            <div className={styles.rowActions}>
                              <button className={styles.viewButton} onClick={() => setSelectedDoc(doc)}><Eye size={15} /> {t("common.view", "View")}</button>
                              <div className={styles.menuWrap}>
                                <button className={styles.iconButton} aria-label={`More actions for ${doc.file_name}`} onClick={() => setMenuDocId((current) => current === doc.id ? null : doc.id)}><MoreHorizontal size={18} /></button>
                                <AnimatePresence>
                                  {menuDocId === doc.id && (
                                    <motion.div className={styles.rowMenu} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                                      <button onClick={() => { setSelectedDoc(doc); setMenuDocId(null); }}><Eye size={14} /> {t("documents.viewDetails", "Open details")}</button>
                                      <button className={styles.deleteAction} onClick={() => handleDelete(doc)}><Trash2 size={14} /> {t("common.delete", "Delete")}</button>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </section>

        <aside className={styles.sideColumn}>
          <section className={styles.sideCard}>
            <h2>{t("dashboard.quickActions", "Quick Actions")}</h2>
            <button onClick={() => fileInputRef.current?.click()}><span><UploadCloud /></span>{t("history.uploadRecord", "Upload Document")}<ChevronRight /></button>
            <button onClick={() => scanInputRef.current?.click()}><span><FileScan /></span>{t("documents.filterScan", "Scan Document")}<ChevronRight /></button>
            <button onClick={openAiPanel}><span><Sparkles /></span>{t("documents.askAi", "Ask AI about Document")}<ChevronRight /></button>
            <button onClick={() => setSortOrder("recent")}><span><FolderOpen /></span>{t("documents.filterAll", "Organize Files")}<ChevronRight /></button>
            <input ref={scanInputRef} type="file" accept="image/*" capture="environment" onChange={(event) => processUpload(event.target.files?.[0])} hidden />
          </section>

          <AnimatePresence>
            {showAi && (
              <motion.section className={`${styles.sideCard} ${styles.aiCard}`} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                <div className={styles.aiHeader}><div><Sparkles size={18} /><h2>{t("documents.askAiDrawerTitle", "Ask your document")}</h2></div><button aria-label="Close AI panel" onClick={() => setShowAi(false)}><X size={16} /></button></div>
                {documents.length ? (
                  <form onSubmit={handleAskAi}>
                    <select value={aiDocId} onChange={(event) => { setAiDocId(event.target.value); setAiAnswer(""); }}>
                      {documents.map((doc) => <option key={doc.id} value={doc.id}>{doc.file_name}</option>)}
                    </select>
                    <div className={styles.aiQuestion}><input ref={aiInputRef} value={aiQuestion} onChange={(event) => setAiQuestion(event.target.value)} placeholder={t("documents.askPlaceholder", "What does this report mean?")} /><button disabled={aiLoading || !aiQuestion.trim()}>{aiLoading ? <Loader2 className={styles.spin} /> : <Send />}</button></div>
                    {aiAnswer && <p className={styles.aiAnswer}>{aiAnswer}</p>}
                  </form>
                ) : <p className={styles.aiHint}>{t("documents.noRecordSelected", "Upload a processed document before asking a question.")}</p>}
              </motion.section>
            )}
          </AnimatePresence>

          <section className={styles.sideCard}>
            <h2>Storage Usage</h2>
            <div className={styles.storageLayout}>
              <div className={styles.storageRing} style={{ "--used": `${storagePercent * 3.6}deg` }}><span>{storagePercent}%</span></div>
              <div className={styles.storageDetails}><strong>{formatBytes(usedBytes) === "—" ? "0 MB" : formatBytes(usedBytes)} used of 15 MB</strong><div><span style={{ width: `${storagePercent}%` }} /></div><button onClick={() => setSortOrder("recent")}>Manage Storage <ChevronRight size={14} /></button></div>
            </div>
          </section>

          <section className={styles.decorativeCard}>
            <img src={smarterDocsCard} alt="Botanical medical records illustration" />
            <p>Smarter<br />Documents.<br />Better Care.</p>
          </section>
        </aside>
      </div>

      {selectedDoc && <DocumentDetailModal doc={selectedDoc} onClose={() => setSelectedDoc(null)} onDelete={handleDelete} />}
    </motion.main>
  );
}
