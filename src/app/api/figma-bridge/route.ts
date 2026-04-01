import { NextRequest, NextResponse } from 'next/server';
import { ensureBridgeRunning } from '@/lib/figma-bridge/server';
import { fetchImagesAsBase64 } from '@/lib/export/image-fetcher';
import { adaptForPlugin } from '@/lib/export/figma-tree-adapter';

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
        error: 'Figma plugin not connected.',
      }, { status: 503 });
    }

    const body = await request.json();

    let pluginTree = body.figmaTree;

    // If from server-analyzer, adapt for plugin format
    if (pluginTree && (pluginTree.useAbsolutePosition !== undefined || pluginTree.layoutAlign)) {
      pluginTree = adaptForPlugin(pluginTree);
    }

    if (!pluginTree) {
      return NextResponse.json({ error: 'Missing figmaTree data' }, { status: 400 });
    }

    // Fetch images
    const imageUrls = collectImageUrls(pluginTree);
    let imageMap = new Map<string, string>();
    if (imageUrls.length > 0) {
      const sourceUrl = body.sourceUrl || '';
      imageMap = await fetchImagesAsBase64(imageUrls, sourceUrl);
    }

    const spec = {
      figmaTree: pluginTree,
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

function collectImageUrls(node: unknown): string[] {
  const urls: string[] = [];
  function walk(n: unknown) {
    if (!n || typeof n !== 'object') return;
    const obj = n as Record<string, unknown>;
    if (obj.imageUrl && typeof obj.imageUrl === 'string') urls.push(obj.imageUrl);
    if (Array.isArray(obj.children)) {
      for (const child of obj.children) walk(child);
    }
  }
  walk(node);
  return urls;
}
