/**
 * Resend executive brief — user-triggered only after full underwriting APPROVED.
 * @see https://resend.com/docs/api-reference/emails/send-email
 */

import { Resend } from 'resend';
import type { ZoneDraftRoomSchema } from '@/types/zone-draft';
import { bandRoom } from '@/lib/band-client';
import { getAppBaseUrl, getResendApiKey, getResendFromEmail } from './config';

export interface SendExecutiveBriefInput {
  roomId: string;
  sessionId: string;
  recipients: string[];
}

export interface SendExecutiveBriefResult {
  resendId: string;
  subject: string;
  recipients: string[];
}

export function isBriefAnalysisReady(schema: ZoneDraftRoomSchema): boolean {
  return (
    schema.status === 'APPROVED' &&
    Boolean(schema.lot_data) &&
    Boolean(schema.zoning_analysis) &&
    Boolean(schema.building_envelope) &&
    Boolean(schema.financial_analysis)
  );
}

export interface SendExecutiveBriefResult {
  resendId: string;
  subject: string;
  recipients: string[];
}

function formatMoney(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function verdictColor(verdict: string): string {
  switch (verdict) {
    case 'STRONG BUY':
      return '#1b5e20';
    case 'BUY':
      return '#2e7d32';
    case 'HOLD':
      return '#e65100';
    case 'PASS':
      return '#b71c1c';
    default:
      return '#5c4033';
  }
}

export function buildExecutiveBriefHtml(
  schema: ZoneDraftRoomSchema,
  sessionId: string
): string {
  const lot = schema.lot_data!;
  const fin = schema.financial_analysis!;
  const zoning = schema.zoning_analysis!;
  const env = schema.building_envelope!;
  const baseUrl = getAppBaseUrl();
  const siteViewerUrl = `${baseUrl}/site-viewer/${sessionId}`;
  const color = verdictColor(fin.deal_verdict);

  const risks: string[] = [];
  if (fin.comp_default_used) {
    risks.push('Exit PSF uses default — no recent comps in search radius');
  }
  if (zoning.zoning_approximated) {
    risks.push(`Zone rules approximated (${zoning.zoning_table_key ?? 'table lookup'})`);
  }
  risks.push('Entitlement / community board risk not modeled');

  const riskRows = risks
    .map(
      (r) =>
        `<li style="margin:4px 0;color:#4a3728;font-size:13px;">${r}</li>`
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5ebe0;font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5ebe0;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:16px;border:1px solid #d4c4b0;overflow:hidden;">
        <tr><td style="background:#2c1810;padding:28px 32px;">
          <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#c8956c;">Zone-Draft IC Brief</p>
          <h1 style="margin:0;font-size:22px;font-weight:400;color:#ede4d9;line-height:1.3;">${lot.address}</h1>
          <p style="margin:8px 0 0;font-size:13px;color:#a8927c;">BBL ${lot.bbl} · ${lot.zonedist1}</p>
        </td></tr>
        <tr><td style="padding:28px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:16px;background:#faf6f1;border-radius:12px;border:1px solid #ede4d9;">
                <p style="margin:0 0 4px;font-size:11px;color:#8b5a2b;text-transform:uppercase;letter-spacing:0.06em;">Recommendation</p>
                <p style="margin:0;font-size:28px;font-weight:700;color:${color};">${fin.deal_verdict}</p>
                <p style="margin:8px 0 0;font-size:13px;color:#4a3728;line-height:1.5;">${fin.verdict_rationale}</p>
              </td>
            </tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
            <tr>
              ${[
                ['Residual land value', formatMoney(fin.residual_land_value)],
                ['Gross dev. value', formatMoney(fin.projected_asset_value)],
                ['Max GFA', `${env.gross_floor_area.toLocaleString()} sf`],
                ['Comps', `${fin.comp_count} @ ${formatMoney(fin.comp_avg_psf)}/sf`],
              ]
                .map(
                  ([label, value]) => `
              <td width="50%" style="padding:8px 8px 8px 0;vertical-align:top;">
                <p style="margin:0;font-size:10px;color:#8b5a2b;text-transform:uppercase;">${label}</p>
                <p style="margin:4px 0 0;font-size:16px;font-weight:600;color:#2c1810;font-family:ui-monospace,monospace;">${value}</p>
              </td>`
                )
                .join('')}
            </tr>
          </table>
          <p style="margin:24px 0 8px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#8b5a2b;">Zoning summary</p>
          <p style="margin:0;font-size:13px;color:#4a3728;line-height:1.6;">${zoning.city_of_yes_notes || `Base FAR ${zoning.base_far}, UAP FAR ${zoning.uap_far}. Max height ${zoning.max_height_ft ?? 'as-of-right'} ft.`}</p>
          <p style="margin:20px 0 8px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#8b5a2b;">Key risks</p>
          <ul style="margin:0;padding-left:18px;">${riskRows}</ul>
          <p style="margin:28px 0 0;text-align:center;">
            <a href="${siteViewerUrl}" style="display:inline-block;background:#6b4423;color:#fff;text-decoration:none;padding:12px 24px;border-radius:999px;font-size:13px;font-weight:600;">Open 3D site viewer</a>
          </p>
        </td></tr>
        <tr><td style="padding:16px 32px;background:#faf6f1;border-top:1px solid #ede4d9;">
          <p style="margin:0;font-size:11px;color:#a8927c;text-align:center;">Generated by Zone-Draft · Session ${sessionId.slice(0, 12)}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendExecutiveBrief(
  input: SendExecutiveBriefInput
): Promise<SendExecutiveBriefResult> {
  const apiKey = getResendApiKey();
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const schema = await bandRoom.context.getAll(input.roomId);
  if (!isBriefAnalysisReady(schema)) {
    throw new Error(
      'Underwriting must be fully approved before sending an executive brief'
    );
  }

  const recipients = input.recipients
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (recipients.length === 0) {
    throw new Error('At least one recipient email is required');
  }
  if (recipients.length > 50) {
    throw new Error('Maximum 50 recipients per Resend request');
  }

  const lot = schema.lot_data!;
  const fin = schema.financial_analysis!;
  const subject = `Zone-Draft: ${fin.deal_verdict} — ${lot.address.split(',')[0]}`;
  const html = buildExecutiveBriefHtml(schema, input.sessionId);

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: getResendFromEmail(),
    to: recipients,
    subject,
    html,
    tags: [
      { name: 'product', value: 'zone-draft' },
      { name: 'verdict', value: fin.deal_verdict.replace(/\s+/g, '-') },
    ],
  });

  if (error) {
    throw new Error(error.message || 'Resend send failed');
  }
  if (!data?.id) {
    throw new Error('Resend returned no message id');
  }

  const outbound: NonNullable<ZoneDraftRoomSchema['outbound_email']> = {
    resend_id: data.id,
    recipients,
    sent_at: new Date().toISOString(),
    subject,
  };
  await bandRoom.context.set(input.roomId, 'outbound_email', outbound);

  return {
    resendId: data.id,
    subject,
    recipients,
  };
}
