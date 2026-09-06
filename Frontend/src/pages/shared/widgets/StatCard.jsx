import React from 'react';
import { MoreHorizontal, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import styles from './StatCard.module.css';

const StatCard = ({ title, icon: Icon, value, trend, subtitle, highlight, bgLight, iconBg, customContent }) => {
    return (
        <div className={`${styles.card} ${bgLight ? styles.cardLight : ''}`}>
            <div className={styles.header}>
                <div className={styles.titleGroup}>
                    <div className={styles.iconWrapper} style={{ backgroundColor: iconBg || 'var(--color-light-grey)' }}>
                        {Icon && <Icon size={16} />}
                    </div>
                    <span className={styles.title}>{title}</span>
                </div>
                <button className={styles.moreBtn}><MoreHorizontal size={16} /></button>
            </div>
            
            <div className={styles.content}>
                <div className={styles.valueGroup}>
                    <span className={styles.value}>{value}</span>
                    {trend && (
                        <div className={`${styles.trend} ${trend > 0 ? styles.trendUp : styles.trendDown}`}>
                            {trend > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                            +{Math.abs(trend)}%
                        </div>
                    )}
                    {customContent}
                </div>
                {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
                {highlight && (
                    <div className={styles.highlightContainer}>
                        {highlight}
                    </div>
                )}
            </div>
        </div>
    );
};

export default StatCard;
