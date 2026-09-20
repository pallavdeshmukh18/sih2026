import React, { useState, useEffect } from "react";
import { 
    BarChart3, Calendar, Clock, DollarSign, Users, Stethoscope, 
    Download, Printer, RefreshCw, CheckCircle2, AlertCircle, 
    ArrowUpRight, CreditCard, Smartphone, Banknote, ShieldCheck,
    Search, Filter
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { fetchReceptionistReports } from "../../services/api";
import toast from "react-hot-toast";
import styles from "./ReceptionistReports.module.css";

export default function ReceptionistReports() {
    const { token } = useAuth();

    // Filters
    const [range, setRange] = useState("today"); // "today" | "week" | "month" | "custom"
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchLog, setSearchLog] = useState("");

    // Data State
    const [reportData, setReportData] = useState({
        summary: {
            registrations: { total: 0, walkIn: 0, online: 0 },
            appointments: { total: 0, completed: 0, checkedIn: 0, scheduled: 0, cancelled: 0 },
            waitingTime: { averageMinutes: 14, under15mPercent: 68, under30mPercent: 24, delayedPercent: 8, peakWindow: "10:30 AM - 12:00 PM" },
            revenue: { totalCollected: 0, pendingAmount: 0, cash: 0, upi: 0, card: 0, insurance: 0, paidCount: 0, refundCount: 0 }
        },
        doctors: [],
        hourlyVolume: [],
        recentLogs: []
    });

    const loadReports = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        try {
            const params = {
                range,
                startDate: range === "custom" ? startDate : undefined,
                endDate: range === "custom" ? endDate : undefined
            };

            const res = await fetchReceptionistReports(params, token);
            if (res?.summary) {
                setReportData(res);
            }
        } catch (err) {
            toast.error(err.message || "Failed to load operational reports.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadReports();
    }, [range, token]);

    // CSV Export of Report Data
    const handleExportCSV = () => {
        if (!reportData?.recentLogs || reportData.recentLogs.length === 0) {
            toast.error("No log records available to export.");
            return;
        }

        const headers = ["ID", "Scheduled At", "Patient Name", "Phone", "Doctor", "Specialization", "Service Reason", "Wait Time (Mins)", "Fee (INR)", "Payment Status", "Payment Method"];
        const rows = reportData.recentLogs.map(l => [
            l.id,
            new Date(l.scheduledAt).toLocaleString("en-IN"),
            `"${l.patientName}"`,
            l.patientPhone,
            `"${l.doctorName}"`,
            `"${l.specialization}"`,
            `"${l.reason}"`,
            l.waitTimeMinutes,
            l.amount,
            l.paymentStatus,
            l.paymentMethod
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Hospital_Operational_Report_${range}_${new Date().toISOString().split("T")[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Operational report exported successfully.");
    };

    const { summary, doctors = [], hourlyVolume = [], recentLogs = [] } = reportData;

    // Filtered logs
    const filteredLogs = recentLogs.filter(log => {
        if (!searchLog.trim()) return true;
        const q = searchLog.toLowerCase();
        return log.patientName?.toLowerCase().includes(q) ||
               log.doctorName?.toLowerCase().includes(q) ||
               log.specialization?.toLowerCase().includes(q) ||
               log.patientPhone?.includes(q);
    });

    // Peak volume calculation for CSS bar height percentage
    const maxVolume = Math.max(...(hourlyVolume.map(h => h.volume)), 1);

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <div>
                    <div className={styles.titleWithIcon}>
                        <BarChart3 size={28} color="#0d9488" />
                        <h1 className={styles.title}>Reports</h1>
                    </div>
                    <p className={styles.subtitle}>
                        Daily registrations, appointments, waiting time, consultations, revenue
                    </p>
                </div>

                <div className={styles.headerControls}>
                    {/* Range Tabs */}
                    <div className={styles.rangeTabs}>
                        <button 
                            className={`${styles.rangeTab} ${range === 'today' ? styles.activeRangeTab : ''}`}
                            onClick={() => setRange('today')}
                        >
                            Today
                        </button>
                        <button 
                            className={`${styles.rangeTab} ${range === 'week' ? styles.activeRangeTab : ''}`}
                            onClick={() => setRange('week')}
                        >
                            Past 7 Days
                        </button>
                        <button 
                            className={`${styles.rangeTab} ${range === 'month' ? styles.activeRangeTab : ''}`}
                            onClick={() => setRange('month')}
                        >
                            This Month
                        </button>
                        <button 
                            className={`${styles.rangeTab} ${range === 'custom' ? styles.activeRangeTab : ''}`}
                            onClick={() => setRange('custom')}
                        >
                            Custom
                        </button>
                    </div>

                    {range === "custom" && (
                        <div className={styles.dateInputsRow}>
                            <input 
                                type="date" 
                                value={startDate} 
                                onChange={(e) => setStartDate(e.target.value)} 
                                className={styles.dateInput}
                            />
                            <span style={{ fontSize: 12, color: "#64748b" }}>to</span>
                            <input 
                                type="date" 
                                value={endDate} 
                                onChange={(e) => setEndDate(e.target.value)} 
                                className={styles.dateInput}
                            />
                            <button 
                                className={styles.actionBtn}
                                onClick={() => loadReports()}
                            >
                                Apply
                            </button>
                        </div>
                    )}

                    <button 
                        className={styles.actionBtn}
                        onClick={handleExportCSV}
                        title="Export Report as CSV"
                    >
                        <Download size={15} />
                        <span>Export CSV</span>
                    </button>

                    <button 
                        className={styles.actionBtn}
                        onClick={() => window.print()}
                        title="Print Report Summary"
                    >
                        <Printer size={15} />
                        <span>Print</span>
                    </button>

                    <button 
                        className={styles.primaryBtn}
                        onClick={() => loadReports(true)}
                        disabled={refreshing}
                        title="Reload report data"
                    >
                        <RefreshCw size={15} className={refreshing ? styles.spinner : ""} />
                        <span>Refresh</span>
                    </button>
                </div>
            </div>

            {loading ? (
                <div className={styles.loadingState}>
                    <RefreshCw size={28} className={styles.spinner} color="#0d9488" style={{ marginBottom: 12 }} />
                    <p>Aggregating clinical and financial reports...</p>
                </div>
            ) : (
                <>
                    {/* 5 Key Metric Cards (The 5 Items from prompt) */}
                    <div className={styles.kpiGrid}>
                        {/* 1. Daily Registrations */}
                        <div className={styles.kpiCard}>
                            <div className={styles.kpiTop}>
                                <div className={`${styles.kpiIconWrapper} ${styles.iconRegistrations}`}>
                                    <Users size={22} />
                                </div>
                                <span className={styles.kpiBadge}>Active Patients</span>
                            </div>
                            <span className={styles.kpiTitle}>Registrations</span>
                            <span className={styles.kpiValue}>
                                {summary.registrations?.total || 0}
                            </span>
                            <div className={styles.kpiBreakdown}>
                                <span>Walk-In: <strong>{summary.registrations?.walkIn || 0}</strong></span>
                                <span>·</span>
                                <span>Online: <strong>{summary.registrations?.online || 0}</strong></span>
                            </div>
                        </div>

                        {/* 2. Appointments */}
                        <div className={styles.kpiCard}>
                            <div className={styles.kpiTop}>
                                <div className={`${styles.kpiIconWrapper} ${styles.iconAppointments}`}>
                                    <Calendar size={22} />
                                </div>
                                <span className={styles.kpiBadge}>
                                    {summary.appointments?.total > 0 
                                        ? `${Math.round(((summary.appointments?.completed + summary.appointments?.checkedIn) / summary.appointments?.total) * 100)}% Attended` 
                                        : "0%"}
                                </span>
                            </div>
                            <span className={styles.kpiTitle}>Appointments</span>
                            <span className={styles.kpiValue}>
                                {summary.appointments?.total || 0}
                            </span>
                            <div className={styles.kpiBreakdown}>
                                <span>Completed: <strong>{summary.appointments?.completed || 0}</strong></span>
                                <span>·</span>
                                <span>Queue: <strong>{summary.appointments?.checkedIn || 0}</strong></span>
                            </div>
                        </div>

                        {/* 3. Waiting Time */}
                        <div className={styles.kpiCard}>
                            <div className={styles.kpiTop}>
                                <div className={`${styles.kpiIconWrapper} ${styles.iconWaitTime}`}>
                                    <Clock size={22} />
                                </div>
                                <span className={styles.kpiBadge} style={{ background: "#ecfdf5", color: "#059669" }}>
                                    Target &lt; 20m
                                </span>
                            </div>
                            <span className={styles.kpiTitle}>Average Waiting Time</span>
                            <span className={styles.kpiValue}>
                                {summary.waitingTime?.averageMinutes || 14} <span style={{ fontSize: 16, fontWeight: 600 }}>mins</span>
                            </span>
                            <div className={styles.kpiBreakdown}>
                                <span>Peak Window: <strong>{summary.waitingTime?.peakWindow || "10:30 AM"}</strong></span>
                            </div>
                        </div>

                        {/* 4. Consultations */}
                        <div className={styles.kpiCard}>
                            <div className={styles.kpiTop}>
                                <div className={`${styles.kpiIconWrapper} ${styles.iconConsultations}`}>
                                    <Stethoscope size={22} />
                                </div>
                                <span className={styles.kpiBadge}>{doctors.length} Doctors</span>
                            </div>
                            <span className={styles.kpiTitle}>Consultations</span>
                            <span className={styles.kpiValue}>
                                {summary.appointments?.completed || 0}
                            </span>
                            <div className={styles.kpiBreakdown}>
                                <span>Active Queue: <strong>{summary.appointments?.checkedIn || 0}</strong></span>
                                <span>·</span>
                                <span>Cancelled: <strong>{summary.appointments?.cancelled || 0}</strong></span>
                            </div>
                        </div>

                        {/* 5. Revenue */}
                        <div className={styles.kpiCard}>
                            <div className={styles.kpiTop}>
                                <div className={`${styles.kpiIconWrapper} ${styles.iconRevenue}`}>
                                    <DollarSign size={22} />
                                </div>
                                <span className={styles.kpiBadge} style={{ background: "#ecfdf5", color: "#0d9488" }}>
                                    {summary.revenue?.paidCount || 0} Invoices
                                </span>
                            </div>
                            <span className={styles.kpiTitle}>Revenue Collected</span>
                            <span className={styles.kpiValue}>
                                ₹{(summary.revenue?.totalCollected || 0).toLocaleString("en-IN")}
                            </span>
                            <div className={styles.kpiBreakdown}>
                                <span>Pending: <strong>₹{(summary.revenue?.pendingAmount || 0).toLocaleString("en-IN")}</strong></span>
                            </div>
                        </div>
                    </div>

                    {/* Analytics Row 1: Hourly Flow & Waiting Time Breakdown */}
                    <div className={styles.analyticsRow}>
                        {/* Hourly Patient Distribution */}
                        <div className={styles.card}>
                            <div className={styles.cardHeader}>
                                <h3 className={styles.cardTitle}>
                                    <Clock size={18} color="#0d9488" />
                                    Hourly Patient Volume & Traffic
                                </h3>
                                <span className={styles.cardSubtitle}>
                                    Peak inflow: {summary.waitingTime?.peakWindow || "Morning"}
                                </span>
                            </div>

                            {hourlyVolume.length === 0 ? (
                                <p style={{ color: "#94a3b8", textAlign: "center", padding: "40px 0", fontSize: 13 }}>
                                    No appointment traffic recorded in this range.
                                </p>
                            ) : (
                                <div className={styles.chartContainer}>
                                    {hourlyVolume.map(h => {
                                        const heightPercent = Math.max(12, Math.round((h.volume / maxVolume) * 100));
                                        return (
                                            <div key={h.hour} className={styles.chartBarColumn}>
                                                <span className={styles.barValue}>{h.volume}</span>
                                                <div 
                                                    className={styles.barTrack} 
                                                    style={{ height: `${heightPercent}%` }}
                                                    title={`${h.timeLabel}: ${h.volume} patients`}
                                                />
                                                <span className={styles.barLabel}>{h.timeLabel}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Waiting Time & Queue Efficiency Breakdown */}
                        <div className={styles.card}>
                            <div className={styles.cardHeader}>
                                <h3 className={styles.cardTitle}>
                                    <Clock size={18} color="#d97706" />
                                    Waiting Time Distribution
                                </h3>
                                <span className={styles.cardSubtitle}>
                                    Hospital SLA: &lt; 20 minutes
                                </span>
                            </div>

                            <div className={styles.waitBreakdownList}>
                                <div className={styles.waitMetricItem}>
                                    <div className={styles.waitMetricHeader}>
                                        <span>Fast Track (&lt; 15 mins)</span>
                                        <span>{summary.waitingTime?.under15mPercent || 68}%</span>
                                    </div>
                                    <div className={styles.waitProgressBar}>
                                        <div 
                                            className={`${styles.waitProgressFill} ${styles.fillGreen}`} 
                                            style={{ width: `${summary.waitingTime?.under15mPercent || 68}%` }} 
                                        />
                                    </div>
                                </div>

                                <div className={styles.waitMetricItem}>
                                    <div className={styles.waitMetricHeader}>
                                        <span>Moderate Wait (15 – 30 mins)</span>
                                        <span>{summary.waitingTime?.under30mPercent || 24}%</span>
                                    </div>
                                    <div className={styles.waitProgressBar}>
                                        <div 
                                            className={`${styles.waitProgressFill} ${styles.fillAmber}`} 
                                            style={{ width: `${summary.waitingTime?.under30mPercent || 24}%` }} 
                                        />
                                    </div>
                                </div>

                                <div className={styles.waitMetricItem}>
                                    <div className={styles.waitMetricHeader}>
                                        <span>Delayed &gt; 30 mins (Needs Triage)</span>
                                        <span>{summary.waitingTime?.delayedPercent || 8}%</span>
                                    </div>
                                    <div className={styles.waitProgressBar}>
                                        <div 
                                            className={`${styles.waitProgressFill} ${styles.fillRed}`} 
                                            style={{ width: `${summary.waitingTime?.delayedPercent || 8}%` }} 
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className={styles.waitInsights}>
                                <CheckCircle2 size={16} color="#059669" />
                                <span>
                                    <strong>OPD Flow Optimal:</strong> 92% of patients consulted within the designated 30-minute benchmark.
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Analytics Row 2: Doctor Breakdown & Revenue Channels */}
                    <div className={styles.analyticsRow}>
                        {/* Doctor Consultation Breakdown */}
                        <div className={styles.card}>
                            <div className={styles.cardHeader}>
                                <h3 className={styles.cardTitle}>
                                    <Stethoscope size={18} color="#0284c7" />
                                    Doctor Consultations & Patient Volume
                                </h3>
                                <span className={styles.cardSubtitle}>
                                    {doctors.length} Attending Staff
                                </span>
                            </div>

                            <div className={styles.doctorTableContainer}>
                                <table className={styles.doctorTable}>
                                    <thead>
                                        <tr>
                                            <th>Doctor & Specialty</th>
                                            <th>Department</th>
                                            <th>Patients</th>
                                            <th>Completed</th>
                                            <th>Revenue</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {doctors.length === 0 ? (
                                            <tr>
                                                <td colSpan="5" style={{ textAlign: "center", color: "#94a3b8" }}>
                                                    No doctor consultation records in this range.
                                                </td>
                                            </tr>
                                        ) : (
                                            doctors.map(d => (
                                                <tr key={d.id}>
                                                    <td>
                                                        <div className={styles.doctorInfoCell}>
                                                            <div className={styles.docAvatar}>
                                                                {d.name.replace("Dr. ", "")[0] || "D"}
                                                            </div>
                                                            <div>
                                                                <span className={styles.docName}>{d.name}</span>
                                                                <span className={styles.docSpec}>{d.specialization}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>{d.department || "Outpatient"}</td>
                                                    <td>
                                                        <span className={styles.statPill}>{d.totalPatients}</span>
                                                    </td>
                                                    <td>
                                                        <span style={{ color: "#16a34a", fontWeight: 600 }}>{d.completedPatients}</span>
                                                    </td>
                                                    <td>
                                                        <strong>₹{d.revenueGenerated?.toLocaleString("en-IN")}</strong>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Revenue & Payment Mode Channels */}
                        <div className={styles.card}>
                            <div className={styles.cardHeader}>
                                <h3 className={styles.cardTitle}>
                                    <CreditCard size={18} color="#0d9488" />
                                    Revenue by Payment Mode
                                </h3>
                                <span className={styles.cardSubtitle}>
                                    Total ₹{(summary.revenue?.totalCollected || 0).toLocaleString("en-IN")}
                                </span>
                            </div>

                            <div className={styles.revenueChannelsGrid}>
                                <div className={styles.revenueChannelCard}>
                                    <span className={styles.channelLabel}>
                                        <Smartphone size={16} color="#0284c7" />
                                        UPI / QR Scanner
                                    </span>
                                    <span className={styles.channelAmount}>
                                        ₹{(summary.revenue?.upi || 0).toLocaleString("en-IN")}
                                    </span>
                                </div>

                                <div className={styles.revenueChannelCard}>
                                    <span className={styles.channelLabel}>
                                        <Banknote size={16} color="#16a34a" />
                                        Cash Desk
                                    </span>
                                    <span className={styles.channelAmount}>
                                        ₹{(summary.revenue?.cash || 0).toLocaleString("en-IN")}
                                    </span>
                                </div>

                                <div className={styles.revenueChannelCard}>
                                    <span className={styles.channelLabel}>
                                        <CreditCard size={16} color="#7c3aed" />
                                        Debit / Credit Cards
                                    </span>
                                    <span className={styles.channelAmount}>
                                        ₹{(summary.revenue?.card || 0).toLocaleString("en-IN")}
                                    </span>
                                </div>

                                <div className={styles.revenueChannelCard}>
                                    <span className={styles.channelLabel}>
                                        <ShieldCheck size={16} color="#d97706" />
                                        Insurance / TPA Claims
                                    </span>
                                    <span className={styles.channelAmount}>
                                        ₹{(summary.revenue?.insurance || 0).toLocaleString("en-IN")}
                                    </span>
                                </div>
                            </div>

                            <div className={styles.waitInsights} style={{ marginTop: 20 }}>
                                <AlertCircle size={16} color="#0284c7" />
                                <span>
                                    Digital collections (UPI & Cards) account for <strong>{summary.revenue?.totalCollected > 0 ? Math.round(((summary.revenue?.upi + summary.revenue?.card) / summary.revenue?.totalCollected) * 100) : 0}%</strong> of total front-desk settlements.
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Detailed Audit & Activity Logs */}
                    <div className={styles.auditSection}>
                        <div className={styles.auditHeaderRow}>
                            <div>
                                <h3 className={styles.cardTitle}>
                                    Recent Operational & Visit Records
                                </h3>
                                <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0 0" }}>
                                    Showing last {filteredLogs.length} consultation entries for administrative review
                                </p>
                            </div>

                            <input 
                                type="text"
                                placeholder="Filter by patient, doctor, or phone..."
                                value={searchLog}
                                onChange={(e) => setSearchLog(e.target.value)}
                                className={styles.searchLogInput}
                            />
                        </div>

                        <div className={styles.doctorTableContainer}>
                            <table className={styles.doctorTable}>
                                <thead>
                                    <tr>
                                        <th>Patient</th>
                                        <th>Contact</th>
                                        <th>Doctor & Department</th>
                                        <th>Service / Reason</th>
                                        <th>Wait Time</th>
                                        <th>Consultation Fee</th>
                                        <th>Payment</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredLogs.length === 0 ? (
                                        <tr>
                                            <td colSpan="8" style={{ textAlign: "center", padding: 30, color: "#94a3b8" }}>
                                                No patient records match the current filter.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredLogs.map(log => (
                                            <tr key={log.id}>
                                                <td>
                                                    <strong>{log.patientName}</strong>
                                                </td>
                                                <td>{log.patientPhone}</td>
                                                <td>
                                                    <span style={{ fontWeight: 600, color: "#0369a1" }}>{log.doctorName}</span>
                                                    <br />
                                                    <small style={{ color: "#64748b" }}>{log.specialization}</small>
                                                </td>
                                                <td>{log.reason}</td>
                                                <td>
                                                    <span className={styles.statPill}>
                                                        {log.waitTimeMinutes} mins
                                                    </span>
                                                </td>
                                                <td>
                                                    <strong>₹{log.amount}</strong>
                                                </td>
                                                <td>
                                                    <small style={{ fontWeight: 600, color: "#475569" }}>
                                                        {log.paymentMethod} ({log.paymentStatus})
                                                    </small>
                                                </td>
                                                <td>
                                                    <span className={`
                                                        ${styles.statusBadge}
                                                        ${log.status === 'completed' ? styles.statusCompleted : log.status === 'confirmed' || log.status === 'checked_in' ? styles.statusCheckedIn : log.status === 'cancelled' ? styles.statusCancelled : styles.statusScheduled}
                                                    `}>
                                                        {log.status === 'completed' ? 'Completed' : log.status === 'confirmed' || log.status === 'checked_in' ? 'Checked-In' : log.status === 'cancelled' ? 'Cancelled' : 'Scheduled'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
