import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
    LayoutDashboard, User, Stethoscope, Users, Building, Calendar, 
    FileText, ClipboardList, Bed, CreditCard, Mail, Layout, LogOut, MoreVertical, UserCog, ShieldCheck
} from 'lucide-react';
import styles from './Sidebar.module.css';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n';

const Sidebar = () => {
    const { user, logout } = useAuth();
    const { t } = useLanguage();
    const role = user?.role || 'patient';
    const basePath = `/${role}`;

    return (
        <aside className={styles.sidebar}>
            <nav className={styles.nav}>
                <div className={styles.menuSection}>
                    <NavLink to={`${basePath}/dashboard`} className={({isActive}) => isActive ? `${styles.navItem} ${styles.active}` : styles.navItem} end>
                        <LayoutDashboard size={20} />
                        <span>{t('navigation.dashboard')}</span>
                    </NavLink>
                    <NavLink to={`${basePath}/account`} className={({isActive}) => isActive ? `${styles.navItem} ${styles.active}` : styles.navItem}>
                        <User size={20} />
                        <span>{t('navigation.account')}</span>
                    </NavLink>
                </div>

                <div className={styles.sectionTitle}>{t('navigation.applications')}</div>
                <div className={styles.menuSection}>
                    {/* Role specific primary links */}
                    {role === 'receptionist' && (
                        <>
                            <NavLink to="/receptionist/appointments" className={({isActive}) => isActive ? `${styles.navItem} ${styles.active}` : styles.navItem}>
                                <ClipboardList size={20} />
                                <span>Front-Desk Queue</span>
                            </NavLink>
                            <NavLink to="/receptionist/patients" className={({isActive}) => isActive ? `${styles.navItem} ${styles.active}` : styles.navItem}>
                                <Users size={20} />
                                <span>Walk-In Registration</span>
                            </NavLink>
                        </>
                    )}

                    <NavLink to={`${basePath}/doctor`} className={({isActive}) => isActive ? `${styles.navItem} ${styles.active}` : styles.navItem}>
                        <Stethoscope size={20} />
                        <span>{role === 'receptionist' ? 'Doctor Availability' : t('navigation.doctors')}</span>
                    </NavLink>
                    
                    {role === 'doctor' && (
                        <NavLink to="/doctor/patients" className={({isActive}) => isActive ? `${styles.navItem} ${styles.active}` : styles.navItem}>
                            <Users size={20} />
                            <span>Patients</span>
                        </NavLink>
                    )}

                    {role === 'patient' && (
                        <>
                            <NavLink to="/patient/medical-id" className={({isActive}) => isActive ? `${styles.navItem} ${styles.active}` : styles.navItem}>
                                <ShieldCheck size={20} />
                                <span>{t('medicalId.title') || 'Medical ID'}</span>
                            </NavLink>
                            <NavLink to="/patient/history" className={({isActive}) => isActive ? `${styles.navItem} ${styles.active}` : styles.navItem}>
                                <FileText size={20} />
                                <span>{t('navigation.history')}</span>
                            </NavLink>
                        </>
                    )}

                    {role === 'doctor' && (
                        <NavLink to="/doctor/team" className={({isActive}) => isActive ? `${styles.navItem} ${styles.active}` : styles.navItem}>
                            <UserCog size={20} />
                            <span>Team</span>
                        </NavLink>
                    )}

                    {role === 'doctor' && (
                        <NavLink to={`${basePath}/departments`} className={({isActive}) => isActive ? `${styles.navItem} ${styles.active}` : styles.navItem}>
                            <Building size={20} />
                            <span>Departments</span>
                        </NavLink>
                    )}
                    
                    {role !== 'receptionist' && (
                        <NavLink to={`${basePath}/schedule`} className={({isActive}) => isActive ? `${styles.navItem} ${styles.active}` : styles.navItem}>
                            <Calendar size={20} />
                            <span>{t('navigation.schedule')}</span>
                        </NavLink>
                    )}
                    
                    {role !== 'receptionist' && (
                        <NavLink to={`${basePath}/appointments`} className={({isActive}) => isActive ? `${styles.navItem} ${styles.active}` : styles.navItem}>
                            <ClipboardList size={20} />
                            <span>{t('navigation.appointments')}</span>
                        </NavLink>
                    )}
                    
                    {role === 'patient' && (
                        <NavLink to="/patient/documents" className={({isActive}) => isActive ? `${styles.navItem} ${styles.active}` : styles.navItem}>
                            <FileText size={20} />
                            <span>{t('navigation.documents')}</span>
                        </NavLink>
                    )}

                    <NavLink to={`${basePath}/bed`} className={({isActive}) => isActive ? `${styles.navItem} ${styles.active}` : styles.navItem}>
                        <Bed size={20} />
                        <span>{t('navigation.bedManager')}</span>
                    </NavLink>
                </div>

                <div className={styles.sectionTitle}>{t('navigation.others')}</div>
                <div className={styles.menuSection}>
                    <NavLink to={`${basePath}/payment`} className={({isActive}) => isActive ? `${styles.navItem} ${styles.active}` : styles.navItem}>
                        <CreditCard size={20} />
                        <span>{role === 'receptionist' ? 'Billing Counter' : t('navigation.payment')}</span>
                    </NavLink>
                    <NavLink to={`${basePath}/mail`} className={({isActive}) => isActive ? `${styles.navItem} ${styles.active}` : styles.navItem}>
                        <Mail size={20} />
                        <span>{t('navigation.mail')}</span>
                    </NavLink>
                </div>
            </nav>

            <div className={styles.logoutSection}>
                <button onClick={logout} className={styles.logoutButton}>
                    <LogOut size={20} />
                    <span>{t('common.logout', 'Log Out')}</span>
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
