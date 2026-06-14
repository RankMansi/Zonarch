import type { TerminalMessage } from '@/types/zone-draft';

const AGENT_STYLES: Record<string, { prefix: string; className: string; classNameLight: string }> = {
  INTAKE_PARSER: {
    prefix: 'Site intake',
    className: 'text-green-400',
    classNameLight: 'text-[#2e7d32]',
  },
  ZONING_COMPLIANCE: {
    prefix: 'Zoning',
    className: 'text-yellow-400',
    classNameLight: 'text-[#f57f17]',
  },
  SPATIAL_CALCULATOR: {
    prefix: 'Envelope',
    className: 'text-[#c8956c]',
    classNameLight: 'text-[#8b5a2b]',
  },
  FINANCIAL_UNDERWRITER: {
    prefix: 'Economics',
    className: 'text-purple-400',
    classNameLight: 'text-[#6a1b9a]',
  },
};

interface TerminalLineProps {
  message: TerminalMessage;
  light?: boolean;
}

export default function TerminalLine({ message, light = false }: TerminalLineProps) {
  if (message.type === 'violation') {
    return (
      <div className="violation-line-light border border-red-400/60 rounded-lg px-3 py-2 my-1.5 bg-red-50">
        <span className="font-mono text-sm text-red-700">
          ⚠ Constraint violation — {message.content}
        </span>
      </div>
    );
  }

  if (message.type === 'resolution') {
    return (
      <p className="font-mono text-sm text-[#2e7d32] py-0.5">
        ✓ Constraint resolved — {message.content}
      </p>
    );
  }

  if (message.type === 'system') {
    return (
      <p className={`font-mono text-sm py-0.5 ${light ? 'text-[#5c4033]' : 'text-[#4a3728]'}`}>
        {'  >'} {message.content}
      </p>
    );
  }

  const agentKey = message.agent?.toUpperCase().replace(/ /g, '_') || '';
  const style = AGENT_STYLES[agentKey] || {
    prefix: `◈ ${message.agent}`,
    className: 'text-[#a8927c]',
    classNameLight: 'text-[#6b4423]',
  };

  const colorClass = light ? style.classNameLight : style.className;
  const lines = (message.content || '').split('\n');

  return (
    <>
      {lines.map((line, i) => (
        <p key={i} className={`font-mono text-sm py-0.5 leading-relaxed ${colorClass}`}>
          {i === 0 ? `${style.prefix} — ${line}` : `  ${line}`}
        </p>
      ))}
    </>
  );
}
