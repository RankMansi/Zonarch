'use client';

import { useState } from 'react';
import { GLOSSARY } from '@/lib/underwriting-glossary';

export default function GlossaryDrawer() {
  const [open, setOpen] = useState(false);

  return (
    <div className="glossary-drawer">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-xs text-[#6b4423] underline underline-offset-2 hover:text-[#4a3728]"
      >
        {open ? 'Hide term definitions' : 'What do these terms mean?'}
      </button>
      {open && (
        <ul className="mt-2 grid gap-1.5 sm:grid-cols-2 text-xs text-[#5c4033] bg-white/80 border border-[#d4c4b0]/50 rounded-lg p-3 max-h-40 overflow-y-auto">
          {Object.entries(GLOSSARY).map(([term, def]) => (
            <li key={term}>
              <span className="font-semibold text-[#2c1810]">{term}</span>
              <span className="text-[#6b4423]"> — </span>
              {def}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
