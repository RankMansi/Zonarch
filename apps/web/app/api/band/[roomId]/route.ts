import { NextResponse } from 'next/server';
import { bandRoom } from '@/lib/band-client';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  try {
    const schema = await bandRoom.context.getAll(roomId);
    return NextResponse.json(schema);
  } catch {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const { key, value } = await req.json();
  await bandRoom.context.set(roomId, key, value);
  return NextResponse.json({ success: true });
}
