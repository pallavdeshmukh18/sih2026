import React from 'react';
import styles from './ChartPlaceholder.module.css';

const ChartPlaceholder = () => {
    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h3 className={styles.title}>Patient Overview</h3>
                <div className={styles.legend}>
                    <div className={styles.legendItem}><span className={styles.dotOnTime}></span> On Time</div>
                    <div className={styles.legendItem}><span className={styles.dotLate}></span> On Late</div>
                </div>
            </div>
            
            <div className={styles.chartArea}>
                <div className={styles.yAxis}>
                    <span>100</span>
                    <span>80</span>
                    <span>60</span>
                    <span>40</span>
                    <span>20</span>
                    <span>0</span>
                </div>
                <div className={styles.graph}>
                    <svg viewBox="0 0 800 200" preserveAspectRatio="none" className={styles.svg}>
                        <path d="M0,100 C100,20 150,150 250,90 C350,30 450,160 550,110 C650,60 750,140 800,120" fill="none" stroke="var(--color-teal)" strokeWidth="3" />
                        <path d="M0,130 C150,80 200,180 300,100 C400,20 500,190 600,130 C700,70 750,160 800,150" fill="none" stroke="#d8b4e2" strokeWidth="3" />
                        
                        <circle cx="250" cy="90" r="5" fill="white" stroke="var(--color-teal)" strokeWidth="2.5" />
                        <circle cx="550" cy="110" r="5" fill="white" stroke="var(--color-teal)" strokeWidth="2.5" />
                        <circle cx="300" cy="100" r="5" fill="white" stroke="#d8b4e2" strokeWidth="2.5" />
                        <circle cx="600" cy="130" r="5" fill="white" stroke="#d8b4e2" strokeWidth="2.5" />
                    </svg>
                    
                    <div className={styles.xAxis}>
                        <span>10am</span>
                        <span>11am</span>
                        <span>12am</span>
                        <span>01am</span>
                        <span>02am</span>
                        <span>03am</span>
                        <span>04am</span>
                        <span>05am</span>
                        <span>06am</span>
                        <span>07am</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChartPlaceholder;
