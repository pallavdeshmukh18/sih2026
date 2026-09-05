import React from 'react';
import { motion } from 'framer-motion';

const DoctorAppointments = () => {
    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
        >
            <div style={{ marginBottom: "30px" }}>
                <h1 style={{ fontSize: "32px", fontFamily: "var(--font-sans)", fontWeight: "700" }}>Schedule</h1>
                <p style={{ color: "var(--color-text-muted)", marginTop: "8px" }}>Manage your patient consultations.</p>
            </div>

            <div style={{ background: "white", padding: "32px", borderRadius: "16px", border: "1px solid var(--color-border)", minHeight: '400px', display: 'flex', alignItems: 'center', justify: 'center' }}>
                <p style={{ color: 'var(--color-text-muted)' }}>Appointments Module Implementation Pending...</p>
            </div>
        </motion.div>
    );
};

export default DoctorAppointments;
