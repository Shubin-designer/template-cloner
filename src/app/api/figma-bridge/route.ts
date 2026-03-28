import { NextRequest, NextResponse } from 'next/server';
import { ensureBridgeRunning } from '@/lib/figma-bridge/server';
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

    const body = await request.json();

    // Expect { figmaTree, pageInfo, sourceUrl }
    if (!body.figmaTree) {
      return NextResponse.json({ error: 'Missing figmaTree data' }, { status: 400 });
    }

    // Collect image URLs from the tree and pre-fetch them
    const imageUrls = collectImageUrlsFromTree(body.figmaTree);
    let imageMap = new Map<string, string>();
    if (imageUrls.length > 0 && body.sourceUrl) {
      imageMap = await fetchImagesAsBase64(imageUrls, body.sourceUrl);
    }

    // Send to plugin with image data
    const spec = {
      figmaTree: body.figmaTree,
      pageInfo: body.pageInfo || { name: 'Cloned Page', width: 1440, height: 900 },
      images: Object.fromEntries(imageMap),
    };

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

function collectImageUrlsFromTree(node: Record<string, unknown>): string[] {
  const urls: string[] = [];
  function walk(n: Record<string, unknown>) {
    if (n.imageUrl && typeof n.imageUrl === 'string') {
      urls.push(n.imageUrl);
    }
    if (Array.isArray(n.children)) {
      for (const child of n.children) {
        walk(child as Record<string, unknown>);
      }
    }
  }
  walk(node);
  return urls;
}
