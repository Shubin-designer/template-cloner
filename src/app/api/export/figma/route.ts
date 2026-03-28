import { NextRequest, NextResponse } from 'next/server';
import { generateFigmaDesignSpec } from '@/lib/export/figma-json';

export async function POST(request: NextRequest) {
  let body: { tree: unknown[]; metadata: unknown; url: string; createdAt: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!body.tree || !Array.isArray(body.tree)) {
    return NextResponse.json({ error: 'Missing tree data' }, { status: 400 });
  }

  try {
    const spec = generateFigmaDesignSpec(
      body.tree as Parameters<typeof generateFigmaDesignSpec>[0],
      (body.metadata || {}) as Parameters<typeof generateFigmaDesignSpec>[1],
      body.url || '',
      body.createdAt || new Date().toISOString()
    );

    return NextResponse.json(spec);
  } catch (error) {
    console.error('Figma export error:', error);
    return NextResponse.json({ error: 'Failed to generate Figma spec' }, { status: 500 });
  }
}
