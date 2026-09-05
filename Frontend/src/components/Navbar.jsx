import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import styles from './Navbar.module.css';

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleMenu = () => setMenuOpen(!menuOpen);

  return (
    <nav className={`${styles.navbar} ${scrolled ? styles.scrolled : ''}`}>
      <div className={styles.container}>
        <div className={styles.logo}>baba</div>
        
        <ul className={`${styles.navLinks} ${menuOpen ? styles.navLinksOpen : ''}`}>
          <li><a href="#mission" onClick={() => setMenuOpen(false)}>Our Mission</a></li>
          <li><a href="#insights" onClick={() => setMenuOpen(false)}>Insights</a></li>
          <li><a href="#work" onClick={() => setMenuOpen(false)}>Work With Us</a></li>
          <li><a href="#faqs" onClick={() => setMenuOpen(false)}>FAQs</a></li>
          
          {/* Mobile only actions in menu */}
          <div className={styles.mobileActions}>
            <Link to="/auth" className={styles.loginBtn}>Login</Link>
            <Link to="/auth" className={styles.startBtn}>Get Started</Link>
          </div>
        </ul>
        
        <div className={styles.actions}>
          <Link to="/auth" className={styles.loginBtn}>Login</Link>
          <Link to="/auth" className={styles.startBtn}>Get Started</Link>
        </div>

        {/* Hamburger Menu Toggle */}
        <button 
          className={`${styles.hamburger} ${menuOpen ? styles.open : ''}`} 
          onClick={toggleMenu}
          aria-label="Toggle menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>

      {/* Backdrop for mobile menu */}
      {menuOpen && <div className={styles.backdrop} onClick={toggleMenu}></div>}
    </nav>
  );
};

export default Navbar;
