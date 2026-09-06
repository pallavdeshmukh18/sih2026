import React from 'react';
import { motion } from 'framer-motion';
import { Lock, FileSearch, ShieldCheck, CheckCircle2, Search, MoreVertical, Plus } from 'lucide-react';

const patientAccessData = [
    { id: '#4928173', name: 'Nevaeh Simmons', gender: 'Female', age: 23, lastVisit: 'Oct 10, 2026', status: 'Granted' },
    { id: '#4928174', name: 'Guy Hawkins', gender: 'Male', age: 45, lastVisit: 'Sep 28, 2026', status: 'Granted' },
    { id: '#4928175', name: 'Darlene Robertson', gender: 'Female', age: 31, lastVisit: 'Aug 15, 2026', status: 'Pending' },
    { id: '#4928176', name: 'Jerome Bell', gender: 'Male', age: 58, lastVisit: 'Jul 02, 2026', status: 'Granted' },
];

const PatientAccess = () => {
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
                        <h1 style={{ fontSize: "28px", fontFamily: "var(--font-sans)", fontWeight: "700", color: "var(--color-dark)" }}>Patients</h1>
                        <p style={{ color: "var(--color-text-muted)", marginTop: "8px" }}>Securely manage patients and access clinical records.</p>
                    </div>
                    <button style={{ background: "var(--color-teal)", color: "white", padding: "10px 20px", borderRadius: "8px", fontWeight: "600", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
                        <Plus size={18} />
                        Add Patient
                    </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>
                    {/* Patient Table */}
                    <div style={{ background: "white", borderRadius: "16px", border: "1px solid var(--color-border)", overflow: "hidden" }}>
                        <div style={{ padding: "24px", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ position: 'relative', width: '300px' }}>
                                <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                                <input 
                                    type="text" 
                                    placeholder='Search patients by name or ID'
                                    style={{ width: '100%', padding: '10px 16px 10px 42px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '14px', outline: 'none' }}
                                />
                            </div>
                        </div>
                        
                        <div style={{ width: "100%", overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                                <thead>
                                    <tr style={{ borderBottom: "1px solid var(--color-border)", color: "var(--color-text-muted)", fontSize: "13px" }}>
                                        <th style={{ padding: "16px 24px", fontWeight: "500" }}>Patient Name</th>
                                        <th style={{ padding: "16px 24px", fontWeight: "500" }}>Gender</th>
                                        <th style={{ padding: "16px 24px", fontWeight: "500" }}>Age</th>
                                        <th style={{ padding: "16px 24px", fontWeight: "500" }}>Last Visit</th>
                                        <th style={{ padding: "16px 24px", fontWeight: "500" }}>Data Access</th>
                                        <th style={{ padding: "16px 24px", fontWeight: "500", textAlign: "right" }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {patientAccessData.map((pt, idx) => (
                                        <tr key={idx} style={{ borderBottom: "1px solid var(--color-border)" }}>
                                            <td style={{ padding: "16px 24px" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                                    <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "var(--color-light-grey)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "600", color: "var(--color-teal)" }}>
                                                        {pt.name.split(' ')[0].charAt(0)}{pt.name.split(' ')[1]?.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: "600", fontSize: "14px", color: "var(--color-dark)" }}>{pt.name}</div>
                                                        <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>{pt.id}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: "16px 24px", fontSize: "14px", color: "var(--color-dark)" }}>{pt.gender}</td>
                                            <td style={{ padding: "16px 24px", fontSize: "14px", color: "var(--color-dark)" }}>{pt.age}</td>
                                            <td style={{ padding: "16px 24px", fontSize: "14px", color: "var(--color-dark)" }}>{pt.lastVisit}</td>
                                            <td style={{ padding: "16px 24px" }}>
                                                <span style={{ 
                                                    background: pt.status === 'Granted' ? "#dcfce7" : "#fef9c3", 
                                                    color: pt.status === 'Granted' ? "#166534" : "#854d0e", 
                                                    padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "600",
                                                    display: "inline-flex", alignItems: "center", gap: "4px"
                                                }}>
                                                    {pt.status === 'Granted' && <CheckCircle2 size={12} />}
                                                    {pt.status}
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

                    {/* Security Sidebar */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div style={{ background: 'var(--color-dark)', color: 'white', padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <ShieldCheck size={28} color="var(--color-teal)" />
                            <h4 style={{ fontSize: '18px', fontWeight: '600' }}>Security Architecture</h4>
                            <p style={{ fontSize: '13px', lineHeight: '1.6', opacity: 0.9 }}>
                                MediKiosk uses Row Level Security (RLS) to ensure that clinical records remain private. Only authorized users with valid consent tokens can query a patient's document embeddings or AI summaries.
                            </p>
                        </div>
                        
                        <div style={{ background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', textAlign: 'center' }}>
                            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '50%', color: 'var(--color-text-muted)' }}>
                                <Lock size={32} />
                            </div>
                            <div>
                                <h4 style={{ fontSize: '16px', fontWeight: '600', color: "var(--color-dark)", marginBottom: '8px' }}>Request Access</h4>
                                <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: '1.5' }}>Need access to a patient's historical records? Send them a consent request.</p>
                            </div>
                            <button style={{ width: '100%', background: '#f1f5f9', color: 'var(--color-dark)', border: 'none', padding: '10px 0', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                <FileSearch size={16} />
                                Request Consent
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default PatientAccess;
