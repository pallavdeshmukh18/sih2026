import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, MapPin, MoreVertical, Plus } from 'lucide-react';

const doctorAppointmentsData = [
    { id: 'APT-4829', patient: 'Nevaeh Simmons', reason: 'Routine Checkup', date: 'Oct 15, 2026', time: '10:00 AM', status: 'Upcoming', type: 'In-person' },
    { id: 'APT-4830', patient: 'Guy Hawkins', reason: 'Follow-up (Surgery)', date: 'Oct 15, 2026', time: '11:30 AM', status: 'Upcoming', type: 'Virtual' },
    { id: 'APT-4710', patient: 'Darlene Robertson', reason: 'Annual Physical', date: 'Oct 15, 2026', time: '02:15 PM', status: 'Upcoming', type: 'In-person' },
    { id: 'APT-4622', patient: 'Jerome Bell', reason: 'ECG Results Review', date: 'Oct 14, 2026', time: '09:00 AM', status: 'Completed', type: 'Virtual' },
];

const DoctorAppointments = () => {
    return (
        <div style={{ paddingBottom: "24px" }}>
            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                style={{ display: "flex", flexDirection: "column", gap: "24px" }}
            >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                        <h1 style={{ fontSize: "28px", fontFamily: "var(--font-sans)", fontWeight: "700", color: "var(--color-dark)" }}>Schedule</h1>
                        <p style={{ color: "var(--color-text-muted)", marginTop: "8px" }}>Manage your patient consultations for the day.</p>
                    </div>
                    <button style={{ background: "var(--color-teal)", color: "white", padding: "10px 20px", borderRadius: "8px", fontWeight: "600", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
                        <Plus size={18} />
                        New Appointment
                    </button>
                </div>

                <div style={{ background: "white", borderRadius: "16px", border: "1px solid var(--color-border)", overflow: "hidden" }}>
                    <div style={{ padding: "24px", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <h3 style={{ fontSize: "18px", fontWeight: "600", color: "var(--color-dark)" }}>Today's Agenda</h3>
                            <span style={{ background: "#e0e7ff", color: "#4f46e5", padding: "4px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: "600" }}>4 Patients</span>
                        </div>
                        <div style={{ display: "flex", gap: "8px" }}>
                            <button style={{ padding: "6px 16px", borderRadius: "20px", background: "var(--color-dark)", color: "white", fontSize: "13px", fontWeight: "600", border: "none" }}>All</button>
                            <button style={{ padding: "6px 16px", borderRadius: "20px", background: "transparent", color: "var(--color-text-muted)", fontSize: "13px", fontWeight: "600", border: "none" }}>Upcoming</button>
                            <button style={{ padding: "6px 16px", borderRadius: "20px", background: "transparent", color: "var(--color-text-muted)", fontSize: "13px", fontWeight: "600", border: "none" }}>Completed</button>
                        </div>
                    </div>
                    
                    <div style={{ width: "100%", overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                            <thead>
                                <tr style={{ borderBottom: "1px solid var(--color-border)", color: "var(--color-text-muted)", fontSize: "13px" }}>
                                    <th style={{ padding: "16px 24px", fontWeight: "500" }}>Patient</th>
                                    <th style={{ padding: "16px 24px", fontWeight: "500" }}>Reason for Visit</th>
                                    <th style={{ padding: "16px 24px", fontWeight: "500" }}>Time</th>
                                    <th style={{ padding: "16px 24px", fontWeight: "500" }}>Type</th>
                                    <th style={{ padding: "16px 24px", fontWeight: "500" }}>Status</th>
                                    <th style={{ padding: "16px 24px", fontWeight: "500", textAlign: "right" }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {doctorAppointmentsData.map((apt, idx) => (
                                    <tr key={idx} style={{ borderBottom: "1px solid var(--color-border)" }}>
                                        <td style={{ padding: "16px 24px" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                                <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "var(--color-light-grey)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "600", color: "var(--color-teal)" }}>
                                                    {apt.patient.split(' ')[0].charAt(0)}{apt.patient.split(' ')[1]?.charAt(0)}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: "600", fontSize: "14px", color: "var(--color-dark)" }}>{apt.patient}</div>
                                                    <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>{apt.id}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: "16px 24px", fontSize: "14px", color: "var(--color-dark)" }}>{apt.reason}</td>
                                        <td style={{ padding: "16px 24px" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", color: "var(--color-dark)" }}>
                                                <Clock size={14} color="var(--color-text-muted)" /> {apt.time}
                                            </div>
                                        </td>
                                        <td style={{ padding: "16px 24px", fontSize: "14px", color: "var(--color-dark)" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                                {apt.type === 'Virtual' ? <span style={{color: '#4f46e5'}}>🌐 Virtual</span> : <span style={{color: '#059669'}}><MapPin size={14}/> In-person</span>}
                                            </div>
                                        </td>
                                        <td style={{ padding: "16px 24px" }}>
                                            <span style={{ 
                                                background: apt.status === 'Upcoming' ? "#dcfce7" : "#f1f5f9", 
                                                color: apt.status === 'Upcoming' ? "#166534" : "#475569", 
                                                padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "600" 
                                            }}>
                                                {apt.status}
                                            </span>
                                        </td>
                                        <td style={{ padding: "16px 24px", textAlign: "right" }}>
                                            <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)" }}>
                                                <MoreVertical size={20} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

            </motion.div>
        </div>
    );
};

export default DoctorAppointments;
