import type { Page } from 'playwright';
import fs from 'fs';
import path from 'path';

/**
 * Use @magicpatterns/html-to-figma to convert the live DOM
 * directly into Figma-compatible node data.
 *
 * This runs the library inside Playwright's browser context,
 * giving it access to getComputedStyle, getBoundingClientRect, etc.
 * The output maps directly to Figma Plugin API node types.
 */
export async function convertPageToFigmaNodes(page: Page): Promise<FigmaPageData> {
  // Read the UMD bundle
  const bundlePath = path.join(
    process.cwd(),
    'node_modules/@magicpatterns/html-to-figma/dist/htmlToFigma.umd.cjs'
  );
  const bundleCode = fs.readFileSync(bundlePath, 'utf8');

  // Inject the library into the page
  await page.evaluate(bundleCode);

  // Run the conversion
  const rawData = await page.evaluate(() => {
    // @ts-expect-error - htmlToFigma is injected globally by the UMD bundle
    const result = htmlToFigma.htmlToFigma(document.body);
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
  tree: unknown; // Raw html-to-figma output — passed directly to plugin
}
