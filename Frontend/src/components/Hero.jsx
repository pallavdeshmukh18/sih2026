import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import styles from './Hero.module.css';
import heroBg from '../assets/hero_bg.jpg';

const Hero = () => {
  return (
    <section className={styles.hero} style={{ backgroundImage: `url(${heroBg})` }}>
      <div className={styles.overlay}></div>
      <motion.div 
        className={styles.content}
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <span className={styles.label}>MEDIKIOSK HEALTH SYSTEM</span>
        <h1 className={styles.title}>
          Navigating Healthcare Is<br />Hard But Manageable.
        </h1>
        <p className={styles.subtitle}>
          Imagine a healthcare journey designed for you — clear, transparent, and supportive.
        </p>
        <div className={styles.ctaGroup}>
          <Link to="/auth" className={styles.ctaButton}>
            Book A Call With Us Today
          </Link>
        </div>
        
        <div className={styles.partners}>
          {/* We'll use simple text/spans to represent logos for now as they are small and gray */}
          <span className={styles.partnerLogo}>NIH</span>
          <span className={styles.partnerLogo}>AARP</span>
          <span className={styles.partnerLogo}>Y COMBINATOR</span>
          <span className={styles.partnerLogo}>FORBES</span>
        </div>
      </motion.div>
      
      {/* Bottom gradient transition to next section */}
      <div className={styles.bottomGradient}></div>
    </section>
  );
};

export default Hero;
