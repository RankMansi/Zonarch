import { getSession, getRoomSchema } from '@/lib/session-store';
import { generateICMemo } from '@/lib/underwriting-glossary';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = getSession(id);
  if (!session?.bandRoomId) {
    return new Response('Session not found', { status: 404 });
  }

  const schema = getRoomSchema(session.bandRoomId);
  if (!schema?.lot_data || !schema.financial_analysis) {
    return new Response('Analysis not complete', { status: 422 });
  }

  const risks: string[] = [];
  if (schema.financial_analysis.comp_default_used) {
    risks.push('Exit PSF uses default — no recent comps in search radius');
  }
  if (schema.zoning_analysis?.zoning_approximated) {
    risks.push(`Zone rules approximated from table entry ${schema.zoning_analysis.zoning_table_key}`);
  }
  risks.push('Entitlement / community board risk not modeled');

  const memo = generateICMemo({
    address: schema.lot_data.address,
    zone: schema.lot_data.zonedist1,
    verdict: schema.financial_analysis.deal_verdict,
    rationale: schema.financial_analysis.verdict_rationale,
    rlv: schema.financial_analysis.residual_land_value,
    gdv: schema.financial_analysis.projected_asset_value,
    gfa: schema.building_envelope?.gross_floor_area ?? 0,
    compPsf: schema.financial_analysis.comp_avg_psf,
    compCount: schema.financial_analysis.comp_count,
    risks,
  });

  return new Response(memo, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="ic-memo-${id.slice(0, 8)}.md"`,
    },
  });
}
