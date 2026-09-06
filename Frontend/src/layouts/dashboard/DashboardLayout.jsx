import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import styles from './DashboardLayout.module.css';

const DashboardLayout = () => {
    return (
        <div className={styles.layout}>
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
