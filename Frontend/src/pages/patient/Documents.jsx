import React from 'react';
import { motion } from 'framer-motion';
import { FileText, Search, Sparkles, Upload, FileSignature } from 'lucide-react';

const Documents = () => {
    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                    <h1 style={{ fontSize: '32px', fontFamily: 'var(--font-sans)', fontWeight: '700' }}>Documents & AI</h1>
                    <p style={{ color: 'var(--color-text-muted)', marginTop: '8px' }}>Manage files, view OCR extractions, and search semantically.</p>
                </div>
                <button style={{ background: 'var(--color-dark)', color: 'white', padding: '10px 20px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', border: 'none', fontWeight: '500' }}>
                    <Upload size={18} />
                    Upload Record
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '24px' }}>
                {/* Main Semantic Search Area */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid var(--color-border)' }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                            <input 
                                type="text" 
                                placeholder='Ask about your medical history (e.g. "Has the patient shown evidence of low hemoglobin?")'
                                style={{ width: '100%', padding: '16px 16px 16px 48px', borderRadius: '12px', border: '1px solid var(--color-border)', fontSize: '15px', outline: 'none' }}
                            />
                            <button style={{ position: 'absolute', right: '8px', top: '8px', background: 'var(--color-teal)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>Search</button>
                        </div>
                        <div style={{ marginTop: '24px', padding: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#4f46e5' }}>
                                <Sparkles size={18} />
                                <span style={{ fontWeight: '600', fontSize: '14px' }}>AI Summary Result</span>
                            </div>
                            <p style={{ fontSize: '14px', lineHeight: '1.6', color: 'var(--color-dark)' }}>
                                Based on your <strong>Blood_Test_Results.pdf</strong> uploaded on Oct 1, 2026:
                            </p>
                            <ul style={{ paddingLeft: '20px', marginTop: '12px', fontSize: '14px', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <li>Mildly reduced hemoglobin (11.2 g/dL)</li>
                                <li>Previous iron deficiency noted in historical chunks</li>
                                <li>WBC within reported range (7500)</li>
                            </ul>
                        </div>
                    </div>

                    <div style={{ background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid var(--color-border)' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Your Files</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {/* File 1 */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', border: '1px solid var(--color-border)', borderRadius: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <div style={{ background: '#eef2ff', padding: '12px', borderRadius: '10px', color: '#4f46e5' }}>
                                        <FileText size={24} />
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '15px', fontWeight: '600' }}>Blood_Test_Results.pdf</p>
                                        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '4px' }}>1.2 MB • Processed (32 Chunks)</p>
                                    </div>
                                </div>
                                <span style={{ background: '#dcfce7', color: '#166534', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>OCR Complete</span>
                            </div>
                            
                            {/* File 2 */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', border: '1px solid var(--color-border)', borderRadius: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <div style={{ background: '#fef3c7', padding: '12px', borderRadius: '10px', color: '#d97706' }}>
                                        <FileSignature size={24} />
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '15px', fontWeight: '600' }}>Prescription_Dermatology.jpg</p>
                                        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '4px' }}>450 KB • Extracting...</p>
                                    </div>
                                </div>
                                <span style={{ background: '#fef9c3', color: '#854d0e', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>Processing</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Side Info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ background: 'var(--color-dark)', color: 'white', padding: '24px', borderRadius: '16px' }}>
                        <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>How this works</h4>
                        <p style={{ fontSize: '13px', lineHeight: '1.6', color: '#a1a1aa' }}>
                            When you upload a document, MediKiosk extracts the text using OCR, breaks it into readable chunks, and converts them to embeddings. This allows our AI to search your documents by meaning rather than just exact keywords.
                        </p>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default Documents;
