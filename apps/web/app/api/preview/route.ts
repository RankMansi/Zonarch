import { NextResponse } from 'next/server';
import { resolveSitePreview } from '@/lib/resolve-site';

export async function POST(req: Request) {
  try {
    const { rawInput } = await req.json();
    if (!rawInput || typeof rawInput !== 'string') {
      return NextResponse.json({ error: 'rawInput required' }, { status: 400 });
    }

    const preview = await resolveSitePreview(rawInput.trim());
    return NextResponse.json(preview);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Preview failed';
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
