import React from 'react';
import styles from './AIFeatures.module.css';
import { useScrollReveal } from '../hooks/useScrollReveal';

const AIFeatures = () => {
  const headerRef = useScrollReveal();
  const c1Ref = useScrollReveal({ threshold: 0.1, triggerOnce: true });
  const c2Ref = useScrollReveal({ threshold: 0.1, triggerOnce: true });
  const c3Ref = useScrollReveal({ threshold: 0.1, triggerOnce: true });

  return (
    <section id="insights" className="section">
      <div className={`container ${styles.container}`}>
        <div ref={headerRef} className={`${styles.header} reveal`}>
          <span className={styles.label}>AI SUPPORT</span>
          <h2>Automated features to keep you on track.</h2>
        </div>

        <div className={styles.grid}>
          {/* Feature 1 */}
          <div ref={c1Ref} className={`${styles.featureCard} reveal delay-100`}>
            <div className={styles.iconBox}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </div>
            <h4>Maximum Appointment and Focus</h4>
            <p>Our match algorithm pairs you with the ideal advocate for your ongoing care.</p>
          </div>

          {/* Feature 2 */}
          <div ref={c2Ref} className={`${styles.featureCard} reveal delay-200`}>
            <div className={styles.iconBox}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
              </svg>
            </div>
            <h4>Build Better Phone Calls</h4>
            <p>Our proprietary AI will call your providers to gather health, details on bills, and clarify to save you time and frustration over phone calls.</p>
          </div>

          {/* Feature 3 */}
          <div ref={c3Ref} className={`${styles.featureCard} reveal delay-300`}>
            <div className={styles.iconBox}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            </div>
            <h4>AI Companionship</h4>
            <p>Get 24/7 assistance from AI tailored to your specific health needs and history.</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AIFeatures;
