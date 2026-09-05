import React from 'react';
import styles from './DetailsSection.module.css';
import detailsTabletImg from '../assets/details_tablet.jpg';
import { motion } from 'framer-motion';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};

const DetailsSection = () => {
  return (
    <section className="section" style={{ backgroundColor: 'var(--color-light-grey)' }}>
      <div className={`container ${styles.container}`}>
        <motion.div 
          className={styles.header}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
        >
          <h2>Dedicated Care At Your Command.</h2>
          <p>Navigating the complex healthcare system can be overwhelming. Let us handle the details while you focus on what truly matters.</p>
        </motion.div>

        <motion.div 
          className={styles.imageContainer}
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
        >
          <img src={detailsTabletImg} alt="Senior man on tablet" />
        </motion.div>

        <motion.div 
          className={styles.cardsGrid}
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {/* Card 1 */}
          <motion.div variants={itemVariants} className={styles.infoCard}>
            <h4>Kidney Disease</h4>
            <ul>
              <li>We will match you with an advocate who has specific experience.</li>
              <li>Receive guidance on dietary changes, treatment options, and dialysis.</li>
            </ul>
          </motion.div>
          
          {/* Card 2 */}
          <motion.div variants={itemVariants} className={styles.infoCard}>
            <h4>Hypertension</h4>
            <ul>
              <li>We offer specialized monitoring routines and medication reminders.</li>
              <li>We coordinate with your primary care provider to keep your blood pressure perfectly managed.</li>
            </ul>
          </motion.div>

          {/* Card 3 */}
          <motion.div variants={itemVariants} className={styles.infoCard}>
            <h4>Mobility Endorsements</h4>
            <ul>
              <li>Our advocates help arrange physical therapy and acquire necessary mobility equipment.</li>
              <li>We ensure your living space is adapted for maximum safety and independence.</li>
            </ul>
          </motion.div>

          {/* Card 4 */}
          <motion.div variants={itemVariants} className={styles.infoCard}>
            <h4>Parkinson's Care</h4>
            <ul>
              <li>Receive dedicated support for complex medication schedules and physical therapy coordination.</li>
              <li>We provide emotional support tailored specifically to Parkinson's care.</li>
            </ul>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default DetailsSection;
