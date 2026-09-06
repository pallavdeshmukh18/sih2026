import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Info, Clock, FileText, ChevronRight, CheckCircle2, ChevronDown } from 'lucide-react';
import styles from './DoctorOverview.module.css';

// Mock Data
const patients = [
  { id: 1, name: 'Annette Black', address: '7529 E. Pecan St.', img: 'AB' },
  { id: 2, name: 'Guy Hawkins', address: '775 Rolling Green Rd.', img: 'GH' },
  { id: 3, name: 'Wade Warren', address: '8558 Green Rd.', img: 'WW' },
  { id: 4, name: 'Floyd Miles', address: '7529 E. Pecan St.', img: 'FM', active: true },
  { id: 5, name: 'Darlene Robertson', address: '8080 Railroad St.', img: 'DR' },
  { id: 6, name: 'Jerome Bell', address: '8558 Green Rd.', img: 'JB' },
];

const DoctorOverview = () => {
  const [activeTab, setActiveTab] = useState('Overview');

  return (
    <div className={styles.container}>
      {/* Left Column: Patient Lists */}
      <aside className={styles.leftSidebar}>
        <div className={styles.sidebarHeader}>
          <h2>Patient Lists (817)</h2>
          <Search size={18} className={styles.icon} />
        </div>
        <div className={styles.patientList}>
          {patients.map(p => (
            <div key={p.id} className={`${styles.patientCard} ${p.active ? styles.activeCard : ''}`}>
              <div className={styles.patientAvatar}>{p.img}</div>
              <div className={styles.patientInfo}>
                <h4>{p.name}</h4>
                <p>{p.address}</p>
              </div>
              <ChevronRight size={16} className={styles.chevron} />
            </div>
          ))}
        </div>
      </aside>

      {/* Middle Column: Main Content */}
      <main className={styles.mainContent}>
        <div className={styles.breadcrumbs}>
          <span>Patients</span> &gt; <span className={styles.currentCrumb}>Patients Information</span>
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
              <h3>99.8 <span>°F</span></h3>
            </div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricIcon} style={{ background: '#fee2e2', color: '#ef4444' }}>🩸</div>
            <div className={styles.metricData}>
              <p>Blood Pressure</p>
              <h3>123/95 <span>mmHg</span></h3>
            </div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricIcon} style={{ background: '#fce7f3', color: '#db2777' }}>🧪</div>
            <div className={styles.metricData}>
              <p>Blood Sugar</p>
              <h3>112 <span>mg/dl</span></h3>
            </div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricIcon} style={{ background: '#e0e7ff', color: '#6366f1' }}>⚖️</div>
            <div className={styles.metricData}>
              <p>Body Weight</p>
              <h3>74 <span>kg</span></h3>
            </div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricIcon} style={{ background: '#fef3c7', color: '#d97706' }}>💤</div>
            <div className={styles.metricData}>
              <p>Avg. Sleep Time</p>
              <h3>8.5 <span>hr</span></h3>
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
              <span className={styles.scoreBadge}>85/100</span>
            </div>
            <div className={styles.progressItem}>
              <div className={styles.progressLabel}><span>Basic ADL</span><span>8/12</span></div>
              <div className={styles.progressBar}><div className={styles.progressFill} style={{ width: '66%', background: '#f97316' }}></div></div>
            </div>
            <div className={styles.progressItem}>
              <div className={styles.progressLabel}><span>Intermediate ADL</span><span>6/12</span></div>
              <div className={styles.progressBar}><div className={styles.progressFill} style={{ width: '50%', background: '#84cc16' }}></div></div>
            </div>
            <div className={styles.progressItem}>
              <div className={styles.progressLabel}><span>Mental Health</span><span>8/25</span></div>
              <div className={styles.progressBar}><div className={styles.progressFill} style={{ width: '32%', background: '#eab308' }}></div></div>
            </div>
            <div className={styles.progressItem}>
              <div className={styles.progressLabel}><span>Social Interaction</span><span>20/30</span></div>
              <div className={styles.progressBar}><div className={styles.progressFill} style={{ width: '66%', background: '#06b6d4' }}></div></div>
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
                <span>Dry Bread Breakfast Only</span>
                <CheckCircle2 size={18} className={styles.unchecked} />
              </div>
              <div className={styles.todoItem}>
                <span>2L Water</span>
                <CheckCircle2 size={18} className={styles.checked} />
              </div>
              <div className={styles.todoItem}>
                <span>Regular Morning Walk</span>
                <CheckCircle2 size={18} className={styles.unchecked} />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Right Column: Profile Sidebar */}
      <aside className={styles.rightSidebar}>
        <div className={styles.profileHeader}>
          <div className={styles.profileAvatar}>FM</div>
          <div className={styles.profileName}>
            <h3>Floyd Miles</h3>
            <p>WBS: #783402847201</p>
            <button className={styles.editBtn}>Edit</button>
          </div>
        </div>

        <div className={styles.accordionGroup}>
          <div className={styles.accordion}>
            <div className={styles.accordionHeader}>
              <h4>Basic Information (7)</h4>
              <ChevronDown size={16} />
            </div>
            <div className={styles.accordionContent}>
              <div className={styles.infoRow}><span>Gender</span><p>Male</p></div>
              <div className={styles.infoRow}><span>Age</span><p>54</p></div>
              <div className={styles.infoRow}><span>Phone</span><p>(603) 555-0123</p></div>
              <div className={styles.infoRow}><span>Email</span><p>floydmiles@gmail.com</p></div>
              <div className={styles.infoRow}><span>Address</span><p>7529 E. Pecan St.</p></div>
              <div className={styles.infoRow}><span>Insurance</span><p>Member ID: 783402847201<br/>Wellbeing Medicare New York</p></div>
            </div>
          </div>
          
          <div className={styles.accordion}>
            <div className={styles.accordionHeader}>
              <h4>Appointments History (2)</h4>
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

export default DoctorOverview;
