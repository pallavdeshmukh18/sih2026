import { useState, useEffect } from 'react';
import { CalendarDays, CheckCircle2, Clock3, MoreHorizontal, Plus, Stethoscope, Users, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n';
import { getPatientAppointments, getDoctorQueue } from '../../services/api';
import ui from '../../pages/shared/PortalPage.module.css';

export default function AppointmentsView({ doctor = false }) {
  const { t } = useLanguage();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    const fetchAppointments = async () => {
      setLoading(true);
      setError('');
      try {
        if (doctor) {
          const res = await getDoctorQueue(token);
          if (res && res.queue) {
            const mapped = res.queue.map((item) => ({
              id: item.appointmentId,
              shortId: `APT-${String(item.appointmentId).slice(0, 6).toUpperCase()}`,
              person: `${item.patient?.firstName || ''} ${item.patient?.lastName || ''}`.trim() || 'Patient',
              sub: item.intake?.chiefComplaint || item.reason || 'Consultation',
              date: new Date(item.scheduledAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }),
              time: new Date(item.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              rawDate: new Date(item.scheduledAt),
              type: item.appointmentType === 'teleconsultation' ? 'Virtual' : 'In-person',
              status: item.appointmentStatus === 'completed' ? 'Completed' : 'Upcoming',
            }));
            setAppointments(mapped);
          }
        } else {
          const res = await getPatientAppointments(token);
          if (res && res.appointments) {
            const mapped = res.appointments.map((item) => ({
              id: item.id,
              shortId: `APT-${String(item.id).slice(0, 6).toUpperCase()}`,
              person: `Dr. ${item.doctor?.firstName || ''} ${item.doctor?.lastName || ''}`.trim() || 'Medical Specialist',
              sub: item.doctor?.specialization ? `${item.doctor.specialization} · ${item.reason || ''}` : (item.reason || 'General Visit'),
              date: new Date(item.scheduledAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }),
              time: new Date(item.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              rawDate: new Date(item.scheduledAt),
              type: item.appointmentType === 'teleconsultation' ? 'Virtual' : 'In-person',
              status: item.status === 'completed' ? 'Completed' : 'Upcoming',
            }));
            setAppointments(mapped);
          }
        }
      } catch (err) {
        console.error("Failed to load appointments:", err);
        setError("Unable to load appointments. Please check connection.");
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchAppointments();
    }
  }, [doctor, token]);

  const shown = filter === 'All' ? appointments : appointments.filter(r => r.status === filter);
  const upcomingCount = appointments.filter(a => a.status === 'Upcoming').length;
  const completedCount = appointments.filter(a => a.status === 'Completed').length;

  const nextAppointment = appointments
    .filter(a => a.status === 'Upcoming')
    .sort((a, b) => a.rawDate - b.rawDate)[0];

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

      {/* Stats Overview */}
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

      {/* Main Appointment Table */}
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


