import React from 'react';
import styles from './HowItWorks.module.css';
import consultationImg from '../assets/consultation.jpg';
import { useScrollReveal } from '../hooks/useScrollReveal';

const HowItWorks = () => {
  const headerRef = useScrollReveal();
  const card1Ref = useScrollReveal({ threshold: 0.1, triggerOnce: true });
  const card2Ref = useScrollReveal({ threshold: 0.1, triggerOnce: true });
  const card3Ref = useScrollReveal({ threshold: 0.1, triggerOnce: true });
  const card4Ref = useScrollReveal({ threshold: 0.1, triggerOnce: true });
  const card5Ref = useScrollReveal({ threshold: 0.1, triggerOnce: true });

  return (
    <section id="mission" className="section" style={{ backgroundColor: 'var(--color-light-grey)' }}>
      <div className="container">
        <div ref={headerRef} className={`${styles.header} reveal`}>
          <h2>Here's How It Works</h2>
          <p>A simpler, more effective healing process with BabyConnect.</p>
        </div>
        
        <div className={styles.grid}>
          {/* Card 1: Consultation (spans 2 rows) */}
          <div ref={card1Ref} className={`${styles.card} ${styles.cardConsultation} reveal delay-100`}>
            <div className={styles.imgWrapper}>
              <img src={consultationImg} alt="Consultation" />
            </div>
            <div className={styles.cardContent}>
              <h3>Consultation</h3>
              <p>Start with a quick chat to let us know your concerns.</p>
            </div>
          </div>

          {/* Card 2: Meet Your Advocate */}
          <div ref={card2Ref} className={`${styles.card} reveal delay-200`}>
            <div className={styles.cardContent}>
              <h3>Meet Your Advocate</h3>
              <p>We will match you with a dedicated advocate who will guide you every step.</p>
            </div>
          </div>

          {/* Card 3: +98% */}
          <div ref={card3Ref} className={`${styles.card} reveal delay-300`}>
            <div className={styles.cardContent}>
              <div className={styles.statLarge}>+98%</div>
              <p>Patient satisfaction guaranteed.</p>
            </div>
          </div>

          {/* Card 4: Stats */}
          <div ref={card4Ref} className={`${styles.card} ${styles.cardStats} reveal delay-200`}>
            <div className={styles.cardContent}>
              <div className={styles.statGroup}>
                <div className={styles.statNumber}>10+</div>
                <div className={styles.statLabel}>Years Of Experience</div>
              </div>
              <div className={styles.statGroup}>
                <div className={styles.statNumber}>50+</div>
                <div className={styles.statLabel}>Professionals</div>
              </div>
            </div>
          </div>

          {/* Card 5: Focus On You */}
          <div ref={card5Ref} className={`${styles.card} reveal delay-300`}>
            <div className={styles.cardContent}>
              <h3>Focus On You</h3>
              <p>An individual approach, care, and attention from the onset of your health management plan.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
