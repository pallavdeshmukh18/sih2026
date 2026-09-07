import styles from './PatientQueue.module.css';
import { AlertTriangle, Clock } from 'lucide-react';

const MOCK_QUEUE = [
    {
        id: 1,
        name: "Rajesh Kumar",
        age: 45,
        gender: "M",
        chiefComplaint: "Chest pain x 3 days",
        waitTime: "15 min",
        aiStatus: "completed",
        redFlags: ["Chest Pain", "Sweating"]
    },
    {
        id: 2,
        name: "Sunita Sharma",
        age: 62,
        gender: "F",
        chiefComplaint: "Severe headache and blurry vision",
        waitTime: "25 min",
        aiStatus: "completed",
        redFlags: ["Sudden Vision Loss"]
    },
    {
        id: 3,
        name: "Amit Patel",
        age: 28,
        gender: "M",
        chiefComplaint: "Fever and cough for 5 days",
        waitTime: "40 min",
        aiStatus: "completed",
        redFlags: []
    },
    {
        id: 4,
        name: "Priya Singh",
        age: 35,
        gender: "F",
        chiefComplaint: "Abdominal pain",
        waitTime: "5 min",
        aiStatus: "pending",
        redFlags: []
    }
];

const PatientQueue = ({ activePatientId, onSelectPatient }) => {
    return (
        <div className={styles.queueContainer}>
            <div className={styles.header}>
                <h2>Triage Queue <span className={styles.badge}>{MOCK_QUEUE.length}</span></h2>
            </div>
            <ul className={styles.queueList}>
                {MOCK_QUEUE.map((patient) => (
                    <li 
                        key={patient.id} 
                        className={`${styles.queueItem} ${activePatientId === patient.id ? styles.active : ''}`}
                        onClick={() => onSelectPatient(patient)}
                    >
                        <div className={styles.avatar}>
                            {patient.name.charAt(0)}
                        </div>
                        <div className={styles.patientInfo}>
                            <div className={styles.patientHeader}>
                                <span className={styles.patientName}>{patient.name}</span>
                                <span className={styles.patientDemographics}>{patient.age}y {patient.gender}</span>
                            </div>
                            <div className={styles.complaint}>
                                {patient.chiefComplaint}
                            </div>
                            {patient.redFlags.length > 0 && (
                                <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                                    {patient.redFlags.map((flag, idx) => (
                                        <span key={idx} className={styles.redFlagBadge}>
                                            <AlertTriangle size={12} />
                                            {flag}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className={styles.waitTime}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Clock size={12} /> {patient.waitTime}
                            </span>
                            {patient.aiStatus === 'completed' ? (
                                <span className={`${styles.aiStatus} ${styles.completed}`}>AI Ready</span>
                            ) : (
                                <span className={`${styles.aiStatus} ${styles.pending}`}>AI Pending</span>
                            )}
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default PatientQueue;
