import JSZip from 'jszip';
import { bandRoom } from '@/lib/band-client';
import { buildSiteGeometry } from '@/lib/site-geometry';
import { generateReport, generateCSV, generateGeometryJson } from '@/lib/exporters/report-generator';
import { getSession } from '@/lib/session-store';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = getSession(id);
  if (!session?.bandRoomId) {
    return new Response('Session not found', { status: 404 });
  }

  try {
    const context = await bandRoom.context.getAll(session.bandRoomId);
    if (!context.lot_data || !context.building_envelope || !context.financial_analysis) {
      return new Response('Underwriting not complete', { status: 400 });
    }

    const zip = new JSZip();
    zip.file('blueprint_report.md', generateReport(context));

    let siteGeo = context.site_geometry_geojson ?? null;
    if (!siteGeo && context.lot_data && context.zoning_analysis) {
      try {
        const built = await buildSiteGeometry(context.lot_data, context.zoning_analysis, 'both');
        siteGeo = built.layers;
      } catch {
        /* legacy export fallback */
      }
    }

    zip.file('financial_underwriting.csv', generateCSV(context.financial_analysis));
    zip.file('site_geometry.json', generateGeometryJson(context, siteGeo));

    const blob = await zip.generateAsync({ type: 'nodebuffer' });
    return new Response(new Uint8Array(blob), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="zone-draft-${id.slice(0, 8)}.zip"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Export failed';
    return new Response(message, { status: 500 });
  }
}
