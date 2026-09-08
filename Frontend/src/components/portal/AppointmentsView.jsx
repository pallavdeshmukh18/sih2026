import { useState, useEffect, useCallback } from 'react';
import { CalendarDays, CheckCircle2, Clock3, MoreHorizontal, Plus, Stethoscope, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n';
import { getPatientAppointments, fetchDoctorQueue } from '../../services/api';
import ui from '../../pages/shared/PortalPage.module.css';

export default function AppointmentsView({ doctor = false }) {
    const { token } = useAuth();
    const { t } = useLanguage();
    const navigate = useNavigate();
    const [filter, setFilter] = useState('All');
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadAppointments = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        try {
            if (doctor) {
                const res = await fetchDoctorQueue(token);
                if (res?.queue) {
                    const formatted = res.queue.map(q => {
                        const sched = q.scheduledAt ? new Date(q.scheduledAt) : new Date();
                        const isDone = q.appointmentStatus === 'completed';
                        const isCanc = q.appointmentStatus === 'cancelled';
                        return {
                            id: q.appointmentId ? `APT-${String(q.appointmentId).slice(0, 6).toUpperCase()}` : 'APT',
                            rawId: q.appointmentId,
                            person: `${q.patient?.firstName || ''} ${q.patient?.lastName || ''}`.trim() || 'Patient',
                            sub: q.intake?.chiefComplaint || q.reason || 'Clinical Consultation',
                            date: sched.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }),
                            time: sched.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                            type: q.appointmentType === 'virtual' ? 'Virtual' : 'In-person',
                            status: isDone ? 'Completed' : isCanc ? 'Cancelled' : 'Upcoming',
                        };
                    });
                    setAppointments(formatted);
                }
            } else {
                const res = await getPatientAppointments(token);
                if (res?.appointments) {
                    const formatted = res.appointments.map(a => {
                        const sched = a.scheduled_at ? new Date(a.scheduled_at) : new Date();
                        const isDone = a.status === 'completed';
                        const isCanc = a.status === 'cancelled';
                        return {
                            id: `APT-${String(a.id).slice(0, 6).toUpperCase()}`,
                            rawId: a.id,
                            person: `Dr. ${a.doctor_first_name || ''} ${a.doctor_last_name || ''}`.trim() || 'Doctor',
                            sub: a.specialization ? `${a.specialization} · ${a.reason || 'Consultation'}` : (a.reason || 'Consultation'),
                            date: sched.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }),
                            time: sched.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                            type: a.appointment_type === 'virtual' ? 'Virtual' : 'In-person',
                            status: isDone ? 'Completed' : isCanc ? 'Cancelled' : 'Upcoming',
                        };
                    });
                    setAppointments(formatted);
                }
            }
        } catch (err) {
            console.error('Failed to load appointments:', err);
        } finally {
            setLoading(false);
        }
    }, [doctor, token]);

    useEffect(() => {
        loadAppointments();
    }, [loadAppointments]);

    const shown = filter === 'All' ? appointments : appointments.filter(r => r.status === filter);
    const upcomingCount = appointments.filter(r => r.status === 'Upcoming').length;
    const completedCount = appointments.filter(r => r.status === 'Completed').length;

    return (
        <div className={ui.page}>
            <header className={ui.header}>
                <div>
                    <div className={ui.eyebrow}>{doctor ? 'CLINICAL SCHEDULE' : 'YOUR CARE PLAN'}</div>
                    <h1>{doctor ? 'Today’s schedule' : t('appointments.title')}</h1>
                    <p>{doctor ? 'Manage today’s consultations and patient visits.' : t('appointments.subtitle')}</p>
                </div>
                {!doctor && (
                    <button className={ui.primary} onClick={() => navigate('/patient/doctors')}>
                        <Plus size={15} /> Book appointment
                    </button>
                )}
            </header>

            <section className={ui.stats}>
                <div className={ui.stat}>
                    <span className={ui.statIcon}><CalendarDays size={17} /></span>
                    <div>
                        <strong>{String(appointments.length).padStart(2, '0')}</strong>
                        <span>{doctor ? 'Total Appointments' : 'Total Visits'}</span>
                    </div>
                </div>
                <div className={ui.stat}>
                    <span className={ui.statIcon}><Clock3 size={17} /></span>
                    <div>
                        <strong>{String(upcomingCount).padStart(2, '0')}</strong>
                        <span>{doctor ? 'Upcoming Consultations' : 'Upcoming Visits'}</span>
                    </div>
                </div>
                <div className={ui.stat}>
                    <span className={ui.statIcon}><CheckCircle2 size={17} /></span>
                    <div>
                        <strong>{String(completedCount).padStart(2, '0')}</strong>
                        <span>{doctor ? 'Completed Consultations' : 'Completed Visits'}</span>
                    </div>
                </div>
                <div className={ui.stat}>
                    <span className={ui.statIcon}>{doctor ? <Users size={17} /> : <Stethoscope size={17} />}</span>
                    <div>
                        <strong>{doctor ? `${upcomingCount}` : 'Verified'}</strong>
                        <span>{doctor ? 'Patients in Queue' : 'Clinical Care'}</span>
                    </div>
                </div>
            </section>

            <section className={ui.card}>
                <div className={ui.cardHeader}>
                    <div>
                        <h2>{doctor ? 'Consultation agenda' : 'Your appointment history'}</h2>
                        <p>{shown.length} appointments shown</p>
                    </div>
                    <div className={ui.tabs}>
                        {['All', 'Upcoming', 'Completed'].map(x => (
                            <button className={filter === x ? ui.active : ''} onClick={() => setFilter(x)} key={x}>
                                {x}
                            </button>
                        ))}
                    </div>
                </div>

                <div className={ui.tableWrap}>
                    {loading ? (
                        <div style={{ padding: '32px', textAlign: 'center', color: '#6b7280' }}>
                            Loading appointments...
                        </div>
                    ) : shown.length === 0 ? (
                        <div style={{ padding: '40px 16px', textAlign: 'center', color: '#6b7280' }}>
                            <CalendarDays size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                            <p style={{ margin: 0, fontWeight: 500 }}>No appointments found</p>
                            <small style={{ color: '#9ca3af' }}>{filter === 'All' ? 'No appointments recorded yet.' : `No ${filter.toLowerCase()} appointments.`}</small>
                        </div>
                    ) : (
                        <table className={ui.table}>
                            <thead>
                                <tr>
                                    <th>{doctor ? 'Patient' : t('appointments.doctor')}</th>
                                    <th>{t('appointments.date')}</th>
                                    <th>Time</th>
                                    <th>Visit type</th>
                                    <th>{t('appointments.status')}</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {shown.map(r => (
                                    <tr key={r.id}>
                                        <td>
                                            <div className={ui.person}>
                                                <span className={ui.avatar}>{r.person.charAt(0)}</span>
                                                <div>
                                                    <strong>{r.person}</strong>
                                                    <small>{r.sub} · {r.id}</small>
                                                </div>
                                            </div>
                                        </td>
                                        <td>{r.date}</td>
                                        <td>{r.time}</td>
                                        <td>{r.type}</td>
                                        <td>
                                            <span className={`${ui.badge} ${r.status === 'Completed' ? ui.success : ui.warning}`}>
                                                {r.status}
                                            </span>
                                        </td>
                                        <td>
                                            <button className={ui.iconButton}><MoreHorizontal size={14} /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </section>
        </div>
    );
}
