'use client';
import { useRef } from 'react';
import { useReveal } from './_components/RevealObserver';
import { Nav } from './_components/Nav';
import { Hero } from './_components/Hero';
import { Features } from './_components/Features';
import { Personalization } from './_components/Personalization';
import { ProducerDashboard } from './_components/ProducerDashboard';
import { Pricing } from './_components/Pricing';
import {
  VSL, Comparison, Testimonials, Integrations, FAQ, CTAFinal, Footer,
} from './_components/sections';

export default function LandingClient() {
  // Fixed to hero variant 2 (dashboard) — can be extended to a state-driven switcher
  const heroVariant = '2';

  useReveal('.landing-root');

  return (
    <div
      className="landing-root"
      data-theme="dark"
      data-density="compact"
    >
      <Nav />
      <Hero heroVariant={heroVariant} />
      <VSL />
      <Features />
      <Personalization />
      <ProducerDashboard />
      <Comparison />
      {/* <Testimonials /> */}
      <Pricing />
      <Integrations />
      <FAQ />
      <CTAFinal />
      <Footer />
    </div>
  );
}
