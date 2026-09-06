import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    UserPlus, Shield, Users, Crown, ChevronDown, X,
    Eye, EyeOff, Check, Trash2, Mail, Phone, User, Lock, Stethoscope, ClipboardList
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { createStaffAccount } from '../../services/api';
import toast from 'react-hot-toast';
import styles from './TeamManagement.module.css';

// Role definitions with hierarchy
const STAFF_ROLES = [
    {
        id: 'admin',
        label: 'Admin',
        description: 'Full access to manage schedules, records, and reports. Second only to Doctor.',
        icon: Shield,
        color: '#6366f1',
        badge: 'admin',
    },
    {
        id: 'receptionist',
        label: 'Receptionist',
        description: 'Handles patient check-ins, appointments, billing, and front-desk operations.',
        icon: ClipboardList,
        color: '#0ea5e9',
        badge: 'admin',
    },
    {
        id: 'nurse',
        label: 'Nurse',
        description: 'Assists with patient care, vitals monitoring, medication, and clinical tasks.',
        icon: User,
        color: '#10b981',
        badge: 'admin',
    },
];

// Mock current team data
const INITIAL_TEAM = [
    { id: 1, name: 'Dr. Priya Sharma', role: 'superadmin', roleLabel: 'Superadmin (You)', email: 'priya@medikiosk.com', phone: '+91 98765 43210', initials: 'PS', status: 'active' },
    { id: 2, name: 'Rahul Verma', role: 'admin', roleLabel: 'Admin', email: 'rahul@medikiosk.com', phone: '+91 87654 32100', initials: 'RV', status: 'active' },
    { id: 3, name: 'Sneha Joshi', role: 'receptionist', roleLabel: 'Receptionist', email: 'sneha@medikiosk.com', phone: '+91 76543 21090', initials: 'SJ', status: 'active' },
    { id: 4, name: 'Karan Mehta', role: 'nurse', roleLabel: 'Nurse', email: 'karan@medikiosk.com', phone: '+91 65432 10980', initials: 'KM', status: 'pending' },
];

const ROLE_CONFIG = {
    superadmin: { color: '#f59e0b', label: 'Superadmin', icon: Crown },
    admin: { color: '#6366f1', label: 'Admin', icon: Shield },
    receptionist: { color: '#0ea5e9', label: 'Receptionist', icon: ClipboardList },
    nurse: { color: '#10b981', label: 'Nurse', icon: User },
};

const TeamManagement = () => {
    const { user, token } = useAuth();
    const [team, setTeam] = useState(INITIAL_TEAM);
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    const [form, setForm] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        password: '',
        role: 'receptionist',
    });

    const handleFormChange = (e) => {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const resetForm = () => {
        setForm({ firstName: '', lastName: '', email: '', phone: '', password: '', role: 'receptionist' });
        setShowPassword(false);
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!form.firstName || !form.email || !form.password || !form.role) {
            toast.error('Please fill in all required fields.');
            return;
        }
        if (form.password.length < 8) {
            toast.error('Password must be at least 8 characters.');
            return;
        }
        setLoading(true);
        try {
            await createStaffAccount(form, token);
            const initials = `${form.firstName[0]}${form.lastName?.[0] || ''}`.toUpperCase();
            const roleLabel = STAFF_ROLES.find(r => r.id === form.role)?.label || form.role;
            setTeam(prev => [...prev, {
                id: Date.now(),
                name: `${form.firstName} ${form.lastName}`,
                role: form.role,
                roleLabel,
                email: form.email,
                phone: form.phone,
                initials,
                status: 'pending',
            }]);
            toast.success(`${roleLabel} account created successfully!`);
            setShowModal(false);
            resetForm();
        } catch (err) {
            toast.error(err.message || 'Failed to create account.');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = (id) => {
        setTeam(prev => prev.filter(m => m.id !== id));
        setDeleteConfirm(null);
        toast.success('Team member removed.');
    };

    const RoleBadge = ({ role }) => {
        const config = ROLE_CONFIG[role] || { color: '#888', label: role };
        const Icon = config.icon || User;
        return (
            <span className={styles.roleBadge} style={{ background: `${config.color}18`, color: config.color, border: `1px solid ${config.color}33` }}>
                <Icon size={11} />
                {config.label}
            </span>
        );
    };

    return (
        <motion.div
            className={styles.page}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
        >
            {/* Header */}
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>Team Management</h1>
                    <p className={styles.subtitle}>Manage staff accounts and their access levels within your clinic.</p>
                </div>
                <button className={styles.createBtn} onClick={() => setShowModal(true)}>
                    <UserPlus size={16} />
                    Add Team Member
                </button>
            </div>

            {/* Hierarchy Banner */}
            <div className={styles.hierarchyBanner}>
                <Crown size={16} className={styles.hierarchyIcon} />
                <span className={styles.hierarchyText}>
                    <strong>You are the Superadmin.</strong> You have full authority to create, manage, and remove staff accounts in your clinic.
                </span>
                <div className={styles.hierarchyLevels}>
                    <div className={styles.level} style={{ borderColor: '#f59e0b', color: '#f59e0b' }}><Crown size={12} /> Doctor (You)</div>
                    <div className={styles.levelArrow}>→</div>
                    <div className={styles.level} style={{ borderColor: '#6366f1', color: '#6366f1' }}><Shield size={12} /> Admin</div>
                    <div className={styles.levelArrow}>→</div>
                    <div className={styles.level} style={{ borderColor: '#0ea5e9', color: '#0ea5e9' }}><ClipboardList size={12} /> Receptionist</div>
                    <div className={styles.levelArrow}>→</div>
                    <div className={styles.level} style={{ borderColor: '#10b981', color: '#10b981' }}><User size={12} /> Nurse</div>
                </div>
            </div>

            {/* Stats Row */}
            <div className={styles.statsRow}>
                {[
                    { label: 'Total Members', value: team.length, icon: Users, color: '#6366f1' },
                    { label: 'Active', value: team.filter(m => m.status === 'active').length, icon: Check, color: '#10b981' },
                    { label: 'Pending', value: team.filter(m => m.status === 'pending').length, icon: ClipboardList, color: '#f59e0b' },
                ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className={styles.statCard}>
                        <div className={styles.statIcon} style={{ background: `${color}15`, color }}><Icon size={18} /></div>
                        <div>
                            <div className={styles.statValue}>{value}</div>
                            <div className={styles.statLabel}>{label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Team Table */}
            <div className={styles.tableCard}>
                <div className={styles.tableHeader}>
                    <h3>Current Team ({team.length})</h3>
                </div>
                <div className={styles.table}>
                    <div className={styles.tableHead}>
                        <div>Member</div>
                        <div>Role</div>
                        <div>Contact</div>
                        <div>Status</div>
                        <div></div>
                    </div>
                    {team.map((member) => (
                        <motion.div
                            key={member.id}
                            className={styles.tableRow}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            layout
                        >
                            <div className={styles.memberCell}>
                                <div className={styles.avatar} style={{ background: ROLE_CONFIG[member.role]?.color || '#888' }}>
                                    {member.initials}
                                </div>
                                <div>
                                    <div className={styles.memberName}>{member.name}</div>
                                    <div className={styles.memberEmail}>{member.email}</div>
                                </div>
                            </div>
                            <div><RoleBadge role={member.role} /></div>
                            <div className={styles.contactCell}>
                                <span><Mail size={12} /> {member.email}</span>
                                {member.phone && <span><Phone size={12} /> {member.phone}</span>}
                            </div>
                            <div>
                                <span className={`${styles.statusBadge} ${member.status === 'active' ? styles.statusActive : styles.statusPending}`}>
                                    {member.status === 'active' ? 'Active' : 'Pending'}
                                </span>
                            </div>
                            <div className={styles.actionsCell}>
                                {member.role !== 'superadmin' && (
                                    deleteConfirm === member.id ? (
                                        <div className={styles.confirmDelete}>
                                            <span>Remove?</span>
                                            <button onClick={() => handleDelete(member.id)} className={styles.confirmYes}>Yes</button>
                                            <button onClick={() => setDeleteConfirm(null)} className={styles.confirmNo}>No</button>
                                        </div>
                                    ) : (
                                        <button className={styles.deleteBtn} onClick={() => setDeleteConfirm(member.id)}>
                                            <Trash2 size={14} />
                                        </button>
                                    )
                                )}
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Create Account Modal */}
            <AnimatePresence>
                {showModal && (
                    <motion.div
                        className={styles.modalOverlay}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => { setShowModal(false); resetForm(); }}
                    >
                        <motion.div
                            className={styles.modal}
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div className={styles.modalHeader}>
                                <div>
                                    <h2>Create Staff Account</h2>
                                    <p>New members will receive login credentials via email.</p>
                                </div>
                                <button className={styles.closeBtn} onClick={() => { setShowModal(false); resetForm(); }}>
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Role Selector Cards */}
                            <div className={styles.roleSelector}>
                                {STAFF_ROLES.map(r => {
                                    const Icon = r.icon;
                                    return (
                                        <button
                                            key={r.id}
                                            type="button"
                                            className={`${styles.roleCard} ${form.role === r.id ? styles.roleCardActive : ''}`}
                                            style={form.role === r.id ? { borderColor: r.color, background: `${r.color}0d` } : {}}
                                            onClick={() => setForm(p => ({ ...p, role: r.id }))}
                                        >
                                            <div className={styles.roleCardIcon} style={{ color: r.color, background: `${r.color}18` }}>
                                                <Icon size={18} />
                                            </div>
                                            <div className={styles.roleCardLabel}>{r.label}</div>
                                            <div className={styles.roleCardDesc}>{r.description}</div>
                                            {form.role === r.id && (
                                                <div className={styles.roleCardCheck} style={{ background: r.color }}>
                                                    <Check size={10} />
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            <form onSubmit={handleCreate} className={styles.form}>
                                <div className={styles.formRow}>
                                    <div className={styles.formGroup}>
                                        <label>First Name <span>*</span></label>
                                        <div className={styles.inputWrapper}>
                                            <User size={15} />
                                            <input name="firstName" value={form.firstName} onChange={handleFormChange} placeholder="First name" required />
                                        </div>
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Last Name</label>
                                        <div className={styles.inputWrapper}>
                                            <User size={15} />
                                            <input name="lastName" value={form.lastName} onChange={handleFormChange} placeholder="Last name" />
                                        </div>
                                    </div>
                                </div>
                                <div className={styles.formRow}>
                                    <div className={styles.formGroup}>
                                        <label>Email Address <span>*</span></label>
                                        <div className={styles.inputWrapper}>
                                            <Mail size={15} />
                                            <input name="email" type="email" value={form.email} onChange={handleFormChange} placeholder="staff@clinic.com" required />
                                        </div>
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Phone Number</label>
                                        <div className={styles.inputWrapper}>
                                            <Phone size={15} />
                                            <input name="phone" type="tel" value={form.phone} onChange={handleFormChange} placeholder="+91 98765 43210" />
                                        </div>
                                    </div>
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Password <span>*</span></label>
                                    <div className={styles.inputWrapper}>
                                        <Lock size={15} />
                                        <input
                                            name="password"
                                            type={showPassword ? 'text' : 'password'}
                                            value={form.password}
                                            onChange={handleFormChange}
                                            placeholder="Min 8 characters"
                                            required
                                        />
                                        <button type="button" className={styles.eyeBtn} onClick={() => setShowPassword(p => !p)}>
                                            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                        </button>
                                    </div>
                                </div>
                                <div className={styles.modalActions}>
                                    <button type="button" className={styles.cancelBtn} onClick={() => { setShowModal(false); resetForm(); }}>
                                        Cancel
                                    </button>
                                    <button type="submit" className={styles.submitBtn} disabled={loading}>
                                        {loading ? (
                                            <><span className={styles.spinner} /> Creating...</>
                                        ) : (
                                            <><UserPlus size={15} /> Create Account</>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default TeamManagement;
