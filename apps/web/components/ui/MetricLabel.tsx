'use client';

const GLOSSARY: Record<string, string> = {
  FAR: 'How much you can build relative to lot size.',
  GFA: 'Total square footage across all floors.',
  RLV: 'Land value after subtracting build costs and profit.',
  UAP: 'NYC bonus for including affordable housing.',
  GDV: 'Estimated value of the finished building.',
  PSF: 'Price per square foot from nearby sales.',
  IRR: 'Expected annual return on investment.',
  'Cap rate': 'Income divided by value — exit sanity check.',
};

interface MetricLabelProps {
  label: string;
  hint?: string;
  className?: string;
}

export default function MetricLabel({ label, hint, className = '' }: MetricLabelProps) {
  const tip = hint ?? GLOSSARY[label];

  if (!tip) return <span className={className}>{label}</span>;

  return (
    <span className={`inline-flex items-center gap-1 ${className}`} title={tip}>
      <span>{label}</span>
      <span
        className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#ede4d9] text-[#6b4423] text-[9px] font-bold cursor-help"
        aria-label={tip}
      >
        ?
      </span>
    </span>
  );
}
