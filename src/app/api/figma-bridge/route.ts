import { NextRequest, NextResponse } from 'next/server';
import { ensureBridgeRunning } from '@/lib/figma-bridge/server';

export async function GET() {
  try {
    const bridge = await ensureBridgeRunning();
    return NextResponse.json({
      status: 'ok',
      pluginConnected: bridge.isPluginConnected(),
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      pluginConnected: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const bridge = await ensureBridgeRunning();

    if (!bridge.isPluginConnected()) {
      return NextResponse.json({
        error: 'Figma plugin not connected. Open the MCP Bridge plugin in Figma and keep it running.',
      }, { status: 503 });
    }

    const spec = await request.json();

    if (!spec.pages || !Array.isArray(spec.pages)) {
      return NextResponse.json({ error: 'Invalid design spec' }, { status: 400 });
    }

    const resp = await bridge.sendToPlugin('create_design', spec);

    if (resp.error) {
      return NextResponse.json({ error: resp.error }, { status: 500 });
    }

    return NextResponse.json({ data: resp.data });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
