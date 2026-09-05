import React from 'react';
import { motion } from 'framer-motion';
import { Lock, FileSearch, ShieldCheck } from 'lucide-react';

const PatientAccess = () => {
    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
        >
            <div style={{ marginBottom: "30px" }}>
                <h1 style={{ fontSize: "32px", fontFamily: "var(--font-sans)", fontWeight: "700" }}>Patient Access</h1>
                <p style={{ color: "var(--color-text-muted)", marginTop: "8px" }}>Securely access documents for patients who have granted you authorization.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '24px' }}>
                <div style={{ background: "white", padding: "32px", borderRadius: "16px", border: "1px solid var(--color-border)", minHeight: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justify: 'center', textAlign: 'center' }}>
                    <div style={{ background: '#f8fafc', padding: '24px', borderRadius: '50%', marginBottom: '24px' }}>
                        <Lock size={48} color="var(--color-text-muted)" />
                    </div>
                    <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '12px' }}>No Active Authorizations</h3>
                    <p style={{ color: 'var(--color-text-muted)', maxWidth: '400px', lineHeight: '1.6' }}>
                        Patient privacy is our priority. Appointment access does not automatically grant document access. Patients must explicitly consent to share their documents with you.
                    </p>
                    <button style={{ marginTop: '24px', background: 'var(--color-dark)', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '8px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileSearch size={18} />
                        Request Patient Access
                    </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ background: 'var(--color-teal)', color: 'white', padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <ShieldCheck size={28} />
                        <h4 style={{ fontSize: '16px', fontWeight: '600' }}>Security Architecture</h4>
                        <p style={{ fontSize: '13px', lineHeight: '1.6', opacity: 0.9 }}>
                            MediKiosk uses Row Level Security (RLS) to ensure that clinical records remain private. Only authorized users with valid consent tokens can query a patient's document embeddings or AI summaries.
                        </p>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default PatientAccess;
