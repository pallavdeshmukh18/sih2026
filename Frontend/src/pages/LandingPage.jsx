import { Link } from "react-router-dom";
import {
  ArrowRight,
  FileText,
  Languages,
  Mic,
  Play,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Users,
} from "lucide-react";
import hero from "../assets/medikiosk-heritage-hero.png";
import woman from "../assets/medikiosk-woman-jharokha-alpha-v3.png";
import gate from "../assets/medikiosk-india-gate-dome.png";
import s from "./LandingPage.module.css";
const feats = [
    ["Voice & Multilingual Support", Mic],
    ["Upload & Digitize Medical Reports", FileText],
    ["AI-Powered Summaries", Sparkles],
    ["Secure & Consent-Driven", ShieldCheck],
  ],
  steps = [
    [
      "01",
      "Share",
      "Tell your story through voice or touch, in your preferred language.",
      Mic,
    ],
    [
      "02",
      "Digitize",
      "Upload your medical reports. We extract key information using AI.",
      FileText,
    ],
    [
      "03",
      "Understand",
      "Get an organized summary with insights and red flags.",
      Sparkles,
    ],
    [
      "04",
      "Better Care",
      "Doctors review, edit and confirm — so you get faster care.",
      Stethoscope,
    ],
  ],
  benefits = [
    [
      "Multilingual Support",
      "Voice and text in regional languages.",
      Languages,
    ],
    ["Secure & Consent-Driven", "Your data, your control.", ShieldCheck],
    ["AI-Powered Insights", "Structured summaries and red flags.", Sparkles],
    ["Seamless Record Management", "All your reports in one place.", FileText],
  ],
  stories = [
    [
      "“MediKiosk helped me keep all my reports in one place. The AI summary helped my doctor understand my condition much faster.”",
      "Savita Deshmukh",
      "Patient, Mumbai",
    ],
    [
      "“The system saves valuable time. I can focus more on the patient, not paperwork.”",
      "Dr. Arjun Mehta",
      "General Physician, Pune",
    ],
    [
      "“Finally, a solution that works in local languages and understands our reality.”",
      "Rohit Sharma",
      "Clinic Administrator, Nagpur",
    ],
  ];
const Logo = () => (
  <Link className={s.logo} to="/">
    <i>✦</i>
    <b>
      Medi<span>Kiosk</span>
    </b>
    <small>Your Health. In Your Hands.</small>
  </Link>
);
export default function LandingPage() {
  return (
    <div className={s.page}>
      <header>
        <Logo />
        <nav>
          {["Home", "For Patients", "For Doctors", "Features", "About"].map(
            (x) => (
              <a key={x} href={"#" + x.toLowerCase().replaceAll(" ", "")}>
                {x}
              </a>
            ),
          )}
        </nav>
        <div className={s.actions}>
          <div className={s.langSelect}>
            <select aria-label="Select language" defaultValue="EN">
              <option value="EN">English</option>
              <option value="HI">हिन्दी</option>
              <option value="MR">मराठी</option>
              <option value="TA">தமிழ்</option>
              <option value="TE">తెలుగు</option>
              <option value="BN">বাংলা</option>
              <option value="GU">ગુજરાતી</option>
              <option value="KN">ಕನ್ನಡ</option>
              <option value="ML">മലയാളം</option>
              <option value="PA">ਪੰਜਾਬੀ</option>
            </select>
            <span>⌄</span>
          </div>
          <Link to="/auth">
            Get Started <ArrowRight />
          </Link>
        </div>
      </header>
      <main>
        <section className={s.hero} id="home">
          <img src={hero} />
          <div className={s.copy}>
            <label>TRADITIONAL WISDOM. MODERN TECHNOLOGY.</label>
            <h1>
              Care
              <br />
              Listening
              <br />
              <em>Understands.</em>
            </h1>
            <p>
              MediKiosk helps you share your medical history through voice or
              touch, digitizes your reports, detects red flags, and creates a
              clear, structured summary — so doctors can focus on what matters
              most: you.
            </p>
            <div className={s.buttons}>
              <Link to="/auth">
                Get Started <ArrowRight />
              </Link>
              <a href="#how">
                <Play /> Watch Video
              </a>
            </div>
            <div className={s.feats}>
              {feats.map(([t, I]) => (
                <div>
                  <i>
                    <I />
                  </i>
                  <b>{t}</b>
                </div>
              ))}
            </div>
          </div>
          <small className={s.tag}>SEVA · SCIENCE · A HEALTHIER BHARAT</small>
        </section>
        <section className={s.how} id="how">
          <div>
            <label>— HOW IT WORKS</label>
            <h2>
              From Your Story
              <br />
              to Better Care
            </h2>
            <p>
              A simple, secure and guided experience
              <br />
              for patients and doctors.
            </p>
          </div>
          <div className={s.steps}>
            {steps.map(([n, t, d, I]) => (
              <article>
                <i>
                  <I />
                </i>
                <b>
                  {n}
                  <br />
                  <strong>{t}</strong>
                </b>
                <p>{d}</p>
              </article>
            ))}
          </div>
        </section>
        <section className={s.people} id="features">
          <div className={s.photo}>
            <img src={woman} />
            <div>
              <h3>
                Healthcare
                <br />
                for Every
                <br />
                Indian
              </h3>
              <hr />
              <p>
                Accessible.
                <br />
                Inclusive.
                <br />
                In your language.
              </p>
            </div>
            <blockquote>
              ❝
              <span>
                Technology should bring us closer to people, not farther.
              </span>
              <small>
                A Healthier Tomorrow
                <br />
                for Every Indian
              </small>
            </blockquote>
          </div>
          <div className={s.why}>
            <label>— WHY MEDIKIOSK</label>
            <h2>
              Built for People.
              <br />
              Designed for Bharat.
            </h2>
            {benefits.map(([t, d, I]) => (
              <article>
                <i>
                  <I />
                </i>
                <div>
                  <b>{t}</b>
                  <p>{d}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className={s.metrics}>
          {[
            ["100K+", "Patients Empowered", Users],
            ["500+", "Doctors & Clinics", Stethoscope],
            ["10+", "Languages Supported", Languages],
            ["99%", "Data Security Focused", ShieldCheck],
          ].map(([a, b, I]) => (
            <div>
              <I />
              <b>{a}</b>
              <span>{b}</span>
            </div>
          ))}
        </section>
        <section className={s.stories} id="forpatients">
          <label>VOICES FROM OUR COMMUNITY</label>
          <h2>Real Stories. Real Impact.</h2>
          <div>
            {stories.map(([q, n, r]) => (
              <article>
                <p>{q}</p>
                <i>{n[0]}</i>
                <b>{n}</b>
                <small>{r}</small>
              </article>
            ))}
          </div>
          <p className={s.dots}>‹ · ● · ○ · ○ · ○ · ○ · ›</p>
        </section>
        <section className={s.final} id="about">
          <div className={s.gate}>
            <img src={gate} />
            <p>
              स्वस्थ
              <br />
              भारत
              <br />
              सशक्त
              <br />
              नागरिक
            </p>
          </div>
          <div>
            <label>BE A PART OF A HEALTHIER INDIA</label>
            <h2>
              Your Health.
              <br />A Brighter Tomorrow.
            </h2>
            <hr />
            <Link to="/auth">
              Get Started <ArrowRight />
            </Link>
          </div>
          <aside>
            CARE
            <br />
            CONNECTS
            <br />
            COMMUNITIES
          </aside>
        </section>
      </main>
      <footer className={s.footer}>
        <div className={s.footerTop}>
          <div className={s.footerBrand}>
            <Logo />
            <p>
              Traditional wisdom meets modern technology. Accessible, inclusive
              healthcare for every Indian.
            </p>
          </div>
          <div className={s.footerLinks}>
            <nav>
              <b>Platform</b>
              <a href="#home">Home</a>
              <a href="#how">How it Works</a>
              <a href="#features">Features</a>
            </nav>
            <nav>
              <b>Audience</b>
              <a href="#forpatients">For Patients</a>
              <a href="#about">For Doctors</a>
              <Link to="/auth">Get Started</Link>
            </nav>
          </div>
        </div>
        <div className={s.footerBottom}>
          <small>© 2026 MediKiosk. All rights reserved.</small>
          <div className={s.socials}>
            <b>in</b>
            <b>𝕏</b>
            <b>◎</b>
            <b>▶</b>
          </div>
          <small>स्वस्थ भारत · सशक्त नागरिक</small>
        </div>
      </footer>
    </div>
  );
}
