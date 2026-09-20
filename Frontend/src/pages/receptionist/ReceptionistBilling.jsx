import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    CreditCard, Search, Filter, RefreshCw, Plus, CheckCircle2, 
    Clock, RotateCcw, Printer, DollarSign, Stethoscope, 
    AlertCircle, FileText, QrCode, Smartphone, Banknote, X
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { 
    fetchReceptionistBilling, 
    fetchReceptionistBillingStats, 
    createReceptionistInvoice, 
    collectInvoicePayment, 
    refundInvoice,
    fetchPublicDoctors 
} from "../../services/api";
import toast from "react-hot-toast";
import styles from "./ReceptionistBilling.module.css";

const SERVICE_TYPES = [
    "OPD Consultation Fee",
    "Specialist Consultation",
    "Follow-up Consultation",
    "Emergency Triage Fee",
    "Diagnostic Investigation",
    "Minor Procedure / Dressing"
];

export default function ReceptionistBilling() {
    const { token } = useAuth();

    // Data States
    const [invoices, setInvoices] = useState([]);
    const [stats, setStats] = useState({
        totalRevenue: 0,
        pendingAmount: 0,
        paidCount: 0,
        pendingCount: 0,
        refundedCount: 0,
        refundedAmount: 0,
        totalInvoices: 0
    });
    const [doctors, setDoctors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filter States
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedStatus, setSelectedStatus] = useState("all");
    const [selectedDoctor, setSelectedDoctor] = useState("all");
    const [selectedMethod, setSelectedMethod] = useState("all");
    const [selectedDate, setSelectedDate] = useState("");

    // Modal States
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createForm, setCreateForm] = useState({
        patientId: "",
        doctorId: "",
        serviceType: "OPD Consultation Fee",
        amount: "500",
        paymentStatus: "paid",
        paymentMethod: "Cash",
        notes: ""
    });
    const [submittingCreate, setSubmittingCreate] = useState(false);

    // Collect Payment Modal States
    const [showPayModal, setShowPayModal] = useState(false);
    const [payTarget, setPayTarget] = useState(null);
    const [payMethod, setPayMethod] = useState("UPI");
    const [submittingPay, setSubmittingPay] = useState(false);

    // Receipt Modal States
    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const [receiptTarget, setReceiptTarget] = useState(null);

    // Refund Modal States
    const [showRefundModal, setShowRefundModal] = useState(false);
    const [refundTarget, setRefundTarget] = useState(null);
    const [refundAmount, setRefundAmount] = useState("");
    const [refundReason, setRefundReason] = useState("Patient requested cancellation");
    const [submittingRefund, setSubmittingRefund] = useState(false);

    const loadBillingData = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        try {
            const params = {
                date: selectedDate || undefined,
                doctorId: selectedDoctor !== "all" ? selectedDoctor : undefined,
                status: selectedStatus !== "all" ? selectedStatus : undefined,
                paymentMethod: selectedMethod !== "all" ? selectedMethod : undefined,
                search: searchQuery.trim() || undefined
            };

            const [billingRes, statsRes, docsRes] = await Promise.all([
                fetchReceptionistBilling(params, token),
                fetchReceptionistBillingStats(token).catch(() => ({ stats: {} })),
                fetchPublicDoctors(token).catch(() => ({ doctors: [] }))
            ]);

            if (billingRes?.invoices) {
                setInvoices(billingRes.invoices);
            }
            if (statsRes?.stats) {
                setStats(statsRes.stats);
            }
            if (docsRes?.doctors) {
                setDoctors(docsRes.doctors);
            }
        } catch (err) {
            toast.error(err.message || "Failed to load billing records.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadBillingData();
    }, [selectedStatus, selectedDoctor, selectedMethod, selectedDate, token]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        loadBillingData();
    };

    // Quick open Create Invoice Modal
    const handleOpenCreateModal = () => {
        setCreateForm({
            patientId: "",
            doctorId: doctors[0]?.id || "",
            serviceType: "OPD Consultation Fee",
            amount: "500",
            paymentStatus: "paid",
            paymentMethod: "Cash",
            notes: ""
        });
        setShowCreateModal(true);
    };

    // Submit Create Invoice
    const handleConfirmCreate = async (e) => {
        e.preventDefault();
        if (!createForm.patientId || !createForm.amount) {
            toast.error("Please enter patient details and fee amount.");
            return;
        }

        setSubmittingCreate(true);
        try {
            await createReceptionistInvoice(createForm, token);
            toast.success("Billing invoice created successfully.");
            setShowCreateModal(false);
            loadBillingData();
        } catch (err) {
            toast.error(err.message || "Failed to create invoice.");
        } finally {
            setSubmittingCreate(false);
        }
    };

    // Open Collect Payment Modal
    const handleOpenPay = (inv) => {
        setPayTarget(inv);
        setPayMethod("UPI");
        setShowPayModal(true);
    };

    // Submit Collect Payment
    const handleConfirmPayment = async (e) => {
        e.preventDefault();
        if (!payTarget) return;

        setSubmittingPay(true);
        try {
            await collectInvoicePayment(payTarget.id, { paymentMethod: payMethod }, token);
            toast.success(`Payment of ₹${payTarget.totalAmount} collected via ${payMethod}.`);
            setShowPayModal(false);
            loadBillingData();
        } catch (err) {
            toast.error(err.message || "Failed to collect payment.");
        } finally {
            setSubmittingPay(false);
        }
    };

    // Open Receipt Modal
    const handleOpenReceipt = (inv) => {
        setReceiptTarget(inv);
        setShowReceiptModal(true);
    };

    // Open Refund Modal
    const handleOpenRefund = (inv) => {
        setRefundTarget(inv);
        setRefundAmount(inv.totalAmount);
        setRefundReason("Patient requested cancellation / doctor unavailable");
        setShowRefundModal(true);
    };

    // Submit Refund
    const handleConfirmRefund = async (e) => {
        e.preventDefault();
        if (!refundTarget) return;

        setSubmittingRefund(true);
        try {
            await refundInvoice(refundTarget.id, {
                refundAmount: parseFloat(refundAmount),
                reason: refundReason
            }, token);
            toast.success(`Refund of ₹${refundAmount} recorded successfully.`);
            setShowRefundModal(false);
            loadBillingData();
        } catch (err) {
            toast.error(err.message || "Failed to process refund.");
        } finally {
            setSubmittingRefund(false);
        }
    };

    return (
        <div className={styles.container}>
            {/* Top Bar */}
            <div className={styles.header}>
                <div>
                    <div className={styles.titleWithIcon}>
                        <CreditCard size={28} color="#0d9488" />
                        <h1 className={styles.title}>Billing & Payments</h1>
                    </div>
                    <p className={styles.subtitle}>
                        Consultation fee, invoices, payment status, receipts, refunds
                    </p>
                </div>
                <div className={styles.headerButtons}>
                    <button 
                        className={styles.secondaryBtn}
                        onClick={() => loadBillingData(true)}
                        disabled={refreshing}
                        title="Reload billing data"
                    >
                        <RefreshCw size={15} className={refreshing ? styles.spinner : ""} />
                        <span>Refresh</span>
                    </button>
                    <button 
                        className={styles.primaryBtn}
                        onClick={handleOpenCreateModal}
                    >
                        <span>Add Invoice / Bill</span>
                    </button>
                </div>
            </div>

            {/* Overview Stats Cards */}
            <div className={styles.statsGrid}>
                <div className={`${styles.statCard} ${styles.statRevenue}`}>
                    <div className={styles.statIconWrapper}>
                        <DollarSign size={24} />
                    </div>
                    <div className={styles.statInfo}>
                        <span className={styles.statLabel}>Total Collected</span>
                        <span className={styles.statValue}>₹{(stats.totalRevenue || 0).toLocaleString("en-IN")}</span>
                        <span className={styles.statMeta}>{stats.paidCount || 0} invoices settled</span>
                    </div>
                </div>

                <div className={`${styles.statCard} ${styles.statPending}`}>
                    <div className={styles.statIconWrapper}>
                        <Clock size={24} />
                    </div>
                    <div className={styles.statInfo}>
                        <span className={styles.statLabel}>Pending Dues</span>
                        <span className={styles.statValue}>₹{(stats.pendingAmount || 0).toLocaleString("en-IN")}</span>
                        <span className={styles.statMeta}>{stats.pendingCount || 0} unpaid bills</span>
                    </div>
                </div>

                <div className={`${styles.statCard} ${styles.statPaid}`}>
                    <div className={styles.statIconWrapper}>
                        <CheckCircle2 size={24} />
                    </div>
                    <div className={styles.statInfo}>
                        <span className={styles.statLabel}>Paid Invoices</span>
                        <span className={styles.statValue}>{stats.paidCount || 0}</span>
                        <span className={styles.statMeta}>{(stats.totalInvoices || 0)} total generated</span>
                    </div>
                </div>

                <div className={`${styles.statCard} ${styles.statRefund}`}>
                    <div className={styles.statIconWrapper}>
                        <RotateCcw size={24} />
                    </div>
                    <div className={styles.statInfo}>
                        <span className={styles.statLabel}>Refunds Processed</span>
                        <span className={styles.statValue}>₹{(stats.refundedAmount || 0).toLocaleString("en-IN")}</span>
                        <span className={styles.statMeta}>{stats.refundedCount || 0} cases refunded</span>
                    </div>
                </div>
            </div>

            {/* Filter & Search Bar Strip (Patient Queue Layout) */}
            <div className={styles.filterCard}>
                <form onSubmit={handleSearchSubmit} className={styles.searchBarRow}>
                    <div className={styles.searchContainer}>
                        <Search size={18} className={styles.searchIcon} />
                        <input 
                            type="text"
                            placeholder="Search patient name, phone number, doctor, or invoice #..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={styles.searchInput}
                        />
                        {searchQuery && (
                            <button 
                                type="button" 
                                className={styles.clearSearchBtn}
                                onClick={() => { setSearchQuery(""); loadBillingData(); }}
                            >
                                ✕
                            </button>
                        )}
                    </div>
                    <button type="submit" className={styles.secondaryBtn}>
                        Search
                    </button>
                </form>

                <div className={styles.filtersRow}>
                    {/* Status Tabs */}
                    <div className={styles.statusTabs}>
                        <button 
                            className={`${styles.statusTab} ${selectedStatus === 'all' ? styles.activeStatusTab : ''}`}
                            onClick={() => setSelectedStatus('all')}
                        >
                            All
                            <span className={styles.tabBadge}>{stats.totalInvoices || invoices.length}</span>
                        </button>
                        <button 
                            className={`${styles.statusTab} ${selectedStatus === 'pending' ? styles.activeStatusTab : ''}`}
                            onClick={() => setSelectedStatus('pending')}
                        >
                            Pending
                            <span className={styles.tabBadge}>{stats.pendingCount || 0}</span>
                        </button>
                        <button 
                            className={`${styles.statusTab} ${selectedStatus === 'paid' ? styles.activeStatusTab : ''}`}
                            onClick={() => setSelectedStatus('paid')}
                        >
                            Paid
                            <span className={styles.tabBadge}>{stats.paidCount || 0}</span>
                        </button>
                        <button 
                            className={`${styles.statusTab} ${selectedStatus === 'refunded' ? styles.activeStatusTab : ''}`}
                            onClick={() => setSelectedStatus('refunded')}
                        >
                            Refunded
                            <span className={styles.tabBadge}>{stats.refundedCount || 0}</span>
                        </button>
                    </div>

                    {/* Filter Dropdowns */}
                    <div className={styles.dropdownGroup}>
                        <select 
                            value={selectedDoctor} 
                            onChange={(e) => setSelectedDoctor(e.target.value)}
                            className={styles.selectInput}
                        >
                            <option value="all">All Doctors</option>
                            {doctors.map(d => (
                                <option key={d.id} value={d.id}>
                                    {d.name} ({d.specialization || 'OPD'})
                                </option>
                            ))}
                        </select>

                        <select 
                            value={selectedMethod} 
                            onChange={(e) => setSelectedMethod(e.target.value)}
                            className={styles.selectInput}
                        >
                            <option value="all">All Payment Methods</option>
                            <option value="Cash">Cash</option>
                            <option value="UPI">UPI</option>
                            <option value="Card">Card</option>
                            <option value="Insurance/TPA">Insurance / TPA</option>
                        </select>

                        <input 
                            type="date" 
                            value={selectedDate} 
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className={styles.dateInput}
                            title="Filter by Invoice Date"
                        />
                        {selectedDate && (
                            <button 
                                className={styles.secondaryBtn} 
                                onClick={() => setSelectedDate("")}
                                style={{ padding: "7px 10px" }}
                            >
                                Clear Date
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Invoices Roster Table */}
            <div className={styles.tableCard}>
                <div className={styles.tableHeader}>
                    <span className={styles.tableCount}>
                        Showing {invoices.length} invoices
                    </span>
                </div>

                {loading ? (
                    <div className={styles.loadingState}>
                        <RefreshCw size={24} className={styles.spinner} />
                        <p>Loading patient billing roster...</p>
                    </div>
                ) : invoices.length === 0 ? (
                    <div className={styles.emptyState}>
                        <FileText size={42} color="#cbd5e1" style={{ marginBottom: 12 }} />
                        <h3>No Invoices Found</h3>
                        <p>No billing records match your selected filters or search query.</p>
                    </div>
                ) : (
                    <div className={styles.tableResponsive}>
                        <table className={styles.invoicesTable}>
                            <thead>
                                <tr>
                                    <th>Patient Details</th>
                                    <th>Attending Doctor</th>
                                    <th>Invoice # & Date</th>
                                    <th>Service & Fee</th>
                                    <th>Status</th>
                                    <th>Method</th>
                                    <th style={{ textAlign: "right" }}>Actions Beside Queue</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoices.map((inv) => {
                                    const isPaid = inv.paymentStatus === "paid";
                                    const isPending = inv.paymentStatus === "pending";
                                    const isRefunded = inv.paymentStatus === "refunded";
                                    const dateObj = new Date(inv.createdAt);
                                    const dateStr = dateObj.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
                                    const timeStr = dateObj.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

                                    return (
                                        <tr key={inv.id}>
                                            {/* Patient Column */}
                                            <td>
                                                <div className={styles.patientCell}>
                                                    <div className={styles.avatar}>
                                                        {inv.patient?.name?.[0] || "P"}
                                                    </div>
                                                    <div>
                                                        <span className={styles.patientName}>{inv.patient?.name}</span>
                                                        <span className={styles.subText}>
                                                            {inv.patient?.phone || "No phone"} · {inv.patient?.gender || "N/A"}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Doctor Column */}
                                            <td>
                                                <div className={styles.doctorCell}>
                                                    <Stethoscope size={14} color="#0284c7" />
                                                    <div>
                                                        <span className={styles.doctorName}>{inv.doctor?.name}</span>
                                                        <span className={styles.subText}>{inv.doctor?.specialization}</span>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Invoice Number & Date Column */}
                                            <td>
                                                <div>
                                                    <span className={styles.invoiceNumCell}>{inv.invoiceNumber}</span>
                                                    <span className={styles.subText}>{dateStr} · {timeStr}</span>
                                                </div>
                                            </td>

                                            {/* Service & Fee Column */}
                                            <td>
                                                <div className={styles.serviceCell}>
                                                    <span className={styles.serviceTitle}>{inv.serviceType || "OPD Consultation Fee"}</span>
                                                    <span className={styles.amountText}>₹{inv.totalAmount?.toLocaleString("en-IN")}</span>
                                                </div>
                                            </td>

                                            {/* Status Badge */}
                                            <td>
                                                <span className={`
                                                    ${styles.statusBadge}
                                                    ${isPaid ? styles.statusPaid : isPending ? styles.statusPending : styles.statusRefunded}
                                                `}>
                                                    {isPaid && <CheckCircle2 size={12} />}
                                                    {isPending && <Clock size={12} />}
                                                    {isRefunded && <RotateCcw size={12} />}
                                                    {inv.paymentStatus ? inv.paymentStatus.toUpperCase() : "PENDING"}
                                                </span>
                                            </td>

                                            {/* Method Column */}
                                            <td>
                                                <span className={styles.methodBadge}>
                                                    {inv.paymentMethod || "Cash"}
                                                </span>
                                            </td>

                                            {/* Action Options Beside Row */}
                                            <td style={{ textAlign: "right" }}>
                                                <div className={styles.actionBtnGroup}>
                                                    {/* Collect Payment (for pending bills) */}
                                                    {isPending && (
                                                        <button 
                                                            className={styles.collectBtn}
                                                            onClick={() => handleOpenPay(inv)}
                                                            title="Collect Payment now"
                                                        >
                                                            <CreditCard size={13} />
                                                            Collect
                                                        </button>
                                                    )}

                                                    {/* View / Print Receipt */}
                                                    <button 
                                                        className={styles.receiptBtn}
                                                        onClick={() => handleOpenReceipt(inv)}
                                                        title="View & Print Official Receipt"
                                                    >
                                                        <Printer size={13} />
                                                        Receipt
                                                    </button>

                                                    {/* Refund Action (for paid bills) */}
                                                    {isPaid && (
                                                        <button 
                                                            className={styles.refundBtn}
                                                            onClick={() => handleOpenRefund(inv)}
                                                            title="Process fee refund"
                                                        >
                                                            <RotateCcw size={13} />
                                                            Refund
                                                        </button>
                                                    )}

                                                    {isRefunded && (
                                                        <span style={{ fontSize: "11px", color: "#dc2626", fontWeight: 600 }}>
                                                            Refunded ₹{inv.refundAmount}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* MODAL 1: Create New Invoice */}
            {showCreateModal && (
                <div className={styles.modalOverlay} onClick={() => setShowCreateModal(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>
                                <CreditCard size={20} color="#0d9488" />
                                Create Bill / Invoice
                            </h2>
                            <button className={styles.closeBtn} onClick={() => setShowCreateModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleConfirmCreate}>
                            <div className={styles.modalBody}>
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Patient (Name, Phone, or UUID) *</label>
                                    <input 
                                        type="text" 
                                        required 
                                        placeholder="e.g. Ramesh Kumar or 9876543210"
                                        value={createForm.patientId}
                                        onChange={(e) => setCreateForm({...createForm, patientId: e.target.value})}
                                        className={styles.formInput}
                                    />
                                </div>

                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Attending Doctor *</label>
                                    <select 
                                        value={createForm.doctorId}
                                        onChange={(e) => setCreateForm({...createForm, doctorId: e.target.value})}
                                        className={styles.formSelect}
                                    >
                                        <option value="">Select Doctor</option>
                                        {doctors.map(d => (
                                            <option key={d.id} value={d.id}>
                                                {d.name} ({d.specialization || 'OPD'})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Service Type</label>
                                    <select 
                                        value={createForm.serviceType}
                                        onChange={(e) => setCreateForm({...createForm, serviceType: e.target.value})}
                                        className={styles.formSelect}
                                    >
                                        {SERVICE_TYPES.map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className={styles.formRow}>
                                    <div className={styles.formGroup}>
                                        <label className={styles.formLabel}>Consultation Fee (₹) *</label>
                                        <input 
                                            type="number" 
                                            required 
                                            min="0"
                                            value={createForm.amount}
                                            onChange={(e) => setCreateForm({...createForm, amount: e.target.value})}
                                            className={styles.formInput}
                                        />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label className={styles.formLabel}>Payment Status</label>
                                        <select 
                                            value={createForm.paymentStatus}
                                            onChange={(e) => setCreateForm({...createForm, paymentStatus: e.target.value})}
                                            className={styles.formSelect}
                                        >
                                            <option value="paid">Paid (Collected)</option>
                                            <option value="pending">Pending</option>
                                        </select>
                                    </div>
                                </div>

                                {createForm.paymentStatus === "paid" && (
                                    <div className={styles.formGroup}>
                                        <label className={styles.formLabel}>Payment Method</label>
                                        <select 
                                            value={createForm.paymentMethod}
                                            onChange={(e) => setCreateForm({...createForm, paymentMethod: e.target.value})}
                                            className={styles.formSelect}
                                        >
                                            <option value="Cash">Cash</option>
                                            <option value="UPI">UPI</option>
                                            <option value="Card">Card</option>
                                            <option value="Insurance/TPA">Insurance / TPA</option>
                                        </select>
                                    </div>
                                )}

                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Notes / Billing Remarks (Optional)</label>
                                    <input 
                                        type="text" 
                                        placeholder="e.g. Follow-up discount applied"
                                        value={createForm.notes}
                                        onChange={(e) => setCreateForm({...createForm, notes: e.target.value})}
                                        className={styles.formInput}
                                    />
                                </div>
                            </div>

                            <div className={styles.modalFooter}>
                                <button 
                                    type="button" 
                                    className={styles.cancelModalBtn}
                                    onClick={() => setShowCreateModal(false)}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className={styles.submitModalBtn}
                                    disabled={submittingCreate}
                                >
                                    {submittingCreate ? "Creating..." : "Generate Invoice"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 2: Collect Payment */}
            {showPayModal && payTarget && (
                <div className={styles.modalOverlay} onClick={() => setShowPayModal(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>
                                <CreditCard size={20} color="#16a34a" />
                                Collect Payment
                            </h2>
                            <button className={styles.closeBtn} onClick={() => setShowPayModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleConfirmPayment}>
                            <div className={styles.modalBody}>
                                <div className={styles.paymentDueBox}>
                                    <div className={styles.paymentDueLabel}>
                                        Fee Due for {payTarget.patient?.name} ({payTarget.invoiceNumber})
                                    </div>
                                    <div className={styles.paymentDueAmount}>
                                        ₹{payTarget.totalAmount?.toLocaleString("en-IN")}
                                    </div>
                                    <small style={{ color: "#166534" }}>{payTarget.serviceType}</small>
                                </div>

                                <label className={styles.formLabel}>Select Payment Method:</label>
                                <div className={styles.paymentMethodGrid}>
                                    <div 
                                        className={`${styles.paymentMethodCard} ${payMethod === 'Cash' ? styles.paymentMethodActive : ''}`}
                                        onClick={() => setPayMethod('Cash')}
                                    >
                                        <Banknote size={24} color={payMethod === 'Cash' ? '#0d9488' : '#64748b'} />
                                        <span>Cash</span>
                                    </div>
                                    <div 
                                        className={`${styles.paymentMethodCard} ${payMethod === 'UPI' ? styles.paymentMethodActive : ''}`}
                                        onClick={() => setPayMethod('UPI')}
                                    >
                                        <Smartphone size={24} color={payMethod === 'UPI' ? '#0d9488' : '#64748b'} />
                                        <span>UPI / QR</span>
                                    </div>
                                    <div 
                                        className={`${styles.paymentMethodCard} ${payMethod === 'Card' ? styles.paymentMethodActive : ''}`}
                                        onClick={() => setPayMethod('Card')}
                                    >
                                        <CreditCard size={24} color={payMethod === 'Card' ? '#0d9488' : '#64748b'} />
                                        <span>Card / POS</span>
                                    </div>
                                </div>

                                {payMethod === "UPI" && (
                                    <div className={styles.upiBox}>
                                        <div className={styles.upiQrPlaceholder}>
                                            <QrCode size={64} />
                                            <small style={{ fontSize: 10 }}>Scan to Pay</small>
                                        </div>
                                        <span className={styles.upiVpaText}>hospital.desk@upi</span>
                                        <p style={{ margin: "6px 0 0 0", fontSize: 11, color: "#64748b" }}>
                                            Patient can scan via Google Pay, PhonePe, Paytm, or BHIM.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className={styles.modalFooter}>
                                <button 
                                    type="button" 
                                    className={styles.cancelModalBtn}
                                    onClick={() => setShowPayModal(false)}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className={styles.submitModalBtn}
                                    style={{ background: "#16a34a" }}
                                    disabled={submittingPay}
                                >
                                    <CheckCircle2 size={15} />
                                    {submittingPay ? "Recording..." : `Confirm ₹${payTarget.totalAmount} Received`}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 3: Printable Receipt */}
            {showReceiptModal && receiptTarget && (
                <div className={styles.modalOverlay} onClick={() => setShowReceiptModal(false)}>
                    <div className={`${styles.modal} ${styles.receiptModal}`} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>
                                <Printer size={20} color="#0284c7" />
                                Official Clinical Receipt
                            </h2>
                            <button className={styles.closeBtn} onClick={() => setShowReceiptModal(false)}>✕</button>
                        </div>

                        <div className={styles.receiptContainer}>
                            <div className={styles.receiptHeader}>
                                <h3 className={styles.receiptHospitalName}>METRO GENERAL CLINIC & HOSPITAL</h3>
                                <p className={styles.receiptSubHeader}>Central Outpatient Department & Billing Desk</p>
                                <p className={styles.receiptSubHeader}>Reg No: HOSP/2026/8940 · GSTIN: 27AABCM8472M1Z8</p>
                                <span className={`
                                    ${styles.receiptBadge}
                                    ${receiptTarget.paymentStatus === 'paid' ? styles.statusPaid : receiptTarget.paymentStatus === 'pending' ? styles.statusPending : styles.statusRefunded}
                                `}>
                                    RECEIPT STATUS: {receiptTarget.paymentStatus ? receiptTarget.paymentStatus.toUpperCase() : "PENDING"}
                                </span>
                            </div>

                            <div className={styles.receiptInfoGrid}>
                                <div>
                                    <div className={styles.receiptInfoRow}>
                                        <span className={styles.receiptInfoLabel}>Invoice No:</span>
                                        <span className={styles.receiptInfoVal}>{receiptTarget.invoiceNumber}</span>
                                    </div>
                                    <div className={styles.receiptInfoRow}>
                                        <span className={styles.receiptInfoLabel}>Date & Time:</span>
                                        <span className={styles.receiptInfoVal}>
                                            {new Date(receiptTarget.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                                        </span>
                                    </div>
                                    <div className={styles.receiptInfoRow}>
                                        <span className={styles.receiptInfoLabel}>Payment Mode:</span>
                                        <span className={styles.receiptInfoVal}>{receiptTarget.paymentMethod || "Cash"}</span>
                                    </div>
                                </div>

                                <div>
                                    <div className={styles.receiptInfoRow}>
                                        <span className={styles.receiptInfoLabel}>Patient:</span>
                                        <span className={styles.receiptInfoVal}>{receiptTarget.patient?.name}</span>
                                    </div>
                                    <div className={styles.receiptInfoRow}>
                                        <span className={styles.receiptInfoLabel}>Phone:</span>
                                        <span className={styles.receiptInfoVal}>{receiptTarget.patient?.phone || "N/A"}</span>
                                    </div>
                                    <div className={styles.receiptInfoRow}>
                                        <span className={styles.receiptInfoLabel}>Consulting Doctor:</span>
                                        <span className={styles.receiptInfoVal}>{receiptTarget.doctor?.name}</span>
                                    </div>
                                </div>
                            </div>

                            <table className={styles.receiptTable}>
                                <thead>
                                    <tr>
                                        <th>Description</th>
                                        <th>Qty</th>
                                        <th style={{ textAlign: "right" }}>Amount (₹)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>
                                            <strong>{receiptTarget.serviceType || "OPD Consultation"}</strong>
                                            <br />
                                            <small style={{ color: "#64748b" }}>{receiptTarget.doctor?.specialization}</small>
                                        </td>
                                        <td>1</td>
                                        <td style={{ textAlign: "right" }}>₹{receiptTarget.amount?.toLocaleString("en-IN")}</td>
                                    </tr>
                                    {receiptTarget.discount > 0 && (
                                        <tr>
                                            <td>Discount</td>
                                            <td>-</td>
                                            <td style={{ textAlign: "right", color: "#16a34a" }}>-₹{receiptTarget.discount}</td>
                                        </tr>
                                    )}
                                    <tr className={styles.receiptTotalRow}>
                                        <td colSpan="2">Net Total Amount:</td>
                                        <td style={{ textAlign: "right" }}>₹{receiptTarget.totalAmount?.toLocaleString("en-IN")}</td>
                                    </tr>
                                </tbody>
                            </table>

                            {receiptTarget.paymentStatus === 'refunded' && (
                                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: 10, borderRadius: 8, margin: '14px 0', fontSize: 12, color: '#b91c1c' }}>
                                    <strong>Refund Notice:</strong> ₹{receiptTarget.refundAmount} refunded on {new Date(receiptTarget.refundedAt || receiptTarget.createdAt).toLocaleDateString("en-IN")}.
                                    <br />
                                    Reason: {receiptTarget.refundReason || "Patient request"}
                                </div>
                            )}

                            <div className={styles.receiptFooter}>
                                This is a computer generated clinical cash receipt. Valid for insurance & claim reimbursements.
                            </div>
                        </div>

                        <div className={styles.modalFooter}>
                            <button 
                                type="button" 
                                className={styles.cancelModalBtn}
                                onClick={() => setShowReceiptModal(false)}
                            >
                                Close
                            </button>
                            <button 
                                type="button" 
                                className={styles.submitModalBtn}
                                onClick={() => window.print()}
                            >
                                <Printer size={15} />
                                Print Receipt
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 4: Issue Refund */}
            {showRefundModal && refundTarget && (
                <div className={styles.modalOverlay} onClick={() => setShowRefundModal(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>
                                <RotateCcw size={20} color="#dc2626" />
                                Process Refund
                            </h2>
                            <button className={styles.closeBtn} onClick={() => setShowRefundModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleConfirmRefund}>
                            <div className={styles.modalBody}>
                                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 14, marginBottom: 16 }}>
                                    <div style={{ fontSize: 13, color: '#991b1b', marginBottom: 4 }}>
                                        Refund for <strong>{refundTarget.patient?.name}</strong> ({refundTarget.invoiceNumber})
                                    </div>
                                    <div style={{ fontSize: 20, fontWeight: 700, color: '#dc2626' }}>
                                        Paid Amount: ₹{refundTarget.totalAmount?.toLocaleString("en-IN")}
                                    </div>
                                </div>

                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Refund Amount (₹) *</label>
                                    <input 
                                        type="number" 
                                        required 
                                        min="1"
                                        max={refundTarget.totalAmount}
                                        value={refundAmount}
                                        onChange={(e) => setRefundAmount(e.target.value)}
                                        className={styles.formInput}
                                    />
                                </div>

                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Reason for Refund *</label>
                                    <select 
                                        value={refundReason}
                                        onChange={(e) => setRefundReason(e.target.value)}
                                        className={styles.formSelect}
                                    >
                                        <option value="Patient requested cancellation">Patient requested cancellation</option>
                                        <option value="Doctor was unavailable / emergency">Doctor was unavailable / emergency</option>
                                        <option value="Duplicate payment received">Duplicate payment received</option>
                                        <option value="Consultation fee waived by doctor">Consultation fee waived by doctor</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                            </div>

                            <div className={styles.modalFooter}>
                                <button 
                                    type="button" 
                                    className={styles.cancelModalBtn}
                                    onClick={() => setShowRefundModal(false)}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className={styles.submitModalBtn}
                                    style={{ background: "#dc2626" }}
                                    disabled={submittingRefund}
                                >
                                    <RotateCcw size={15} />
                                    {submittingRefund ? "Processing..." : `Confirm ₹${refundAmount} Refund`}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
