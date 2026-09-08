import { Link, useLocation } from 'react-router-dom';
import { Activity, ChevronRight, Mail, Settings, Globe } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage, LANGUAGE_OPTIONS } from '../../i18n';
import styles from './TopBar.module.css';

export default function TopBar() {
 const {user} = useAuth();
 const {pathname} = useLocation();
 const {language, changeLanguage} = useLanguage();
 const role=user?.role || 'patient';
 const page=pathname.split('/').pop().replaceAll('-', ' ');

 return <header className={styles.topbar}>
  <Link to={`/${role}/dashboard`} className={styles.logo}><span className={styles.logoIcon}><Activity size={20}/></span><span className={styles.brandWords}>MediKiosk<span className={styles.logoDot}>.</span></span></Link>
  <div className={styles.breadcrumb}><span>Workspace</span><ChevronRight size={13}/><strong>{page}</strong></div>
  <div className={styles.actions}>
    <div className={styles.langSelectorWrapper}>
      <Globe size={16} className={styles.globeIcon} />
      <select 
        className={styles.langSelect}
        value={language}
        onChange={(e) => changeLanguage(e.target.value)}
        aria-label="Select language"
      >
        {LANGUAGE_OPTIONS.map((opt) => (
          <option key={opt.code} value={opt.code}>
            {opt.nativeLabel} ({opt.label})
          </option>
        ))}
      </select>
    </div>
    <span className={styles.portal}>
      {role === 'receptionist' ? 'Front Desk' : role === 'doctor' ? 'Doctor Portal' : 'Patient Portal'}
    </span>
    <Link aria-label="Messages" className={styles.iconButton} to={`/${role}/mail`}><Mail size={19}/></Link>
    <Link aria-label="Account settings" className={styles.iconButton} to={`/${role}/account`}><Settings size={19}/></Link>
    <Link className={styles.profile} to={`/${role}/account`}><span className={styles.avatar}>{user?.firstName?.[0] || 'U'}{user?.lastName?.[0]}</span><span className={styles.userName}>{user?.firstName || 'Your account'}<small>{role === 'receptionist' ? 'Front Desk' : role}</small></span></Link>
  </div>
 </header>;
}

