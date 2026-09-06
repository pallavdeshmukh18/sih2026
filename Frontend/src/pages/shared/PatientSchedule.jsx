import React from 'react';
import { motion } from 'framer-motion';
import { Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

const PatientSchedule = () => {
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
                        <p style={{ color: "var(--color-text-muted)", marginTop: "8px" }}>Your upcoming healthcare calendar.</p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button style={{ background: 'white', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                            <ChevronLeft size={20} color="var(--color-dark)" />
                        </button>
                        <span style={{ display: 'flex', alignItems: 'center', fontWeight: '600', fontSize: '15px' }}>October 2026</span>
                        <button style={{ background: 'white', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                            <ChevronRight size={20} color="var(--color-dark)" />
                        </button>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '24px' }}>
                    {/* Calendar Grid (Dummy) */}
                    <div style={{ background: "white", padding: "24px", borderRadius: "16px", border: "1px solid var(--color-border)", minHeight: '500px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
                            <CalendarIcon size={48} style={{ opacity: 0.2, margin: '0 auto 16px auto' }} />
                            <p>Full Month Calendar View</p>
                        </div>
                    </div>

                    {/* Upcoming Events */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--color-dark)' }}>Upcoming Events</h3>
                        
                        <div style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid var(--color-border)', borderLeft: '4px solid var(--color-teal)' }}>
                            <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-dark)', marginBottom: '8px' }}>Dr. Sarah Jenkins</h4>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                                <Clock size={14} /> Oct 15, 10:00 AM
                            </div>
                        </div>

                        <div style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid var(--color-border)', borderLeft: '4px solid #f59e0b' }}>
                            <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-dark)', marginBottom: '8px' }}>Dr. Robert Miles</h4>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                                <Clock size={14} /> Oct 22, 02:30 PM
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default PatientSchedule;
