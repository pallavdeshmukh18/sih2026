import styles from './PatientQueue.module.css';
import { AlertTriangle, Clock, User } from 'lucide-react';

const PatientQueue = ({ activePatientId, onSelectPatient, queue = [], loading = false }) => {
    return (
        <div className={styles.queueContainer}>
            <div className={styles.header}>
                <h2>Triage Queue <span className={styles.badge}>{queue.length}</span></h2>
            </div>
            {loading ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280', fontSize: '13px' }}>
                    Loading patient queue...
                </div>
            ) : queue.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: '#6b7280', fontSize: '13px' }}>
                    <User size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                    <p style={{ margin: 0, fontWeight: 500 }}>No patients in queue</p>
                    <small style={{ color: '#9ca3af' }}>New appointments will appear here automatically.</small>
                </div>
            ) : (
                <ul className={styles.queueList}>
                    {queue.map((patient) => (
                        <li 
                            key={patient.id || patient.appointmentId} 
                            className={`${styles.queueItem} ${activePatientId === (patient.id || patient.appointmentId) ? styles.active : ''}`}
                            onClick={() => onSelectPatient(patient)}
                        >
                            <div className={styles.avatar}>
                                {(patient.name || patient.patient?.firstName || 'P').charAt(0)}
                            </div>
                            <div className={styles.patientInfo}>
                                <div className={styles.patientHeader}>
                                    <span className={styles.patientName}>{patient.name || `${patient.patient?.firstName} ${patient.patient?.lastName || ''}`.trim()}</span>
                                    <span className={styles.patientDemographics}>
                                        {patient.age || (patient.patient?.dateOfBirth ? Math.floor((new Date() - new Date(patient.patient.dateOfBirth)) / 31557600000) + 'y' : '')} {patient.gender || patient.patient?.gender?.charAt(0)?.toUpperCase()}
                                    </span>
                                </div>
                                <div className={styles.complaint}>
                                    {patient.chiefComplaint || patient.intake?.chiefComplaint || patient.reason || 'General Consultation'}
                                </div>
                                {((patient.redFlags && patient.redFlags.length > 0) || (patient.intake?.redFlags && patient.intake.redFlags.length > 0)) && (
                                    <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                                        {(patient.redFlags || patient.intake?.redFlags || []).map((flag, idx) => (
                                            <span key={idx} className={styles.redFlagBadge}>
                                                <AlertTriangle size={12} />
                                                {typeof flag === 'string' ? flag : flag.flag || 'Red Flag'}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className={styles.waitTime}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Clock size={12} /> {patient.waitTime || (patient.scheduledAt ? new Date(patient.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Scheduled')}
                                </span>
                                {(patient.aiStatus === 'completed' || patient.intake?.status === 'completed' || patient.intake?.aiSummary) ? (
                                    <span className={`${styles.aiStatus} ${styles.completed}`}>AI Ready</span>
                                ) : (
                                    <span className={`${styles.aiStatus} ${styles.pending}`}>AI Pending</span>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default PatientQueue;
