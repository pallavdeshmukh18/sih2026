import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import styles from './DashboardLayout.module.css';

const DashboardLayout = () => {
  return (
    <div className={styles.layoutWrapper}>
      <Sidebar />
      <main className={styles.mainContent}>
        <div className={styles.topbar}>
          {/* We can add notifications or breadcrumbs here later */}
          <div className={styles.topbarLeft}></div>
          <div className={styles.topbarRight}>
            <button className={styles.helpBtn}>Help & Support</button>
          </div>
        </div>
        <div className={styles.pageContent}>
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
