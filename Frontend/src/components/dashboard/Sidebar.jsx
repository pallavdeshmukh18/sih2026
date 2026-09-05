import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LayoutDashboard, FileText, Calendar, Activity, LogOut, FileSearch } from 'lucide-react';
import styles from './DashboardLayout.module.css';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const role = user?.role || 'patient';

  const patientLinks = [
    { to: '/patient/dashboard', label: 'Overview', icon: <LayoutDashboard size={20} /> },
    { to: '/patient/history', label: 'Medical History', icon: <Activity size={20} /> },
    { to: '/patient/appointments', label: 'Appointments', icon: <Calendar size={20} /> },
    { to: '/patient/documents', label: 'Documents & AI', icon: <FileText size={20} /> },
  ];

  const doctorLinks = [
    { to: '/doctor/dashboard', label: 'Overview', icon: <LayoutDashboard size={20} /> },
    { to: '/doctor/appointments', label: 'Schedule', icon: <Calendar size={20} /> },
    { to: '/doctor/patients', label: 'Patient Access', icon: <FileSearch size={20} /> },
  ];

  const links = role === 'doctor' ? doctorLinks : patientLinks;

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <Link to="/" className={styles.logo}>
          <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 18C6 14.6863 8.68629 12 12 12H16V22H6V18Z" fill="currentColor"/>
            <path d="M14 18C14 14.6863 16.6863 12 20 12H24V22H14V18Z" fill="currentColor"/>
            <path d="M22 18C22 14.6863 24.6863 12 28 12H32V22H22V18Z" fill="currentColor"/>
          </svg>
          MediKiosk
        </Link>
        <span className={styles.roleBadge}>{role === 'doctor' ? 'Physician Portal' : 'Patient Portal'}</span>
      </div>

      <nav className={styles.navLinks}>
        {links.map((link) => (
          <NavLink 
            key={link.to} 
            to={link.to} 
            className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
            end={link.to.endsWith('dashboard')} 
          >
            {link.icon}
            <span>{link.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className={styles.sidebarFooter}>
        <div className={styles.userInfo}>
          <div className={styles.userAvatar}>
            {user?.firstName?.[0] || 'U'}
          </div>
          <div className={styles.userDetails}>
            <p className={styles.userName}>{role === 'doctor' ? 'Dr. ' : ''}{user?.firstName} {user?.lastName}</p>
            <p className={styles.userMethod}>{user?.loginMethod}</p>
          </div>
        </div>
        <button onClick={logout} className={styles.logoutBtn}>
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
