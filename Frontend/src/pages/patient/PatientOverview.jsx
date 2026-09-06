import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'framer-motion';
import { Info, Clock, FileText, CheckCircle2, ChevronDown } from 'lucide-react';
import styles from './PatientOverview.module.css';

const PatientOverview = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('Overview');

  return (
    <div className={styles.container}>
      {/* Middle Column: Main Content */}
      <main className={styles.mainContent}>
        <div className={styles.breadcrumbs}>
          <span>Dashboard</span> &gt; <span className={styles.currentCrumb}>Overview</span>
        </div>

        <div className={styles.tabs}>
          <button className={`${styles.tab} ${activeTab === 'Overview' ? styles.activeTab : ''}`} onClick={() => setActiveTab('Overview')}>
            <Info size={16} /> Overview
          </button>
          <button className={`${styles.tab} ${activeTab === 'Booking' ? styles.activeTab : ''}`} onClick={() => setActiveTab('Booking')}>
            <Clock size={16} /> Booking History
          </button>
          <button className={`${styles.tab} ${activeTab === 'Invoices' ? styles.activeTab : ''}`} onClick={() => setActiveTab('Invoices')}>
            <FileText size={16} /> Invoices
          </button>
        </div>

        <div className={styles.metricsGrid}>
          <div className={styles.metricCard}>
            <div className={styles.metricIcon} style={{ background: '#e0f2fe', color: '#0ea5e9' }}>🌡️</div>
            <div className={styles.metricData}>
              <p>Body Temperature</p>
              <h3>98.6 <span>°F</span></h3>
            </div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricIcon} style={{ background: '#fee2e2', color: '#ef4444' }}>🩸</div>
            <div className={styles.metricData}>
              <p>Blood Pressure</p>
              <h3>120/80 <span>mmHg</span></h3>
            </div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricIcon} style={{ background: '#fce7f3', color: '#db2777' }}>🧪</div>
            <div className={styles.metricData}>
              <p>Blood Sugar</p>
              <h3>95 <span>mg/dl</span></h3>
            </div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricIcon} style={{ background: '#e0e7ff', color: '#6366f1' }}>⚖️</div>
            <div className={styles.metricData}>
              <p>Body Weight</p>
              <h3>68 <span>kg</span></h3>
            </div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricIcon} style={{ background: '#fef3c7', color: '#d97706' }}>💤</div>
            <div className={styles.metricData}>
              <p>Avg. Sleep Time</p>
              <h3>7.5 <span>hr</span></h3>
            </div>
          </div>
          <div className={`${styles.metricCard} ${styles.addMoreCard}`}>
            <p>+ Add More</p>
          </div>
        </div>

        <div className={styles.splitSection}>
          {/* Functional Status */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h3>Functional Status</h3>
              <span className={styles.scoreBadge}>90/100</span>
            </div>
            <div className={styles.progressItem}>
              <div className={styles.progressLabel}><span>Basic ADL</span><span>10/12</span></div>
              <div className={styles.progressBar}><div className={styles.progressFill} style={{ width: '83%', background: '#f97316' }}></div></div>
            </div>
            <div className={styles.progressItem}>
              <div className={styles.progressLabel}><span>Intermediate ADL</span><span>8/12</span></div>
              <div className={styles.progressBar}><div className={styles.progressFill} style={{ width: '66%', background: '#84cc16' }}></div></div>
            </div>
            <div className={styles.progressItem}>
              <div className={styles.progressLabel}><span>Mental Health</span><span>20/25</span></div>
              <div className={styles.progressBar}><div className={styles.progressFill} style={{ width: '80%', background: '#eab308' }}></div></div>
            </div>
            <div className={styles.progressItem}>
              <div className={styles.progressLabel}><span>Social Interaction</span><span>28/30</span></div>
              <div className={styles.progressBar}><div className={styles.progressFill} style={{ width: '93%', background: '#06b6d4' }}></div></div>
            </div>
          </div>

          {/* Todo List */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h3>Todo List</h3>
              <a href="#" className={styles.seeAll}>See All</a>
            </div>
            <div className={styles.todoList}>
              <div className={styles.todoItem}>
                <span>Regular Morning Walk</span>
                <CheckCircle2 size={18} className={styles.checked} />
              </div>
              <div className={styles.todoItem}>
                <span>Take Vitamin D Supplement</span>
                <CheckCircle2 size={18} className={styles.unchecked} />
              </div>
              <div className={styles.todoItem}>
                <span>2L Water</span>
                <CheckCircle2 size={18} className={styles.checked} />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Right Column: Profile Sidebar */}
      <aside className={styles.rightSidebar}>
        <div className={styles.profileHeader}>
          <div className={styles.profileAvatar}>{user?.firstName?.[0] || 'U'}</div>
          <div className={styles.profileName}>
            <h3>{user?.firstName} {user?.lastName}</h3>
            <p>ID: #492817349</p>
            <button className={styles.editBtn}>Edit Profile</button>
          </div>
        </div>

        <div className={styles.accordionGroup}>
          <div className={styles.accordion}>
            <div className={styles.accordionHeader}>
              <h4>Basic Information</h4>
              <ChevronDown size={16} />
            </div>
            <div className={styles.accordionContent}>
              <div className={styles.infoRow}><span>Gender</span><p>Not Specified</p></div>
              <div className={styles.infoRow}><span>Age</span><p>Not Specified</p></div>
              <div className={styles.infoRow}><span>Phone</span><p>{user?.phone || 'N/A'}</p></div>
              <div className={styles.infoRow}><span>Email</span><p>{user?.email || 'N/A'}</p></div>
              <div className={styles.infoRow}><span>Insurance</span><p>Add Insurance Details</p></div>
            </div>
          </div>
          
          <div className={styles.accordion}>
            <div className={styles.accordionHeader}>
              <h4>Appointments History</h4>
              <ChevronDown size={16} />
            </div>
          </div>
          
          <div className={styles.accordion}>
            <div className={styles.accordionHeader}>
              <h4>Medications</h4>
              <ChevronDown size={16} />
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default PatientOverview;
