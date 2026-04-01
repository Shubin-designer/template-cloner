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

    // Clean tree: flatten zero-size containers (Framer/GSAP hidden elements)
    function fixZeroSize(n: Record<string, unknown>): Record<string, unknown>[] {
      if (!n) return [];
      const fixed = { ...n };
      if (Array.isArray(n.children)) {
        const newChildren: Record<string, unknown>[] = [];
        for (const child of n.children as Record<string, unknown>[]) {
          newChildren.push(...fixZeroSize(child));
        }
        fixed.children = newChildren;
      }
      const w = (n.width as number) || 0;
      const h = (n.height as number) || 0;
      if ((w <= 0 || h <= 0) && Array.isArray(fixed.children) && (fixed.children as unknown[]).length > 0) {
        return fixed.children as Record<string, unknown>[];
      }
      if (w <= 0 || h <= 0) return [];
      return [fixed];
    }

    const cleanedResults = fixZeroSize(body.figmaTree);
    const cleanedTree = cleanedResults[0] || body.figmaTree;

    // Collect image URLs from the tree and pre-fetch them
    const imageUrls = collectImageUrlsFromTree(cleanedTree);
    let imageMap = new Map<string, string>();
    if (imageUrls.length > 0) {
      const sourceUrl = body.sourceUrl || '';
      console.log(`[figma-bridge] Fetching ${imageUrls.length} images from ${sourceUrl}...`);
      imageMap = await fetchImagesAsBase64(imageUrls, sourceUrl);
      console.log(`[figma-bridge] Fetched ${imageMap.size}/${imageUrls.length} images`);
    }

    // Send to plugin with image data
    const images = Object.fromEntries(imageMap);
    const spec = {
      figmaTree: cleanedTree,
      pageInfo: body.pageInfo || { name: 'Cloned Page', width: 1440, height: 900 },
      images,
    };

    const specSize = JSON.stringify(spec).length;
    console.log(`[figma-bridge] Payload to plugin: ${(specSize/1024/1024).toFixed(1)} MB (${Object.keys(images).length} images)`);

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

function collectImageUrlsFromTree(node: unknown): string[] {
  const urls: string[] = [];
  function walk(n: unknown) {
    if (!n || typeof n !== 'object') return;
    const obj = n as Record<string, unknown>;
    if (obj.imageUrl && typeof obj.imageUrl === 'string') {
      urls.push(obj.imageUrl);
    }
    if (Array.isArray(obj.children)) {
      for (const child of obj.children) {
        walk(child);
      }
    }
  }
  walk(node);
  return urls;
}
