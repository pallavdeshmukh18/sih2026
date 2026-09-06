import React from 'react';
import { motion } from 'framer-motion';
import { Construction } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const ComingSoon = () => {
    const location = useLocation();
    
    // Format the path nicely (e.g. "/patient/bed-manager" -> "Bed Manager")
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const featureName = pathSegments[pathSegments.length - 1]
        ? pathSegments[pathSegments.length - 1].split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
        : 'Feature';

    return (
        <div style={{ paddingBottom: "24px", height: "100%", display: "flex", flexDirection: "column" }}>
            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                style={{ flex: 1, display: "flex", flexDirection: "column", gap: "24px" }}
            >
                <div>
                    <h1 style={{ fontSize: "28px", fontFamily: "var(--font-sans)", fontWeight: "700", color: "var(--color-dark)" }}>{featureName}</h1>
                    <p style={{ color: "var(--color-text-muted)", marginTop: "8px" }}>This module is currently under development.</p>
                </div>

                <div style={{ background: "white", borderRadius: "16px", border: "1px solid var(--color-border)", flex: 1, minHeight: "400px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "40px" }}>
                    <div style={{ background: "#f8fafc", padding: "24px", borderRadius: "50%", marginBottom: "24px", color: "var(--color-teal)" }}>
                        <Construction size={48} />
                    </div>
                    <h3 style={{ fontSize: "20px", fontWeight: "600", color: "var(--color-dark)", marginBottom: "12px" }}>Coming Soon</h3>
                    <p style={{ color: "var(--color-text-muted)", maxWidth: "400px", lineHeight: "1.6" }}>
                        The <strong>{featureName}</strong> module is currently being built by our team. Check back soon for updates!
                    </p>
                </div>
            </motion.div>
        </div>
    );
};

export default ComingSoon;
