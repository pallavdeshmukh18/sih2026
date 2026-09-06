import React from 'react';
import { Edit2, Trash2 } from 'lucide-react';
import styles from './PatientTable.module.css';

const patients = [
    { id: '02', name: 'Nevaeh Simmons', room: 'Melati Room', age: 23, dob: '23 February 2023', status: 'Active', email: 'nevaeh@example.com', phone: '(316) 555-0116' },
    { id: '03', name: 'Nevaeh Simmons', room: 'Melati Room', age: 23, dob: '23 February 2023', status: 'Active', email: 'nevaeh@example.com', phone: '(316) 555-0116' },
    { id: '04', name: 'Nevaeh Simmons', room: 'Melati Room', age: 23, dob: '23 February 2023', status: 'Active', email: 'nevaeh@example.com', phone: '(316) 555-0116' },
    { id: '05', name: 'Nevaeh Simmons', room: 'Melati Room', age: 23, dob: '23 February 2023', status: 'Active', email: 'nevaeh@example.com', phone: '(316) 555-0116' },
];

const PatientTable = () => {
    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h2 className={styles.title}>Patient Overview</h2>
                    <p className={styles.subtitle}>Lorem ipsum dolor sit amet consectetur sit amet ipsum dolor sit amet consectetur.</p>
                </div>
                <div className={styles.tabs}>
                    <button className={`${styles.tab} ${styles.active}`}>Today</button>
                    <button className={styles.tab}>Weekly</button>
                    <button className={styles.tab}>Monthly</button>
                    <button className={styles.tab}>Yearly</button>
                </div>
            </div>
            
            <div className={styles.tableWrapper}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th><input type="checkbox" className={styles.checkbox} /></th>
                            <th>No</th>
                            <th>Name</th>
                            <th>Age</th>
                            <th>Date of Birth</th>
                            <th>Status</th>
                            <th>Email address</th>
                            <th>Phone</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {patients.map((patient, idx) => (
                            <tr key={idx}>
                                <td><input type="checkbox" className={styles.checkbox} /></td>
                                <td>{patient.id}</td>
                                <td>
                                    <div className={styles.nameCell}>
                                        <div className={styles.avatar}>{patient.name.charAt(0)}</div>
                                        <div>
                                            <div className={styles.name}>{patient.name}</div>
                                            <div className={styles.room}>{patient.room}</div>
                                        </div>
                                    </div>
                                </td>
                                <td>{patient.age}</td>
                                <td>{patient.dob}</td>
                                <td>
                                    <span className={styles.statusBadge}>
                                        <span className={styles.statusDot}></span>
                                        {patient.status}
                                    </span>
                                </td>
                                <td>{patient.email}</td>
                                <td>{patient.phone}</td>
                                <td>
                                    <div className={styles.actions}>
                                        <button className={styles.actionBtn}><Edit2 size={16} /></button>
                                        <button className={`${styles.actionBtn} ${styles.deleteBtn}`}><Trash2 size={16} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PatientTable;
