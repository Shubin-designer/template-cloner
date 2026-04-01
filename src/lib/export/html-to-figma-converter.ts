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

  // BLOCK 1: Clean DOM before conversion — remove invisible garbage
  const cleanStats = await page.evaluate(() => {
    let removed = 0;
    let unwrapped = 0;

    function cleanElement(el: Element): void {
      // Process children first (bottom-up)
      const children = Array.from(el.children);
      for (const child of children) {
        cleanElement(child);
      }

      const cs = window.getComputedStyle(el);
      const tag = el.tagName;

      // Skip body and important structural tags
      if (tag === 'BODY' || tag === 'HTML') return;

      // Remove display:none elements entirely
      if (cs.display === 'none') {
        el.remove();
        removed++;
        return;
      }

      // Remove zero-size non-structural elements with no visible children
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 && rect.height < 1) {
        // Keep if it has visible children (they might be absolutely positioned)
        const hasVisibleChild = Array.from(el.children).some(c => {
          const cr = c.getBoundingClientRect();
          return cr.width > 0 && cr.height > 0;
        });
        if (!hasVisibleChild) {
          el.remove();
          removed++;
          return;
        }
      }

      // BLOCK 2: Unwrap display:contents — children should belong to parent
      if (cs.display === 'contents') {
        const parent = el.parentElement;
        if (parent) {
          while (el.firstChild) {
            parent.insertBefore(el.firstChild, el);
          }
          el.remove();
          unwrapped++;
        }
      }
    }

    cleanElement(document.body);
    return { removed, unwrapped };
  });

  console.log(`[converter] Cleaned DOM: removed ${cleanStats.removed}, unwrapped ${cleanStats.unwrapped} display:contents`);

  // Inject html-to-figma via addScriptTag to ensure proper browser context
  await page.addScriptTag({ content: bundleCode });

  // Run the conversion, enrich with computed colors, strip metadata
  const rawData = await page.evaluate(() => {
    // @ts-expect-error - injected by UMD bundle
    const lib = globalThis.htmlToFigma || window.htmlToFigma;
    if (!lib || !lib.htmlToFigma) {
      throw new Error('html-to-figma library not loaded');
    }

    const result = lib.htmlToFigma(document.body);

    // Enrich: walk all DOM elements and add background colors
    // that the library missed (it only checks CSS stylesheets, not computedStyle)
    function rgbaToFill(rgba: string): Record<string, unknown> | null {
      if (!rgba || rgba === 'rgba(0, 0, 0, 0)' || rgba === 'transparent') return null;
      const m = rgba.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/);
      if (!m) return null;
      const ri = parseInt(m[1]);
      const gi = parseInt(m[2]);
      const bi = parseInt(m[3]);
      const a = m[4] !== undefined ? parseFloat(m[4]) : 1;
      if (a === 0) return null;
      // Skip pure black and pure white — these are usually defaults, not real backgrounds
      if (ri === 0 && gi === 0 && bi === 0) return null;
      if (ri === 255 && gi === 255 && bi === 255) return null;
      const r = ri / 255;
      const g = gi / 255;
      const b = bi / 255;
      return { type: 'SOLID', color: { r, g, b }, opacity: a, visible: true, blendMode: 'NORMAL' };
    }

    // Walk the DOM in parallel with the figma tree to enrich fills
    function enrichFromDOM(figmaNode: Record<string, unknown>, domEl: Element | null): void {
      if (!figmaNode || !domEl) return;

      // Add background fill if library didn't set one
      if (!figmaNode.backgroundFill && figmaNode.type === 'FRAME') {
        const cs = window.getComputedStyle(domEl);
        const fill = rgbaToFill(cs.backgroundColor);
        if (fill) {
          figmaNode.backgroundFill = fill;
        }
      }

      // Match children by index
      const figmaChildren = figmaNode.children as Record<string, unknown>[] | undefined;
      const domChildren = domEl.children;
      if (figmaChildren && domChildren) {
        let domIdx = 0;
        for (let i = 0; i < figmaChildren.length && domIdx < domChildren.length; i++) {
          const fc = figmaChildren[i];
          if (fc && (fc.type === 'FRAME' || fc.type === 'TEXT')) {
            enrichFromDOM(fc, domChildren[domIdx]);
            domIdx++;
          } else if (fc && fc.type === 'SVG') {
            domIdx++;
          } else if (fc) {
            // TEXT nodes don't have matching DOM children, skip domIdx
          }
        }
      }
    }

    // Try to enrich - if DOM doesn't match perfectly, just skip
    try {
      enrichFromDOM(result, document.body);
    } catch {
      // Non-critical
    }

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
