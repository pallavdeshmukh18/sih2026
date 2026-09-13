import { Link, useLocation } from 'react-router-dom';
import { Activity, ChevronRight, Settings, Globe } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage, LANGUAGE_OPTIONS } from '../../i18n';
import { transliterateName } from '../../utils/transliterate';
import styles from './TopBar.module.css';

export default function TopBar() {
  const {user} = useAuth();
  const {pathname} = useLocation();
  const {language, changeLanguage, t} = useLanguage();
  const role = user?.role || 'patient';
  const rawKey = pathname.split('/').pop();
  const navKeyMap = {
    'medical-passport': 'medicalPassport',
    'medical-id': 'medicalPassport',
    'teleconsult': 'teleconsult',
    'dashboard': 'dashboard',
    'account': 'account',
    'doctor': 'doctors',
    'history': 'history',
    'schedule': 'schedule',
    'appointments': 'appointments',
    'documents': 'documents',
    'assessment': 'assessment',
    'mail': 'mail'
  };
  const key = navKeyMap[rawKey] || rawKey.replaceAll('-', ' ');

  return <header className={styles.topbar}>
    <Link to={`/${role}/dashboard`} className={styles.logo}><span className={styles.logoIcon}><Activity size={20}/></span><span className={styles.brandWords}>MediKiosk<span className={styles.logoDot}>.</span></span></Link>
    <div className={styles.breadcrumb}>
      <span>{t("common.workspace", "Workspace")}</span>
      <ChevronRight size={13}/>
      <strong>{t(`navigation.${key}`, t(`${key}.title`, key))}</strong>
    </div>
    <div className={styles.actions}>
      <div className={styles.langSelectorWrapper}>
        <Globe size={16} className={styles.globeIcon} />
        <select 
          className={styles.langSelect}
          value={language || "en"}
          onChange={(e) => changeLanguage(e.target.value)}
          aria-label={t("common.selectLanguage", "Select language")}
        >
          {LANGUAGE_OPTIONS.map((opt) => (
            <option key={opt.code} value={opt.code}>
              {opt.nativeLabel} ({opt.label})
            </option>
          ))}
        </select>
      </div>
      <span className={styles.portal}>
        {role === "patient" ? t("common.patientPortal", "Patient Portal") : role === 'receptionist' ? t("common.frontDesk", "Front Desk") : role === 'doctor' ? t("common.doctorPortal", "Doctor Portal") : `${role} portal`}
      </span>
      <Link aria-label={t("common.settings", "Settings")} className={styles.iconButton} to={`/${role}/settings`}><Settings size={19}/></Link>
      <Link className={styles.profile} to={`/${role}/account`}>
        <span className={styles.avatar}>
          {user?.profilePhotoUrl
            ? <img src={user.profilePhotoUrl} alt="" />
            : <>{user?.firstName?.[0] || 'U'}{user?.lastName?.[0]}</>}
        </span>
        <span className={styles.userName}>
          {transliterateName(user?.firstName, language) || t("navigation.account", "Your account")}
          <small>{role === 'patient' ? t("account.patient", "Patient") : role === 'receptionist' ? t("common.frontDesk", "Front Desk") : role}</small>
        </span>
      </Link>
    </div>
  </header>;
}
