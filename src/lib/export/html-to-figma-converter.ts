import type { Page } from 'playwright';
import fs from 'fs';
import path from 'path';

/**
 * Use @magicpatterns/html-to-figma to convert the live DOM
 * directly into Figma-compatible node data.
 */
export async function convertPageToFigmaNodes(page: Page): Promise<FigmaPageData> {
  // Read the UMD bundle
  const bundlePath = path.join(
    process.cwd(),
    'node_modules/@magicpatterns/html-to-figma/dist/htmlToFigma.umd.cjs'
  );
  const bundleCode = fs.readFileSync(bundlePath, 'utf8');

  // Inject via addScriptTag to ensure it runs in proper browser context
  await page.addScriptTag({ content: bundleCode });

  // Run the conversion and strip non-serializable metadata
  const rawData = await page.evaluate(() => {
    // The UMD bundle exposes htmlToFigma on globalThis
    // @ts-expect-error - injected by UMD bundle
    const lib = globalThis.htmlToFigma || window.htmlToFigma;
    if (!lib || !lib.htmlToFigma) {
      throw new Error('html-to-figma library not loaded');
    }

    const result = lib.htmlToFigma(document.body);

    // Strip metadata.node (DOM references — not serializable)
    function strip(node: Record<string, unknown>): void {
      if (node.metadata) {
        const meta = node.metadata as Record<string, unknown>;
        delete meta.node;
      }
      if (Array.isArray(node.children)) {
        for (const child of node.children) {
          strip(child as Record<string, unknown>);
        }
      }
    }
    strip(result);

    return result;
  });

  // Get page dimensions
  const dimensions = await page.evaluate(() => ({
    width: Math.max(document.body.scrollWidth, window.innerWidth),
    height: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
    title: document.title,
  }));

  return {
    name: dimensions.title || 'Cloned Page',
    width: dimensions.width,
    height: dimensions.height,
    tree: rawData,
  };
}

export interface FigmaPageData {
  name: string;
  width: number;
  height: number;
  tree: unknown;
}
