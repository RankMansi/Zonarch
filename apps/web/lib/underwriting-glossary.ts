export const GLOSSARY: Record<string, string> = {
  FAR: 'How much you can build relative to lot size. A FAR of 4 means 4× the lot area in total floor area.',
  GFA: 'Total square footage across all floors of the building.',
  RLV: 'What the land is worth after subtracting construction and profit from the finished building value.',
  UAP: 'NYC bonus that lets you build more if you include affordable housing.',
  GDV: 'Estimated value of the finished building (units × price per square foot).',
  PSF: 'Price per square foot — what similar buildings sold for nearby.',
  IRR: 'Expected annual return on your investment over the project life.',
  'Cap rate': 'Stabilized income divided by building value — used to sanity-check exit pricing.',
  BBL: 'Borough-Block-Lot ID — the official NYC parcel number.',
  MapPLUTO: 'NYC parcel database with zoning, lot size, and building info.',
  Comps: 'Recent sales of similar properties used to estimate your exit price.',
  Setback: 'Required step-back from the lot line at higher floors.',
  Envelope: 'The maximum 3D shape you are allowed to build on the lot.',
  HOLD: 'Deal might work but margin is tight — negotiate or adjust assumptions.',
  PASS: 'Numbers do not support buying at current assumptions.',
};

export interface ZoningCitation {
  section: string;
  title: string;
  excerpt: string;
  appliesBecause: string;
}

export function getZoningCitations(
  zone: string,
  sections: string[] = []
): ZoningCitation[] {
  const base: ZoningCitation[] = [
    {
      section: 'ZR 23-154',
      title: 'Floor Area Ratio in mixed districts',
      excerpt:
        'In mixed districts, residential floor area shall not exceed the maximum FAR permitted for the district, except as modified by applicable bonus provisions.',
      appliesBecause: `Your zone ${zone} is a mixed residential district subject to base and bonus FAR limits.`,
    },
    {
      section: 'ZR 23-631',
      title: 'Universal Affordability Preference (UAP)',
      excerpt:
        'A development may receive a floor area bonus of 20 percent when at least 20 percent of residential floor area is affordable at or below 60 percent of AMI.',
      appliesBecause: 'UAP may increase buildable FAR if affordable units are included.',
    },
    {
      section: 'ZR 33-26',
      title: 'City of Yes — parking',
      excerpt:
        'Minimum parking requirements for residential development within transit zones have been eliminated.',
      appliesBecause: 'Parking is not modeled as required for this site under 2024 amendments.',
    },
    {
      section: 'ZR 23-47',
      title: 'Sky exposure plane',
      excerpt:
        'Above the sky exposure plane, building walls shall be set back at a prescribed angle to protect light and air at street level.',
      appliesBecause: 'Setbacks in your envelope model follow the sky exposure plane rules.',
    },
  ];

  if (sections.length === 0) return base;
  return base.filter((c) =>
    sections.some((s) => c.section.includes(s.replace('ZR ', '')) || s === c.section)
  );
}

export function generateLenderQuestions(
  financial: {
    comp_default_used?: boolean;
    comp_count: number;
    comp_avg_psf: number;
    cap_rate: number;
    hard_cost_psf: number;
    deal_verdict: string;
  },
  zoning?: { uap_eligible?: boolean } | null
): string[] {
  const q: string[] = [];
  if (financial.comp_default_used || financial.comp_count === 0) {
    q.push(`Why use $${financial.comp_avg_psf}/sf with ${financial.comp_count} comps in this search?`);
  }
  if (zoning?.uap_eligible) {
    q.push('Did you underwrite the cost of 20% affordable units required for the UAP bonus?');
  }
  q.push(`What exit cap rate are you using? (Model assumes ${(financial.cap_rate * 100).toFixed(1)}%.)`);
  q.push(`Is $${financial.hard_cost_psf}/sf hard cost realistic for this borough and product type?`);
  if (financial.deal_verdict.includes('HOLD') || financial.deal_verdict === 'PASS') {
    q.push('What land price would make this deal work for your return target?');
  }
  return q.slice(0, 5);
}

export function generateICMemo(data: {
  address: string;
  zone: string;
  verdict: string;
  rationale: string;
  rlv: number;
  gdv: number;
  gfa: number;
  compPsf: number;
  compCount: number;
  risks: string[];
}): string {
  return `# Investment Committee Memo — ${data.address}

## Thesis
Underwrite for ${data.address} (${data.zone}): ${data.verdict}. ${data.rationale}

## Key numbers
| Metric | Value |
|--------|-------|
| Verdict | **${data.verdict}** |
| Residual land value | $${(data.rlv / 1e6).toFixed(2)}M |
| Gross development value | $${(data.gdv / 1e6).toFixed(2)}M |
| Buildable GFA | ${data.gfa.toLocaleString()} sf |
| Exit PSF | $${data.compPsf} (${data.compCount} comps) |

## Key risks
${data.risks.map((r) => `- ${r}`).join('\n')}

## Sensitivity (directional)
- +$50 PSF exit → RLV increases materially
- +$25/sf hard cost → RLV decreases
- Land ask +10% → may flip HOLD ↔ PASS

## Open questions
- Confirm comps radius and product type match
- Validate UAP / affordable compliance cost if pursuing bonus FAR
- Entitlement and community process not scored in this memo

---
*Generated by Zone-Draft — not investment advice.*
`;
}
