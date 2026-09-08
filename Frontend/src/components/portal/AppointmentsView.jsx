import { useState } from 'react';
import { CalendarDays, CheckCircle2, Clock3, MoreHorizontal, Plus, Stethoscope, Users } from 'lucide-react';
import { useLanguage } from '../../i18n';
import ui from '../../pages/shared/PortalPage.module.css';

const patientRows = [
 { id:'APT-4829', person:'Dr. Sarah Jenkins', sub:'Cardiology consultation', date:'Oct 15, 2026', time:'10:00 AM', type:'In-person', status:'Upcoming' },
 { id:'APT-4830', person:'Dr. Robert Miles', sub:'Dental consultation', date:'Oct 22, 2026', time:'02:30 PM', type:'Virtual', status:'Upcoming' },
 { id:'APT-4710', person:'Dr. Emily Chen', sub:'General consultation', date:'Sep 05, 2026', time:'11:15 AM', type:'In-person', status:'Completed' },
 { id:'APT-4622', person:'Dr. Sarah Jenkins', sub:'Cardiology follow-up', date:'Aug 12, 2026', time:'09:00 AM', type:'In-person', status:'Completed' },
];
const doctorRows = [
 { id:'APT-4829', person:'Nevaeh Simmons', sub:'Routine checkup', date:'Today', time:'10:00 AM', type:'In-person', status:'Upcoming' },
 { id:'APT-4830', person:'Guy Hawkins', sub:'Post-surgery follow-up', date:'Today', time:'11:30 AM', type:'Virtual', status:'Upcoming' },
 { id:'APT-4710', person:'Darlene Robertson', sub:'Annual physical', date:'Today', time:'02:15 PM', type:'In-person', status:'Upcoming' },
 { id:'APT-4622', person:'Jerome Bell', sub:'ECG results review', date:'Yesterday', time:'09:00 AM', type:'Virtual', status:'Completed' },
];

export default function AppointmentsView({ doctor = false }) {
 const { t } = useLanguage();
 const [filter,setFilter]=useState('All'); const rows=doctor?doctorRows:patientRows; const shown=filter==='All'?rows:rows.filter(r=>r.status===filter);
 return <div className={ui.page}>
  <header className={ui.header}><div><div className={ui.eyebrow}>{doctor?'CLINICAL SCHEDULE':'YOUR CARE PLAN'}</div><h1>{doctor?'Today’s schedule':t('appointments.title')}</h1><p>{doctor?'Manage today’s consultations and patient visits.':t('appointments.subtitle')}</p></div><button className={ui.primary}><Plus size={15}/>{doctor?'New appointment':'Book appointment'}</button></header>
  <section className={ui.stats}><div className={ui.stat}><span className={ui.statIcon}><CalendarDays size={17}/></span><div><strong>{doctor?'12':'02'}</strong><span>{doctor?'Appointments today':'Upcoming visits'}</span></div></div><div className={ui.stat}><span className={ui.statIcon}><Clock3 size={17}/></span><div><strong>{doctor?'21m':'10:00'}</strong><span>{doctor?'Average consultation':'Next appointment'}</span></div></div><div className={ui.stat}><span className={ui.statIcon}><CheckCircle2 size={17}/></span><div><strong>{doctor?'08':'14'}</strong><span>{doctor?'Completed today':'Completed visits'}</span></div></div><div className={ui.stat}><span className={ui.statIcon}>{doctor?<Users size={17}/>:<Stethoscope size={17}/>}</span><div><strong>{doctor?'04':'03'}</strong><span>{doctor?'Patients waiting':'Care specialists'}</span></div></div></section>
  <section className={ui.card}><div className={ui.cardHeader}><div><h2>{doctor?'Consultation agenda':'Your appointment history'}</h2><p>{shown.length} appointments shown</p></div><div className={ui.tabs}>{['All','Upcoming','Completed'].map(x=><button className={filter===x?ui.active:''} onClick={()=>setFilter(x)} key={x}>{x}</button>)}</div></div><div className={ui.tableWrap}><table className={ui.table}><thead><tr><th>{doctor?'Patient':t('appointments.doctor')}</th><th>{t('appointments.date')}</th><th>Time</th><th>Visit type</th><th>{t('appointments.status')}</th><th/></tr></thead><tbody>{shown.map(r=><tr key={r.id}><td><div className={ui.person}><span className={ui.avatar}>{r.person.split(' ').map(x=>x[0]).slice(-2).join('')}</span><div><strong>{r.person}</strong><small>{r.sub} · {r.id}</small></div></div></td><td>{r.date}</td><td>{r.time}</td><td>{r.type}</td><td><span className={`${ui.badge} ${r.status==='Completed'?ui.success:ui.warning}`}>{r.status}</span></td><td><button className={ui.iconButton}><MoreHorizontal size={14}/></button></td></tr>)}</tbody></table></div></section>
 </div>;
}

