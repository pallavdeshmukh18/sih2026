import React from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { useAuth } from "../context/AuthContext";

const DoctorDashboard = () => {
    const { user, logout } = useAuth();

    return (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "#f8fafc" }}>
            <Navbar />
            <main style={{ flex: 1, padding: "120px 24px 60px", maxWidth: "1200px", margin: "0 auto", width: "100%" }}>
                <div style={{
                    background: "white",
                    borderRadius: "24px",
                    padding: "40px",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.05)",
                    border: "1px solid var(--color-border)"
                }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px", flexWrap: "wrap", gap: "16px" }}>
                        <div>
                            <span style={{
                                background: "rgba(58, 122, 133, 0.15)",
                                color: "#3a7a85",
                                padding: "6px 16px",
                                borderRadius: "20px",
                                fontSize: "13px",
                                fontWeight: "600",
                                textTransform: "uppercase"
                            }}>
                                Physician Portal
                            </span>
                            <h1 style={{ fontSize: "32px", marginTop: "12px", fontFamily: "var(--font-sans)", fontWeight: "700" }}>
                                Welcome, Dr. {user?.firstName} {user?.lastName || ""} 🩺
                            </h1>
                        </div>
                        <button
                            onClick={logout}
                            style={{
                                background: "#ef4444",
                                color: "white",
                                padding: "10px 24px",
                                borderRadius: "12px",
                                fontWeight: "600",
                                fontSize: "14px",
                                cursor: "pointer",
                                transition: "all 0.2s"
                            }}
                        >
                            Logout
                        </button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px", marginTop: "30px" }}>
                        <div style={{ background: "var(--color-light-grey)", padding: "24px", borderRadius: "16px", border: "1px solid var(--color-border)" }}>
                            <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "8px" }}>Physician Verification</h3>
                            <p style={{ fontSize: "14px", color: "var(--color-text-muted)" }}>Role: <strong style={{ color: "var(--color-dark)" }}>{user?.role}</strong></p>
                            <p style={{ fontSize: "14px", color: "var(--color-text-muted)" }}>Login Method: <strong style={{ color: "var(--color-dark)" }}>{user?.loginMethod}</strong></p>
                            <p style={{ fontSize: "14px", color: "var(--color-text-muted)" }}>Doctor ID: <span style={{ fontFamily: "monospace", fontSize: "12px" }}>{user?.id}</span></p>
                        </div>

                        <div style={{ background: "var(--color-light-grey)", padding: "24px", borderRadius: "16px", border: "1px solid var(--color-border)" }}>
                            <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "8px" }}>Clinical Workflow</h3>
                            <p style={{ fontSize: "14px", color: "var(--color-text-muted)" }}>
                                Patient consultation queue, EHR, and AI clinical decision support coming soon.
                            </p>
                        </div>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
};

export default DoctorDashboard;
