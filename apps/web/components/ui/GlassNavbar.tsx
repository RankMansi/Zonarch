'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

const navLinks = [
  { label: 'About', href: '#about' },
  { label: 'Agents', href: '#agents' },
  { label: 'Process', href: '#process' },
  { label: 'Contact', href: '#contact' },
];

export default function GlassNavbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header className="fixed top-5 md:top-7 left-0 right-0 z-50 flex justify-center px-4 md:px-8 pointer-events-none">
        <nav className="glass-nav pointer-events-auto w-full max-w-5xl flex items-center justify-between gap-4 px-4 md:px-6 py-3 md:py-3.5">
          <Link href="/" className="type-label text-[#f5ebe0] shrink-0 hover:text-[#c8956c] transition-colors">
            Zone·Draft
          </Link>

          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="glass-nav-link type-label text-[#ede4d9]/90 px-4 py-2 rounded-full hover:text-[#f5ebe0] transition-colors flex items-center gap-1.5"
              >
                {link.label}
                <span className="text-[#c8956c]/70 text-[10px]">→</span>
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/underwrite"
              className="hidden sm:inline-flex type-label text-[#f5ebe0] bg-[#6b4423]/50 border border-[#ede4d9]/20 px-4 py-2 rounded-full hover:bg-[#6b4423]/80 transition-all duration-300"
            >
              Launch →
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="lg:hidden type-label text-[#ede4d9] px-3 py-2 rounded-full hover:bg-[#6b4423]/30 transition-colors"
              aria-expanded={menuOpen}
              aria-label="Toggle menu"
            >
              {menuOpen ? 'Close' : 'Menu'}
            </button>
          </div>
        </nav>
      </header>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.25 }}
            className="fixed top-[4.5rem] left-4 right-4 z-40 lg:hidden pointer-events-none flex justify-center"
          >
            <div className="glass-nav glass-nav-menu pointer-events-auto w-full max-w-sm p-4 flex flex-col gap-1">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="type-label text-[#ede4d9] px-4 py-3 rounded-2xl hover:bg-[#6b4423]/35 transition-colors flex items-center justify-between"
                >
                  {link.label}
                  <span className="text-[#c8956c]">→</span>
                </a>
              ))}
              <Link
                href="/underwrite"
                onClick={() => setMenuOpen(false)}
                className="type-label text-[#f5ebe0] text-center mt-2 px-4 py-3 rounded-full bg-[#6b4423]/60 border border-[#ede4d9]/15 hover:bg-[#6b4423] transition-colors"
              >
                Launch Terminal →
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
