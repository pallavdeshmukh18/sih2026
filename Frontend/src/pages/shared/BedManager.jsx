import React from 'react';
import { motion } from 'framer-motion';
import { BedDouble, CheckCircle, AlertTriangle } from 'lucide-react';

const wards = [
    { name: 'ICU Ward A', beds: [
        { id: 'A-101', status: 'Occupied' },
        { id: 'A-102', status: 'Occupied' },
        { id: 'A-103', status: 'Available' },
        { id: 'A-104', status: 'Cleaning' },
    ]},
    { name: 'General Ward B', beds: [
        { id: 'B-201', status: 'Available' },
        { id: 'B-202', status: 'Available' },
        { id: 'B-203', status: 'Occupied' },
        { id: 'B-204', status: 'Available' },
        { id: 'B-205', status: 'Occupied' },
        { id: 'B-206', status: 'Available' },
    ]},
];

const BedManager = () => {
    return (
        <div className="workspacePage" style={{ paddingBottom: "24px" }}>
            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                style={{ display: "flex", flexDirection: "column", gap: "24px" }}
            >
                <div className="workspaceHeader" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 style={{ fontSize: "28px", fontFamily: "var(--font-sans)", fontWeight: "700", color: "var(--color-dark)" }}>Bed Manager</h1>
                        <p style={{ color: "var(--color-text-muted)", marginTop: "8px" }}>Track hospital bed availability and occupancy in real-time.</p>
                    </div>
                    <div style={{ display: 'flex', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--color-dark)' }}>
                            <div style={{ width: '12px', height: '12px', borderRadius: '4px', background: '#dcfce7' }}></div> Available
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--color-dark)' }}>
                            <div style={{ width: '12px', height: '12px', borderRadius: '4px', background: '#fee2e2' }}></div> Occupied
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--color-dark)' }}>
                            <div style={{ width: '12px', height: '12px', borderRadius: '4px', background: '#fef3c7' }}></div> Cleaning
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {wards.map((ward, wIdx) => (
                        <div className="workspaceCard" key={wIdx} style={{ background: "white", padding: "24px", borderRadius: "16px", border: "1px solid var(--color-border)" }}>
                            <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--color-dark)', marginBottom: '20px' }}>{ward.name}</h3>
                            <div className="workspaceGrid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
                                {ward.beds.map((bed, bIdx) => {
                                    let bg = '#dcfce7';
                                    let color = '#166534';
                                    let icon = <CheckCircle size={20} />;
                                    if (bed.status === 'Occupied') {
                                        bg = '#fee2e2';
                                        color = '#b91c1c';
                                        icon = <BedDouble size={20} />;
                                    } else if (bed.status === 'Cleaning') {
                                        bg = '#fef3c7';
                                        color = '#b45309';
                                        icon = <AlertTriangle size={20} />;
                                    }

                                    return (
                                        <div key={bIdx} style={{ background: bg, color: color, padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            <div className="workspaceHeader" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: '16px', fontWeight: '700' }}>{bed.id}</span>
                                                {icon}
                                            </div>
                                            <span style={{ fontSize: '13px', fontWeight: '600' }}>{bed.status}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </motion.div>
        </div>
    );
};

export default BedManager;
