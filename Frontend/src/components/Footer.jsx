import React from 'react';
import { Link } from 'react-router-dom';
import styles from './Footer.module.css';

const Footer = () => {
  return (
    <footer className={styles.footerWrapper} id="work">
      {/* Background elements */}
      <div className={styles.radialBg}></div>
      {/* CTA Section */}
      <div className={styles.ctaSection}>
        <h2 className={styles.ctaTitle}>
          Transform your healthcare<br />
          workflows with <span className={styles.highlightText}>intelligent AI</span><br />
          <span className={styles.highlightText}>built for providers</span>
        </h2>
        <p className={styles.ctaDescription}>
          Streamline operations, reduce administrative burden, and deliver better patient outcomes
          with MediKiosk's AI-powered platform.
        </p>
        <Link to="/auth" className={styles.ctaButton}>Request a Demo</Link>
      </div>

      {/* Footer Card */}
      <div className={`container ${styles.cardContainer}`}>
        <div className={styles.bgTextWrapper}>
          <div className={styles.bgText}>MediKiosk</div>
        </div>
        <div className={styles.footerCard}>
          <div className={styles.footerTop}>
            {/* Column 1: Logo & Info */}
            <div className={styles.footerColMain}>
              <Link to="/" className={styles.logo}>
                <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6 18C6 14.6863 8.68629 12 12 12H16V22H6V18Z" fill="var(--color-dark)"/>
                  <path d="M14 18C14 14.6863 16.6863 12 20 12H24V22H14V18Z" fill="var(--color-dark)"/>
                  <path d="M22 18C22 14.6863 24.6863 12 28 12H32V22H22V18Z" fill="var(--color-dark)"/>
                </svg>
                MediKiosk
              </Link>
              <p className={styles.companyInfo}>
                AI-powered infrastructure designed to support healthcare providers with smarter workflows
              </p>
              <Link to="/auth" className={styles.getAppBtn}>Get MediKiosk AI</Link>
            </div>

            {/* Column 2: Product */}
            <div className={styles.footerCol}>
              <h4 className={styles.colTitle}>Product</h4>
              <ul className={styles.colList}>
                <li><a href="#features">Features</a></li>
                <li><a href="#integrations">Integrations</a></li>
                <li><a href="#security">Security</a></li>
                <li><a href="#api">API Access</a></li>
                <li><a href="#use-cases">Use Cases</a></li>
              </ul>
            </div>

            {/* Column 3: Company */}
            <div className={styles.footerCol}>
              <h4 className={styles.colTitle}>Company</h4>
              <ul className={styles.colList}>
                <li><a href="#mission">About MediKiosk</a></li>
                <li><a href="#careers">Careers</a></li>
                <li><a href="#insights">Blog</a></li>
                <li><a href="#press">Press</a></li>
                <li><a href="#contact">Contact</a></li>
              </ul>
            </div>

            {/* Column 4: Stay Connected */}
            <div className={styles.footerColConnect}>
              <h4 className={styles.colTitle}>Stay Connected with MediKiosk</h4>
              <p className={styles.connectText}>
                Get the latest updates on product releases, healthcare insights, and AI innovations follow us across our channels.
              </p>
              <div className={styles.socialFollow}>
                <span className={styles.followTitle}>Follow us</span>
                <div className={styles.socialIcons}>
                  <a href="#ig" aria-label="Instagram">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
                  </a>
                  <a href="#li" aria-label="LinkedIn">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>
                  </a>
                  <a href="#yt" aria-label="YouTube">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33 2.78 2.78 0 0 0 1.94 2c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33z"></path><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon></svg>
                  </a>
                  <a href="#x" aria-label="X">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4l11.733 16h4.267l-11.733 -16z" /><path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772" /></svg>
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.footerBottom}>
            <div className={styles.bottomLeft}>
              © 2026 MediKiosk. All rights reserved.
            </div>
            <div className={styles.bottomRight}>
              <a href="#terms">Terms of Service</a>
              <a href="#security">Security Policy</a>
              <a href="#privacy">Privacy Policy</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
