import React from 'react';
import styles from './Testimonials.module.css';
import test1 from '../assets/test1.jpg';
import test2 from '../assets/test2.jpg';
import test3 from '../assets/test3.jpg';
import { useScrollReveal } from '../hooks/useScrollReveal';

const Testimonials = () => {
  const headerRef = useScrollReveal();
  const c1Ref = useScrollReveal({ threshold: 0.1, triggerOnce: true });
  const c2Ref = useScrollReveal({ threshold: 0.1, triggerOnce: true });
  const c3Ref = useScrollReveal({ threshold: 0.1, triggerOnce: true });

  return (
    <section className={styles.section}>
      <div className={`container ${styles.container}`}>
        <h2 ref={headerRef} className={`${styles.header} reveal`}>Trusted By Families Like Yours</h2>

        <div className={styles.grid}>
          
          {/* Column 1 */}
          <div ref={c1Ref} className={`${styles.column} reveal delay-100`}>
            <div className={styles.videoCard}>
              <img src={test1} alt="Larry, 82" />
              <div className={styles.videoOverlay}>
                <button className={styles.playBtn}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>
                <span className={styles.name}>Larry, 82</span>
              </div>
            </div>
            
            <div className={styles.quoteCard}>
              <span className={styles.quoteIcon}>“</span>
              <p>"It's Fast And Simple. It's Hassle Free And The Feeling That I Matter A Lot Is Just Great. I Have Left All My Care In AI's Hands."</p>
            </div>
          </div>

          {/* Column 2 */}
          <div ref={c2Ref} className={`${styles.column} reveal delay-200`}>
            <div className={styles.quoteCard}>
              <span className={styles.quoteIcon}>“</span>
              <p>"My mom has gotten to start to decline, now I look forward to a cheerful call from someone she laughs with every day. It feels like family now."</p>
            </div>

            <div className={styles.videoCard}>
              <img src={test3} alt="Michael, 67" />
              <div className={styles.videoOverlay}>
                <button className={styles.playBtn}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>
                <span className={styles.name}>Michael, 67</span>
              </div>
            </div>
          </div>

          {/* Column 3 */}
          <div ref={c3Ref} className={`${styles.column} reveal delay-300`}>
            <div className={styles.videoCard}>
              <img src={test2} alt="Gary, 74" />
              <div className={styles.videoOverlay}>
                <button className={styles.playBtn}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>
                <span className={styles.name}>Gary, 74</span>
              </div>
            </div>
            
            <div className={styles.quoteCard}>
              <span className={styles.quoteIcon}>“</span>
              <p>"I Didn't Even Realize How Much Help Was Available Health-wise I Found To Know It's Like Having An Assistant In My Pocket."</p>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default Testimonials;
