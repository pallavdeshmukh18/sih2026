import React from 'react';
import { Link } from 'react-router-dom';
import styles from './Footer.module.css';
import heroBg from '../assets/hero_bg.jpg';

const Footer = () => {
  return (
    <footer id="work">
      <div className={styles.ctaBanner} style={{ backgroundImage: `url(${heroBg})` }}>
        <div className={styles.ctaOverlay}></div>
        <div className={styles.ctaContent}>
          <h2>We're Here When You Need Us.</h2>
          <p>Join thousands of users who have streamlined their care today.</p>
          <Link to="/auth" className={styles.ctaBtn}>Get Started</Link>
        </div>
      </div>

      <div className={styles.footerBottom}>
        <div className={`container ${styles.container}`}>
          <div className={styles.left}>
            <span>© Baba Inc. 2026</span>
            <a href="#privacy">Privacy Policy</a>
            <a href="#terms">Terms and Conditions</a>
          </div>
          
          <div className={styles.right}>
            <a href="#mission">Our Mission</a>
            <a href="#insights">Insights</a>
            <a href="#work">Work With Us</a>
            <a href="#faqs">FAQs</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
