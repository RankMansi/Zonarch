import { NextResponse } from 'next/server';
import { bandClient } from '@/lib/band-client';
import { sendExecutiveBrief } from '@/lib/integrations/executive-brief-email';
import { isResendConfigured } from '@/lib/integrations/config';
import { getSession } from '@/lib/session-store';

export async function POST(req: Request) {
  if (!isResendConfigured()) {
    return NextResponse.json(
      {
        error:
          'Email not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL in .env',
      },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId : '';
    const recipients = Array.isArray(body.recipients)
      ? body.recipients.filter((r: unknown) => typeof r === 'string')
      : typeof body.recipient === 'string'
        ? [body.recipient]
        : [];

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
    }

    const session = getSession(sessionId);
    if (!session?.bandRoomId) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const result = await sendExecutiveBrief({
      roomId: session.bandRoomId,
      sessionId,
      recipients,
    });

    await bandClient.emit(session.bandRoomId, {
      event: 'outbound.email.sent',
      agent: 'FINANCIAL_UNDERWRITER',
      content: `Executive brief sent to ${result.recipients.join(', ')}`,
      resend_id: result.resendId,
    });

    return NextResponse.json({
      ok: true,
      resendId: result.resendId,
      subject: result.subject,
      recipients: result.recipients,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Send failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
