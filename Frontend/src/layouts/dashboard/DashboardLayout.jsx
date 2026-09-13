import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import AccessibilityVoiceGuide from '../../components/accessibility/AccessibilityVoiceGuide';
import ISLAccessibilityOverlay from '../../components/accessibility/ISLAccessibilityOverlay';
import styles from './DashboardLayout.module.css';
import { useAuth } from '../../context/AuthContext';

const DashboardLayout = () => {
    const { user } = useAuth();
    const isPatient = user?.role === 'patient';
    const [sidebarHovered, setSidebarHovered] = useState(false);

    return (
        <div className={`${styles.layout} ${isPatient ? styles.patientLayout : styles.doctorLayout}`}>
            <TopBar />
            <Sidebar onHoverChange={setSidebarHovered} collapsed={!isPatient && !sidebarHovered} />
            <div className={`${styles.mainWrapper} ${isPatient && sidebarHovered ? styles.patientSidebarOpen : ''} ${!isPatient && !sidebarHovered ? styles.doctorSidebarCollapsed : ''}`}>
                <main className={styles.mainContent}>
                    <Outlet />
                </main>
            </div>
            {isPatient && <AccessibilityVoiceGuide />}
            {isPatient && <ISLAccessibilityOverlay />}
        </div>
    );
};

export default DashboardLayout;
