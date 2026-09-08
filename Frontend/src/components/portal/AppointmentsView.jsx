import { useState, useEffect, useCallback } from 'react';
import { CalendarDays, CheckCircle2, Clock3, MoreHorizontal, Plus, Stethoscope, Users, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n';
import { getPatientAppointments, getDoctorQueue, fetchDoctorQueue } from '../../services/api';
import ui from '../../pages/shared/PortalPage.module.css';

export default function AppointmentsView({ doctor = false }) {
  const { token } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('All');

  const fetchFn = doctor ? (getDoctorQueue || fetchDoctorQueue) : getPatientAppointments;

  const loadAppointments = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      if (doctor) {
        const queueFn = getDoctorQueue || fetchDoctorQueue;
        const res = await queueFn(token);
        if (res && res.queue) {
          const mapped = res.queue.map((item) => {
            const patFirstName = item.patient?.firstName || item.patient_first_name || '';
            const patLastName = item.patient?.lastName || item.patient_last_name || '';
            const patName = `${patFirstName} ${patLastName}`.trim() || 'Patient';
            const chiefComp = item.intake?.chiefComplaint || item.reason || 'Consultation';

            const rawScheduledAt = item.scheduledAt || item.scheduled_at;
            const dateObj = rawScheduledAt ? new Date(rawScheduledAt) : null;
            const isValidDate = dateObj && !isNaN(dateObj.getTime());

            const dateStr = isValidDate
              ? dateObj.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
              : 'Not Scheduled';
            const timeStr = isValidDate
              ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : 'N/A';

            const apptType = item.appointmentType || item.appointment_type;
            const apptStatus = item.appointmentStatus || item.status;

            return {
              id: item.appointmentId || item.id,
              shortId: item.appointmentId ? `APT-${String(item.appointmentId).slice(0, 6).toUpperCase()}` : `APT-${String(item.id || '').slice(0, 6).toUpperCase()}`,
              person: patName,
              sub: chiefComp,
              date: dateStr,
              time: timeStr,
              rawDate: isValidDate ? dateObj : new Date(0),
              type: apptType === 'teleconsultation' || apptType === 'virtual' ? 'Virtual' : 'In-person',
              status: apptStatus === 'completed' ? 'Completed' : apptStatus === 'cancelled' ? 'Cancelled' : 'Upcoming',
            };
          });
          setAppointments(mapped);
        }
      } else {
        const res = await getPatientAppointments(token);
        if (res && res.appointments) {
          const mapped = res.appointments.map((item) => {
            const docFirstName = item.doctor?.firstName || item.doctor_first_name || '';
            const docLastName = item.doctor?.lastName || item.doctor_last_name || '';
            const rawDocName = item.doctor?.name || `${docFirstName} ${docLastName}`.trim();
            const docName = rawDocName ? (rawDocName.startsWith('Dr.') ? rawDocName : `Dr. ${rawDocName}`) : 'Medical Specialist';
            const spec = item.doctor?.specialization || item.specialization || '';
            const reasonText = item.reason || 'General Visit';
            const subText = spec ? `${spec} · ${reasonText}` : reasonText;

            const rawScheduledAt = item.scheduledAt || item.scheduled_at;
            const dateObj = rawScheduledAt ? new Date(rawScheduledAt) : null;
            const isValidDate = dateObj && !isNaN(dateObj.getTime());

            const dateStr = isValidDate
              ? dateObj.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
              : 'Not Scheduled';
            const timeStr = isValidDate
              ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : 'N/A';

            const apptType = item.appointmentType || item.appointment_type;

            return {
              id: item.id,
              shortId: `APT-${String(item.id).slice(0, 6).toUpperCase()}`,
              person: docName,
              sub: subText,
              date: dateStr,
              time: timeStr,
              rawDate: isValidDate ? dateObj : new Date(0),
              type: apptType === 'teleconsultation' || apptType === 'virtual' ? 'Virtual' : 'In-person',
              status: item.status === 'completed' ? 'Completed' : item.status === 'cancelled' ? 'Cancelled' : 'Upcoming',
            };
          });
          setAppointments(mapped);
        }
      }
    } catch (err) {
      console.error('Failed to load appointments:', err);
      setError('Unable to load appointments. Please check connection.');
    } finally {
      setLoading(false);
    }
  }, [doctor, token]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const shown = filter === 'All' ? appointments : appointments.filter(r => r.status === filter);
  const upcomingCount = appointments.filter(a => a.status === 'Upcoming').length;
  const completedCount = appointments.filter(a => a.status === 'Completed').length;

  const validUpcomingAppointments = appointments.filter(a => a.status === 'Upcoming' && a.rawDate.getTime() > 0);
  const nextAppointment = validUpcomingAppointments.sort((a, b) => a.rawDate - b.rawDate)[0];

  return (
    <div className={ui.page}>
      <header className={ui.header}>
        <div>
          <div className={ui.eyebrow}>{doctor ? 'CLINICAL SCHEDULE' : 'YOUR CARE PLAN'}</div>
          <h1>{doctor ? "Today's schedule" : t('appointments.title')}</h1>
          <p>{doctor ? "Manage today's consultations and patient visits." : t('appointments.subtitle')}</p>
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
            <strong>{String(upcomingCount).padStart(2, '0')}</strong>
            <span>{doctor ? 'Appointments queue' : 'Upcoming visits'}</span>
          </div>
        </div>

        <div className={ui.stat}>
          <span className={ui.statIcon}><Clock3 size={17} /></span>
          <div>
            <strong>{nextAppointment ? nextAppointment.time : 'None'}</strong>
            <span>{doctor ? 'Next patient time' : 'Next appointment'}</span>
          </div>
        </div>

        <div className={ui.stat}>
          <span className={ui.statIcon}><CheckCircle2 size={17} /></span>
          <div>
            <strong>{String(completedCount).padStart(2, '0')}</strong>
            <span>{doctor ? 'Completed today' : 'Completed visits'}</span>
          </div>
        </div>

        <div className={ui.stat}>
          <span className={ui.statIcon}>{doctor ? <Users size={17} /> : <Stethoscope size={17} />}</span>
          <div>
            <strong>{String(appointments.length).padStart(2, '0')}</strong>
            <span>{doctor ? 'Total patients' : 'Total records'}</span>
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
            <div style={{ padding: '32px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
              Loading appointments...
            </div>
          ) : error ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#dc2626', fontSize: '14px' }}>
              <AlertCircle size={20} style={{ marginBottom: '6px' }} />
              <div>{error}</div>
            </div>
          ) : shown.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
              No appointments found for the selected filter.
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
                {shown.map(r => {
                  const initials = r.person.split(' ').map(x => x[0]).slice(-2).join('').toUpperCase();
                  return (
                    <tr key={r.id}>
                      <td>
                        <div className={ui.person}>
                          <span className={ui.avatar}>{initials}</span>
                          <div>
                            <strong>{r.person}</strong>
                            <small>{r.sub} · {r.shortId}</small>
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
                        <button className={ui.iconButton}>
                          <MoreHorizontal size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
