import React from 'react';
import styles from './DetailsSection.module.css';
import detailsTabletImg from '../assets/details_tablet.jpg';
import { useScrollReveal } from '../hooks/useScrollReveal';

const DetailsSection = () => {
  const headerRef = useScrollReveal();
  const imgRef = useScrollReveal({ threshold: 0.1, triggerOnce: true });
  const contentRef = useScrollReveal({ threshold: 0.1, triggerOnce: true });

  return (
    <section className="section" style={{ backgroundColor: 'var(--color-light-grey)' }}>
      <div className={`container ${styles.container}`}>
        <div ref={headerRef} className={`${styles.header} reveal`}>
          <h2>Dedicated Care At Your Command.</h2>
          <p>Navigating the complex healthcare system can be overwhelming. Let us handle the details while you focus on what truly matters.</p>
        </div>

        <div ref={imgRef} className={`${styles.imageContainer} reveal`}>
          <img src={detailsTabletImg} alt="Senior man on tablet" />
        </div>

        <div className={styles.cardsGrid}>
          {/* Card 1 */}
          <div ref={contentRef} className={`${styles.infoCard} reveal delay-100`}>
            <h4>Kidney Disease</h4>
            <ul>
              <li>We will match you with an advocate who has specific experience.</li>
              <li>Receive guidance on dietary changes, treatment options, and dialysis.</li>
            </ul>
          </div>
          
          {/* Card 2 */}
          <div className={`${styles.infoCard} reveal delay-200`}>
            <h4>Prescription & Savings</h4>
            <ul>
              <li>Your advocate will search for the best prices on medications.</li>
              <li>They will handle refill requests, transfers, and prior authorizations.</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DetailsSection;
