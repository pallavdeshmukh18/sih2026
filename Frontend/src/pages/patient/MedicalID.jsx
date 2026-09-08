import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, AlertCircle, AlertTriangle, ArrowRight, Calendar, CheckCircle2, Droplet, FileText, FlaskConical, Languages, Loader2, MapPin, Pencil, Pill, Plus, RefreshCw, ShieldCheck, Sparkles, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../i18n";
import { getMedicalId } from "../../services/api";
import heroImage from "../../assets/medical-id-hero.png";
import styles from "./MedicalID.module.css";

const formatDate = (value, fallback = "Not recorded") => {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
};

export default function MedicalID() {
  const { token } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
    return () => { active = false; };
  }, [token]);

  if (loading) return <div className={styles.state}><Loader2 className={styles.spin} /><h3>{t("common.loading") || "Loading your Medical ID..."}</h3></div>;
  if (error) return <div className={styles.state}><div className={styles.errorBox}><AlertCircle /><h3>{t("medicalId.error") || "Unable to load your Medical ID."}</h3><p>{error}</p><button onClick={fetchMedicalId}><RefreshCw /> Retry</button></div></div>;

  const patient = data?.patient || {};
  const allergies = data?.allergies || [];
  const conditions = data?.conditions || [];
  const medications = data?.medications || [];
  const procedures = data?.procedures || [];
  const investigations = data?.investigations || [];
  const assessment = data?.recentAssessment;
  const recordStats = data?.recordStats || { documents: 0 };
  const notRecorded = t("medicalId.notRecorded") || "Not recorded";
  const updatedAt = data?.lastUpdated ? new Date(data.lastUpdated).toLocaleDateString("en-IN") : "Not available";
  const information = [
    { label: "Full Name", value: patient.name || notRecorded, icon: User },
    { label: "Date of Birth", value: formatDate(patient.dateOfBirth, notRecorded), icon: Calendar },
    { label: "Gender", value: patient.gender || notRecorded, icon: Activity, capitalize: true },
    { label: "Blood Group", value: patient.bloodGroup || notRecorded, icon: Droplet },
    { label: "State / Region", value: patient.state || notRecorded, icon: MapPin },
    { label: "Preferred Language", value: patient.preferredLanguage || notRecorded, icon: Languages, capitalize: true },
  ];
  const badge = (status) => <span className={`${styles.badge} ${styles[status] || styles.reported}`}>{status === "ai_extracted" ? "AI extracted" : status === "verified" ? "Verified" : "Patient reported"}</span>;

  return <motion.main className={`${styles.page} workspacePage`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .35 }}>
    <header className={styles.hero}>
      <img src={heroImage} alt="Botanical medical identification card" />
      <div className={styles.heroCopy}><span>MEDIKIOSK</span><h1>Medical ID</h1><p>{t("medicalId.subtitle") || "A structured clinical overview of your recorded profile and medical history."}</p></div>
    </header>

    <section className={styles.patientCard}>
      <div className={styles.patientHeader}><span className={styles.patientIcon}><User /></span><div><h2>{t("medicalId.patientInformation") || "Patient Information"}</h2><p>Basic details about you.</p></div><div className={styles.updated}>Last updated: <b>{updatedAt}</b><button onClick={() => navigate("/patient/account")}><Pencil /> Edit</button></div></div>
      <div className={styles.infoGrid}>{information.map(({ label, value, icon: Icon, capitalize }) => <div className={styles.infoTile} key={label}><Icon /><span><small>{label}</small><strong className={capitalize ? styles.capitalize : ""}>{value}</strong></span></div>)}</div>
    </section>

    <section className={`${styles.healthBand} ${styles.allergyBand}`}>
      <span className={styles.bandIcon}><AlertTriangle /></span><div className={styles.bandIntro}><h2>{t("medicalId.allergies") || "Allergies"}</h2><p>Known allergies to drugs, foods, or substances.</p></div>
      <div className={styles.bandContent}>{allergies.length ? allergies.map((item) => <div className={styles.record} key={item.id}><b>{item.allergy}</b>{item.description && <span>{item.description}</span>}{badge(item.verificationStatus)}</div>) : <em>{t("medicalId.noAllergiesRecorded") || "No allergies recorded"}</em>}</div>
      <button className={styles.bandAction} onClick={() => navigate("/patient/assessment")}><Plus /> Add Allergies</button>
    </section>

    <section className={`${styles.healthBand} ${styles.conditionBand}`}>
      <span className={styles.bandIcon}><Activity /></span><div className={styles.bandIntro}><h2>{t("medicalId.conditions") || "Conditions & Diagnoses"}</h2><p>Current or past medical conditions.</p></div>
      <div className={styles.bandContent}>{conditions.length ? conditions.map((item) => <div className={styles.record} key={item.id}><b>{item.condition}</b>{item.diagnosedDate && <span>Diagnosed {formatDate(item.diagnosedDate)}</span>}{badge(item.verificationStatus)}</div>) : <em>{t("medicalId.noConditionsRecorded") || "No medical conditions recorded"}</em>}</div>
      <button className={styles.bandAction} onClick={() => navigate("/patient/assessment")}><Plus /> Add Condition</button>
    </section>

    <section className={`${styles.healthBand} ${styles.medicationBand}`}>
      <span className={styles.bandIcon}><Pill /></span><div className={styles.bandIntro}><h2>{t("medicalId.currentMedications") || "Current Medications"}</h2><p>List of medications you are currently taking.</p></div>
      <div className={styles.bandContent}>{medications.length ? medications.map((item) => <div className={styles.record} key={item.id}><b>{item.medicine}</b><span>{[item.dosage, item.frequency].filter(Boolean).join(" · ")}</span>{badge(item.verificationStatus)}</div>) : <em>{t("medicalId.noMedicationsRecorded") || "No current medications recorded"}</em>}</div>
      <button className={styles.bandAction} onClick={() => navigate("/patient/assessment")}><Plus /> Add Medication</button>
    </section>

    <section className={styles.moreDetails}>
      <article><span><Activity /></span><div><h3>{t("medicalId.pastProcedures") || "Past Procedures"}</h3><p>{procedures.length ? `${procedures.length} procedure${procedures.length === 1 ? "" : "s"} recorded` : "No procedures recorded"}</p></div><ArrowRight /></article>
      <article><span><FlaskConical /></span><div><h3>{t("medicalId.investigations") || "Tests & Investigations"}</h3><p>{investigations.length ? `${investigations.length} investigation${investigations.length === 1 ? "" : "s"} available` : "No investigations recorded"}</p></div><ArrowRight /></article>
      <article onClick={() => navigate("/patient/assessment")}><span><Sparkles /></span><div><h3>{t("medicalId.latestAssessment") || "Latest Assessment"}</h3><p>{assessment?.chiefComplaint || "Complete your clinical assessment"}</p></div><ArrowRight /></article>
      <article onClick={() => navigate("/patient/documents")}><span><FileText /></span><div><h3>{t("medicalId.medicalRecords") || "Medical Records"}</h3><p>{recordStats.documents} uploaded file{recordStats.documents === 1 ? "" : "s"}</p></div><ArrowRight /></article>
    </section>
    <footer className={styles.secureNote}><ShieldCheck /><span><b>Your health information is protected.</b> Only authorized care providers can access this Medical ID.</span><CheckCircle2 /></footer>
  </motion.main>;
}
