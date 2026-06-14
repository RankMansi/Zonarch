'use client';

import { generateLenderQuestions } from '@/lib/underwriting-glossary';
import type { ZoneDraftRoomSchema } from '@/types/zone-draft';

type FinancialData = NonNullable<ZoneDraftRoomSchema['financial_analysis']>;
type ZoningData = NonNullable<ZoneDraftRoomSchema['zoning_analysis']>;

interface LenderQuestionsProps {
  financialData: FinancialData | null;
  zoningData: ZoningData | null;
}

export default function LenderQuestions({ financialData, zoningData }: LenderQuestionsProps) {
  if (!financialData) return null;

  const questions = generateLenderQuestions(financialData, zoningData);

  return (
    <div className="rounded-xl border border-[#d4c4b0]/60 bg-white px-3 py-3">
      <p className="text-xs font-semibold text-[#2c1810] mb-2">What would a skeptical lender ask?</p>
      <ol className="list-decimal pl-4 space-y-1 text-xs text-[#5c4033]">
        {questions.map((q) => (
          <li key={q}>{q}</li>
        ))}
      </ol>
    </div>
  );
}
