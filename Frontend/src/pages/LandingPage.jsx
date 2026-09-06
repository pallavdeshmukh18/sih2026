import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Activity, Clock, Calendar, CheckCircle, Video, MessageSquare, 
    Shield, FileText, ChevronDown, Plus, Search, MapPin, Play, Star, ArrowRight, Menu, X, Mail
} from 'lucide-react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import detailsTabletImg from '../assets/details_tablet.jpg';
import heroBg from '../assets/hero_bg.jpg';
import anim1 from '../assets/animations/6855771.lottie?url';
import anim2 from '../assets/animations/6855773.lottie?url';
import anim3 from '../assets/animations/6855776.lottie?url';
import test1 from '../assets/test1.jpg';
import test2 from '../assets/test2.jpg';
import test3 from '../assets/test3.jpg';
import styles from './LandingPage.module.css';

const tabs = [
  {
    id: 'kidney',
    title: 'Kidney Disease',
    description: 'Help manage blood pressure medications, coordinate lifestyle modifications (diet, exercise, monitoring appointments), and provide patient education and ongoing support for you.'
  },
  {
    id: 'hypertension',
    title: 'Hypertension',
    description: 'We offer specialized monitoring routines, medication reminders, and coordinate with your primary care provider to keep your blood pressure perfectly managed.'
  },
  {
    id: 'diabetes',
    title: 'Diabetes',
    description: 'Track your blood sugar levels, get continuous dietary guidance, and receive automated reminders for insulin and regular check-ups to keep your diabetes fully under control.'
  },
  {
    id: 'heart-disease',
    title: 'Heart Disease',
    description: 'Comprehensive cardiovascular care coordination including medication management, cholesterol tracking, and post-operative lifestyle rehabilitation tailored to your heart health.'
  },
  {
    id: 'asthma',
    title: 'Asthma',
    description: 'Monitor respiratory triggers, manage inhaler prescriptions, and ensure you have an up-to-date action plan ready for both daily maintenance and sudden flare-ups.'
  }
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};

const faqs = [
  {
    question: "Does My Insurance Cover This, And Will I Have To Pay Anything?",
    answer: "Advocates Don't Cost A Cent Because Your Insurance Covers All Patient Advocacy Fees. You Would Usually Pay For It Out Of Pocket. If It Turns Out That Your Insurance Does Not Cover It, We Simply Invoice You For The Month. No Hidden Fees. Cancel Anytime."
  },
  {
    question: "Is MediKiosk AI Or Humans?",
    answer: "MediKiosk is a combination of both. We use AI to handle administrative tasks and gather information, while our dedicated human advocates provide personalized care, empathy, and strategic guidance for your unique health journey."
  },
  {
    question: "What Is A Care Advocate?",
    answer: "A care advocate is a professional who helps you navigate the complex healthcare system. They assist with understanding diagnoses, communicating with doctors, managing billing issues, and ensuring you receive the best possible care."
  },
  {
    question: "Why Do I Need A Care Advocate?",
    answer: "Navigating healthcare can be overwhelming, especially when dealing with chronic conditions or complex treatments. An advocate serves as your personal guide, reducing stress, preventing medical errors, and saving you time and money."
  }
];

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleMenu = () => setMenuOpen(!menuOpen);

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate("/auth");
  };

  const dashboardPath = user?.role === "doctor" ? "/doctor/dashboard" : "/patient/dashboard";
  const displayName = user?.role === "doctor" ? `Dr. ${user.firstName}` : user?.firstName;

  return (
    <nav className={`${styles.Navbar_navbar} ${scrolled ? 'glass' : ""}`}>
      <div className={styles.Navbar_container}>
        <Link to="/" className={styles.Navbar_logo}>
          MediKiosk
        </Link>

        <ul className={`${styles.Navbar_navLinks} ${menuOpen ? styles.Navbar_navLinksOpen : ""}`}>
          <li>
            <a href="#mission" onClick={() => setMenuOpen(false)}>
              Our Mission
            </a>
          </li>
          <li>
            <a href="#insights" onClick={() => setMenuOpen(false)}>
              Insights
            </a>
          </li>
          <li>
            <a href="#work" onClick={() => setMenuOpen(false)}>
              Work With Us
            </a>
          </li>
          <li>
            <a href="#faqs" onClick={() => setMenuOpen(false)}>
              FAQs
            </a>
          </li>

          {/* Mobile only actions in menu */}
          <div className={styles.Navbar_mobileActions}>
            {isAuthenticated ? (
              <>
                <Link to={dashboardPath} className={styles.Navbar_loginBtn} onClick={() => setMenuOpen(false)}>
                  {displayName} (Dashboard)
                </Link>
                <button onClick={handleLogout} className={styles.Navbar_startBtn}>
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/auth" className={styles.Navbar_loginBtn} onClick={() => setMenuOpen(false)}>
                  Login
                </Link>
                <Link to="/auth" className={styles.Navbar_startBtn} onClick={() => setMenuOpen(false)}>
                  Get Started
                </Link>
              </>
            )}
          </div>
        </ul>

        <div className={styles.Navbar_actions}>
          {isAuthenticated ? (
            <>
              <Link to={dashboardPath} className={styles.Navbar_loginBtn}>
                {displayName} (Dashboard)
              </Link>
              <button onClick={handleLogout} className={styles.Navbar_startBtn}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/auth" className={styles.Navbar_loginBtn}>
                Login
              </Link>
              <Link to="/auth" className={styles.Navbar_startBtn}>
                Get Started
              </Link>
            </>
          )}
        </div>

        {/* Hamburger Menu Toggle */}
        <button
          className={`${styles.Navbar_hamburger} ${menuOpen ? styles.Navbar_open : ""}`}
          onClick={toggleMenu}
          aria-label="Toggle menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>

      {/* Backdrop for mobile menu */}
      {menuOpen && <div className={styles.Navbar_backdrop} onClick={toggleMenu}></div>}
    </nav>
  );
};

const Hero = () => {
  return (
    <section className={styles.Hero_hero} style={{ backgroundImage: `url(${heroBg})` }}>
      <div className={styles.Hero_overlay}></div>
      <motion.div 
        className={styles.Hero_content}
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <span className={styles.Hero_label}>MEDIKIOSK HEALTH SYSTEM</span>
        <h1 className={styles.Hero_title}>
          Navigating Healthcare Is<br />Hard But Manageable.
        </h1>
        <p className={styles.Hero_subtitle}>
          Imagine a healthcare journey designed for you — clear, transparent, and supportive.
        </p>
        <div className={styles.Hero_ctaGroup}>
          <Link to="/auth" className={styles.Hero_ctaButton}>
            Book A Call With Us Today
          </Link>
        </div>
        
        <div className={styles.Hero_partners}>
          {/* We'll use simple text/spans to represent logos for now as they are small and gray */}
          <span className={styles.Hero_partnerLogo}>NIH</span>
          <span className={styles.Hero_partnerLogo}>AARP</span>
          <span className={styles.Hero_partnerLogo}>Y COMBINATOR</span>
          <span className={styles.Hero_partnerLogo}>FORBES</span>
        </div>
      </motion.div>
      
      {/* Bottom gradient transition to next section */}
      <div className={styles.Hero_bottomGradient}></div>
    </section>
  );
};

const HowItWorks = () => {
  return (
    <section id="mission" className="section" style={{ backgroundColor: 'var(--color-light-grey)' }}>
      <div className={`container ${styles.HowItWorks_container}`}>
        <motion.div 
          className={styles.HowItWorks_header}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
        >
          <h2>Here's How It Works</h2>
          <p>A simpler, more effective healing process with MediKiosk.</p>
        </motion.div>
        
        <div className={styles.HowItWorks_zigZagContainer}>
          {/* Row 1: SVG Left, Text Right */}
          <motion.div 
            className={styles.HowItWorks_row}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7 }}
          >
            <div className={styles.HowItWorks_visualCol}>
              <div className={styles.HowItWorks_lottieContainer}>
                <DotLottieReact src={anim1} loop autoplay />
              </div>
            </div>
            <div className={styles.HowItWorks_textCol}>
              <span className={styles.HowItWorks_stepNumber}>Step 01</span>
              <h3>Consultation</h3>
              <p>Start with a quick chat to let us know your concerns.</p>
            </div>
          </motion.div>

          {/* Row 2: Text Left, SVG Right */}
          <motion.div 
            className={`${styles.HowItWorks_row} ${styles.HowItWorks_rowReverse}`}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7 }}
          >
            <div className={styles.HowItWorks_visualCol}>
              <div className={styles.HowItWorks_lottieContainer}>
                <DotLottieReact src={anim2} loop autoplay />
              </div>
            </div>
            <div className={styles.HowItWorks_textCol}>
              <span className={styles.HowItWorks_stepNumber}>Step 02</span>
              <h3>Meet Your Advocate</h3>
              <p>We will match you with a dedicated advocate who will guide you every step.</p>
              
              <div className={styles.HowItWorks_statBox}>
                <div className={styles.HowItWorks_statLarge}>+98%</div>
                <div className={styles.HowItWorks_statLabel}>Patient satisfaction<br/>guaranteed.</div>
              </div>
            </div>
          </motion.div>

          {/* Row 3: SVG Left, Text Right */}
          <motion.div 
            className={styles.HowItWorks_row}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7 }}
          >
            <div className={styles.HowItWorks_visualCol}>
              <div className={styles.HowItWorks_lottieContainer}>
                <DotLottieReact src={anim3} loop autoplay />
              </div>
            </div>
            <div className={styles.HowItWorks_textCol}>
              <span className={styles.HowItWorks_stepNumber}>Step 03</span>
              <h3>Focus On You</h3>
              <p>An individual approach, care, and attention from the onset of your health management plan.</p>
              
              <div className={styles.HowItWorks_statsRow}>
                <div className={styles.HowItWorks_statItem}>
                  <div className={styles.HowItWorks_statNum}>10+</div>
                  <div className={styles.HowItWorks_statText}>Years Experience</div>
                </div>
                <div className={styles.HowItWorks_statItem}>
                  <div className={styles.HowItWorks_statNum}>50+</div>
                  <div className={styles.HowItWorks_statText}>Professionals</div>
                </div>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
};

const Highlight = () => {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <section className={styles.Highlight_section}>
      <motion.div 
        className={`container ${styles.Highlight_container}`}
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        
        {/* Left Card */}
        <div className={styles.Highlight_leftCard}>
          <div className={styles.Highlight_cardHeader}>
            <span className={styles.Highlight_eyebrow}>For you or your loved ones</span>
          </div>
          
          <div className={styles.Highlight_list}>
            {tabs.map((tab, index) => (
              <button 
                key={tab.id}
                className={`${styles.Highlight_listItem} ${activeTab === index ? styles.Highlight_activeItem : ''}`}
                onClick={() => setActiveTab(index)}
              >
                <h3 className={activeTab === index ? '' : styles.Highlight_inactiveText}>
                  {tab.title}
                </h3>
              </button>
            ))}
          </div>

          <div className={styles.Highlight_cardFooter}>
            <p>Find dedicated advocates who specialize in your unique healthcare priorities.</p>
          </div>
        </div>

        {/* Right Card */}
        <div className={styles.Highlight_rightCard}>
          <div className={styles.Highlight_rightCardContent}>
            <span className={styles.Highlight_eyebrowLight}>A dedicated advocate</span>
            <div className={styles.Highlight_textWrapper}>
              <p key={activeTab} className={`${styles.Highlight_rightCardText} ${styles.Highlight_fadeIn}`}>
                {tabs[activeTab].description}
              </p>
            </div>
            <button className={styles.Highlight_playButton}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          </div>
          <div className={styles.Highlight_colorfulBg}></div>
        </div>
        
      </motion.div>
    </section>
  );
};

const DetailsSection = () => {
  return (
    <section className="section" style={{ backgroundColor: 'var(--color-light-grey)' }}>
      <div className={`container ${styles.DetailsSection_container}`}>
        <motion.div 
          className={styles.DetailsSection_header}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
        >
          <h2>Dedicated Care At Your Command.</h2>
          <p>Navigating the complex healthcare system can be overwhelming. Let us handle the details while you focus on what truly matters.</p>
        </motion.div>

        <motion.div 
          className={styles.DetailsSection_imageContainer}
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
        >
          <img src={detailsTabletImg} alt="Senior man on tablet" />
        </motion.div>

        <motion.div 
          className={styles.DetailsSection_cardsGrid}
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {/* Card 1 */}
          <motion.div variants={itemVariants} className={styles.DetailsSection_infoCard}>
            <h4>Kidney Disease</h4>
            <ul>
              <li>We will match you with an advocate who has specific experience.</li>
              <li>Receive guidance on dietary changes, treatment options, and dialysis.</li>
            </ul>
          </motion.div>
          
          {/* Card 2 */}
          <motion.div variants={itemVariants} className={styles.DetailsSection_infoCard}>
            <h4>Hypertension</h4>
            <ul>
              <li>We offer specialized monitoring routines and medication reminders.</li>
              <li>We coordinate with your primary care provider to keep your blood pressure perfectly managed.</li>
            </ul>
          </motion.div>

          {/* Card 3 */}
          <motion.div variants={itemVariants} className={styles.DetailsSection_infoCard}>
            <h4>Mobility Endorsements</h4>
            <ul>
              <li>Our advocates help arrange physical therapy and acquire necessary mobility equipment.</li>
              <li>We ensure your living space is adapted for maximum safety and independence.</li>
            </ul>
          </motion.div>

          {/* Card 4 */}
          <motion.div variants={itemVariants} className={styles.DetailsSection_infoCard}>
            <h4>Parkinson's Care</h4>
            <ul>
              <li>Receive dedicated support for complex medication schedules and physical therapy coordination.</li>
              <li>We provide emotional support tailored specifically to Parkinson's care.</li>
            </ul>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

const AIFeatures = () => {
  const headerRef = useScrollReveal();
  const c1Ref = useScrollReveal({ threshold: 0.1, triggerOnce: true });
  const c2Ref = useScrollReveal({ threshold: 0.1, triggerOnce: true });
  const c3Ref = useScrollReveal({ threshold: 0.1, triggerOnce: true });

  return (
    <section id="insights" className="section">
      <div className={`container ${styles.AIFeatures_container}`}>
        <div ref={headerRef} className={`${styles.AIFeatures_header} reveal`}>
          <span className={styles.AIFeatures_label}>AI SUPPORT</span>
          <h2>Automated features to keep you on track.</h2>
        </div>

        <div className={styles.AIFeatures_grid}>
          {/* Feature 1 */}
          <div ref={c1Ref} className={`${styles.AIFeatures_featureCard} reveal delay-100`}>
            <div className={styles.AIFeatures_iconBox}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </div>
            <h4>Maximum Appointment and Focus</h4>
            <p>Our match algorithm pairs you with the ideal advocate for your ongoing care.</p>
          </div>

          {/* Feature 2 */}
          <div ref={c2Ref} className={`${styles.AIFeatures_featureCard} reveal delay-200`}>
            <div className={styles.AIFeatures_iconBox}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
              </svg>
            </div>
            <h4>Build Better Phone Calls</h4>
            <p>Our proprietary AI will call your providers to gather health, details on bills, and clarify to save you time and frustration over phone calls.</p>
          </div>

          {/* Feature 3 */}
          <div ref={c3Ref} className={`${styles.AIFeatures_featureCard} reveal delay-300`}>
            <div className={styles.AIFeatures_iconBox}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            </div>
            <h4>AI Companionship</h4>
            <p>Get 24/7 assistance from AI tailored to your specific health needs and history.</p>
          </div>
        </div>
      </div>
    </section>
  );
};

const Testimonials = () => {
  const headerRef = useScrollReveal();
  const c1Ref = useScrollReveal({ threshold: 0.1, triggerOnce: true });
  const c2Ref = useScrollReveal({ threshold: 0.1, triggerOnce: true });
  const c3Ref = useScrollReveal({ threshold: 0.1, triggerOnce: true });

  return (
    <section className={styles.Testimonials_section}>
      <div className={`container ${styles.Testimonials_container}`}>
        <h2 ref={headerRef} className={`${styles.Testimonials_header} reveal`}>Trusted By Families Like Yours</h2>

        <div className={styles.Testimonials_grid}>
          
          {/* Column 1 */}
          <div ref={c1Ref} className={`${styles.Testimonials_column} reveal delay-100`}>
            <div className={styles.Testimonials_videoCard}>
              <img src={test1} alt="Larry, 82" />
              <div className={styles.Testimonials_videoOverlay}>
                <button className={styles.Testimonials_playBtn}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>
                <span className={styles.Testimonials_name}>Larry, 82</span>
              </div>
            </div>
            
            <div className={styles.Testimonials_quoteCard}>
              <span className={styles.Testimonials_quoteIcon}>“</span>
              <p>"It's Fast And Simple. It's Hassle Free And The Feeling That I Matter A Lot Is Just Great. I Have Left All My Care In AI's Hands."</p>
            </div>
          </div>

          {/* Column 2 */}
          <div ref={c2Ref} className={`${styles.Testimonials_column} reveal delay-200`}>
            <div className={styles.Testimonials_quoteCard}>
              <span className={styles.Testimonials_quoteIcon}>“</span>
              <p>"My mom has gotten to start to decline, now I look forward to a cheerful call from someone she laughs with every day. It feels like family now."</p>
            </div>

            <div className={styles.Testimonials_videoCard}>
              <img src={test3} alt="Michael, 67" />
              <div className={styles.Testimonials_videoOverlay}>
                <button className={styles.Testimonials_playBtn}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>
                <span className={styles.Testimonials_name}>Michael, 67</span>
              </div>
            </div>
          </div>

          {/* Column 3 */}
          <div ref={c3Ref} className={`${styles.Testimonials_column} reveal delay-300`}>
            <div className={styles.Testimonials_videoCard}>
              <img src={test2} alt="Gary, 74" />
              <div className={styles.Testimonials_videoOverlay}>
                <button className={styles.Testimonials_playBtn}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>
                <span className={styles.Testimonials_name}>Gary, 74</span>
              </div>
            </div>
            
            <div className={styles.Testimonials_quoteCard}>
              <span className={styles.Testimonials_quoteIcon}>“</span>
              <p>"I Didn't Even Realize How Much Help Was Available Health-wise I Found To Know It's Like Having An Assistant In My Pocket."</p>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

const FAQ = () => {
  const [openIndex, setOpenIndex] = useState(0);
  const headerRef = useScrollReveal();
  const listRef = useScrollReveal({ threshold: 0.1, triggerOnce: true });

  const toggleOpen = (index) => {
    setOpenIndex(openIndex === index ? -1 : index);
  };

  return (
    <section className="section" id="faqs">
      <div className={`container ${styles.FAQ_container}`}>
        <div ref={headerRef} className={`${styles.FAQ_header} reveal`}>
          <h2>Your Questions Answered</h2>
          <p>Find answers to the most common questions our users ask.</p>
        </div>

        <div ref={listRef} className={`${styles.FAQ_faqList} reveal delay-100`}>
          {faqs.map((faq, index) => (
            <div 
              key={index} 
              className={`${styles.FAQ_faqItem} ${openIndex === index ? styles.FAQ_open : ''}`}
            >
              <button 
                className={styles.FAQ_faqQuestion} 
                onClick={() => toggleOpen(index)}
              >
                {faq.question}
                <span className={styles.FAQ_icon}>
                  {openIndex === index ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 15l-6-6-6 6"/>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 9l6 6 6-6"/>
                    </svg>
                  )}
                </span>
              </button>
              <div className={styles.FAQ_faqAnswer}>
                <div className={styles.FAQ_answerContent}>
                  {faq.answer}
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className={styles.FAQ_actions}>
          <button className={styles.FAQ_seeAllBtn}>See All FAQs</button>
        </div>
      </div>
    </section>
  );
};

const Footer = () => {
  return (
    <footer className={styles.Footer_footerWrapper} id="work">
      {/* Background elements */}
      <div className={styles.Footer_radialBg}></div>
      {/* CTA Section */}
      <div className={styles.Footer_ctaSection}>
        <h2 className={styles.Footer_ctaTitle}>
          Transform your healthcare<br />
          workflows with <span className={styles.Footer_highlightText}>intelligent AI</span><br />
          <span className={styles.Footer_highlightText}>built for providers</span>
        </h2>
        <p className={styles.Footer_ctaDescription}>
          Streamline operations, reduce administrative burden, and deliver better patient outcomes
          with MediKiosk's AI-powered platform.
        </p>
        <Link to="/auth" className={styles.Footer_ctaButton}>Request a Demo</Link>
      </div>

      {/* Footer Card */}
      <div className={`container ${styles.Footer_cardContainer}`}>
        <div className={styles.Footer_bgTextWrapper}>
          <div className={styles.Footer_bgText}>MediKiosk</div>
        </div>
        <div className={styles.Footer_footerCard}>
          <div className={styles.Footer_footerTop}>
            {/* Column 1: Logo & Info */}
            <div className={styles.Footer_footerColMain}>
              <Link to="/" className={styles.Footer_logo}>
                <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6 18C6 14.6863 8.68629 12 12 12H16V22H6V18Z" fill="var(--color-dark)"/>
                  <path d="M14 18C14 14.6863 16.6863 12 20 12H24V22H14V18Z" fill="var(--color-dark)"/>
                  <path d="M22 18C22 14.6863 24.6863 12 28 12H32V22H22V18Z" fill="var(--color-dark)"/>
                </svg>
                MediKiosk
              </Link>
              <p className={styles.Footer_companyInfo}>
                AI-powered infrastructure designed to support healthcare providers with smarter workflows
              </p>
              <Link to="/auth" className={styles.Footer_getAppBtn}>Get MediKiosk AI</Link>
            </div>

            {/* Column 2: Product */}
            <div className={styles.Footer_footerCol}>
              <h4 className={styles.Footer_colTitle}>Product</h4>
              <ul className={styles.Footer_colList}>
                <li><a href="#features">Features</a></li>
                <li><a href="#integrations">Integrations</a></li>
                <li><a href="#security">Security</a></li>
                <li><a href="#api">API Access</a></li>
                <li><a href="#use-cases">Use Cases</a></li>
              </ul>
            </div>

            {/* Column 3: Company */}
            <div className={styles.Footer_footerCol}>
              <h4 className={styles.Footer_colTitle}>Company</h4>
              <ul className={styles.Footer_colList}>
                <li><a href="#mission">About MediKiosk</a></li>
                <li><a href="#careers">Careers</a></li>
                <li><a href="#insights">Blog</a></li>
                <li><a href="#press">Press</a></li>
                <li><a href="#contact">Contact</a></li>
              </ul>
            </div>

            {/* Column 4: Stay Connected */}
            <div className={styles.Footer_footerColConnect}>
              <h4 className={styles.Footer_colTitle}>Stay Connected with MediKiosk</h4>
              <p className={styles.Footer_connectText}>
                Get the latest updates on product releases, healthcare insights, and AI innovations follow us across our channels.
              </p>
              <div className={styles.Footer_socialFollow}>
                <span className={styles.Footer_followTitle}>Follow us</span>
                <div className={styles.Footer_socialIcons}>
                  <a href="#ig" aria-label="Instagram">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
                  </a>
                  <a href="#li" aria-label="LinkedIn">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>
                  </a>
                  <a href="#yt" aria-label="YouTube">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33 2.78 2.78 0 0 0 1.94 2c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33z"></path><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon></svg>
                  </a>
                  <a href="#x" aria-label="X">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4l11.733 16h4.267l-11.733 -16z" /><path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772" /></svg>
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.Footer_footerBottom}>
            <div className={styles.Footer_bottomLeft}>
              © 2026 MediKiosk. All rights reserved.
            </div>
            <div className={styles.Footer_bottomRight}>
              <a href="#terms">Terms of Service</a>
              <a href="#security">Security Policy</a>
              <a href="#privacy">Privacy Policy</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};


const LandingPage = () => {
    return (
        <div className={styles.LandingPage_root}>
            <Navbar />
            <main>
                <Hero />
                <HowItWorks />
                <Highlight />
                <DetailsSection />
                <AIFeatures />
                <Testimonials />
                <FAQ />
            </main>
            <Footer />
        </div>
    );
};

export default LandingPage;
