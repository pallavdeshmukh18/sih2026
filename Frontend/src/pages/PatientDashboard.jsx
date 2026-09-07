import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bell, CalendarDays, ChevronLeft, ChevronRight, Clock3, HeartPulse, MapPin, Search, Sparkles, Video } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import careImage from '../assets/indian-care-dashboard.png';
import styles from './PatientDashboard.module.css';

const bars=[58,43,72,46,66,79];
const schedule=[
 {title:'Morning yoga',detail:'07:00 AM · 25 min',tone:'green',icon:'ॐ'},
 {title:'Physiotherapy',detail:'09:00 AM · Care centre',tone:'orange',icon:'✦'},
];
const calendarDays=['26','27','28','29','30','1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30'];

export default function PatientDashboard(){
 const {user}=useAuth(); const [calendarMode,setCalendarMode]=useState('Monthly');
 return <div className={styles.dashboard}>
  <aside className={styles.wellness}>
   <div className={styles.wellnessCopy}><span className={styles.namaste}>NAMASTE</span><h2>Your health,<br/>our heartfelt care.</h2><p>Small mindful choices make every day healthier.</p><Link to="/patient/history">Check your wellbeing <ArrowRight size={14}/></Link></div>
   <div className={styles.pattern} aria-hidden="true">✦</div><img src={careImage} alt="Indian woman doctor checking a patient’s blood pressure in a calm clinic"/>
   <div className={styles.imageNote}><HeartPulse size={16}/><span><strong>Care rooted in trust</strong><small>Personal, private and always with you</small></span></div>
  </aside>

  <main className={styles.main}>
   <header className={styles.greeting}><div><span>MONDAY, 7 SEPTEMBER</span><h1>Namaste, {user?.firstName || 'Nisarg'} <i>✦</i></h1><p>Let’s take one thoughtful step for your health today.</p></div><div className={styles.headerActions}><button aria-label="Search"><Search size={17}/></button><button aria-label="Notifications"><Bell size={17}/><i/></button></div></header>

   <section><div className={styles.sectionHead}><div><span>NEXT VISIT</span><h2>Upcoming appointment</h2></div><Link to="/patient/appointments">View all <ArrowRight size={13}/></Link></div>
    <article className={styles.appointment}><div className={styles.hospitalVisual}><div className={styles.sun}/><div className={styles.building}><i/><i/><i/><strong>+</strong></div><span>Swasthya Care</span></div><div className={styles.doctor}><span className={styles.doctorAvatar}>AS</span><div><h3>Dr. Ananya Sharma</h3><p>General Physician</p><small><MapPin size={11}/> VitalHealth Clinic, Pune</small></div></div><div className={styles.appointmentTime}><span><CalendarDays size={15}/><i><small>Date</small>12 Sep 2026</i></span><span><Clock3 size={15}/><i><small>Time</small>09:00 AM</i></span></div><button className={styles.video}><Video size={14}/> Video call</button></article>
   </section>

   <section className={styles.activitySection}><div className={styles.sectionHead}><div><span>WELLNESS RHYTHM</span><h2>Your health activity</h2><p>July – December 2026</p></div><button className={styles.period}><CalendarDays size={13}/> 6 months <ChevronRight size={12}/></button></div><div className={styles.activityGrid}><article className={styles.chartCard}><div className={styles.chart}>{bars.map((height,i)=><div key={i} className={styles.barGroup}><span style={{height:`${height}%`}} className={i===5?styles.current:''}/><small>{['Jul','Aug','Sep','Oct','Nov','Dec'][i]}</small></div>)}</div><div className={styles.insight}><span><HeartPulse size={17}/></span><div><strong>Steady progress</strong><small>Your active days increased by 12%</small></div><ArrowRight size={15}/></div></article><article className={styles.progressCard}><Sparkles size={17}/><h3>Daily progress</h3><p>Keep nurturing your body and mind.</p><div className={styles.ring}><strong>80%</strong></div><small>4 of 5 habits completed</small></article></div></section>
  </main>

  <aside className={styles.rightPanel}>
   <div className={styles.sectionHead}><div><span>CARE CALENDAR</span><h2>Your appointments</h2></div></div>
   <section className={styles.calendar}><div className={styles.calendarTabs}>{['Monthly','Daily'].map(x=><button key={x} className={calendarMode===x?styles.active:''} onClick={()=>setCalendarMode(x)}><CalendarDays size={13}/>{x}</button>)}</div><div className={styles.month}><h3>September 2026</h3><span><button><ChevronLeft size={13}/></button><button><ChevronRight size={13}/></button></span></div><div className={styles.week}>{['S','M','T','W','T','F','S'].map((x,i)=><span key={`${x}${i}`}>{x}</span>)}</div><div className={styles.days}>{calendarDays.map((x,i)=><button key={i} className={`${i<5?styles.muted:''} ${x==='12'?styles.today:''}`}>{x}</button>)}</div></section>
   <div className={styles.scheduleList}>{schedule.map(item=><article key={item.title} className={`${styles.scheduleItem} ${styles[item.tone]}`}><span className={styles.scheduleIcon}>{item.icon}</span><div><h3>{item.title}</h3><p>{item.detail}</p></div><button><ChevronRight size={14}/></button></article>)}</div>
   <Link className={styles.more} to="/patient/schedule">See complete schedule <ArrowRight size={14}/></Link>
   <div className={styles.tip}><span>आज का सुझाव</span><strong>Stay hydrated</strong><p>A glass of water now keeps your energy flowing.</p></div>
  </aside>
 </div>;
}
