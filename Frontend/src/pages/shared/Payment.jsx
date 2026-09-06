import React from 'react';
import { motion } from 'framer-motion';
import { CreditCard, DollarSign, Download, Plus } from 'lucide-react';

const invoices = [
    { id: 'INV-2026-001', date: 'Oct 15, 2026', amount: '$150.00', status: 'Paid', desc: 'Cardiology Consultation' },
    { id: 'INV-2026-002', date: 'Oct 02, 2026', amount: '$45.00', status: 'Unpaid', desc: 'Prescription Refill' },
    { id: 'INV-2026-003', date: 'Sep 12, 2026', amount: '$320.00', status: 'Paid', desc: 'Blood Work & Lab Tests' },
];

const Payment = () => {
    return (
        <div style={{ paddingBottom: "24px" }}>
            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                style={{ display: "flex", flexDirection: "column", gap: "24px" }}
            >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                        <h1 style={{ fontSize: "28px", fontFamily: "var(--font-sans)", fontWeight: "700", color: "var(--color-dark)" }}>Payments & Billing</h1>
                        <p style={{ color: "var(--color-text-muted)", marginTop: "8px" }}>Manage invoices, receipts, and payment methods.</p>
                    </div>
                    <button style={{ background: "var(--color-teal)", color: "white", padding: "10px 20px", borderRadius: "8px", fontWeight: "600", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
                        <Plus size={18} />
                        Add Payment Method
                    </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '24px' }}>
                    {/* Main Invoice List */}
                    <div style={{ background: "white", borderRadius: "16px", border: "1px solid var(--color-border)", overflow: "hidden" }}>
                        <div style={{ padding: "24px", borderBottom: "1px solid var(--color-border)" }}>
                            <h3 style={{ fontSize: "18px", fontWeight: "600", color: "var(--color-dark)" }}>Recent Invoices</h3>
                        </div>
                        <div style={{ width: "100%", overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                                <thead>
                                    <tr style={{ borderBottom: "1px solid var(--color-border)", color: "var(--color-text-muted)", fontSize: "13px" }}>
                                        <th style={{ padding: "16px 24px", fontWeight: "500" }}>Invoice ID</th>
                                        <th style={{ padding: "16px 24px", fontWeight: "500" }}>Date</th>
                                        <th style={{ padding: "16px 24px", fontWeight: "500" }}>Description</th>
                                        <th style={{ padding: "16px 24px", fontWeight: "500" }}>Amount</th>
                                        <th style={{ padding: "16px 24px", fontWeight: "500" }}>Status</th>
                                        <th style={{ padding: "16px 24px", fontWeight: "500", textAlign: "right" }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoices.map((inv, idx) => (
                                        <tr key={idx} style={{ borderBottom: "1px solid var(--color-border)" }}>
                                            <td style={{ padding: "16px 24px", fontSize: "14px", fontWeight: "600", color: "var(--color-dark)" }}>{inv.id}</td>
                                            <td style={{ padding: "16px 24px", fontSize: "14px", color: "var(--color-dark)" }}>{inv.date}</td>
                                            <td style={{ padding: "16px 24px", fontSize: "14px", color: "var(--color-dark)" }}>{inv.desc}</td>
                                            <td style={{ padding: "16px 24px", fontSize: "14px", fontWeight: "600", color: "var(--color-dark)" }}>{inv.amount}</td>
                                            <td style={{ padding: "16px 24px" }}>
                                                <span style={{ 
                                                    background: inv.status === 'Paid' ? "#dcfce7" : "#fee2e2", 
                                                    color: inv.status === 'Paid' ? "#166534" : "#b91c1c", 
                                                    padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "600" 
                                                }}>
                                                    {inv.status}
                                                </span>
                                            </td>
                                            <td style={{ padding: "16px 24px", textAlign: "right" }}>
                                                <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-teal)" }}>
                                                    <Download size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Summary Sidebar */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div style={{ background: 'var(--color-dark)', color: 'white', padding: '24px', borderRadius: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                <div style={{ background: 'rgba(255,255,255,0.1)', padding: '10px', borderRadius: '12px' }}>
                                    <DollarSign size={20} />
                                </div>
                                <span style={{ fontSize: '15px', fontWeight: '500' }}>Outstanding Balance</span>
                            </div>
                            <h2 style={{ fontSize: '32px', fontWeight: '700', marginBottom: '24px' }}>$45.00</h2>
                            <button style={{ width: '100%', background: 'var(--color-teal)', color: 'white', padding: '12px', borderRadius: '8px', fontWeight: '600', border: 'none', cursor: 'pointer' }}>Pay Now</button>
                        </div>
                        
                        <div style={{ background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid var(--color-border)' }}>
                            <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--color-dark)', marginBottom: '16px' }}>Saved Methods</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
                                <CreditCard size={20} color="var(--color-text-muted)" />
                                <div>
                                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-dark)' }}>Visa ending in 4242</div>
                                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Expires 12/28</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default Payment;
