import React from 'react';
import { motion } from 'framer-motion';
import { HeartPulse, Brain, Baby, Bone, Eye, Activity, Users } from 'lucide-react';

const depts = [
    { name: 'Cardiology', head: 'Dr. Sarah Jenkins', patients: 142, icon: HeartPulse, color: '#ef4444', bg: '#fee2e2' },
    { name: 'Neurology', head: 'Dr. Marcus Webb', patients: 84, icon: Brain, color: '#8b5cf6', bg: '#ede9fe' },
    { name: 'Pediatrics', head: 'Dr. Priya Patel', patients: 215, icon: Baby, color: '#f59e0b', bg: '#fef3c7' },
    { name: 'Orthopedics', head: 'Dr. James Wilson', patients: 110, icon: Bone, color: '#3b82f6', bg: '#dbeafe' },
    { name: 'Ophthalmology', head: 'Dr. Lisa Ray', patients: 95, icon: Eye, color: '#10b981', bg: '#d1fae5' },
    { name: 'General Practice', head: 'Dr. Emily Chen', patients: 430, icon: Activity, color: '#0ea5e9', bg: '#e0f2fe' },
];

const Departments = () => {
    return (
        <div className="workspacePage" style={{ paddingBottom: "24px" }}>
            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                style={{ display: "flex", flexDirection: "column", gap: "24px" }}
            >
                <div>
                    <h1 style={{ fontSize: "28px", fontFamily: "var(--font-sans)", fontWeight: "700", color: "var(--color-dark)" }}>Departments</h1>
                    <p style={{ color: "var(--color-text-muted)", marginTop: "8px" }}>Explore hospital departments and specializations.</p>
                </div>

                <div className="workspaceGrid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
                    {depts.map((dept, idx) => (
                        <div className="workspaceCard" key={idx} style={{ background: "white", padding: "24px", borderRadius: "16px", border: "1px solid var(--color-border)", display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                                <div style={{ background: dept.bg, color: dept.color, width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <dept.icon size={24} />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--color-dark)' }}>{dept.name}</h3>
                                    <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '2px' }}>Head: {dept.head}</p>
                                </div>
                            </div>
                            
                            <div className="workspaceHeader" style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-dark)', fontSize: '14px', fontWeight: '500' }}>
                                    <Users size={16} color="var(--color-text-muted)" />
                                    Active Patients
                                </div>
                                <span style={{ fontWeight: '600', color: 'var(--color-teal)' }}>{dept.patients}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </motion.div>
        </div>
    );
};

export default Departments;
