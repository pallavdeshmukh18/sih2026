import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  Loader2,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  UserCheck
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../i18n";
import { getMedicalId } from "../../services/api";

export default function MedicalIdCard() {
  const { token } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMedicalIdData = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getMedicalId(token);
      if (res.success && res.medicalId) {
        setData(res.medicalId);
      } else {
        throw new Error(res.message || "Failed to load Medical ID.");
      }
    } catch (err) {
      console.warn("Medical ID load error:", err.message);
      setError(t("medicalId.error") || "Unable to load your Medical ID.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedicalIdData();
  }, [token]);

  if (loading) {
    return (
      <div
        style={{
          background: "#ffffff",
          borderRadius: "18px",
          border: "1px solid #e2e8f0",
          padding: "24px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Loader2 size={20} color="#0d9488" className="spin" />
          <span style={{ fontSize: "14px", fontWeight: "700", color: "#0f172a" }}>
            Loading Medical ID...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          background: "#fef2f2",
          borderRadius: "18px",
          border: "1px solid #fecaca",
          padding: "20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: "#991b1b",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <AlertCircle size={20} color="#dc2626" />
          <span style={{ fontSize: "13px", fontWeight: "600" }}>{error}</span>
        </div>
        <button
          onClick={fetchMedicalIdData}
          style={{
            background: "#dc2626",
            color: "#ffffff",
            border: "none",
            padding: "6px 14px",
            borderRadius: "8px",
            fontSize: "12px",
            fontWeight: "600",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <RefreshCw size={14} /> {t("medicalId.retry") || "Retry"}
        </button>
      </div>
    );
  }

  const patient = data?.patient || {};
  const allergies = data?.allergies || [];
  const conditions = data?.conditions || [];
  const medications = data?.medications || [];
  const recordStats = data?.recordStats || { documents: 0, conditions: 0, medications: 0 };
  const lastUpdated = data?.lastUpdated ? new Date(data.lastUpdated).toLocaleDateString() : "Not available";

  const notRecordedLabel = t("medicalId.notRecorded") || "Not recorded";

  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: "18px",
        border: "1px solid #e2e8f0",
        padding: "24px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
        display: "flex",
        flexDirection: "column",
        gap: "18px",
        position: "relative",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#0d9488", fontSize: "11px", fontWeight: "800", letterSpacing: "1px", textTransform: "uppercase" }}>
            <ShieldCheck size={16} color="#0d9488" />
            <span>{t("medicalId.title") || "MEDICAL ID"}</span>
          </div>
          <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: "20px", fontWeight: "700", color: "#0f172a", margin: "6px 0 2px" }}>
            {patient.name || "Patient Profile"}
          </h3>
          <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "500" }}>
            Patient • ID: #{patient.id ? patient.id.substring(0, 8) : "N/A"}
          </span>
        </div>

        {/* Identity Pills */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
          <span style={{ fontSize: "12px", fontWeight: "600", color: "#334155", background: "#f1f5f9", padding: "4px 10px", borderRadius: "10px" }}>
            Age: {patient.age !== null && patient.age !== undefined ? patient.age : notRecordedLabel}
          </span>
          <span style={{ fontSize: "11px", fontWeight: "500", color: "#64748b" }}>
            Blood Group: {patient.bloodGroup || notRecordedLabel}
          </span>
        </div>
      </div>

      <hr style={{ border: "none", borderTop: "1px solid #f1f5f9", margin: "0" }} />

      {/* Primary Section 1: ALLERGIES (Visual Emphasis) */}
      <div>
        <div style={{ fontSize: "11px", fontWeight: "800", color: "#b91c1c", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
          <AlertTriangle size={14} color="#dc2626" />
          <span>{t("medicalId.allergies") || "ALLERGIES"}</span>
        </div>

        {allergies.length === 0 ? (
          <p style={{ fontSize: "13px", color: "#64748b", margin: 0, fontStyle: "italic" }}>
            {t("medicalId.noAllergiesRecorded") || "No allergies recorded"}
          </p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {allergies.slice(0, 3).map((alg, i) => (
              <span
                key={i}
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#991b1b",
                  padding: "4px 10px",
                  borderRadius: "10px",
                  fontSize: "12px",
                  fontWeight: "600",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                {alg.allergy}
                <span style={{ fontSize: "10px", opacity: 0.8, fontWeight: "500" }}>
                  [{alg.verificationStatus === "ai_extracted" ? (t("medicalId.needsVerification") || "Verify") : (t("medicalId.verified") || "Verified")}]
                </span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Primary Section 2: CONDITIONS */}
      <div>
        <div style={{ fontSize: "11px", fontWeight: "800", color: "#0369a1", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: "6px" }}>
          {t("medicalId.conditions") || "CONDITIONS & DIAGNOSES"}
        </div>
        {conditions.length === 0 ? (
          <p style={{ fontSize: "13px", color: "#64748b", margin: 0, fontStyle: "italic" }}>
            {t("medicalId.noConditionsRecorded") || "No medical conditions recorded"}
          </p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {conditions.slice(0, 3).map((cond, i) => (
              <span
                key={i}
                style={{
                  background: "#f0f9ff",
                  border: "1px solid #bae6fd",
                  color: "#0369a1",
                  padding: "4px 10px",
                  borderRadius: "10px",
                  fontSize: "12px",
                  fontWeight: "600",
                }}
              >
                {cond.condition}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Primary Section 3: MEDICATIONS & STATS */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", background: "#f8fafc", padding: "12px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
        <div>
          <span style={{ fontSize: "11px", fontWeight: "700", color: "#475569", textTransform: "uppercase" }}>
            {t("medicalId.currentMedications") || "CURRENT MEDICATIONS"}
          </span>
          <p style={{ fontSize: "14px", fontWeight: "700", color: "#0f172a", margin: "2px 0 0" }}>
            {medications.length > 0
              ? `${medications.length} active`
              : (t("medicalId.noMedicationsRecorded") || "No active meds")}
          </p>
        </div>

        <div>
          <span style={{ fontSize: "11px", fontWeight: "700", color: "#475569", textTransform: "uppercase" }}>
            {t("medicalId.medicalRecords") || "MEDICAL RECORDS"}
          </span>
          <p style={{ fontSize: "14px", fontWeight: "700", color: "#0f172a", margin: "2px 0 0" }}>
            {recordStats.documents} records on file
          </p>
        </div>
      </div>

      {/* Footer & CTA */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "4px" }}>
        <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "500" }}>
          {t("medicalId.lastUpdated") || "Last updated"}: {lastUpdated}
        </span>

        <button
          onClick={() => navigate("/patient/medical-id")}
          style={{
            background: "#0d9488",
            color: "#ffffff",
            border: "none",
            padding: "8px 18px",
            borderRadius: "10px",
            fontSize: "13px",
            fontWeight: "700",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            boxShadow: "0 4px 12px rgba(13, 148, 136, 0.2)",
          }}
        >
          {t("medicalId.viewMedicalId") || "View Medical ID →"}
        </button>
      </div>
    </div>
  );
}
