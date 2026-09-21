import { Link, useLocation } from 'react-router-dom';
import { Activity, Bell, ChevronDown, ChevronRight, Search, Settings, Globe } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage, LANGUAGE_OPTIONS } from '../../i18n';
import { transliterateName } from '../../utils/transliterate';
import styles from './TopBar.module.css';

export default function TopBar() {
  const {user} = useAuth();
  const {pathname} = useLocation();
  const {language, changeLanguage, t} = useLanguage();
  const role = user?.role || 'patient';
  const isPatientPortal = role === 'patient';
  const isDoctorPortal = role === 'doctor';
  const patientNav = [
    { label: 'Home', to: '/patient/dashboard', active: pathname === '/patient/dashboard' },
    { label: 'Appointments', to: '/patient/appointments', active: pathname.includes('/patient/appointments') || pathname.includes('/patient/schedule') || pathname.includes('/patient/teleconsult') },
    { label: 'Records', to: '/patient/documents', active: pathname.includes('/patient/documents') },
    { label: 'Prescriptions', to: '/patient/history', active: pathname.includes('/patient/history') },
    { label: 'Find Doctors', to: '/patient/doctor', active: pathname.includes('/patient/doctor') },
    { label: 'Health Timeline', to: '/patient/medical-passport', active: pathname.includes('/patient/medical-passport') || pathname.includes('/patient/assessment') || pathname.includes('/patient/claim-estimator') },
  ];
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

  if (isPatientPortal) return <header className={`${styles.topbar} ${styles.dashboardTopbar}`}>
    <Link to="/patient/dashboard" className={styles.dashboardLogo}><span className={styles.leafMark}>♥</span><span><b>MediKiosk.</b><small>Your Health. In Your Hands.</small></span></Link>
    <nav className={styles.dashboardNav}>{patientNav.map((item) => <Link className={item.active ? styles.activeNav : ''} to={item.to} key={item.to}>{item.label}</Link>)}</nav>
    <label className={styles.dashboardSearch}><Search /><input placeholder="Search doctors, records, or symptoms..." /></label>
    <button className={styles.dashboardBell} aria-label="Notifications"><Bell /><i /></button>
    <Link className={styles.dashboardProfile} to="/patient/account"><span>{user?.firstName?.[0] || 'N'}{user?.lastName?.[0] || 'A'}</span><b>{user?.firstName || 'Nisarg'} {user?.lastName || 'Anand'}</b><ChevronDown /></Link>
  </header>;

  if (isDoctorPortal) {
    const doctorNav = [
      { label: 'Home', to: '/doctor/dashboard', active: pathname === '/doctor/dashboard' },
      { label: 'Patients', to: '/doctor/patients', active: pathname.includes('/doctor/patients') },
      { label: 'Appointments', to: '/doctor/appointments', active: pathname.includes('/doctor/appointments') || pathname.includes('/doctor/teleconsult') },
      { label: 'Records', to: '/doctor/records', active: pathname.includes('/doctor/records') },
      { label: 'Prescriptions', to: '/doctor/prescriptions', active: pathname.includes('/doctor/prescriptions') },
      { label: 'Messages', to: '/doctor/messages', active: pathname.includes('/doctor/messages') },
    ];
    return <header className={`${styles.topbar} ${styles.dashboardTopbar} ${styles.doctorTopbar}`}>
      <Link to="/doctor/dashboard" className={styles.dashboardLogo}><span className={styles.leafMark}>♥</span><span><b>MediKiosk.</b><small>Your Health. In Your Hands.</small></span></Link>
      <nav className={styles.dashboardNav}>{doctorNav.map((item) => <Link className={item.active ? styles.activeNav : ''} to={item.to} key={item.to}>{item.label}</Link>)}</nav>
      <label className={styles.dashboardSearch}><Search /><input placeholder="Search patients, records..." /></label>
      <button className={styles.dashboardBell} aria-label="Notifications"><Bell /><i /></button>
      <Link className={styles.dashboardProfile} to="/doctor/account"><span>{user?.firstName?.[0] || 'R'}{user?.lastName?.[0] || 'S'}</span><span className={styles.doctorIdentity}><b>Dr. {user?.firstName || 'Rajesh'} {user?.lastName || 'Sharma'}</b><small>{user?.specialization || 'Cardiologist'}</small></span><ChevronDown /></Link>
    </header>;
  }

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
