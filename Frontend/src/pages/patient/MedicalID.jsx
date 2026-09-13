import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, AlertCircle, AlertTriangle, Calendar, Clock, Droplet, Languages, Loader2, MapPin, Pencil, QrCode, RefreshCw, ShieldCheck, Stethoscope, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../i18n";
import { useAccessibility } from "../../context/AccessibilityContext";
import { getMedicalId, generatePatientQrToken, getConnectedDoctors, revokeDoctorAccess } from "../../services/api";
import { transliterateName, translateClinicalTerm } from "../../utils/transliterate";
import { SUPPORTED_LANGUAGES } from "../../constants/onboardingData";
import heroImage from "../../assets/medical-id-hero.png";
import styles from "./MedicalID.module.css";

const formatDate = (value, fallback = "Not recorded") => {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
};

export default function MedicalID() {
  const { token } = useAuth();
  const { t, language } = useLanguage();
  const { islEnabled, requestSign } = useAccessibility();
  const navigate = useNavigate();

  useEffect(() => {
    if (islEnabled) {
      requestSign("Medical ID", { context: "medical_id_header" });
    }
  }, [islEnabled, requestSign]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [qrData, setQrData] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrTimeLeft, setQrTimeLeft] = useState(0);
  const [connectedDoctors, setConnectedDoctors] = useState([]);
  const [revokingId, setRevokingId] = useState(null);

  const fetchMedicalId = async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const response = await getMedicalId(token);
      if (!response.success || !response.medicalId) throw new Error(response.message || "Failed to fetch Medical ID.");
      setData(response.medicalId);
    } catch (requestError) {
      setError(requestError.message || t("medicalId.error") || "Unable to load Medical ID.");
    } finally {
      setLoading(false);
    }
  };

  const fetchQrToken = async () => {
    if (!token || qrLoading) return;
    setQrLoading(true);
    try {
      const res = await generatePatientQrToken(token);
      if (res.success) {
        setQrData(res);
        setQrTimeLeft(res.expiresInSeconds || 300);
      }
    } catch (err) {
      console.warn("Failed to generate QR token:", err.message);
    } finally {
      setQrLoading(false);
    }
  };

  const fetchConnectedDoctorsList = async () => {
    if (!token) return;
    try {
      const res = await getConnectedDoctors(token);
      if (res.success && Array.isArray(res.connectedDoctors)) {
        setConnectedDoctors(res.connectedDoctors);
      }
    } catch (err) {
      console.warn("Failed to fetch connected doctors:", err.message);
    }
  };

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    getMedicalId(token)
      .then((response) => {
        if (!response.success || !response.medicalId) throw new Error(response.message || "Failed to fetch Medical ID.");
        if (active) setData(response.medicalId);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || "Unable to load Medical ID.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    fetchQrToken();
    fetchConnectedDoctorsList();

    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    let interval = null;
    if (qrTimeLeft > 0) {
      interval = setInterval(() => {
        setQrTimeLeft((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [qrTimeLeft]);

  const handleRevokeDoctor = async (relationshipId) => {
    if (!token || revokingId) return;
    setRevokingId(relationshipId);
    try {
      const res = await revokeDoctorAccess(relationshipId, token);
      if (res.success) {
        setConnectedDoctors((prev) =>
          prev.map((doc) =>
            doc.relationshipId === relationshipId ? { ...doc, status: "revoked" } : doc
          )
        );
      }
    } catch (err) {
      console.error("Failed to revoke doctor access:", err);
    } finally {
      setRevokingId(null);
    }
  };

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (loading) return <div className={styles.state}><Loader2 className={styles.spin} /><h3>{t("common.loading") || "Loading your Medical ID..."}</h3></div>;
  if (error) return <div className={styles.state}><div className={styles.errorBox}><AlertCircle /><h3>{t("medicalId.error") || "Unable to load your Medical ID."}</h3><p>{error}</p><button onClick={fetchMedicalId}><RefreshCw /> Retry</button></div></div>;

  const patient = data?.patient || {};
  const notRecorded = t("medicalId.notRecorded", "Not recorded");
  const updatedAt = data?.lastUpdated ? new Date(data.lastUpdated).toLocaleDateString("en-IN") : "Not available";
  const bloodGroupValue = (!patient.bloodGroup || patient.bloodGroup === "Not recorded") ? notRecorded : patient.bloodGroup;
  const langObj = SUPPORTED_LANGUAGES.find((l) => l.code === (patient.preferredLanguage || "").toLowerCase());
  const preferredLangDisplay = langObj ? (langObj.nativeName || langObj.name) : (patient.preferredLanguage || notRecorded);

  const information = [
    { label: t("medicalId.fullName", "Full Name"), value: patient.name ? transliterateName(patient.name, language) : notRecorded, icon: User },
    { label: t("medicalId.dob", "Date of Birth"), value: formatDate(patient.dateOfBirth, notRecorded), icon: Calendar },
    { label: t("medicalId.gender", "Gender"), value: patient.gender ? t(`common.${patient.gender.toLowerCase()}`, patient.gender) : notRecorded, icon: Activity, capitalize: true },
    { label: t("medicalId.bloodGroup", "Blood Group"), value: bloodGroupValue, icon: Droplet },
    { label: t("medicalId.state", "State / Region"), value: patient.state ? translateClinicalTerm(patient.state, "states", language) : notRecorded, icon: MapPin },
    { label: t("medicalId.preferredLanguage", "Preferred Language"), value: preferredLangDisplay, icon: Languages, capitalize: true },
  ];

  return <motion.main className={`${styles.page} workspacePage`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .35 }}>
    <header className={styles.hero}>
      <img src={heroImage} alt="Botanical medical identification card" />
      <div className={styles.heroCopy}><span>MEDIKIOSK</span><h1>{t("medicalId.title", "Medical ID")}</h1><p>{t("medicalId.subtitle", "A structured clinical overview of your recorded profile and medical history.")}</p></div>
    </header>

    {/* Combined Patient Information + Medical ID / QR Side Panel Card */}
    <section className={styles.patientCard}>
      <div className={styles.patientCardContent}>
        {/* Left Side: Patient Information */}
        <div className={styles.patientInfoLeft}>
          <div className={styles.patientHeader}>
            <span className={styles.patientIcon}><User /></span>
            <div>
              <h2>{t("medicalId.patientInfo", "Patient Information")}</h2>
              <p>{t("medicalId.patientInfoSub", "Basic details about you.")}</p>
            </div>
            <div className={styles.updated}>
              {t("medicalId.lastUpdated", "Last updated")}: <b>{updatedAt}</b>
              <button onClick={() => navigate("/patient/account")} aria-label="Edit Profile"><Pencil /> {t("common.edit", "Edit")}</button>
            </div>
          </div>
          <div className={styles.infoGrid}>
            {information.map(({ label, value, icon: Icon, capitalize }) => (
              <div className={styles.infoTile} key={label}>
                <Icon />
                <span>
                  <small>{label}</small>
                  <strong className={capitalize ? styles.capitalize : ""}>{value}</strong>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Side: Medical ID / QR Panel */}
        <div className={styles.qrSidePanel}>
          <div className={styles.qrSideHeader}>
            <h3><QrCode size={15} /> {t("medicalId.title", "MEDICAL ID")} / QR</h3>
            <p>{t("medicalId.qrDescription", "Securely share your Medical ID with an authorized doctor.")}</p>
          </div>

          {qrLoading ? (
            <div style={{ padding: "16px", textAlign: "center", color: "#059669" }}>
              <Loader2 className={styles.spin} size={24} style={{ margin: "0 auto 6px" }} />
              <span style={{ fontSize: "11px", fontWeight: "600", display: "block" }}>{t("medicalId.generating", "Generating...")}</span>
            </div>
          ) : (
            <>
              <div className={styles.qrBox} aria-label={t("medicalId.qrAriaLabel", "Secure Medical ID QR code for connecting with a doctor")}>
                <QRCodeSVG 
                  value={qrData?.qrPayload || ""} 
                  size={115} 
                  level="H" 
                  includeMargin={true}
                />
                <div className={styles.pairingCodeTag}>
                  {t("medicalId.pairingCode", "Pairing Code")}: <strong>{qrData?.pairingCode || "MK-XXXXXX"}</strong>
                </div>
              </div>

              <div className={styles.qrControls}>
                {qrTimeLeft > 0 ? (
                  <div className={`${styles.qrTimer} ${qrTimeLeft < 60 ? styles.qrTimerWarning : ""}`}>
                    <Clock size={13} />
                    <span>{t("medicalId.expiresIn", "QR expires in")} <strong>{formatTimer(qrTimeLeft)}</strong></span>
                  </div>
                ) : (
                  <div className={`${styles.qrTimer} ${styles.qrTimerWarning}`}>
                    <AlertTriangle size={13} color="#b45309" />
                    <span style={{ color: "#b45309", fontWeight: "700" }}>{t("medicalId.qrExpired", "QR Expired")}</span>
                  </div>
                )}

                <button 
                  onClick={fetchQrToken} 
                  disabled={qrLoading}
                  className={styles.qrRefreshBtn}
                  aria-label={t("medicalId.generateNewQr", "Generate New QR")}
                >
                  {qrLoading ? <Loader2 className={styles.spin} size={12} /> : <RefreshCw size={12} />}
                  <span>{qrLoading ? t("medicalId.generating", "Generating...") : t("medicalId.generateNewQr", "Generate New QR")}</span>
                </button>
              </div>
            </>
          )}

          <div className={styles.qrSecurityNote}>
            <ShieldCheck size={14} />
            <span>🔒 {t("medicalId.qrSecurityNotice", "This QR does not contain your medical information.")}</span>
          </div>
        </div>
      </div>
    </section>

    {/* Connected Care Providers Section */}
    <section className={styles.connectedSection}>
      <div className={styles.patientHeader}>
        <span className={styles.patientIcon} style={{ background: "#f0fdf4", color: "#166534" }}><Stethoscope size={20} /></span>
        <div>
          <h2>{t("medicalId.connectedCareProviders", "CONNECTED CARE PROVIDERS")}</h2>
          <p>{t("medicalId.connectedProvidersSubtitle", "Doctors who have authorized access to your MediKiosk clinical profile.")}</p>
        </div>
      </div>

      <div className={styles.connectedDoctorsGrid}>
        {connectedDoctors.length > 0 ? (
          connectedDoctors.map((doc) => (
            <div key={doc.relationshipId} className={styles.connectedDoctorCard}>
              <div className={styles.docHeader}>
                <div className={styles.docAvatar}>
                  {doc.doctorName?.replace("Dr. ", "").charAt(0)}
                </div>
                <div className={styles.docInfo}>
                  <h4>{doc.doctorName}</h4>
                  <p>{doc.specialization} • {doc.department}</p>
                  <small>{t("medicalId.connectedAt", "Connected")}: {formatDate(doc.connectedAt)}</small>
                </div>
              </div>
              <div className={styles.docActions}>
                {doc.status === "active" ? (
                  <>
                    <span className={styles.statusBadge}>{t("medicalId.statusActive", "Active")}</span>
                    <button
                      onClick={() => handleRevokeDoctor(doc.relationshipId)}
                      className={styles.revokeBtn}
                      disabled={revokingId === doc.relationshipId}
                      aria-label="Revoke Access"
                    >
                      {revokingId === doc.relationshipId ? t("medicalId.revoking", "Revoking...") : t("medicalId.revokeAccess", "Revoke Access")}
                    </button>
                  </>
                ) : (
                  <span className={styles.revokedTag}>{t("medicalId.accessRevoked", "Access Revoked")}</span>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className={styles.emptyProviders}>
            <div className={styles.emptyProvidersIcon}>
              <Stethoscope size={22} />
            </div>
            <h4>{t("medicalId.noConnectedProviders", "No connected care providers yet")}</h4>
            <p>{t("medicalId.noConnectedProvidersSub", "Share your secure QR with a doctor to connect your MediKiosk record.")}</p>
          </div>
        )}
      </div>
    </section>

  </motion.main>;
}
