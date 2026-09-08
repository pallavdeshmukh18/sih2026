import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  User,
  AlertTriangle,
  Activity,
  Pill,
  FileText,
  FlaskConical,
  Sparkles,
  Calendar,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  ExternalLink,
  Info,
  ArrowRight
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../i18n";
import { getMedicalId } from "../../services/api";

export default function MedicalID() {
  const { token } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMedicalId = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getMedicalId(token);
      if (res.success && res.medicalId) {
        setData(res.medicalId);
      } else {
        throw new Error(res.message || "Failed to fetch Medical ID.");
      }
    } catch (err) {
      console.error("Medical ID fetch error:", err);
      setError(err.message || t("medicalId.error") || "Unable to load Medical ID.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedicalId();
  }, [token]);

  if (loading) {
    return (
      <div className="workspacePage" style={{ padding: "40px 24px", textAlign: "center" }}>
        <Loader2 size={36} color="#0d9488" className="spin" style={{ margin: "0 auto 16px" }} />
        <h3 style={{ fontSize: "16px", color: "#0f172a", fontWeight: "600" }}>
          {t("common.loading") || "Loading your Medical ID..."}
        </h3>
      </div>
    );
  }

  if (error) {
    return (
      <div className="workspacePage" style={{ padding: "40px 24px", textAlign: "center" }}>
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", padding: "24px", borderRadius: "16px", maxWidth: "480px", margin: "0 auto" }}>
          <AlertCircle size={32} color="#dc2626" style={{ margin: "0 auto 12px" }} />
          <h3 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "8px" }}>
            {t("medicalId.error") || "Unable to load your Medical ID."}
          </h3>
          <p style={{ fontSize: "13px", color: "#7f1d1d", marginBottom: "16px" }}>{error}</p>
          <button
            onClick={fetchMedicalId}
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
            <RefreshCw size={14} /> {t("medicalId.retry") || "Retry"}
          </button>
        </div>
      </div>
    );
  }

  const patient = data?.patient || {};
  const allergies = data?.allergies || [];
  const conditions = data?.conditions || [];
  const medications = data?.medications || [];
  const procedures = data?.procedures || [];
  const investigations = data?.investigations || [];
  const recentAssessment = data?.recentAssessment || null;
  const recordStats = data?.recordStats || { documents: 0, conditions: 0, medications: 0, assessments: 0 };
  const lastUpdated = data?.lastUpdated ? new Date(data.lastUpdated).toLocaleDateString() : "Not available";

  const notRecorded = t("medicalId.notRecorded") || "Not recorded";

  const renderBadge = (status) => {
    if (status === "verified") {
      return (
        <span style={{ background: "#dcfce7", color: "#166534", padding: "2px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: "700" }}>
          {t("medicalId.verified") || "Verified"}
        </span>
      );
    }
    if (status === "ai_extracted") {
      return (
        <span style={{ background: "#fef9c3", color: "#854d0e", padding: "2px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: "700" }}>
          {t("medicalId.aiExtracted") || "AI Extracted"}
        </span>
      );
    }
    return (
      <span style={{ background: "#e0f2fe", color: "#0369a1", padding: "2px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: "700" }}>
        {t("medicalId.patientReported") || "Patient Reported"}
      </span>
    );
  };

  return (
    <div className="workspacePage" style={{ paddingBottom: "40px" }}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        style={{ display: "flex", flexDirection: "column", gap: "28px" }}
      >
        {/* Page Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "#ccfbf1", color: "#0d9488", padding: "4px 12px", borderRadius: "20px", fontSize: "11px", fontWeight: "800", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "8px" }}>
              <ShieldCheck size={14} /> MediKiosk Clinical Identification
            </div>
            <h1 style={{ fontSize: "28px", fontFamily: "'Playfair Display', serif", fontWeight: "700", color: "#0f172a", margin: 0 }}>
              {t("medicalId.title") || "MEDICAL ID"}
            </h1>
            <p style={{ color: "#64748b", marginTop: "4px", fontSize: "14px" }}>
              {t("medicalId.subtitle") || "A structured clinical overview of your recorded profile and medical history."}
            </p>
          </div>

          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: "12px", color: "#64748b", display: "block" }}>
              {t("medicalId.lastUpdated") || "Last updated"}: <strong>{lastUpdated}</strong>
            </span>
          </div>
        </div>

        {/* 1. PATIENT INFORMATION CARD */}
        <div style={{ background: "#ffffff", padding: "24px", borderRadius: "18px", border: "1px solid #e2e8f0", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px", color: "#0d9488" }}>
            <User size={20} />
            <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#0f172a", margin: 0 }}>
              {t("medicalId.patientInformation") || "Patient Information"}
            </h3>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "18px" }}>
            <div style={{ background: "#f8fafc", padding: "14px 16px", borderRadius: "12px", border: "1px solid #f1f5f9" }}>
              <span style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: "700" }}>Full Name</span>
              <p style={{ fontSize: "15px", fontWeight: "700", color: "#0f172a", margin: "4px 0 0" }}>{patient.name || notRecorded}</p>
            </div>

            <div style={{ background: "#f8fafc", padding: "14px 16px", borderRadius: "12px", border: "1px solid #f1f5f9" }}>
              <span style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: "700" }}>Age / DOB</span>
              <p style={{ fontSize: "15px", fontWeight: "700", color: "#0f172a", margin: "4px 0 0" }}>
                {patient.age !== null && patient.age !== undefined ? `${patient.age} yrs` : notRecorded}
                {patient.dateOfBirth ? ` (${new Date(patient.dateOfBirth).toLocaleDateString()})` : ""}
              </p>
            </div>

            <div style={{ background: "#f8fafc", padding: "14px 16px", borderRadius: "12px", border: "1px solid #f1f5f9" }}>
              <span style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: "700" }}>Gender</span>
              <p style={{ fontSize: "15px", fontWeight: "700", color: "#0f172a", margin: "4px 0 0", textTransform: "capitalize" }}>{patient.gender || notRecorded}</p>
            </div>

            <div style={{ background: "#f8fafc", padding: "14px 16px", borderRadius: "12px", border: "1px solid #f1f5f9" }}>
              <span style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: "700" }}>Blood Group</span>
              <p style={{ fontSize: "15px", fontWeight: "700", color: "#0f172a", margin: "4px 0 0" }}>{patient.bloodGroup || notRecorded}</p>
            </div>

            <div style={{ background: "#f8fafc", padding: "14px 16px", borderRadius: "12px", border: "1px solid #f1f5f9" }}>
              <span style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: "700" }}>State / Region</span>
              <p style={{ fontSize: "15px", fontWeight: "700", color: "#0f172a", margin: "4px 0 0" }}>{patient.state || notRecorded}</p>
            </div>

            <div style={{ background: "#f8fafc", padding: "14px 16px", borderRadius: "12px", border: "1px solid #f1f5f9" }}>
              <span style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: "700" }}>Preferred Language</span>
              <p style={{ fontSize: "15px", fontWeight: "700", color: "#0f172a", margin: "4px 0 0", textTransform: "uppercase" }}>{patient.preferredLanguage || notRecorded}</p>
            </div>
          </div>
        </div>

        {/* 2. ALLERGIES CARD (VISUAL EMPHASIS) */}
        <div style={{ background: "#ffffff", padding: "24px", borderRadius: "18px", border: "1px solid #fecaca", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px", color: "#dc2626" }}>
            <AlertTriangle size={20} />
            <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#991b1b", margin: 0 }}>
              {t("medicalId.allergies") || "Allergies"}
            </h3>
          </div>

          {allergies.length === 0 ? (
            <p style={{ fontSize: "13px", color: "#64748b", fontStyle: "italic", margin: 0 }}>
              {t("medicalId.noAllergiesRecorded") || "No allergies recorded"}
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {allergies.map((alg) => (
                <div key={alg.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderRadius: "12px", background: "#fef2f2", border: "1px solid #fecaca" }}>
                  <div>
                    <h4 style={{ fontSize: "14px", fontWeight: "700", color: "#991b1b", margin: 0 }}>{alg.allergy}</h4>
                    {alg.description && <p style={{ fontSize: "12px", color: "#7f1d1d", margin: "2px 0 0" }}>{alg.description}</p>}
                    <span style={{ fontSize: "11px", color: "#991b1b", opacity: 0.8, marginTop: "4px", display: "inline-block" }}>
                      Source: <strong>{alg.source}</strong>
                    </span>
                  </div>
                  <div>{renderBadge(alg.verificationStatus)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. CONDITIONS & DIAGNOSES */}
        <div style={{ background: "#ffffff", padding: "24px", borderRadius: "18px", border: "1px solid #e2e8f0", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px", color: "#0369a1" }}>
            <Activity size={20} />
            <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#0f172a", margin: 0 }}>
              {t("medicalId.conditions") || "Conditions & Diagnoses"}
            </h3>
          </div>

          {conditions.length === 0 ? (
            <p style={{ fontSize: "13px", color: "#64748b", fontStyle: "italic", margin: 0 }}>
              {t("medicalId.noConditionsRecorded") || "No medical conditions recorded"}
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {conditions.map((cond) => (
                <div key={cond.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderRadius: "12px", background: "#f0f9ff", border: "1px solid #bae6fd" }}>
                  <div>
                    <h4 style={{ fontSize: "14px", fontWeight: "700", color: "#0369a1", margin: 0 }}>{cond.condition}</h4>
                    <span style={{ fontSize: "11px", color: "#0284c7", marginTop: "3px", display: "inline-block" }}>
                      Source: <strong>{cond.source}</strong> • Diagnosed: {new Date(cond.diagnosedDate).toLocaleDateString()}
                    </span>
                  </div>
                  <div>{renderBadge(cond.verificationStatus)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 4. CURRENT MEDICATIONS */}
        <div style={{ background: "#ffffff", padding: "24px", borderRadius: "18px", border: "1px solid #e2e8f0", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px", color: "#4f46e5" }}>
            <Pill size={20} />
            <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#0f172a", margin: 0 }}>
              {t("medicalId.currentMedications") || "Current Medications"}
            </h3>
          </div>

          {medications.length === 0 ? (
            <p style={{ fontSize: "13px", color: "#64748b", fontStyle: "italic", margin: 0 }}>
              {t("medicalId.noMedicationsRecorded") || "No medications recorded"}
            </p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px" }}>
              {medications.map((med) => (
                <div key={med.id} style={{ padding: "14px 16px", borderRadius: "12px", border: "1px solid #e0e7ff", background: "#faf5ff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                    <h4 style={{ fontSize: "14px", fontWeight: "700", color: "#4338ca", margin: 0 }}>{med.medicine}</h4>
                    {renderBadge(med.verificationStatus)}
                  </div>
                  {med.dosage && <p style={{ fontSize: "12px", color: "#6366f1", margin: "2px 0 0", fontWeight: "600" }}>Dose: {med.dosage}</p>}
                  {med.frequency && <p style={{ fontSize: "12px", color: "#475569", margin: "2px 0 0" }}>{med.frequency}</p>}
                  <span style={{ fontSize: "11px", color: "#94a3b8", marginTop: "8px", display: "inline-block" }}>
                    Source: <strong>{med.source}</strong>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 5. PAST SURGERIES & PROCEDURES */}
        <div style={{ background: "#ffffff", padding: "24px", borderRadius: "18px", border: "1px solid #e2e8f0", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px", color: "#16a34a" }}>
            <Activity size={20} />
            <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#0f172a", margin: 0 }}>
              {t("medicalId.pastProcedures") || "Past Surgeries & Procedures"}
            </h3>
          </div>

          {procedures.length === 0 ? (
            <p style={{ fontSize: "13px", color: "#64748b", fontStyle: "italic", margin: 0 }}>
              {t("medicalId.noProceduresRecorded") || "No surgeries or procedures recorded"}
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {procedures.map((proc) => (
                <div key={proc.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderRadius: "12px", background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                  <div>
                    <h4 style={{ fontSize: "14px", fontWeight: "700", color: "#166534", margin: 0 }}>{proc.procedure}</h4>
                    <span style={{ fontSize: "11px", color: "#15803d", marginTop: "3px", display: "inline-block" }}>
                      Source: <strong>{proc.source}</strong> • Status: {proc.status}
                    </span>
                  </div>
                  <div>{renderBadge(proc.verificationStatus)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 6. TESTS & INVESTIGATIONS */}
        <div style={{ background: "#ffffff", padding: "24px", borderRadius: "18px", border: "1px solid #e2e8f0", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px", color: "#0d9488" }}>
            <FlaskConical size={20} />
            <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#0f172a", margin: 0 }}>
              {t("medicalId.investigations") || "Tests & Investigations"}
            </h3>
          </div>

          {investigations.length === 0 ? (
            <p style={{ fontSize: "13px", color: "#64748b", fontStyle: "italic", margin: 0 }}>
              {t("medicalId.noInvestigationsRecorded") || "No investigation reports recorded"}
            </p>
          ) : (
            <div style={{ border: "1px solid #e2e8f0", borderRadius: "12px", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", color: "#475569", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontSize: "11px", textTransform: "uppercase" }}>Test Name</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontSize: "11px", textTransform: "uppercase" }}>Result</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontSize: "11px", textTransform: "uppercase" }}>Reference Range</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontSize: "11px", textTransform: "uppercase" }}>Flag</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontSize: "11px", textTransform: "uppercase" }}>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {investigations.map((lab) => (
                    <tr key={lab.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "12px 14px", fontWeight: "700", color: "#0f172a" }}>{lab.test}</td>
                      <td style={{ padding: "12px 14px", fontWeight: "600" }}>{lab.value ? `${lab.value} ${lab.unit || ""}` : "—"}</td>
                      <td style={{ padding: "12px 14px", color: "#64748b" }}>{lab.referenceRange || "Reported range unavailable"}</td>
                      <td style={{ padding: "12px 14px" }}>
                        <span
                          style={{
                            background: lab.flag?.toLowerCase() === "high" ? "#fef2f2" : lab.flag?.toLowerCase() === "low" ? "#fefce8" : "#f0fdf4",
                            color: lab.flag?.toLowerCase() === "high" ? "#991b1b" : lab.flag?.toLowerCase() === "low" ? "#854d0e" : "#166534",
                            padding: "2px 8px",
                            borderRadius: "10px",
                            fontSize: "11px",
                            fontWeight: "700"
                          }}
                        >
                          {(lab.flag || "normal").toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: "11px", color: "#64748b" }}>{lab.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 7. LATEST CLINICAL ASSESSMENT */}
        <div style={{ background: "#ffffff", padding: "24px", borderRadius: "18px", border: "1px solid #e2e8f0", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px", color: "#9333ea" }}>
            <Sparkles size={20} />
            <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#0f172a", margin: 0 }}>
              {t("medicalId.latestAssessment") || "Latest Clinical Assessment"}
            </h3>
          </div>

          {recentAssessment ? (
            <div style={{ padding: "16px", borderRadius: "14px", border: "1px solid #e9d5ff", background: "#faf5ff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <h4 style={{ fontSize: "15px", fontWeight: "700", color: "#7e22ce", margin: 0 }}>
                  Chief Concern: {recentAssessment.chiefComplaint}
                </h4>
                <span style={{ fontSize: "11px", background: "#f3e8ff", color: "#6b21a8", padding: "2px 8px", borderRadius: "10px", fontWeight: "700" }}>
                  {recentAssessment.status === "completed" ? "Completed" : "In Progress"}
                </span>
              </div>
              <p style={{ fontSize: "13px", color: "#6b21a8", margin: "4px 0" }}>{recentAssessment.summary}</p>
              <span style={{ fontSize: "11px", color: "#9333ea", marginTop: "6px", display: "inline-block" }}>
                Date: {new Date(recentAssessment.date).toLocaleDateString()} • Source: {recentAssessment.source}
              </span>
            </div>
          ) : (
            <div style={{ padding: "20px", background: "#f8fafc", borderRadius: "14px", border: "1px solid #e2e8f0", textAlign: "center" }}>
              <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 12px" }}>
                {t("medicalId.completeAssessmentPrompt") || "Complete your clinical assessment to build your medical profile."}
              </p>
              <button
                onClick={() => navigate("/patient/assessment")}
                style={{
                  background: "#0d9488",
                  color: "#ffffff",
                  padding: "8px 20px",
                  borderRadius: "10px",
                  border: "none",
                  fontWeight: "700",
                  fontSize: "13px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                {t("medicalId.takeAssessment") || "Take Clinical Assessment"} <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>

        {/* 8. RECORDS LINK */}
        <div style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", padding: "20px 24px", borderRadius: "18px", color: "#ffffff", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h4 style={{ fontSize: "16px", fontWeight: "700", margin: "0 0 4px", color: "#ffffff" }}>
              {t("medicalId.medicalRecords") || "Medical Records"} ({recordStats.documents} files)
            </h4>
            <p style={{ fontSize: "12px", color: "#cbd5e1", margin: 0 }}>
              All uploaded prescriptions, lab reports, and doctor letters are structured into your Medical ID.
            </p>
          </div>
          <button
            onClick={() => navigate("/patient/documents")}
            style={{
              background: "#0d9488",
              color: "#ffffff",
              border: "none",
              padding: "10px 20px",
              borderRadius: "10px",
              fontWeight: "700",
              fontSize: "13px",
              cursor: "pointer"
            }}
          >
            Manage Records →
          </button>
        </div>
      </motion.div>
    </div>
  );
}
