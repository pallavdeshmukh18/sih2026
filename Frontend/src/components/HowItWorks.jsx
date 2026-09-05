import React from 'react';
import styles from './HowItWorks.module.css';
import { motion } from 'framer-motion';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import anim1 from '../assets/animations/6855771.lottie?url';
import anim2 from '../assets/animations/6855773.lottie?url';
import anim3 from '../assets/animations/6855776.lottie?url';

const HowItWorks = () => {
  return (
    <section id="mission" className="section" style={{ backgroundColor: 'var(--color-light-grey)' }}>
      <div className={`container ${styles.container}`}>
        <motion.div 
          className={styles.header}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
        >
          <h2>Here's How It Works</h2>
          <p>A simpler, more effective healing process with MediKiosk.</p>
        </motion.div>
        
        <div className={styles.zigZagContainer}>
          {/* Row 1: SVG Left, Text Right */}
          <motion.div 
            className={styles.row}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7 }}
          >
            <div className={styles.visualCol}>
              <div className={styles.lottieContainer}>
                <DotLottieReact src={anim1} loop autoplay />
              </div>
            </div>
            <div className={styles.textCol}>
              <span className={styles.stepNumber}>Step 01</span>
              <h3>Consultation</h3>
              <p>Start with a quick chat to let us know your concerns.</p>
            </div>
          </motion.div>

          {/* Row 2: Text Left, SVG Right */}
          <motion.div 
            className={`${styles.row} ${styles.rowReverse}`}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7 }}
          >
            <div className={styles.visualCol}>
              <div className={styles.lottieContainer}>
                <DotLottieReact src={anim2} loop autoplay />
              </div>
            </div>
            <div className={styles.textCol}>
              <span className={styles.stepNumber}>Step 02</span>
              <h3>Meet Your Advocate</h3>
              <p>We will match you with a dedicated advocate who will guide you every step.</p>
              
              <div className={styles.statBox}>
                <div className={styles.statLarge}>+98%</div>
                <div className={styles.statLabel}>Patient satisfaction<br/>guaranteed.</div>
              </div>
            </div>
          </motion.div>

          {/* Row 3: SVG Left, Text Right */}
          <motion.div 
            className={styles.row}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7 }}
          >
            <div className={styles.visualCol}>
              <div className={styles.lottieContainer}>
                <DotLottieReact src={anim3} loop autoplay />
              </div>
            </div>
            <div className={styles.textCol}>
              <span className={styles.stepNumber}>Step 03</span>
              <h3>Focus On You</h3>
              <p>An individual approach, care, and attention from the onset of your health management plan.</p>
              
              <div className={styles.statsRow}>
                <div className={styles.statItem}>
                  <div className={styles.statNum}>10+</div>
                  <div className={styles.statText}>Years Experience</div>
                </div>
                <div className={styles.statItem}>
                  <div className={styles.statNum}>50+</div>
                  <div className={styles.statText}>Professionals</div>
                </div>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
