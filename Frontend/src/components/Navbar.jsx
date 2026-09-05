import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import styles from "./Navbar.module.css";

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleMenu = () => setMenuOpen(!menuOpen);

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate("/auth");
  };

  const dashboardPath = user?.role === "doctor" ? "/doctor/dashboard" : "/patient/dashboard";
  const displayName = user?.role === "doctor" ? `Dr. ${user.firstName}` : user?.firstName;

  return (
    <nav className={`${styles.navbar} ${scrolled ? 'glass' : ""}`}>
      <div className={styles.container}>
        <Link to="/" className={styles.logo}>
          MediKiosk
        </Link>

        <ul className={`${styles.navLinks} ${menuOpen ? styles.navLinksOpen : ""}`}>
          <li>
            <a href="#mission" onClick={() => setMenuOpen(false)}>
              Our Mission
            </a>
          </li>
          <li>
            <a href="#insights" onClick={() => setMenuOpen(false)}>
              Insights
            </a>
          </li>
          <li>
            <a href="#work" onClick={() => setMenuOpen(false)}>
              Work With Us
            </a>
          </li>
          <li>
            <a href="#faqs" onClick={() => setMenuOpen(false)}>
              FAQs
            </a>
          </li>

          {/* Mobile only actions in menu */}
          <div className={styles.mobileActions}>
            {isAuthenticated ? (
              <>
                <Link to={dashboardPath} className={styles.loginBtn} onClick={() => setMenuOpen(false)}>
                  {displayName} (Dashboard)
                </Link>
                <button onClick={handleLogout} className={styles.startBtn}>
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/auth" className={styles.loginBtn} onClick={() => setMenuOpen(false)}>
                  Login
                </Link>
                <Link to="/auth" className={styles.startBtn} onClick={() => setMenuOpen(false)}>
                  Get Started
                </Link>
              </>
            )}
          </div>
        </ul>

        <div className={styles.actions}>
          {isAuthenticated ? (
            <>
              <Link to={dashboardPath} className={styles.loginBtn}>
                {displayName} (Dashboard)
              </Link>
              <button onClick={handleLogout} className={styles.startBtn}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/auth" className={styles.loginBtn}>
                Login
              </Link>
              <Link to="/auth" className={styles.startBtn}>
                Get Started
              </Link>
            </>
          )}
        </div>

        {/* Hamburger Menu Toggle */}
        <button
          className={`${styles.hamburger} ${menuOpen ? styles.open : ""}`}
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
