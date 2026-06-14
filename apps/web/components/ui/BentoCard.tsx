import type { ReactNode } from 'react';

interface BentoCardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  accent?: boolean;
  step?: number;
  fill?: boolean;
}

export default function BentoCard({
  children,
  className = '',
  title,
  subtitle,
  accent = false,
  step,
  fill = false,
}: BentoCardProps) {
  return (
    <article
      className={`bento-card ${accent ? 'bento-card-accent' : ''} flex flex-col min-h-0 overflow-hidden ${
        fill ? 'h-full' : ''
      } ${className}`}
    >
      {(title || subtitle || step) && (
        <header className="bento-card-header shrink-0 flex items-start gap-2.5">
          {step !== undefined && (
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#6b4423] text-[#f5ebe0] text-xs font-bold"
              aria-label={`Step ${step}`}
            >
              {step}
            </span>
          )}
          <div className="min-w-0">
            {subtitle && <p className="bento-card-subtitle">{subtitle}</p>}
            {title && <h2 className="bento-card-title">{title}</h2>}
          </div>
        </header>
      )}
      <div className="bento-card-body flex-1 min-h-0 flex flex-col">{children}</div>
    </article>
  );
}
