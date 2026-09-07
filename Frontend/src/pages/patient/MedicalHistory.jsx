import React from 'react';
import { motion } from 'framer-motion';
import { Activity, Thermometer, ShieldAlert, Syringe } from 'lucide-react';

const MedicalHistory = () => {
    return (
        <div className="workspacePage" style={{ paddingBottom: "24px" }}>
            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                style={{ display: "flex", flexDirection: "column", gap: "24px" }}
            >
                <div style={{ marginBottom: "8px" }}>
                    <h1 style={{ fontSize: "28px", fontFamily: "var(--font-sans)", fontWeight: "700", color: "var(--color-dark)" }}>Medical History</h1>
                    <p style={{ color: "var(--color-text-muted)", marginTop: "8px" }}>Manage your allergies, conditions, and past surgeries.</p>
                </div>

                <div className="workspaceGrid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                    {/* Allergies & Conditions */}
                    <div className="workspaceCard" style={{ background: "white", padding: "24px", borderRadius: "16px", border: "1px solid var(--color-border)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
                            <div style={{ background: "#fee2e2", padding: "10px", borderRadius: "12px", color: "#ef4444" }}>
                                <ShieldAlert size={20} />
                            </div>
                            <h3 style={{ fontSize: "18px", fontWeight: "600", color: "var(--color-dark)" }}>Allergies & Conditions</h3>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                            <div className="workspaceHeader" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "16px", borderBottom: "1px solid var(--color-border)" }}>
                                <div>
                                    <h4 style={{ fontSize: "15px", fontWeight: "600", color: "var(--color-dark)" }}>Penicillin Allergy</h4>
                                    <p style={{ fontSize: "13px", color: "var(--color-text-muted)", marginTop: "4px" }}>Diagnosed: Aug 2015</p>
                                </div>
                                <span style={{ background: "#fee2e2", color: "#b91c1c", padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "600" }}>Severe</span>
                            </div>
                            <div className="workspaceHeader" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "16px", borderBottom: "1px solid var(--color-border)" }}>
                                <div>
                                    <h4 style={{ fontSize: "15px", fontWeight: "600", color: "var(--color-dark)" }}>Type 2 Diabetes</h4>
                                    <p style={{ fontSize: "13px", color: "var(--color-text-muted)", marginTop: "4px" }}>Diagnosed: Mar 2021</p>
                                </div>
                                <span style={{ background: "#e0f2fe", color: "#0369a1", padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "600" }}>Chronic</span>
                            </div>
                            <div className="workspaceHeader" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <h4 style={{ fontSize: "15px", fontWeight: "600", color: "var(--color-dark)" }}>Seasonal Asthma</h4>
                                    <p style={{ fontSize: "13px", color: "var(--color-text-muted)", marginTop: "4px" }}>Diagnosed: Apr 2018</p>
                                </div>
                                <span style={{ background: "#fef3c7", color: "#b45309", padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "600" }}>Mild</span>
                            </div>
                        </div>
                    </div>

                    {/* Current Medications */}
                    <div className="workspaceCard" style={{ background: "white", padding: "24px", borderRadius: "16px", border: "1px solid var(--color-border)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
                            <div style={{ background: "#e0e7ff", padding: "10px", borderRadius: "12px", color: "#4f46e5" }}>
                                <Syringe size={20} />
                            </div>
                            <h3 style={{ fontSize: "18px", fontWeight: "600", color: "var(--color-dark)" }}>Current Medications</h3>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                            <div style={{ padding: "16px", borderRadius: "12px", border: "1px solid var(--color-border)", background: "#f8fafc" }}>
                                <div className="workspaceHeader" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                    <h4 style={{ fontSize: "15px", fontWeight: "600", color: "var(--color-dark)" }}>Metformin</h4>
                                    <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--color-text-muted)" }}>500mg</span>
                                </div>
                                <p style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>Take 1 tablet twice daily with meals.</p>
                            </div>
                            <div style={{ padding: "16px", borderRadius: "12px", border: "1px solid var(--color-border)", background: "#f8fafc" }}>
                                <div className="workspaceHeader" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                    <h4 style={{ fontSize: "15px", fontWeight: "600", color: "var(--color-dark)" }}>Albuterol Inhaler</h4>
                                    <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--color-text-muted)" }}>90mcg</span>
                                </div>
                                <p style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>Take 2 puffs every 4-6 hours as needed.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Past Surgeries & Procedures */}
                <div className="workspaceCard" style={{ background: "white", padding: "24px", borderRadius: "16px", border: "1px solid var(--color-border)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
                        <div style={{ background: "#dcfce7", padding: "10px", borderRadius: "12px", color: "#16a34a" }}>
                            <Activity size={20} />
                        </div>
                        <h3 style={{ fontSize: "18px", fontWeight: "600", color: "var(--color-dark)" }}>Past Surgeries & Procedures</h3>
                    </div>
                    
                    <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
                        <div style={{ display: "flex", gap: "24px" }}>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "var(--color-teal)" }}></div>
                                <div style={{ width: "2px", height: "60px", background: "var(--color-border)", margin: "4px 0" }}></div>
                            </div>
                            <div style={{ paddingBottom: "32px" }}>
                                <h4 style={{ fontSize: "15px", fontWeight: "600", color: "var(--color-dark)" }}>Appendectomy</h4>
                                <p style={{ fontSize: "13px", color: "var(--color-text-muted)", marginTop: "4px" }}>Oct 12, 2018 • Dr. Sarah Jenkins</p>
                                <p style={{ fontSize: "13px", color: "var(--color-dark)", marginTop: "8px" }}>Laparoscopic removal of the appendix. No complications.</p>
                            </div>
                        </div>
                        
                        <div style={{ display: "flex", gap: "24px" }}>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "var(--color-teal)", opacity: 0.5 }}></div>
                            </div>
                            <div>
                                <h4 style={{ fontSize: "15px", fontWeight: "600", color: "var(--color-dark)" }}>Wisdom Teeth Extraction</h4>
                                <p style={{ fontSize: "13px", color: "var(--color-text-muted)", marginTop: "4px" }}>May 04, 2014 • Dr. Robert Miles</p>
                                <p style={{ fontSize: "13px", color: "var(--color-dark)", marginTop: "8px" }}>Removal of all 4 impacted wisdom teeth under general anesthesia.</p>
                            </div>
                        </div>
                    </div>
                </div>

            </motion.div>
        </div>
    );
};

export default MedicalHistory;
