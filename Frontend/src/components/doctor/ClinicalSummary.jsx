import { useState, useEffect } from 'react';
import styles from './ClinicalSummary.module.css';
import { FileText, AlertTriangle, Activity, Pill, Clock, Edit3, Save, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { confirmConsultation } from '../../services/api';
import toast from 'react-hot-toast';

const ClinicalSummary = ({ patient, onConsultationCompleted }) => {
    const { token } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [diagnosis, setDiagnosis] = useState('');
    
    const initialSummary = patient?.intake?.aiSummary || 
                           patient?.aiSummary || 
                           patient?.intake?.chiefComplaint || 
                           patient?.chiefComplaint || 
                           patient?.reason || 
                           "Patient presents for clinical evaluation.";

    const [summary, setSummary] = useState(initialSummary);

    useEffect(() => {
        setSummary(
            patient?.intake?.aiSummary || 
            patient?.aiSummary || 
            patient?.intake?.chiefComplaint || 
            patient?.chiefComplaint || 
            patient?.reason || 
            "Patient presents for clinical evaluation."
        );
        setDiagnosis('');
        setIsEditing(false);
    }, [patient]);

    const handleSave = () => {
        setIsEditing(false);
        toast.success("Clinical summary updated.");
    };

    const handleEndConsultation = async () => {
        const appointmentId = patient?.appointmentId || patient?.id;
        if (!appointmentId) {
            toast.error("No valid appointment ID found.");
            return;
        }

        setIsSubmitting(true);
        try {
            await confirmConsultation(
                appointmentId, 
                {
                    clinicalNotes: summary,
                    diagnosis: diagnosis.trim() || "Clinical consultation completed",
                    chiefComplaint: patient?.chiefComplaint || patient?.intake?.chiefComplaint || patient?.reason || "Consultation"
                }, 
                token
            );
            toast.success("Consultation confirmed and recorded successfully!");
            if (onConsultationCompleted) onConsultationCompleted();
        } catch (err) {
            toast.error(err.message || "Failed to confirm consultation.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!patient) {
        return (
            <div className={styles.summaryContainer}>
                <div className={styles.emptyState}>
                    <FileText size={64} />
                    <h2>No Patient Selected</h2>
                    <p>Select a patient from the triage queue to view their AI-generated clinical summary, red flags, and document timeline.</p>
                </div>
            </div>
        );
    }

    const patientName = patient.name || `${patient.patient?.firstName || ''} ${patient.patient?.lastName || ''}`.trim() || 'Patient';
    const patientAge = patient.age || (patient.patient?.dateOfBirth ? Math.floor((new Date() - new Date(patient.patient.dateOfBirth)) / 31557600000) : '--');
    const patientGender = patient.gender || patient.patient?.gender || 'N/A';
    const abhaId = patient.patient?.abhaId || patient.abhaId || `P-${patient.appointmentId ? patient.appointmentId.slice(0, 8) : '1001'}`;
    const redFlags = patient.redFlags || patient.intake?.redFlags || [];

    return (
        <div className={styles.summaryContainer}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.patientIdentity}>
                    <div className={styles.avatarLg}>
                        {patientName.charAt(0)}
                    </div>
                    <div className={styles.identityDetails}>
                        <h2>{patientName}</h2>
                        <p>{patientAge} years • {patientGender} • ABHA: {abhaId}</p>
                    </div>
                </div>
                <div className={styles.actions}>
                    {isEditing ? (
                        <button className={styles.btnPrimary} onClick={handleSave}>
                            <Save size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }}/> Save Notes
                        </button>
                    ) : (
                        <button className={styles.btnSecondary} onClick={() => setIsEditing(true)}>
                            <Edit3 size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }}/> Edit
                        </button>
                    )}
                    <button 
                        className={styles.btnPrimary} 
                        onClick={handleEndConsultation}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? "Saving..." : "Confirm & End Consult"}
                    </button>
                </div>
            </div>

            <div className={styles.content}>
                {/* Red Flags Alert */}
                {redFlags && redFlags.length > 0 && (
                    <div className={styles.alertBox}>
                        <div className={styles.alertIcon}>
                            <AlertTriangle size={24} />
                        </div>
                        <div className={styles.alertContent}>
                            <h3>Potential Red Flags Detected by AI</h3>
                            <p>The patient reported symptoms consistent with high-priority conditions: <strong>{patient.redFlags.join(", ")}</strong>. Immediate clinical evaluation recommended.</p>
                        </div>
                    </div>
                )}

                {/* AI Structured Summary */}
                <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <FileText size={18} /> Chief Complaint & HPI
                    </div>
                    {isEditing ? (
                        <textarea 
                            className={styles.editableTextarea}
                            value={summary}
                            onChange={(e) => setSummary(e.target.value)}
                        />
                    ) : (
                        <p style={{ lineHeight: '1.6', color: 'var(--color-dark)', margin: 0 }}>
                            {summary}
                        </p>
                    )}
                </div>

                {/* Extracted Entities Grid */}
                <div className={styles.twoColumnGrid}>
                    <div className={styles.section}>
                        <div className={styles.sectionHeader}>
                            <Pill size={18} /> Extracted Medications
                        </div>
                        <ul className={styles.entityList}>
                            <li className={styles.entityItem}>
                                <div>
                                    <span className={styles.entityLabel}>Metformin 500mg</span>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Twice daily after meals</div>
                                </div>
                                <span className={styles.entitySource}>OCR: Rx Oct 2023</span>
                            </li>
                            <li className={styles.entityItem}>
                                <div>
                                    <span className={styles.entityLabel}>Aspirin 75mg</span>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Once daily</div>
                                </div>
                                <span className={styles.entitySource}>Patient Voice</span>
                            </li>
                        </ul>
                    </div>

                    <div className={styles.section}>
                        <div className={styles.sectionHeader}>
                            <Activity size={18} /> Recent Investigations
                        </div>
                        <ul className={styles.entityList}>
                            <li className={styles.entityItem}>
                                <div>
                                    <span className={styles.entityLabel}>HbA1c</span>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#ef4444' }}>8.2% (High)</div>
                                </div>
                                <span className={styles.entitySource}>OCR: Lab Report</span>
                            </li>
                            <li className={styles.entityItem}>
                                <div>
                                    <span className={styles.entityLabel}>ECG</span>
                                    <div style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Normal Sinus Rhythm</div>
                                </div>
                                <span className={styles.entitySource}>OCR: Discharge Sum.</span>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Medical Timeline */}
                <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <Clock size={18} /> Reconstructed Medical Timeline
                    </div>
                    <div style={{ padding: '10px 0' }}>
                        <div className={styles.timelineItem}>
                            <div className={styles.timelineDot}></div>
                            <div className={styles.timelineContent}>
                                <div className={styles.timelineDate}>Today, 10:15 AM</div>
                                <h4>AI Voice Intake Completed</h4>
                                <p>Patient completed symptom questionnaire in Hindi.</p>
                            </div>
                        </div>
                        <div className={styles.timelineItem}>
                            <div className={styles.timelineDot} style={{ background: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.2)' }}></div>
                            <div className={styles.timelineContent}>
                                <div className={styles.timelineDate}>Oct 2023</div>
                                <h4>Type 2 Diabetes Diagnosed</h4>
                                <p>Extracted from uploaded prescription by Dr. Mehta.</p>
                            </div>
                        </div>
                        <div className={styles.timelineItem}>
                            <div className={styles.timelineDot} style={{ background: '#3b82f6', borderColor: 'rgba(59, 130, 246, 0.2)' }}></div>
                            <div className={styles.timelineContent}>
                                <div className={styles.timelineDate}>Jan 2020</div>
                                <h4>Appendectomy</h4>
                                <p>Extracted from uploaded surgical discharge summary.</p>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ClinicalSummary;
