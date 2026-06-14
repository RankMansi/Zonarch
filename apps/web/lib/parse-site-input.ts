/** Parse raw user input as NYC BBL or free-text address. */
export type SiteInputKind = 'bbl' | 'address';

export interface ParsedSiteInput {
  kind: SiteInputKind;
  raw: string;
  bbl?: string;
  address?: string;
}

export function normalizeBBLInput(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(0, 10);
  return digits.padStart(10, '0');
}

/** True when input looks like a 10-digit BBL or borough-block-lot pattern. */
export function looksLikeBBL(raw: string): boolean {
  const trimmed = raw.trim();
  if (/^\d{10}$/.test(trimmed.replace(/\D/g, ''))) return true;
  if (/^[1-5][\s-]?\d{1,5}[\s-]?\d{1,4}$/.test(trimmed)) return true;
  return false;
}

export function parseSiteInput(raw: string): ParsedSiteInput {
  const trimmed = raw.trim();
  if (!trimmed) return { kind: 'address', raw: trimmed };

  if (looksLikeBBL(trimmed)) {
    return { kind: 'bbl', raw: trimmed, bbl: normalizeBBLInput(trimmed) };
  }

  return { kind: 'address', raw: trimmed, address: trimmed };
}
