import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, FileSearch, ShieldCheck, CheckCircle2, Search, MoreVertical, Plus, QrCode, X, Loader2, AlertCircle, UserCheck, Key, RefreshCw, Trash2, Camera, Eye, FileText, Sparkles } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { useAuth } from '../../context/AuthContext';
import { getDoctorPatients, previewPatientPairing, confirmPatientPairing, revokePatientConnection } from '../../services/api';
import PatientHistoryModal from '../../components/doctor/PatientHistoryModal';

const PatientAccess = () => {
    const { token } = useAuth();
    const [searchParams] = useSearchParams();
    const urlPatientId = searchParams.get('patientId') || searchParams.get('patient');

    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // Patient History Modal State
    const [selectedPatientForHistory, setSelectedPatientForHistory] = useState(
        urlPatientId ? { patientId: urlPatientId, patientName: 'Patient' } : null
    );

    // Modal state
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('scanner'); // 'scanner' | 'code'
    const [manualCode, setManualCode] = useState('');
    const [previewLoading, setPreviewLoading] = useState(false);
    const [confirmLoading, setConfirmLoading] = useState(false);
    const [pairError, setPairError] = useState('');
    const [patientPreview, setPatientPreview] = useState(null);
    const [scannedPayload, setScannedPayload] = useState(null);

    // Revoke state
    const [revokingId, setRevokingId] = useState(null);

    // QR scanner instance ref
    const scannerRef = useRef(null);

    const fetchPatientsList = async () => {
        if (!token) return;
        setLoading(true);
        setError('');
        try {
            const res = await getDoctorPatients(token);
            if (res.success && Array.isArray(res.patients)) {
                setPatients(res.patients);
                if (urlPatientId) {
                    const match = res.patients.find(p => String(p.id) === String(urlPatientId) || String(p.patientId) === String(urlPatientId) || String(p.userId) === String(urlPatientId));
                    if (match) {
                        setSelectedPatientForHistory({ patientId: urlPatientId, patientName: match.patientName });
                    }
                }
            } else {
                setPatients([]);
            }
        } catch (err) {
            console.error("Failed to fetch doctor patients:", err);
            setError(err.message || 'Failed to load patient list.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPatientsList();
    }, [token]);

    // Handle HTML5 QR Scanner inside modal
    useEffect(() => {
        if (!isAddModalOpen || activeTab !== 'scanner' || patientPreview) {
            if (scannerRef.current) {
                try {
                    if (scannerRef.current.isScanning) {
                        scannerRef.current.stop().catch(() => {});
                    }
                } catch (e) {}
                scannerRef.current = null;
            }
            return;
        }

        let isMounted = true;
        const elementId = "doctor-qr-reader";

        // Give DOM time to render div
        const timer = setTimeout(() => {
            const element = document.getElementById(elementId);
            if (!element || !isMounted) return;

            try {
                const html5QrCode = new Html5Qrcode(elementId);
                scannerRef.current = html5QrCode;

                html5QrCode.start(
                    { facingMode: "environment" },
                    { fps: 10, qrbox: { width: 220, height: 220 } },
                    (decodedText) => {
                        if (!isMounted) return;
                        html5QrCode.stop().then(() => {
                            handleCodeScanned(decodedText);
                        }).catch(() => {
                            handleCodeScanned(decodedText);
                        });
                    },
                    () => {}
                ).catch((err) => {
                    console.warn("Camera scanner failed to start:", err.message || err);
                });
            } catch (err) {
                console.warn("QR Scanner error:", err);
            }
        }, 300);

        return () => {
            isMounted = false;
            clearTimeout(timer);
            if (scannerRef.current) {
                try {
                    if (scannerRef.current.isScanning) {
                        scannerRef.current.stop().catch(() => {});
                    }
                } catch (e) {}
                scannerRef.current = null;
            }
        };
    }, [isAddModalOpen, activeTab, patientPreview]);

    const handleCodeScanned = (scannedText) => {
        let rawToken = scannedText;
        let pCode = scannedText;

        try {
            const parsed = JSON.parse(scannedText);
            if (parsed.token) rawToken = parsed.token;
            if (parsed.code) pCode = parsed.code;
        } catch (e) {
            // Not JSON formatted, treat as raw text token or code
        }

        triggerPreview({ token: rawToken, pairingCode: pCode });
    };

    const triggerPreview = async (payload) => {
        if (!token) return;
        setPreviewLoading(true);
        setPairError('');
        setPatientPreview(null);
        setScannedPayload(payload);

        try {
            const res = await previewPatientPairing(payload, token);
            if (res.success && res.patient) {
                setPatientPreview(res);
            } else {
                throw new Error(res.message || 'Invalid or expired QR pairing code.');
            }
        } catch (err) {
            setPairError(err.message || 'Invalid pairing code or QR token.');
        } finally {
            setPreviewLoading(false);
        }
    };

    const handleManualSubmit = (e) => {
        e.preventDefault();
        if (!manualCode.trim()) return;
        triggerPreview({ pairingCode: manualCode.trim() });
    };

    const handleConfirmPairing = async () => {
        if (!token || !scannedPayload) return;
        setConfirmLoading(true);
        setPairError('');
        try {
            const res = await confirmPatientPairing(scannedPayload, token);
            if (res.success) {
                await fetchPatientsList();
                closeModal();
            } else {
                throw new Error(res.message || 'Failed to connect patient.');
            }
        } catch (err) {
            setPairError(err.message || 'Pairing failed.');
        } finally {
            setConfirmLoading(false);
        }
    };

    const handleRevoke = async (patientId) => {
        if (!token) return;
        if (!window.confirm("Are you sure you want to revoke access to this patient's records?")) return;

        setRevokingId(patientId);
        try {
            const res = await revokePatientConnection(patientId, token);
            if (res.success) {
                await fetchPatientsList();
            }
        } catch (err) {
            alert(err.message || 'Failed to revoke access.');
        } finally {
            setRevokingId(null);
        }
    };

    const closeModal = () => {
        setIsAddModalOpen(false);
        setPatientPreview(null);
        setScannedPayload(null);
        setManualCode('');
        setPairError('');
        setActiveTab('scanner');
    };

    const filteredPatients = patients.filter((pt) => {
        const query = searchQuery.toLowerCase();
        return (
            pt.patientName?.toLowerCase().includes(query) ||
            pt.medicalId?.toLowerCase().includes(query) ||
            pt.email?.toLowerCase().includes(query) ||
            pt.phone?.includes(query)
        );
    });

    return (
        <div className="workspacePage" style={{ paddingBottom: "24px" }}>
            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                style={{ display: "flex", flexDirection: "column", gap: "24px" }}
            >
                <div className="workspaceHeader" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                        <h1 style={{ fontSize: "28px", fontFamily: "var(--font-sans)", fontWeight: "700", color: "var(--color-dark)" }}>Patients</h1>
                        <p style={{ color: "var(--color-text-muted)", marginTop: "8px" }}>Securely manage patients and access clinical records.</p>
                    </div>
                    <button 
                        onClick={() => setIsAddModalOpen(true)}
                        style={{ background: "var(--color-teal)", color: "white", padding: "10px 20px", borderRadius: "8px", fontWeight: "600", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
                    >
                        <Plus size={18} />
                        Add Patient
                    </button>
                </div>

                <div className="workspaceGrid" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>
                    {/* Patient Table */}
                    <div className="workspaceCard" style={{ background: "white", borderRadius: "16px", border: "1px solid var(--color-border)", overflow: "hidden" }}>
                        <div className="workspaceHeader" style={{ padding: "24px", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ position: 'relative', width: '320px' }}>
                                <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                                <input 
                                    type="text" 
                                    placeholder='Search patients by name, ID, or phone...'
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{ width: '100%', padding: '10px 16px 10px 42px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '14px', outline: 'none' }}
                                />
                            </div>
                            <span style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>
                                {filteredPatients.length} {filteredPatients.length === 1 ? 'patient' : 'patients'}
                            </span>
                        </div>
                        
                        <div style={{ width: "100%", overflowX: "auto" }}>
                            {loading ? (
                                <div style={{ padding: "40px", textAlign: "center", color: "var(--color-teal)" }}>
                                    <Loader2 className="animate-spin" size={28} style={{ margin: "0 auto 12px" }} />
                                    <p style={{ fontSize: "14px", color: "var(--color-text-muted)" }}>Loading connected patients...</p>
                                </div>
                            ) : error ? (
                                <div style={{ padding: "30px", textAlign: "center", color: "#dc2626" }}>
                                    <AlertCircle size={24} style={{ margin: "0 auto 8px" }} />
                                    <p>{error}</p>
                                </div>
                            ) : filteredPatients.length === 0 ? (
                                <div style={{ padding: "40px 24px", textAlign: "center", color: "var(--color-text-muted)" }}>
                                    <UserCheck size={36} style={{ opacity: 0.4, margin: "0 auto 12px" }} />
                                    <h4 style={{ fontSize: "16px", fontWeight: "600", color: "var(--color-dark)" }}>No patients connected yet</h4>
                                    <p style={{ fontSize: "13px", marginTop: "6px", maxWidth: "380px", margin: "6px auto 16px" }}>
                                        Click <strong>"Add Patient"</strong> above to scan a patient's secure QR code or enter their pairing code.
                                    </p>
                                </div>
                            ) : (
                                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                                    <thead>
                                        <tr style={{ borderBottom: "1px solid var(--color-border)", color: "var(--color-text-muted)", fontSize: "13px" }}>
                                            <th style={{ padding: "16px 24px", fontWeight: "500" }}>Patient Name</th>
                                            <th style={{ padding: "16px 24px", fontWeight: "500" }}>Gender</th>
                                            <th style={{ padding: "16px 24px", fontWeight: "500" }}>Age</th>
                                            <th style={{ padding: "16px 24px", fontWeight: "500" }}>Last Visit</th>
                                            <th style={{ padding: "16px 24px", fontWeight: "500" }}>Data Access</th>
                                            <th style={{ padding: "16px 24px", fontWeight: "500", textAlign: "right" }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredPatients.map((pt) => {
                                            const patientId = pt.patientId || pt.id || pt.userId;
                                            return (
                                                <tr 
                                                    key={pt.id || pt.relationshipId} 
                                                    style={{ borderBottom: "1px solid var(--color-border)", cursor: "pointer", transition: "background 0.15s" }}
                                                    onClick={() => setSelectedPatientForHistory({ patientId, patientName: pt.patientName })}
                                                    onMouseEnter={(e) => e.currentTarget.style.background = "#f8fafc"}
                                                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                                                >
                                                    <td style={{ padding: "16px 24px" }}>
                                                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                                            <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "600", color: "#166534", fontSize: "14px" }}>
                                                                {pt.firstName?.charAt(0)}{(pt.lastName || pt.patientName?.split(' ')[1])?.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <div style={{ fontWeight: "600", fontSize: "14px", color: "var(--color-dark)" }}>{pt.patientName}</div>
                                                                <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>{pt.medicalId}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: "16px 24px", fontSize: "14px", color: "var(--color-dark)" }}>{pt.gender}</td>
                                                    <td style={{ padding: "16px 24px", fontSize: "14px", color: "var(--color-dark)" }}>{pt.age} yrs</td>
                                                    <td style={{ padding: "16px 24px", fontSize: "14px", color: "var(--color-dark)" }}>{pt.lastVisit}</td>
                                                    <td style={{ padding: "16px 24px" }}>
                                                        <span style={{ 
                                                            background: pt.status === 'Granted' ? "#dcfce7" : "#fef9c3", 
                                                            color: pt.status === 'Granted' ? "#166534" : "#854d0e", 
                                                            padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "600",
                                                            display: "inline-flex", alignItems: "center", gap: "4px"
                                                        }}>
                                                            {pt.status === 'Granted' && <CheckCircle2 size={12} />}
                                                            {pt.status}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: "16px 24px", textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                                                        <div style={{ display: "inline-flex", gap: "8px", alignItems: "center" }}>
                                                            <button 
                                                                onClick={() => setSelectedPatientForHistory({ patientId, patientName: pt.patientName })}
                                                                title="View Patient Medical History & Clinical Triage"
                                                                style={{ background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0", padding: "6px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: "600", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "5px" }}
                                                            >
                                                                <Eye size={13} /> View History
                                                            </button>
                                                            <button 
                                                                onClick={() => handleRevoke(pt.id)}
                                                                disabled={revokingId === pt.id}
                                                                title="Revoke Access"
                                                                style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fee2e2", padding: "6px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: "600", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                                                            >
                                                                <Trash2 size={13} />
                                                                {revokingId === pt.id ? "Revoking..." : "Revoke"}
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                    {/* Security Sidebar */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div style={{ background: 'var(--color-dark)', color: 'white', padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <ShieldCheck size={28} color="var(--color-teal)" />
                            <h4 style={{ fontSize: '18px', fontWeight: '600' }}>Secure QR Architecture</h4>
                            <p style={{ fontSize: '13px', lineHeight: '1.6', opacity: 0.9 }}>
                                MediKiosk pairing QR codes contain zero patient health or demographic data. They use single-use cryptographic reference tokens expiring in 5 minutes to prevent unauthorized access.
                            </p>
                        </div>
                        
                        <div className="workspaceCard" style={{ background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', textAlign: 'center' }}>
                            <div style={{ background: '#f0fdf4', padding: '16px', borderRadius: '50%', color: '#166534' }}>
                                <QrCode size={32} />
                            </div>
                            <div>
                                <h4 style={{ fontSize: '16px', fontWeight: '600', color: "var(--color-dark)", marginBottom: '8px' }}>Patient Pairing</h4>
                                <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: '1.5' }}>Scan a patient's QR code from their Medical ID screen to connect their profile.</p>
                            </div>
                            <button 
                                onClick={() => setIsAddModalOpen(true)}
                                style={{ width: '100%', background: 'var(--color-teal)', color: 'white', border: 'none', padding: '10px 0', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                            >
                                <Plus size={16} />
                                Add Patient via QR
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Add Patient / QR Scan Modal */}
            <AnimatePresence>
                {isAddModalOpen && (
                    <div style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            style={{ background: "white", borderRadius: "20px", width: "100%", maxWidth: "460px", overflow: "hidden", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)" }}
                        >
                            {/* Modal Header */}
                            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                    <div style={{ background: "#f0fdf4", color: "#166534", padding: "8px", borderRadius: "10px" }}>
                                        <QrCode size={20} />
                                    </div>
                                    <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--color-dark)", margin: 0 }}>Add Patient</h3>
                                </div>
                                <button onClick={closeModal} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)" }}>
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div style={{ padding: "24px" }}>
                                {pairError && (
                                    <div style={{ background: "#fef2f2", border: "1px solid #fee2e2", color: "#991b1b", padding: "12px 16px", borderRadius: "10px", fontSize: "13px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                                        <AlertCircle size={16} />
                                        <span>{pairError}</span>
                                    </div>
                                )}

                                {previewLoading ? (
                                    <div style={{ padding: "40px 0", textAlign: "center", color: "var(--color-teal)" }}>
                                        <Loader2 className="animate-spin" size={32} style={{ margin: "0 auto 12px" }} />
                                        <p style={{ fontSize: "14px", fontWeight: "600", color: "var(--color-dark)" }}>Validating Pairing Code...</p>
                                        <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Verifying single-use security token...</span>
                                    </div>
                                ) : patientPreview ? (
                                    /* Patient Preview Confirmation Card */
                                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                                        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", fontWeight: "600", color: "#166534", marginBottom: "12px" }}>
                                                <ShieldCheck size={16} />
                                                <span>PATIENT PREVIEW VERIFIED</span>
                                            </div>
                                            <h4 style={{ fontSize: "18px", fontWeight: "700", color: "var(--color-dark)", margin: "0 0 4px 0" }}>
                                                {patientPreview.patient.patientName}
                                            </h4>
                                            <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: "0 0 12px 0" }}>
                                                Medical ID: <strong style={{ color: "var(--color-dark)" }}>{patientPreview.patient.medicalId}</strong>
                                            </p>

                                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "13px", color: "#334155" }}>
                                                <div>Age: <strong>{patientPreview.patient.age ? `${patientPreview.patient.age} yrs` : 'Not recorded'}</strong></div>
                                                <div>Gender: <strong>{patientPreview.patient.gender}</strong></div>
                                                <div>Region: <strong>{patientPreview.patient.state}</strong></div>
                                                <div>Lang: <strong style={{ textTransform: "capitalize" }}>{patientPreview.patient.preferredLanguage}</strong></div>
                                            </div>

                                            {patientPreview.patient.abhaIdMasked && (
                                                <div style={{ marginTop: "8px", fontSize: "12px", color: "#64748b" }}>
                                                    ABHA: <code>{patientPreview.patient.abhaIdMasked}</code>
                                                </div>
                                            )}
                                        </div>

                                        {patientPreview.alreadyConnected ? (
                                            <div style={{ background: "#fef9c3", border: "1px solid #fef08a", color: "#854d0e", padding: "12px", borderRadius: "8px", fontSize: "13px", textAlign: "center" }}>
                                                This patient is already in your active patient list.
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: "12px", color: "var(--color-text-muted)", lineHeight: "1.4" }}>
                                                Confirming will pair this patient with your account and allow you to view their longitudinal records and clinical assessments.
                                            </div>
                                        )}

                                        <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                                            <button 
                                                onClick={() => { setPatientPreview(null); setPairError(''); }}
                                                style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid var(--color-border)", background: "white", color: "var(--color-dark)", fontWeight: "600", cursor: "pointer" }}
                                            >
                                                Back
                                            </button>
                                            {!patientPreview.alreadyConnected && (
                                                <button 
                                                    onClick={handleConfirmPairing}
                                                    disabled={confirmLoading}
                                                    style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "none", background: "var(--color-teal)", color: "white", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                                                >
                                                    {confirmLoading ? <Loader2 className="animate-spin" size={16} /> : <UserCheck size={16} />}
                                                    {confirmLoading ? "Connecting..." : "Add to My Patients"}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    /* Scanner / Manual Code Tabs */
                                    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                                        {/* Tabs */}
                                        <div style={{ display: "flex", background: "#f1f5f9", padding: "4px", borderRadius: "10px" }}>
                                            <button 
                                                onClick={() => setActiveTab('scanner')}
                                                style={{ flex: 1, padding: "8px", borderRadius: "8px", border: "none", background: activeTab === 'scanner' ? "white" : "transparent", fontWeight: "600", fontSize: "13px", color: activeTab === 'scanner' ? "var(--color-dark)" : "var(--color-text-muted)", cursor: "pointer", boxShadow: activeTab === 'scanner' ? "0 1px 3px rgba(0,0,0,0.1)" : "none", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                                            >
                                                <Camera size={15} />
                                                Scan QR Code
                                            </button>
                                            <button 
                                                onClick={() => setActiveTab('code')}
                                                style={{ flex: 1, padding: "8px", borderRadius: "8px", border: "none", background: activeTab === 'code' ? "white" : "transparent", fontWeight: "600", fontSize: "13px", color: activeTab === 'code' ? "var(--color-dark)" : "var(--color-text-muted)", cursor: "pointer", boxShadow: activeTab === 'code' ? "0 1px 3px rgba(0,0,0,0.1)" : "none", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                                            >
                                                <Key size={15} />
                                                Enter Pairing Code
                                            </button>
                                        </div>

                                        {activeTab === 'scanner' ? (
                                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                                                <div 
                                                    id="doctor-qr-reader" 
                                                    style={{ width: "100%", borderRadius: "12px", overflow: "hidden", background: "#000", minHeight: "240px" }}
                                                />
                                                <p style={{ fontSize: "12px", color: "var(--color-text-muted)", textAlign: "center", margin: 0 }}>
                                                    Point camera at patient's Medical ID QR Code.
                                                </p>
                                            </div>
                                        ) : (
                                            <form onSubmit={handleManualSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                                                <div>
                                                    <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "var(--color-dark)", marginBottom: "6px" }}>
                                                        6-Digit Pairing Code
                                                    </label>
                                                    <input 
                                                        type="text" 
                                                        placeholder="e.g. MK-748291"
                                                        value={manualCode}
                                                        onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                                                        style={{ width: "100%", padding: "12px 16px", borderRadius: "8px", border: "1px solid var(--color-border)", fontSize: "16px", fontWeight: "600", letterSpacing: "1px", textTransform: "uppercase", outline: "none" }}
                                                    />
                                                </div>
                                                <button 
                                                    type="submit"
                                                    disabled={!manualCode.trim()}
                                                    style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "none", background: "var(--color-teal)", color: "white", fontWeight: "600", cursor: "pointer", opacity: manualCode.trim() ? 1 : 0.6 }}
                                                >
                                                    Preview Patient
                                                </button>
                                            </form>
                                        )}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Patient Unified Medical History & AI Triage Modal */}
            {selectedPatientForHistory && (
                <PatientHistoryModal
                    patientId={selectedPatientForHistory.patientId}
                    patientName={selectedPatientForHistory.patientName}
                    onClose={() => setSelectedPatientForHistory(null)}
                />
            )}
        </div>
    );
};

export default PatientAccess;
