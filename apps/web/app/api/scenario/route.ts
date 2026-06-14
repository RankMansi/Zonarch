import { NextResponse } from 'next/server';
import { getSession, getRoomSchema } from '@/lib/session-store';
import { parseScenarioQuestion, rerunFinancial } from '@/lib/financial-model';

export async function POST(req: Request) {
  try {
    const { sessionId, question } = await req.json();
    if (!sessionId || !question) {
      return NextResponse.json({ error: 'sessionId and question required' }, { status: 400 });
    }

    const session = getSession(sessionId);
    if (!session?.bandRoomId) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const schema = getRoomSchema(session.bandRoomId);
    if (!schema?.lot_data || !schema.building_envelope) {
      return NextResponse.json(
        { error: 'Run full analysis first — need lot and envelope data' },
        { status: 422 }
      );
    }

    const { inputs, answer } = parseScenarioQuestion(
      question,
      schema.lot_data,
      schema.building_envelope,
      schema.financial_analysis ?? undefined
    );

    const financial = await rerunFinancial(
      schema.lot_data,
      schema.building_envelope,
      inputs
    );

    return NextResponse.json({
      answer: `${answer} New verdict: ${financial.deal_verdict}. RLV $${(financial.residual_land_value / 1e6).toFixed(2)}M.`,
      financial,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Scenario failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
