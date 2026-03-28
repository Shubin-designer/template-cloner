import { NextRequest, NextResponse } from 'next/server';
import { ensureBridgeRunning } from '@/lib/figma-bridge/server';
import { collectImageUrls, injectImageBase64 } from '@/lib/export/figma-json';
import { fetchImagesAsBase64 } from '@/lib/export/image-fetcher';

export async function GET() {
  try {
    const bridge = await ensureBridgeRunning();
    const connected = await bridge.checkPluginConnected();
    return NextResponse.json({ status: 'ok', pluginConnected: connected });
  } catch (error) {
    return NextResponse.json({
      status: 'error', pluginConnected: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const bridge = await ensureBridgeRunning();
    const connected = await bridge.checkPluginConnected();
    if (!connected) {
      return NextResponse.json({
        error: 'Figma plugin not connected. Open the SiteCloner Bridge plugin in Figma.',
      }, { status: 503 });
    }

    const spec = await request.json();

    // v3 format: spec.page.children
    const children = spec.page?.children;
    if (!children || !Array.isArray(children)) {
      console.error('[figma-bridge] Invalid spec. Keys:', Object.keys(spec), 'page keys:', spec.page ? Object.keys(spec.page) : 'none');
      return NextResponse.json({ error: 'Invalid design spec: missing page.children' }, { status: 400 });
    }

    // Pre-fetch images
    const sourceUrl = spec.source?.url || '';
    const imageUrls = collectImageUrls(children);
    if (imageUrls.length > 0) {
      const imageMap = await fetchImagesAsBase64(imageUrls, sourceUrl);
      injectImageBase64(children, imageMap);
    }

    const result = await bridge.createDesign(spec);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json({ data: result.data });
  } catch (error) {
    console.error('[figma-bridge] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
