import type { ReactNode } from 'react';

interface PageSectionProps {
  children: ReactNode;
  variant?: 'cream' | 'dark' | 'surface';
  className?: string;
  id?: string;
}

const variants: Record<string, string> = {
  cream: 'bg-[#ede4d9] text-[#2c1810]',
  dark: 'bg-[#0f0a07] text-[#ede4d9]',
  surface: 'bg-[#1a120b] text-[#ede4d9]',
};

export default function PageSection({
  children,
  variant = 'dark',
  className = '',
  id,
}: PageSectionProps) {
  return (
    <section id={id} className={`${variants[variant]} ${className}`}>
      {children}
    </section>
  );
}
