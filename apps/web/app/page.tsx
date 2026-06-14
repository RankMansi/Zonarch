'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import GlassNavbar from '@/components/ui/GlassNavbar';
import PageSection from '@/components/ui/PageSection';

function FocusLoader({ onComplete }: { onComplete: () => void }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          setTimeout(onComplete, 500);
          return 100;
        }
        return p + 1.5;
      });
    }, 25);
    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <motion.div
      className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-[#ede4d9]"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, y: -40 }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
    >
      <p className="type-label text-[#6b4423] mb-10">Bringing it into focus</p>
      <div className="w-56 h-px bg-[#d4c4b0] relative overflow-hidden">
        <motion.div className="absolute inset-y-0 left-0 bg-[#6b4423]" style={{ width: `${progress}%` }} />
      </div>
      <p className="type-label text-[#a8927c] mt-6 tabular-nums">{Math.round(progress)}%</p>
    </motion.div>
  );
}

const principles = [
  {
    title: 'Outcomes first, zoning second',
    body: 'Every envelope decision is interrogated against one question: does this actually pencil for your deal?',
  },
  {
    title: 'All in or nothing',
    body: 'Four agents, one Band room, fully invested in your site from geocode to residual land value.',
  },
  {
    title: 'Human-first, always',
    body: 'Behind every BBL is a founder with real stakes. The output must feel unmistakably audit-ready.',
  },
  {
    title: 'Intention over speed',
    body: 'Rushed underwriting compounds into regret. Every constraint earns its place before we move on.',
  },
];

const stats = [
  { value: '04', label: 'Specialized agents' },
  { value: 'NYC', label: 'MapPLUTO + ZR native' },
  { value: 'RLV', label: 'Residual land value model' },
];

export default function LandingPage() {
  const [loading, setLoading] = useState(true);
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.35], [0, 120]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.25], [1, 0.3]);

  return (
    <>
      <AnimatePresence>{loading && <FocusLoader onComplete={() => setLoading(false)} />}</AnimatePresence>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: loading ? 0 : 1 }}
        transition={{ duration: 0.7, delay: 0.1 }}
      >
        <GlassNavbar />

        <PageSection variant="cream" className="relative min-h-screen flex flex-col justify-end pb-16 md:pb-24 pt-28 md:pt-32 px-6 md:px-12 lg:px-20">
          <motion.div style={{ y: heroY, opacity: heroOpacity }} className="max-w-[1400px]">
            <div className="flex items-end gap-4 mb-8 md:mb-12">
              <span className="type-label text-[#6b4423]">0#</span>
              <span className="type-label text-[#a8927c]">/</span>
              <span className="type-label text-[#6b4423]">03</span>
            </div>

            <h1 className="type-display text-[#1a120b] max-w-[1200px]">
              We underwrite
              <br />
              <span className="type-serif-italic text-[#6b4423]">change-making</span>
              <br />
              NYC developments.
            </h1>

            <p className="type-body-lg text-[#4a3728] max-w-2xl mt-10 md:mt-14">
              For founder-led developers whose site intelligence hasn&apos;t caught up to what
              they&apos;re building. Zone-Draft closes that gap — autonomously.
            </p>

            <div className="mt-12 md:mt-16 flex flex-wrap gap-5">
              <Link
                href="/underwrite"
                className="group inline-flex items-center gap-4 bg-[#1a120b] text-[#ede4d9] px-10 py-5 type-label hover:bg-[#6b4423] transition-colors duration-400"
              >
                Run Underwriting
                <span className="text-xl group-hover:translate-x-2 transition-transform duration-300">→</span>
              </Link>
              <a
                href="#about"
                className="inline-flex items-center gap-4 border-2 border-[#1a120b]/15 text-[#1a120b] px-10 py-5 type-label hover:border-[#6b4423] transition-colors"
              >
                Our story
              </a>
            </div>
          </motion.div>

          <motion.p
            className="absolute bottom-8 right-8 md:right-12 type-label text-[#a8927c] hidden md:block"
            animate={{ opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 4, repeat: Infinity }}
          >
            Scroll ↓
          </motion.p>
        </PageSection>

        <PageSection variant="surface" className="py-16 md:py-20 px-6 md:px-12 lg:px-20 border-y border-[#2a1f16]">
          <div className="max-w-[1400px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12, duration: 0.6 }}
              >
                <p className="type-display text-[#c8956c] leading-none">{stat.value}</p>
                <p className="type-label text-[#a8927c] mt-4">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </PageSection>

        <PageSection id="about" variant="dark" className="py-24 md:py-40 px-6 md:px-12 lg:px-20">
          <div className="max-w-[1400px] mx-auto">
            <p className="type-label text-[#c8956c] mb-8">The gap</p>
            <h2 className="type-headline text-[#ede4d9] max-w-4xl">
              Great developers changing the skyline deserve intelligence as powerful as what
              they&apos;re building.
            </h2>
            <p className="type-body-lg text-[#a8927c] max-w-3xl mt-10 md:mt-14">
              Most sites we analyze are building something significant — but their underwriting
              story doesn&apos;t show it yet. That gap costs more than revenue. It costs the
              certainty that your deal is finally being understood.
            </p>

            <div className="mt-20 md:mt-28 flex flex-col md:flex-row md:items-end gap-8 md:gap-16">
              <div>
                <p className="type-subhead text-[#ede4d9]">We close</p>
                <p className="type-display text-[#c8956c] mt-2">That gap.</p>
              </div>
              <blockquote className="type-body-lg text-[#a8927c] max-w-lg border-l-2 border-[#6b4423] pl-8 italic font-serif">
                &ldquo;Our new envelope analysis became a crucial first impression for investors.
                A clear, compelling asset that communicates our upside instantly.&rdquo;
              </blockquote>
            </div>
          </div>
        </PageSection>

        <PageSection id="agents" variant="cream" className="py-24 md:py-36 px-6 md:px-12 lg:px-20">
          <div className="max-w-[1400px] mx-auto">
            <p className="type-label text-[#6b4423] mb-6">What we run</p>
            <h2 className="type-headline text-[#1a120b] max-w-3xl">
              Four agents. One Band room. Zero guesswork.
            </h2>

            <div className="mt-16 md:mt-24 grid grid-cols-1 md:grid-cols-2 gap-px bg-[#d4c4b0]/50">
              {[
                { num: '01', title: 'Intake Parser', desc: 'Geocode + MapPLUTO lookup against NYC Open Data' },
                { num: '02', title: 'Zoning Compliance', desc: 'RAG-powered City of Yes + UAP density analysis' },
                { num: '03', title: 'Spatial Calculator', desc: 'FAR limits, setbacks, morphing 3D envelope' },
                { num: '04', title: 'Financial Underwriter', desc: 'DOF comps + residual land value modeling' },
              ].map((agent, i) => (
                <motion.div
                  key={agent.num}
                  className="bg-[#ede4d9] p-10 md:p-14 group hover:bg-[#f5ebe0] transition-colors duration-500"
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                >
                  <span className="type-label text-[#a8927c]">{agent.num}</span>
                  <h3 className="type-subhead text-[#1a120b] mt-6 group-hover:text-[#6b4423] transition-colors">
                    {agent.title}
                  </h3>
                  <p className="type-body-lg text-[#4a3728] mt-4 font-light">{agent.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </PageSection>

        <div className="py-12 md:py-16 border-y border-[#2a1f16] overflow-hidden bg-[#1a120b]">
          <div className="flex animate-marquee whitespace-nowrap">
            {[0, 1].map((set) => (
              <div key={set} className="flex gap-20 px-10">
                {['MIXED-USE', 'RESIDENTIAL', 'UAP BONUS', 'CITY OF YES', 'RLV MODEL', 'MAPPLUTO', 'SKY EXPOSURE', 'FAR'].map(
                  (tag) => (
                    <span key={`${set}-${tag}`} className="type-label text-[#6b4423]/80 text-base md:text-lg">
                      {tag}
                    </span>
                  )
                )}
              </div>
            ))}
          </div>
        </div>

        <PageSection id="process" variant="dark" className="py-24 md:py-36 px-6 md:px-12 lg:px-20">
          <div className="max-w-[1400px] mx-auto">
            <p className="type-label text-[#c8956c] mb-6">Our principles</p>
            <h2 className="type-headline text-[#ede4d9] max-w-2xl mb-16 md:mb-24">
              Built like a studio. Runs like an engine.
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16">
              {principles.map((p, i) => (
                <motion.div
                  key={p.title}
                  initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                >
                  <h3 className="type-subhead text-[#ede4d9]">{p.title}</h3>
                  <p className="type-body-lg text-[#a8927c] mt-4">{p.body}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </PageSection>

        <PageSection id="contact" variant="cream" className="py-28 md:py-44 px-6 md:px-12 lg:px-20">
          <div className="max-w-[1400px] mx-auto text-center md:text-left">
            <p className="type-label text-[#6b4423] mb-10">Ready?</p>
            <div className="space-y-2 md:space-y-4">
              <p className="type-display text-[#1a120b]">Let&apos;s build</p>
              <p className="type-display text-[#4a3728]">an underwriting</p>
              <p className="type-display text-[#6b4423] flex flex-wrap items-center justify-center md:justify-start gap-4 md:gap-8">
                that moves
                <Link
                  href="/underwrite"
                  className="inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-full border-2 border-[#1a120b] text-[#1a120b] hover:bg-[#1a120b] hover:text-[#ede4d9] transition-all duration-400 text-2xl md:text-3xl"
                >
                  →
                </Link>
                deals
              </p>
            </div>
            <Link
              href="/underwrite"
              className="inline-block mt-14 md:mt-20 type-label bg-[#1a120b] text-[#ede4d9] px-12 py-5 hover:bg-[#6b4423] transition-colors duration-400"
            >
              Tell us your address →
            </Link>
          </div>
        </PageSection>

        <footer className="py-10 px-6 md:px-12 border-t border-[#2a1f16] bg-[#0f0a07] flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <p className="type-label text-[#6b4423]">© 2026 Zone·Draft</p>
            <p className="type-label text-[#4a3728] mt-2">NYC · Band of Agents Hackathon</p>
          </div>
          <p className="type-serif-italic text-[#a8927c] text-lg md:text-xl">
            Refuse to be underestimated.
          </p>
        </footer>
      </motion.div>
    </>
  );
}
