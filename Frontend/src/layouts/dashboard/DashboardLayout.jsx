import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import AccessibilityVoiceGuide from '../../components/accessibility/AccessibilityVoiceGuide';
import styles from './DashboardLayout.module.css';
import { useAuth } from '../../context/AuthContext';

const DashboardLayout = () => {
    const { user } = useAuth();
    const { pathname } = useLocation();
    const isPatient = user?.role === 'patient';
    const isDoctor = user?.role === 'doctor';
    const isPatientDashboard = isPatient && pathname === '/patient/dashboard';
    const [sidebarHovered, setSidebarHovered] = useState(false);

    return (
        <div className={`${styles.layout} ${isPatient ? styles.patientLayout : styles.doctorLayout} ${isPatientDashboard ? styles.patientDashboardLayout : ''}`}>
            <TopBar />
            {!isPatient && !isDoctor && <Sidebar onHoverChange={setSidebarHovered} collapsed={!sidebarHovered} />}
            <div className={`${styles.mainWrapper} ${isPatient && sidebarHovered ? styles.patientSidebarOpen : ''} ${!isPatient && !sidebarHovered ? styles.doctorSidebarCollapsed : ''}`}>
                <main className={styles.mainContent}>
                    <Outlet />
                </main>
            </div>
            {isPatient && !isPatientDashboard && <AccessibilityVoiceGuide />}
        </div>
    );
};

export default DashboardLayout;
