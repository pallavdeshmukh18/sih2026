import React from 'react';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import HowItWorks from '../components/HowItWorks';
import Highlight from '../components/Highlight';
import DetailsSection from '../components/DetailsSection';
import AIFeatures from '../components/AIFeatures';
import Testimonials from '../components/Testimonials';
import FAQ from '../components/FAQ';
import Footer from '../components/Footer';

const LandingPage = () => {
  return (
    <>
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
    </>
  );
};

export default LandingPage;
