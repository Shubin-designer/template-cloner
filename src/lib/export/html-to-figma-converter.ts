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

  // Force all elements visible — Webflow/GSAP animations hide elements
  // with visibility:hidden, opacity:0, or transforms until scroll triggers
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = `
      * {
        visibility: visible !important;
        opacity: 1 !important;
        transform: none !important;
        transition: none !important;
        animation: none !important;
      }
    `;
    document.head.appendChild(style);
  });

  // Wait for styles to apply
  await page.waitForTimeout(500);

  // Inject html-to-figma via addScriptTag to ensure proper browser context
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
    function strip(node: unknown): void {
      if (!node || typeof node !== 'object') return;
      const n = node as Record<string, unknown>;
      if (n.metadata && typeof n.metadata === 'object') {
        delete (n.metadata as Record<string, unknown>).node;
      }
      if (Array.isArray(n.children)) {
        for (const child of n.children) {
          strip(child);
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
