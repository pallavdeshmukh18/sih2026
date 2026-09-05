import React, { useState } from 'react';
import styles from './Highlight.module.css';
import { useScrollReveal } from '../hooks/useScrollReveal';

const tabs = [
  {
    id: 'kidney',
    title: 'Kidney Disease',
    description: 'Help manage blood pressure medications, coordinate lifestyle modifications (diet, exercise, monitoring appointments), and provide patient education and ongoing support for you.'
  },
  {
    id: 'hypertension',
    title: 'Hypertension',
    description: 'We offer specialized monitoring routines, medication reminders, and coordinate with your primary care provider to keep your blood pressure perfectly managed.'
  },
  {
    id: 'mobility',
    title: 'Mobility Endorsements',
    description: 'Our advocates help arrange physical therapy, acquire necessary mobility equipment, and ensure your living space is adapted for maximum safety and independence.'
  },
  {
    id: 'parkinsons',
    title: 'Parkinsons',
    description: 'Receive dedicated support for complex medication schedules, physical therapy coordination, and emotional support tailored to Parkinsons care.'
  }
];

const Highlight = () => {
  const [activeTab, setActiveTab] = useState(0);
  const sectionRef = useScrollReveal();

  return (
    <section className={styles.section}>
      <div ref={sectionRef} className={`container ${styles.container} reveal`}>
        
        {/* Left Card */}
        <div className={styles.leftCard}>
          <div className={styles.cardHeader}>
            <span className={styles.eyebrow}>For you or your loved ones</span>
          </div>
          
          <div className={styles.list}>
            {tabs.map((tab, index) => (
              <button 
                key={tab.id}
                className={`${styles.listItem} ${activeTab === index ? styles.activeItem : ''}`}
                onClick={() => setActiveTab(index)}
              >
                <h3 className={activeTab === index ? '' : styles.inactiveText}>
                  {tab.title}
                </h3>
              </button>
            ))}
          </div>

          <div className={styles.cardFooter}>
            <p>Find dedicated advocates who specialize in your unique healthcare priorities.</p>
          </div>
        </div>

        {/* Right Card */}
        <div className={styles.rightCard}>
          <div className={styles.rightCardContent}>
            <span className={styles.eyebrowLight}>A dedicated advocate</span>
            <div className={styles.textWrapper}>
              <p key={activeTab} className={`${styles.rightCardText} ${styles.fadeIn}`}>
                {tabs[activeTab].description}
              </p>
            </div>
            <button className={styles.playButton}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          </div>
          <div className={styles.colorfulBg}></div>
        </div>
        
      </div>
    </section>
  );
};

export default Highlight;
