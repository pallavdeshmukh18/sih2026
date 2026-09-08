import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  ShieldAlert,
  Syringe,
  FileText,
  FlaskConical,
  UserCheck,
  Sparkles,
  Clock,
  ExternalLink,
  AlertCircle,
  Loader2,
  RefreshCw,
  Calendar,
  Stethoscope
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../i18n";
import { getPatientMedicalHistory, getDocumentDownloadUrl } from "../../services/api";
import DocumentDetailModal from "../../components/DocumentDetailModal";

export default function MedicalHistory() {
  const { token } = useAuth();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);

  const fetchHistory = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getPatientMedicalHistory(token);
      if (res.success && res.history) {
        setHistory(res.history);
      } else {
        throw new Error(res.message || "Failed to load medical history.");
      }
    } catch (err) {
      console.error("Error loading medical history:", err);
      setError(err.message || t("history.error"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [token]);

  const handleOpenDocument = async (docId) => {
    try {
      const res = await getDocumentDownloadUrl(docId, token);
      if (res.url) {
        window.open(res.url, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      console.error("Could not fetch document URL:", err);
    }
  };

  if (loading) {
    return (
      <div className="workspacePage" style={{ padding: "40px 24px", textAlign: "center" }}>
        <Loader2 size={36} color="#0d9488" className="animate-spin" style={{ margin: "0 auto 16px" }} />
        <h3 style={{ fontSize: "16px", color: "var(--color-dark)", fontWeight: "600" }}>
          {t("history.loading")}
        </h3>
      </div>
    );
  }

  if (error) {
    return (
      <div className="workspacePage" style={{ padding: "40px 24px", textAlign: "center" }}>
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", padding: "24px", borderRadius: "16px", maxWidth: "480px", margin: "0 auto" }}>
          <AlertCircle size={32} color="#dc2626" style={{ margin: "0 auto 12px" }} />
          <h3 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "8px" }}>{t("history.error")}</h3>
          <p style={{ fontSize: "13px", color: "#7f1d1d", marginBottom: "16px" }}>{error}</p>
          <button
            onClick={fetchHistory}
            style={{
              background: "#dc2626",
              color: "#ffffff",
              padding: "10px 20px",
              borderRadius: "10px",
              border: "none",
              fontWeight: "600",
              fontSize: "13px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            <RefreshCw size={14} /> {t("history.retry")}
          </button>
        </div>
      </div>
    );
  }

  const conditions = history?.conditions || [];
  const allergies = history?.allergies || [];
  const currentMedications = history?.currentMedications || [];
  const prescriptions = history?.prescriptions || [];
  const investigations = history?.investigations || [];
  const procedures = history?.procedures || [];
  const consultations = history?.consultations || [];
  const documents = history?.documents || [];
  const assessments = history?.assessments || [];
  const timeline = history?.timeline || [];

  return (
    <div className="workspacePage" style={{ paddingBottom: "32px" }}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ display: "flex", flexDirection: "column", gap: "28px" }}
      >
        {/* Page Header */}
        <div>
          <h1 style={{ fontSize: "28px", fontFamily: "var(--font-sans)", fontWeight: "700", color: "var(--color-dark)" }}>
            {t("history.title")}
          </h1>
          <p style={{ color: "var(--color-text-muted)", marginTop: "6px", fontSize: "14px" }}>
            {t("history.subtitle")}
          </p>
        </div>

        {/* 1. Allergies & Conditions + Current Medications (2-Column Grid) */}
        <div className="workspaceGrid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "24px" }}>
          
          {/* Card 1: Allergies & Conditions */}
          <div className="workspaceCard" style={{ background: "#ffffff", padding: "24px", borderRadius: "18px", border: "1px solid var(--color-border)", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
              <div style={{ background: "#fee2e2", padding: "10px", borderRadius: "12px", color: "#ef4444" }}>
                <ShieldAlert size={20} />
              </div>
              <h3 style={{ fontSize: "17px", fontWeight: "700", color: "var(--color-dark)" }}>
                {t("history.allergiesAndConditions")}
              </h3>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Allergies Section */}
              <div>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "#ef4444", letterSpacing: "1px", textTransform: "uppercase" }}>
                  {t("history.allergies")}
                </span>
                {allergies.length === 0 ? (
                  <p style={{ fontSize: "13px", color: "var(--color-text-muted)", marginTop: "6px", fontStyle: "italic" }}>
                    {t("history.noAllergies")}
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "8px" }}>
                    {allergies.map((allergy) => (
                      <div key={allergy.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: "10px", background: "#fef2f2", border: "1px solid #fecaca" }}>
                        <div>
                          <h4 style={{ fontSize: "14px", fontWeight: "600", color: "#991b1b" }}>{allergy.name}</h4>
                          {allergy.description && <p style={{ fontSize: "12px", color: "#7f1d1d", marginTop: "2px" }}>{allergy.description}</p>}
                        </div>
                        <span style={{ background: "#fee2e2", color: "#b91c1c", padding: "2px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: "600" }}>
                          {allergy.status || "Active"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <hr style={{ border: "none", borderTop: "1px solid var(--color-border)", margin: "4px 0" }} />

              {/* Conditions Section */}
              <div>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "#0369a1", letterSpacing: "1px", textTransform: "uppercase" }}>
                  {t("history.conditions")}
                </span>
                {conditions.length === 0 ? (
                  <p style={{ fontSize: "13px", color: "var(--color-text-muted)", marginTop: "6px", fontStyle: "italic" }}>
                    {t("history.noConditions")}
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "8px" }}>
                    {conditions.map((cond) => (
                      <div key={cond.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", borderRadius: "10px", background: "#f0f9ff", border: "1px solid #bae6fd" }}>
                        <div>
                          <h4 style={{ fontSize: "14px", fontWeight: "600", color: "#0369a1" }}>{cond.name}</h4>
                          <p style={{ fontSize: "12px", color: "#0284c7", marginTop: "2px" }}>
                            Diagnosed: {new Date(cond.date).toLocaleDateString()}
                          </p>
                        </div>
                        <span style={{ background: "#e0f2fe", color: "#0369a1", padding: "3px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: "600" }}>
                          {cond.status || "Active"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Card 2: Current Medications */}
          <div className="workspaceCard" style={{ background: "#ffffff", padding: "24px", borderRadius: "18px", border: "1px solid var(--color-border)", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
              <div style={{ background: "#e0e7ff", padding: "10px", borderRadius: "12px", color: "#4f46e5" }}>
                <Syringe size={20} />
              </div>
              <h3 style={{ fontSize: "17px", fontWeight: "700", color: "var(--color-dark)" }}>
                {t("history.currentMedications")}
              </h3>
            </div>

            {currentMedications.length === 0 ? (
              <p style={{ fontSize: "13px", color: "var(--color-text-muted)", fontStyle: "italic" }}>
                {t("history.noMedications")}
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {currentMedications.map((med) => (
                  <div key={med.id} style={{ padding: "14px 16px", borderRadius: "12px", border: "1px solid #e0e7ff", background: "#f8fafc" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <h4 style={{ fontSize: "15px", fontWeight: "600", color: "var(--color-dark)" }}>{med.name}</h4>
                      {med.dosage && <span style={{ fontSize: "12px", fontWeight: "700", color: "#4f46e5" }}>{med.dosage}</span>}
                    </div>
                    {med.frequency && <p style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>{med.frequency}</p>}
                    <span style={{ fontSize: "11px", color: "#64748b", marginTop: "6px", display: "inline-block" }}>Source: {med.source}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Card 3: Prescriptions & OCR Extracted Records */}
        <div className="workspaceCard" style={{ background: "#ffffff", padding: "24px", borderRadius: "18px", border: "1px solid var(--color-border)", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
            <div style={{ background: "#fef3c7", padding: "10px", borderRadius: "12px", color: "#d97706" }}>
              <FileText size={20} />
            </div>
            <h3 style={{ fontSize: "17px", fontWeight: "700", color: "var(--color-dark)" }}>
              {t("history.prescriptions")}
            </h3>
          </div>

          {prescriptions.length === 0 ? (
            <p style={{ fontSize: "13px", color: "var(--color-text-muted)", fontStyle: "italic" }}>
              {t("history.noPrescriptions")}
            </p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
              {prescriptions.map((rx) => (
                <div key={rx.id} style={{ border: "1px solid #fde68a", borderRadius: "14px", padding: "16px", background: "#fffbeb", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <h4 style={{ fontSize: "14px", fontWeight: "700", color: "#92400e" }}>{rx.title}</h4>
                      <span style={{ fontSize: "11px", background: "#fef3c7", color: "#b45309", padding: "2px 8px", borderRadius: "10px", fontWeight: "600" }}>
                        {rx.ocrStatus === "completed" ? "OCR Processed" : rx.ocrStatus}
                      </span>
                    </div>
                    <p style={{ fontSize: "12px", color: "#b45309", marginBottom: "10px" }}>{rx.summary}</p>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "10px", borderTop: "1px dashed #fde68a" }}>
                    <span style={{ fontSize: "11px", color: "#d97706" }}>{new Date(rx.date).toLocaleDateString()}</span>
                    <button
                      onClick={() => handleOpenDocument(rx.documentId)}
                      style={{ background: "none", border: "none", color: "#b45309", fontSize: "12px", fontWeight: "700", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                    >
                      View Document <ExternalLink size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Card 4: Tests & Investigations */}
        <div className="workspaceCard" style={{ background: "#ffffff", padding: "24px", borderRadius: "18px", border: "1px solid var(--color-border)", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
            <div style={{ background: "#ccfbf1", padding: "10px", borderRadius: "12px", color: "#0d9488" }}>
              <FlaskConical size={20} />
            </div>
            <h3 style={{ fontSize: "17px", fontWeight: "700", color: "var(--color-dark)" }}>
              {t("history.investigations")}
            </h3>
          </div>

          {investigations.length === 0 ? (
            <p style={{ fontSize: "13px", color: "var(--color-text-muted)", fontStyle: "italic" }}>
              {t("history.noInvestigations")}
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {investigations.map((inv) => (
                <div key={inv.id} style={{ border: "1px solid #ccfbf1", borderRadius: "12px", padding: "16px", background: "#f0fdf4" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <h4 style={{ fontSize: "15px", fontWeight: "600", color: "#0f766e" }}>{inv.name}</h4>
                    <span style={{ fontSize: "12px", color: "#14b8a6" }}>{new Date(inv.date).toLocaleDateString()}</span>
                  </div>
                  <p style={{ fontSize: "13px", color: "#0f766e", marginBottom: "10px" }}>{inv.summary}</p>
                  {inv.documentId && (
                    <button
                      onClick={() => handleOpenDocument(inv.documentId)}
                      style={{ background: "#0d9488", color: "#ffffff", border: "none", padding: "6px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: "600", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                    >
                      View Report <ExternalLink size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Card 5: Past Surgeries & Procedures */}
        <div className="workspaceCard" style={{ background: "#ffffff", padding: "24px", borderRadius: "18px", border: "1px solid var(--color-border)", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
            <div style={{ background: "#dcfce7", padding: "10px", borderRadius: "12px", color: "#16a34a" }}>
              <Activity size={20} />
            </div>
            <h3 style={{ fontSize: "17px", fontWeight: "700", color: "var(--color-dark)" }}>
              {t("history.procedures")}
            </h3>
          </div>

          {procedures.length === 0 ? (
            <p style={{ fontSize: "13px", color: "var(--color-text-muted)", fontStyle: "italic" }}>
              {t("history.noProcedures")}
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {procedures.map((proc) => (
                <div key={proc.id} style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                  <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#16a34a", marginTop: "6px", flexShrink: 0 }} />
                  <div>
                    <h4 style={{ fontSize: "15px", fontWeight: "600", color: "var(--color-dark)" }}>{proc.name}</h4>
                    <p style={{ fontSize: "12px", color: "var(--color-text-muted)", marginTop: "2px" }}>
                      Date: {new Date(proc.date).toLocaleDateString()} • Status: {proc.status || "Resolved"}
                    </p>
                    {proc.description && <p style={{ fontSize: "13px", color: "var(--color-dark)", marginTop: "4px" }}>{proc.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Card 6: Doctor Consultations */}
        <div className="workspaceCard" style={{ background: "#ffffff", padding: "24px", borderRadius: "18px", border: "1px solid var(--color-border)", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
            <div style={{ background: "#e0f2fe", padding: "10px", borderRadius: "12px", color: "#0284c7" }}>
              <UserCheck size={20} />
            </div>
            <h3 style={{ fontSize: "17px", fontWeight: "700", color: "var(--color-dark)" }}>
              {t("history.consultations")}
            </h3>
          </div>

          {consultations.length === 0 ? (
            <p style={{ fontSize: "13px", color: "var(--color-text-muted)", fontStyle: "italic" }}>
              {t("history.noConsultations")}
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {consultations.map((c) => (
                <div key={c.id} style={{ padding: "16px", borderRadius: "12px", border: "1px solid #bae6fd", background: "#f0f9ff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <h4 style={{ fontSize: "15px", fontWeight: "700", color: "#0369a1" }}>{c.doctorName}</h4>
                    <span style={{ fontSize: "12px", color: "#0284c7" }}>{new Date(c.date).toLocaleDateString()}</span>
                  </div>
                  <p style={{ fontSize: "13px", color: "#0369a1" }}>
                    <strong>Specialization:</strong> {c.specialization}
                  </p>
                  {c.diagnosis && (
                    <p style={{ fontSize: "13px", color: "#0284c7", marginTop: "4px" }}>
                      <strong>Diagnosis:</strong> {c.diagnosis}
                    </p>
                  )}
                  {c.clinicalNotes && (
                    <p style={{ fontSize: "12px", color: "#334155", marginTop: "6px", background: "#ffffff", padding: "8px 12px", borderRadius: "8px" }}>
                      {c.clinicalNotes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Card 7: MediKiosk Clinical Assessments */}
        <div className="workspaceCard" style={{ background: "#ffffff", padding: "24px", borderRadius: "18px", border: "1px solid var(--color-border)", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
            <div style={{ background: "#f3e8ff", padding: "10px", borderRadius: "12px", color: "#9333ea" }}>
              <Sparkles size={20} />
            </div>
            <h3 style={{ fontSize: "17px", fontWeight: "700", color: "var(--color-dark)" }}>
              {t("history.assessments")}
            </h3>
          </div>

          {assessments.length === 0 ? (
            <p style={{ fontSize: "13px", color: "var(--color-text-muted)", fontStyle: "italic" }}>
              {t("history.noAssessments")}
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {assessments.map((a) => (
                <div key={a.id} style={{ padding: "16px", borderRadius: "12px", border: "1px solid #e9d5ff", background: "#faf5ff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <h4 style={{ fontSize: "15px", fontWeight: "700", color: "#7e22ce" }}>
                      Chief Concern: {a.chiefComplaint || "General Intake"}
                    </h4>
                    <span style={{ fontSize: "11px", background: "#f3e8ff", color: "#6b21a8", padding: "2px 8px", borderRadius: "10px", fontWeight: "600" }}>
                      {a.status === "completed" ? "Completed" : "In Progress"}
                    </span>
                  </div>
                  <p style={{ fontSize: "13px", color: "#6b21a8", marginTop: "4px" }}>{a.summary}</p>
                  <span style={{ fontSize: "11px", color: "#9333ea", marginTop: "8px", display: "inline-block" }}>
                    Date: {new Date(a.date).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Card 8: Longitudinal Medical Timeline */}
        <div className="workspaceCard" style={{ background: "#ffffff", padding: "24px", borderRadius: "18px", border: "1px solid var(--color-border)", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
            <div style={{ background: "#e0f2fe", padding: "10px", borderRadius: "12px", color: "#0284c7" }}>
              <Clock size={20} />
            </div>
            <h3 style={{ fontSize: "17px", fontWeight: "700", color: "var(--color-dark)" }}>
              {t("history.timeline")}
            </h3>
          </div>

          {timeline.length === 0 ? (
            <p style={{ fontSize: "13px", color: "var(--color-text-muted)", fontStyle: "italic" }}>
              {t("history.noRecords")}
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
              {timeline.map((event, idx) => (
                <div key={event.id || idx} style={{ display: "flex", gap: "20px" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#0d9488", flexShrink: 0 }} />
                    {idx < timeline.length - 1 && <div style={{ width: "2px", height: "100%", background: "#e2e8f0", margin: "4px 0" }} />}
                  </div>
                  <div style={{ paddingBottom: "24px", flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <h4 style={{ fontSize: "15px", fontWeight: "700", color: "var(--color-dark)" }}>{event.title}</h4>
                      <span style={{ fontSize: "11px", color: "#64748b", fontWeight: "600" }}>
                        {new Date(event.date).toLocaleDateString()}
                      </span>
                    </div>
                    <p style={{ fontSize: "12px", color: "#0d9488", fontWeight: "600", marginTop: "2px" }}>{event.subtitle}</p>
                    {event.details && <p style={{ fontSize: "13px", color: "#334155", marginTop: "4px" }}>{event.details}</p>}
                    <span style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px", display: "inline-block" }}>Source: {event.source}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </motion.div>

      {/* Document Detail Modal */}
      {selectedDoc && (
        <DocumentDetailModal
          doc={selectedDoc}
          onClose={() => setSelectedDoc(null)}
          onDelete={() => fetchHistory()}
        />
      )}
    </div>
  );
}
