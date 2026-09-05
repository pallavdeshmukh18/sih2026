import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { motion } from "framer-motion";

const PatientOverview = () => {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 800);
        return () => clearTimeout(timer);
    }, []);

    if (isLoading) {
        return (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px", opacity: 0.7 }}>
                <div className="skeleton skeleton-title"></div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px" }}>
                    <div className="skeleton skeleton-card"></div>
                    <div className="skeleton skeleton-card"></div>
                </div>
            </div>
        );
    }

    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
        >
            <div style={{ marginBottom: "30px" }}>
                <h1 style={{ fontSize: "32px", fontFamily: "var(--font-sans)", fontWeight: "700" }}>
                    Welcome back, {user?.firstName} 👋
                </h1>
                <p style={{ color: "var(--color-text-muted)", marginTop: "8px" }}>Here's an overview of your health portal.</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px", marginTop: "30px" }}>
                <div style={{ background: "white", padding: "24px", borderRadius: "16px", border: "1px solid var(--color-border)" }} className="glass">
                    <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px" }}>Upcoming Appointment</h3>
                    <div style={{ display: "flex", alignItems: "center", gap: "16px", background: "#f8fafc", padding: "16px", borderRadius: "12px" }}>
                        <div style={{ background: "var(--color-teal)", color: "white", width: "48px", height: "48px", borderRadius: "12px", display: "flex", flexDirection: "column", alignItems: "center", justify: "center", padding: "4px" }}>
                            <span style={{ fontSize: "12px", fontWeight: "600", textTransform: "uppercase" }}>Oct</span>
                            <span style={{ fontSize: "18px", fontWeight: "700", lineHeight: "1" }}>14</span>
                        </div>
                        <div>
                            <h4 style={{ fontSize: "15px", fontWeight: "600" }}>General Checkup</h4>
                            <p style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>Dr. Sarah Jenkins • 10:00 AM</p>
                        </div>
                    </div>
                </div>

                <div style={{ background: "white", padding: "24px", borderRadius: "16px", border: "1px solid var(--color-border)" }} className="glass">
                    <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px" }}>Recent Documents</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", border: "1px solid var(--color-border)", borderRadius: "8px" }}>
                            <div style={{ background: "#eef2ff", padding: "8px", borderRadius: "8px", color: "#4f46e5" }}>
                                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            </div>
                            <div>
                                <p style={{ fontSize: "14px", fontWeight: "600" }}>Blood_Test_Results.pdf</p>
                                <p style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Added Oct 1, 2026</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default PatientOverview;
