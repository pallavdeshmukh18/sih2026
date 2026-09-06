import React from 'react';
import { motion } from 'framer-motion';
import { Inbox, Send, File, Edit3, Star, Search } from 'lucide-react';

const messages = [
    { id: 1, sender: 'Dr. Sarah Jenkins', subject: 'Lab results for Nevaeh Simmons', time: '10:42 AM', unread: true, snippet: 'The CBC results are back. Please review the attached file...' },
    { id: 2, sender: 'Admin Office', subject: 'Updated Holiday Schedule', time: 'Yesterday', unread: false, snippet: 'Please note the revised on-call schedule for the upcoming holidays...' },
    { id: 3, sender: 'IT Support', subject: 'MediKiosk System Maintenance', time: 'Oct 02', unread: false, snippet: 'We will be performing routine maintenance on the database tonight...' },
];

const Mail = () => {
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
                        <h1 style={{ fontSize: "28px", fontFamily: "var(--font-sans)", fontWeight: "700", color: "var(--color-dark)" }}>Internal Mail</h1>
                        <p style={{ color: "var(--color-text-muted)", marginTop: "8px" }}>Secure communication within the hospital network.</p>
                    </div>
                    <button style={{ background: "var(--color-teal)", color: "white", padding: "10px 20px", borderRadius: "8px", fontWeight: "600", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
                        <Edit3 size={18} />
                        Compose
                    </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '24px' }}>
                    {/* Mailbox Sidebar */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ background: 'var(--color-dark)', color: 'white', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: '500', fontSize: '14px' }}>
                                <Inbox size={18} /> Inbox
                            </div>
                            <span style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: '600' }}>2</span>
                        </div>
                        <div style={{ color: 'var(--color-text-muted)', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', fontWeight: '500', fontSize: '14px' }}>
                            <Send size={18} /> Sent
                        </div>
                        <div style={{ color: 'var(--color-text-muted)', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', fontWeight: '500', fontSize: '14px' }}>
                            <File size={18} /> Drafts
                        </div>
                        <div style={{ color: 'var(--color-text-muted)', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', fontWeight: '500', fontSize: '14px' }}>
                            <Star size={18} /> Starred
                        </div>
                    </div>

                    {/* Inbox List */}
                    <div style={{ background: "white", borderRadius: "16px", border: "1px solid var(--color-border)", minHeight: '500px', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--color-border)' }}>
                            <div style={{ position: 'relative', width: '100%' }}>
                                <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                                <input 
                                    type="text" 
                                    placeholder='Search messages...'
                                    style={{ width: '100%', padding: '10px 16px 10px 42px', borderRadius: '8px', border: '1px solid var(--color-border)', background: '#f8fafc', fontSize: '14px', outline: 'none' }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {messages.map(msg => (
                                <div key={msg.id} style={{ padding: '16px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', gap: '16px', cursor: 'pointer', background: msg.unread ? '#f1f5f9' : 'transparent' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--color-light-grey)', color: 'var(--color-teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600' }}>
                                        {msg.sender.charAt(0)}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '15px', fontWeight: msg.unread ? '700' : '500', color: 'var(--color-dark)' }}>{msg.sender}</span>
                                            <span style={{ fontSize: '12px', color: msg.unread ? 'var(--color-teal)' : 'var(--color-text-muted)', fontWeight: msg.unread ? '600' : '400' }}>{msg.time}</span>
                                        </div>
                                        <div style={{ fontSize: '14px', fontWeight: msg.unread ? '600' : '400', color: 'var(--color-dark)', marginBottom: '4px' }}>{msg.subject}</div>
                                        <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '500px' }}>{msg.snippet}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default Mail;
