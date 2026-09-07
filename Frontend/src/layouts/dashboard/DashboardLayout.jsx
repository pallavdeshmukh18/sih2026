import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import styles from './DashboardLayout.module.css';
import { useAuth } from '../../context/AuthContext';

const DashboardLayout = () => {
    const { user } = useAuth();
    return (
        <div className={`${styles.layout} ${user?.role === 'patient' ? styles.patientLayout : styles.doctorLayout}`}>
            <TopBar />
            <Sidebar />
            <div className={styles.mainWrapper}>
                <main className={styles.mainContent}>
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default DashboardLayout;
