import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
    LayoutDashboard, User, Stethoscope, Users, Building, Calendar, 
    FileText, ClipboardList, Bed, CreditCard, Mail, Layout, LogOut, MoreVertical, UserCog
} from 'lucide-react';
import styles from './Sidebar.module.css';
import { useAuth } from '../../context/AuthContext';

const Sidebar = () => {
    const { user, logout } = useAuth();
    const role = user?.role || 'patient';
    const basePath = `/${role}`;

    return (
        <aside className={styles.sidebar}>
            <nav className={styles.nav}>
                <div className={styles.menuSection}>
                    <NavLink to={`${basePath}/dashboard`} className={({isActive}) => isActive ? `${styles.navItem} ${styles.active}` : styles.navItem} end>
                        <LayoutDashboard size={20} />
                        <span>Dashboard</span>
                    </NavLink>
                    <NavLink to={`${basePath}/account`} className={({isActive}) => isActive ? `${styles.navItem} ${styles.active}` : styles.navItem}>
                        <User size={20} />
                        <span>Your Account</span>
                    </NavLink>
                </div>

                <div className={styles.sectionTitle}>APPLICATIONS</div>
                <div className={styles.menuSection}>
                    <NavLink to={`${basePath}/doctor`} className={({isActive}) => isActive ? `${styles.navItem} ${styles.active}` : styles.navItem}>
                        <Stethoscope size={20} />
                        <span>Doctor</span>
                    </NavLink>
                    
                    {role === 'doctor' ? (
                        <NavLink to="/doctor/patients" className={({isActive}) => isActive ? `${styles.navItem} ${styles.active}` : styles.navItem}>
                            <Users size={20} />
                            <span>Patients</span>
                        </NavLink>
                    ) : (
                        <NavLink to="/patient/history" className={({isActive}) => isActive ? `${styles.navItem} ${styles.active}` : styles.navItem}>
                            <FileText size={20} />
                            <span>Medical History</span>
                        </NavLink>
                    )}

                    {role === 'doctor' && (
                        <NavLink to="/doctor/team" className={({isActive}) => isActive ? `${styles.navItem} ${styles.active}` : styles.navItem}>
                            <UserCog size={20} />
                            <span>Team</span>
                        </NavLink>
                    )}

                    <NavLink to={`${basePath}/departments`} className={({isActive}) => isActive ? `${styles.navItem} ${styles.active}` : styles.navItem}>
                        <Building size={20} />
                        <span>Departments</span>
                    </NavLink>
                    
                    {role === 'doctor' ? (
                        <NavLink to="/doctor/schedule" className={({isActive}) => isActive ? `${styles.navItem} ${styles.active}` : styles.navItem}>
                            <Calendar size={20} />
                            <span>Schedule</span>
                        </NavLink>
                    ) : (
                        <NavLink to="/patient/schedule" className={({isActive}) => isActive ? `${styles.navItem} ${styles.active}` : styles.navItem}>
                            <Calendar size={20} />
                            <span>Schedule</span>
                        </NavLink>
                    )}
                    
                    <NavLink to={`${basePath}/appointments`} className={({isActive}) => isActive ? `${styles.navItem} ${styles.active}` : styles.navItem}>
                        <ClipboardList size={20} />
                        <span>Appointment</span>
                    </NavLink>
                    
                    {role === 'patient' && (
                        <NavLink to="/patient/documents" className={({isActive}) => isActive ? `${styles.navItem} ${styles.active}` : styles.navItem}>
                            <FileText size={20} />
                            <span>Documents</span>
                        </NavLink>
                    )}
                    <NavLink to={`${basePath}/bed`} className={({isActive}) => isActive ? `${styles.navItem} ${styles.active}` : styles.navItem}>
                        <Bed size={20} />
                        <span>Bed Manager</span>
                    </NavLink>
                </div>

                <div className={styles.sectionTitle}>OTHERS</div>
                <div className={styles.menuSection}>
                    <NavLink to={`${basePath}/payment`} className={({isActive}) => isActive ? `${styles.navItem} ${styles.active}` : styles.navItem}>
                        <CreditCard size={20} />
                        <span>Payment</span>
                    </NavLink>
                    <NavLink to={`${basePath}/mail`} className={({isActive}) => isActive ? `${styles.navItem} ${styles.active}` : styles.navItem}>
                        <Mail size={20} />
                        <span>Mail</span>
                    </NavLink>
                </div>
            </nav>

            <div className={styles.logoutSection}>
                <button onClick={logout} className={styles.logoutButton}>
                    <LogOut size={20} />
                    <span>Log Out</span>
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
