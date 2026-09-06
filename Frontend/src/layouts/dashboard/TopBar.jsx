import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sun, Moon, Bell, Mail, Settings } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import styles from './TopBar.module.css';

const TopBar = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [isDark, setIsDark] = useState(false);
    
    const role = user?.role || 'patient';
    const basePath = `/${role}`;
    
    const handleThemeToggle = () => {
        setIsDark(!isDark);
        toast(isDark ? 'Switched to Light Mode' : 'Dark mode coming soon!', {
            icon: isDark ? '☀️' : '🌙',
            style: {
                borderRadius: '10px',
                background: isDark ? '#fff' : '#1e293b',
                color: isDark ? '#333' : '#fff',
            },
        });
    };

    const handleNotifications = () => {
        toast.success('You have 1 new unread message!', { icon: '🔔' });
    };
    
    return (
        <header className={styles.topbar}>
            <div className={styles.logo}>
                <div className={styles.logoIcon}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" fill="var(--color-teal)" opacity="0.2"/>
                        <path d="M8 12L11 15L16 9" stroke="var(--color-teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </div>
                <span className={styles.logoText}>VitalHealth</span>
            </div>
            
            <div className={styles.actions}>
                <div className={styles.themeToggle} onClick={handleThemeToggle} style={{ cursor: 'pointer' }}>
                    <Sun size={18} className={isDark ? styles.iconMuted : styles.iconActive} />
                    <div className={styles.toggleSwitch}>
                        <div className={styles.toggleKnob} style={{ transform: isDark ? 'translateX(20px)' : 'translateX(0)' }}></div>
                    </div>
                    <Moon size={18} className={isDark ? styles.iconActive : styles.iconMuted} />
                </div>
                
                <div className={styles.divider}></div>
                
                <button className={styles.iconButton} onClick={handleNotifications}>
                    <Bell size={20} />
                    <span className={styles.badge}>1</span>
                </button>
                <button className={styles.iconButton} onClick={() => navigate(`${basePath}/mail`)}>
                    <Mail size={20} />
                </button>
                
                <div className={styles.divider}></div>
                
                <button className={styles.iconButton} onClick={() => navigate(`${basePath}/account`)}>
                    <Settings size={20} />
                </button>
                
                <div className={styles.avatar} onClick={() => navigate(`${basePath}/account`)} style={{ cursor: 'pointer' }}>
                    {user?.firstName?.charAt(0) || 'U'}{user?.lastName?.charAt(0) || ''}
                </div>
            </div>
        </header>
    );
};

export default TopBar;
