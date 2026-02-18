'use client';

import { motion, useAnimation } from 'framer-motion';
import { useEffect, useState } from 'react';

interface StatCardProps {
  value: number;
  label: string;
  suffix?: string;
}

function StatCard({ value, label, suffix = '' }: StatCardProps) {
  const [count, setCount] = useState(0);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    // Trigger after mount
    const timer = setTimeout(() => setInView(true), 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!inView) return;
    let startTime: number;
    const duration = 2000;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(easeOutQuart * value));
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setCount(value);
      }
    };

    requestAnimationFrame(animate);
  }, [inView, value]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-2xl p-6 md:p-8 backdrop-blur-sm bg-white/10 border-2 border-white/20 hover:scale-105 transition-transform duration-300"
    >
      <div className="relative z-10">
        <div className="text-4xl md:text-5xl font-bold mb-2 text-[#60a5fa]">
          {count.toLocaleString()}{suffix}
        </div>
        <div className="text-white/90 text-base md:text-lg font-medium">{label}</div>
      </div>
      <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-blue-500/20 to-blue-600/20" />
    </motion.div>
  );
}

export function HeroSection() {
  const controls = useAnimation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    controls.start({
      backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
      transition: {
        duration: 8,
        ease: 'linear',
        repeat: Infinity,
      },
    });
  }, [controls]);

  return (
    <section className="relative min-h-[65vh] flex items-center justify-center overflow-hidden">
      {/* Animated gradient background */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-[#0A1628] via-[#1E3A5F] to-[#0A1628]"
        animate={mounted ? controls : {}}
        style={{ backgroundSize: '200% 200%' }}
      />

      {/* Subtle dot pattern overlay */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Content */}
      <div className="relative z-10 container mx-auto px-6 py-16">
        <div className="max-w-7xl mx-auto">
          {/* Main headline */}
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="text-center mb-10"
          >
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-4">
              <span className="bg-gradient-to-r from-[#60a5fa] via-[#93c5fd] to-[#60a5fa] bg-clip-text text-transparent"
                style={{ backgroundSize: '200% auto', animation: 'gradient 4s ease infinite' }}>
                College Baseball
              </span>
              <br />
              <span className="text-white text-4xl md:text-5xl lg:text-6xl">Pitcher Tracker</span>
            </h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="text-xl md:text-2xl text-white/75 max-w-3xl mx-auto"
            >
              Track 1,341 pitchers across 64 Division I programs
            </motion.p>
          </motion.div>

          {/* Stats cards */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-10"
          >
            <StatCard value={64} label="Division I Teams" />
            <StatCard value={1341} label="Pitchers Tracked" />
            <StatCard value={5321} label="Games in Database" />
          </motion.div>

          {/* Last updated */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.8 }}
            className="text-center text-white/50 text-sm"
          >
            Data last updated: {new Date().toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.8 }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 1.5, ease: 'easeInOut', repeat: Infinity }}
          className="flex flex-col items-center gap-1"
        >
          <span className="text-white/50 text-xs font-medium">Scroll</span>
          <svg className="w-5 h-5 text-[#60a5fa]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </motion.div>
      </motion.div>
    </section>
  );
}
