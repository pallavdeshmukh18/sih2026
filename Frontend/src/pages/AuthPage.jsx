import React from 'react';
import { Link } from 'react-router-dom';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import lottieUrl from '../assets/d62JHEJbaa.lottie?url';
import styles from './AuthPage.module.css';

const AuthPage = () => {
  return (
    <div className={styles.authContainer}>
      {/* Background Shapes */}
      <div className={styles.bgBlobTopRight}></div>
      <div className={styles.bgBlobBottomLeft}></div>

      <div className={styles.authCard}>
        {/* Left Side: Form */}
        <div className={styles.formSection}>
          <div className={styles.formHeader}>
            <h1>Hello!</h1>
            <p>Sign in to your account</p>
          </div>

          <form className={styles.form}>
            <div className={styles.inputGroup}>
              <span className={styles.icon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
              </span>
              <input type="email" placeholder="E-mail" required />
            </div>

            <div className={styles.inputGroup}>
              <span className={styles.icon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </span>
              <input type="password" placeholder="Password" required />
              <button type="button" className={styles.eyeIcon} aria-label="Show password">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </button>
            </div>

            <div className={styles.formOptions}>
              <label className={styles.checkboxLabel}>
                <input type="checkbox" />
                <span className={styles.checkmark}></span>
                Remember me
              </label>
              <a href="#forgot" className={styles.forgotLink}>Forgot password?</a>
            </div>

            <button type="submit" className={styles.submitBtn}>SIGN IN</button>

            <div className={styles.divider}>
              <span>or continue with</span>
            </div>

            <button type="button" className={styles.googleBtn}>
              <svg className={styles.googleIcon} viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Google
            </button>
          </form>

          <p className={styles.switchAuth}>
            Don't have an account? <Link to="/auth?mode=signup" className={styles.switchLink}>Create</Link>
          </p>
          <div className={styles.backHome}>
             <Link to="/">← Back to Home</Link>
          </div>
        </div>

        {/* Right Side: Welcome Animation */}
        <div className={styles.welcomeSection}>
          <div className={styles.lottieContainer}>
            <DotLottieReact
              src={lottieUrl}
              loop
              autoplay
              style={{ width: '100%', height: '400px' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
