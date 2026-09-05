import React, { useState } from 'react';
import styles from './FAQ.module.css';
import { useScrollReveal } from '../hooks/useScrollReveal';

const faqs = [
  {
    question: "Does My Insurance Cover This, And Will I Have To Pay Anything?",
    answer: "Advocates Don't Cost A Cent Because Your Insurance Covers All Patient Advocacy Fees. You Would Usually Pay For It Out Of Pocket. If It Turns Out That Your Insurance Does Not Cover It, We Simply Invoice You For The Month. No Hidden Fees. Cancel Anytime."
  },
  {
    question: "Is Baba AI Or Humans?",
    answer: "Baba is a combination of both. We use AI to handle administrative tasks and gather information, while our dedicated human advocates provide personalized care, empathy, and strategic guidance for your unique health journey."
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

const FAQ = () => {
  const [openIndex, setOpenIndex] = useState(0);
  const headerRef = useScrollReveal();
  const listRef = useScrollReveal({ threshold: 0.1, triggerOnce: true });

  const toggleOpen = (index) => {
    setOpenIndex(openIndex === index ? -1 : index);
  };

  return (
    <section className="section" id="faqs">
      <div className={`container ${styles.container}`}>
        <div ref={headerRef} className={`${styles.header} reveal`}>
          <h2>Your Questions Answered</h2>
          <p>Find answers to the most common questions our users ask.</p>
        </div>

        <div ref={listRef} className={`${styles.faqList} reveal delay-100`}>
          {faqs.map((faq, index) => (
            <div 
              key={index} 
              className={`${styles.faqItem} ${openIndex === index ? styles.open : ''}`}
            >
              <button 
                className={styles.faqQuestion} 
                onClick={() => toggleOpen(index)}
              >
                {faq.question}
                <span className={styles.icon}>
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
              <div className={styles.faqAnswer}>
                <div className={styles.answerContent}>
                  {faq.answer}
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className={styles.actions}>
          <button className={styles.seeAllBtn}>See All FAQs</button>
        </div>
      </div>
    </section>
  );
};

export default FAQ;
