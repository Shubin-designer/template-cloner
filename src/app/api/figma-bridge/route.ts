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
        error: 'Figma plugin not connected. Open the SiteCloner Bridge plugin in Figma and keep it running.',
      }, { status: 503 });
    }

    const spec = await request.json();

    if (!spec.pages || !Array.isArray(spec.pages)) {
      return NextResponse.json({ error: 'Invalid design spec' }, { status: 400 });
    }

    // Pre-fetch all images and inject base64 data
    const sourceUrl = spec.source?.url || '';
    for (const page of spec.pages) {
      if (page.children) {
        const imageUrls = collectImageUrls(page.children);
        if (imageUrls.length > 0) {
          const imageMap = await fetchImagesAsBase64(imageUrls, sourceUrl);
          injectImageBase64(page.children, imageMap);
        }
      }
    }

    const result = await bridge.createDesign(spec);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ data: result.data });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
