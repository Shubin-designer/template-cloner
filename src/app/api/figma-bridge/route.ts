import { NextRequest, NextResponse } from 'next/server';
import { ensureBridgeRunning } from '@/lib/figma-bridge/server';
import { collectImageUrls, injectImageBase64 } from '@/lib/export/figma-json';
import { fetchImagesAsBase64 } from '@/lib/export/image-fetcher';

export async function GET() {
  try {
    const bridge = await ensureBridgeRunning();
    const connected = await bridge.checkPluginConnected();
    return NextResponse.json({
      status: 'ok',
      pluginConnected: connected,
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

    const connected = await bridge.checkPluginConnected();
    if (!connected) {
      return NextResponse.json({
        error: 'Figma plugin not connected. Open the SiteCloner Bridge plugin in Figma.',
      }, { status: 503 });
    }

    const spec = await request.json();

    // Support both v2 (spec.page) and v1 (spec.pages) formats
    const page = spec.page || (spec.pages && spec.pages[0]);
    const elements = page?.elements || page?.children;

    if (!page || !elements) {
      console.error('[figma-bridge] Invalid spec keys:', Object.keys(spec));
      return NextResponse.json({
        error: `Invalid design spec. Got keys: ${Object.keys(spec).join(', ')}`,
      }, { status: 400 });
    }

    // Normalize to v2 format
    if (!spec.page) {
      spec.page = { ...page, elements: elements };
    }
    if (!spec.page.elements && spec.page.children) {
      spec.page.elements = spec.page.children;
    }

    // Pre-fetch images
    const sourceUrl = spec.source?.url || '';
    const imageUrls = collectImageUrls(spec.page.elements);
    if (imageUrls.length > 0) {
      const imageMap = await fetchImagesAsBase64(imageUrls, sourceUrl);
      injectImageBase64(spec.page.elements, imageMap);
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
