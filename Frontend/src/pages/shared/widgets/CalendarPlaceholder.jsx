import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './CalendarPlaceholder.module.css';

const CalendarPlaceholder = () => {
    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h3 className={styles.title}>Calendar</h3>
                <div className={styles.nav}>
                    <button className={styles.navBtn}><ChevronLeft size={16} /></button>
                    <span className={styles.month}>July 2026</span>
                    <button className={styles.navBtn}><ChevronRight size={16} /></button>
                </div>
            </div>
            
            <div className={styles.grid}>
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
                    <div key={day} className={styles.dayHeader}>{day}</div>
                ))}
                
                {[...Array(35)].map((_, i) => {
                    const dayNum = (i - 2 + 31) % 31 + 1;
                    const isMuted = i < 2 || i > 32;
                    const isSelected = i === 10;
                    return (
                        <div key={i} className={`${styles.day} ${isMuted ? styles.muted : ''} ${isSelected ? styles.selected : ''}`}>
                            {dayNum}
                            {i === 9 && <div className={styles.dotGroup}><span className={styles.dotAppointment}></span><span className={styles.dotMeeting}></span></div>}
                            {i === 17 && <div className={styles.dotGroup}><span className={styles.dotMeeting}></span><span className={styles.dotSurgery}></span></div>}
                        </div>
                    );
                })}
            </div>
            
            <div className={styles.legend}>
                <div className={styles.legendItem}><span className={styles.dotAppointment}></span> Appointment</div>
                <div className={styles.legendItem}><span className={styles.dotMeeting}></span> Meeting</div>
                <div className={styles.legendItem}><span className={styles.dotSurgery}></span> Surgery</div>
            </div>
        </div>
    );
};

export default CalendarPlaceholder;
