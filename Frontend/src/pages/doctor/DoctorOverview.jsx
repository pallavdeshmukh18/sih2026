import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { motion } from "framer-motion";

const DoctorOverview = () => {
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
                    Welcome, Dr. {user?.firstName} 🩺
                </h1>
                <p style={{ color: "var(--color-text-muted)", marginTop: "8px" }}>Here's an overview of your clinical schedule.</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px", marginTop: "30px" }}>
                <div style={{ background: "white", padding: "24px", borderRadius: "16px", border: "1px solid var(--color-border)" }} className="glass">
                    <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px" }}>Today's Queue</h3>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100px', background: '#f8fafc', borderRadius: '12px' }}>
                        <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>No appointments scheduled for today.</p>
                    </div>
                </div>

                <div style={{ background: "white", padding: "24px", borderRadius: "16px", border: "1px solid var(--color-border)" }} className="glass">
                    <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px" }}>Recent Authorizations</h3>
                    <p style={{ fontSize: "14px", color: "var(--color-text-muted)", lineHeight: '1.6' }}>
                        You currently have no active authorizations to view patient documents. When a patient grants you access, their records will appear in the Patient Access tab.
                    </p>
                </div>
            </div>
        </motion.div>
    );
};

export default DoctorOverview;
