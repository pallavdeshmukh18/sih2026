import React from 'react';
import { motion } from 'framer-motion';
import { Stethoscope, Star, Calendar } from 'lucide-react';

const doctors = [
    { name: 'Dr. Sarah Jenkins', spec: 'Cardiology', rating: '4.9', exp: '12 Years', img: 'SJ' },
    { name: 'Dr. Robert Miles', spec: 'Dentistry', rating: '4.7', exp: '8 Years', img: 'RM' },
    { name: 'Dr. Emily Chen', spec: 'General Practice', rating: '4.8', exp: '15 Years', img: 'EC' },
    { name: 'Dr. Marcus Webb', spec: 'Neurology', rating: '4.9', exp: '20 Years', img: 'MW' },
    { name: 'Dr. Priya Patel', spec: 'Pediatrics', rating: '5.0', exp: '10 Years', img: 'PP' },
    { name: 'Dr. James Wilson', spec: 'Orthopedics', rating: '4.6', exp: '14 Years', img: 'JW' },
];

const DoctorDirectory = () => {
    return (
        <div className="workspacePage" style={{ paddingBottom: "24px" }}>
            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                style={{ display: "flex", flexDirection: "column", gap: "24px" }}
            >
                <div>
                    <h1 style={{ fontSize: "28px", fontFamily: "var(--font-sans)", fontWeight: "700", color: "var(--color-dark)" }}>Medical Professionals</h1>
                    <p style={{ color: "var(--color-text-muted)", marginTop: "8px" }}>Browse our directory of specialized doctors.</p>
                </div>

                <div className="workspaceGrid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
                    {doctors.map((doc, idx) => (
                        <div className="workspaceCard" key={idx} style={{ background: "white", padding: "24px", borderRadius: "16px", border: "1px solid var(--color-border)", display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--color-light-grey)', color: 'var(--color-teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: '700', marginBottom: '16px' }}>
                                {doc.img}
                            </div>
                            <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--color-dark)' }}>{doc.name}</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-teal)', marginTop: '6px', marginBottom: '12px' }}>
                                <Stethoscope size={14} />
                                <span style={{ fontSize: '13px', fontWeight: '500' }}>{doc.spec}</span>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                                    <Star size={14} color="#f59e0b" fill="#f59e0b" /> {doc.rating}
                                </div>
                                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                                    Exp: {doc.exp}
                                </div>
                            </div>
                            
                            <button style={{ width: '100%', background: '#f1f5f9', color: 'var(--color-dark)', padding: '10px', borderRadius: '8px', fontWeight: '600', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                <Calendar size={16} />
                                Book Visit
                            </button>
                        </div>
                    ))}
                </div>
            </motion.div>
        </div>
    );
};

export default DoctorDirectory;
