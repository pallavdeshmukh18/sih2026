import React from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Phone, MapPin, Shield, Bell } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const Account = () => {
    const { user } = useAuth();
    
    return (
        <div style={{ paddingBottom: "24px" }}>
            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                style={{ display: "flex", flexDirection: "column", gap: "24px" }}
            >
                <div style={{ marginBottom: "8px" }}>
                    <h1 style={{ fontSize: "28px", fontFamily: "var(--font-sans)", fontWeight: "700", color: "var(--color-dark)" }}>Your Account</h1>
                    <p style={{ color: "var(--color-text-muted)", marginTop: "8px" }}>Manage your profile, preferences, and security settings.</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px' }}>
                    {/* Sidebar / Quick Profile */}
                    <div style={{ background: "white", padding: "24px", borderRadius: "16px", border: "1px solid var(--color-border)", display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', height: 'fit-content' }}>
                        <div style={{ width: '96px', height: '96px', borderRadius: '50%', background: 'var(--color-teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', color: 'white', fontWeight: '700', marginBottom: '16px' }}>
                            {user?.name ? user.name.charAt(0) : 'U'}
                        </div>
                        <h3 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--color-dark)' }}>{user?.name || 'Demo User'}</h3>
                        <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', textTransform: 'capitalize', marginTop: '4px' }}>{user?.role || 'Patient'} Account</p>
                        
                        <div style={{ width: '100%', height: '1px', background: 'var(--color-border)', margin: '24px 0' }}></div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', textAlign: 'left' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--color-dark)' }}>
                                <Mail size={16} color="var(--color-text-muted)" />
                                <span style={{ fontSize: '14px' }}>{user?.email || 'user@example.com'}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--color-dark)' }}>
                                <Phone size={16} color="var(--color-text-muted)" />
                                <span style={{ fontSize: '14px' }}>+1 (555) 123-4567</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--color-dark)' }}>
                                <MapPin size={16} color="var(--color-text-muted)" />
                                <span style={{ fontSize: '14px' }}>San Francisco, CA</span>
                            </div>
                        </div>
                    </div>

                    {/* Main Settings Area */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div style={{ background: "white", padding: "24px", borderRadius: "16px", border: "1px solid var(--color-border)" }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                                <div style={{ background: '#f1f5f9', padding: '10px', borderRadius: '10px', color: '#475569' }}>
                                    <User size={20} />
                                </div>
                                <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--color-dark)' }}>Personal Information</h3>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--color-text-muted)' }}>Full Name</label>
                                    <input type="text" defaultValue={user?.name || 'Demo User'} style={{ padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--color-border)', outline: 'none', fontSize: '14px' }} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--color-text-muted)' }}>Date of Birth</label>
                                    <input type="date" defaultValue="1990-01-01" style={{ padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--color-border)', outline: 'none', fontSize: '14px' }} />
                                </div>
                            </div>
                            <button style={{ marginTop: '24px', background: 'var(--color-dark)', color: 'white', padding: '10px 20px', borderRadius: '8px', fontWeight: '600', border: 'none', cursor: 'pointer' }}>Save Changes</button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                            <div style={{ background: "white", padding: "24px", borderRadius: "16px", border: "1px solid var(--color-border)" }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                                    <div style={{ background: '#e0e7ff', padding: '10px', borderRadius: '10px', color: '#4f46e5' }}>
                                        <Shield size={20} />
                                    </div>
                                    <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--color-dark)' }}>Security</h3>
                                </div>
                                <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>Manage your password and 2FA settings to keep your account secure.</p>
                                <button style={{ width: '100%', background: 'transparent', color: 'var(--color-dark)', padding: '10px', borderRadius: '8px', fontWeight: '600', border: '1px solid var(--color-border)', cursor: 'pointer' }}>Change Password</button>
                            </div>

                            <div style={{ background: "white", padding: "24px", borderRadius: "16px", border: "1px solid var(--color-border)" }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                                    <div style={{ background: '#fef3c7', padding: '10px', borderRadius: '10px', color: '#d97706' }}>
                                        <Bell size={20} />
                                    </div>
                                    <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--color-dark)' }}>Notifications</h3>
                                </div>
                                <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>Choose what updates you want to receive via email or SMS.</p>
                                <button style={{ width: '100%', background: 'transparent', color: 'var(--color-dark)', padding: '10px', borderRadius: '8px', fontWeight: '600', border: '1px solid var(--color-border)', cursor: 'pointer' }}>Manage Preferences</button>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default Account;
