import type { Page } from 'playwright';
import { getDomWalkerScript, type DOMNode } from './dom-walker';
import { analyzeDOMTree, type FigmaOutputNode } from './server-analyzer';

export interface FigmaPageData {
  name: string;
  width: number;
  height: number;
  tree: FigmaOutputNode;
}

/**
 * New pipeline:
 * 1. Force visibility (animations)
 * 2. DOM Walker — single pass, collects structure + ALL CSS
 * 3. Server Analyzer — converts DOMNode tree to Figma-ready tree
 * No matching, no collisions, no second pass.
 */
export async function convertPageToFigmaNodes(page: Page): Promise<FigmaPageData> {
  // Force all elements visible (Webflow/GSAP animations)
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
  await page.waitForTimeout(500);

  // Step 1: DOM Walker — one pass, everything collected
  const script = getDomWalkerScript();
  const domTree: DOMNode = await page.evaluate(script);

  if (!domTree) {
    throw new Error('DOM Walker returned null');
  }

  // Step 2: Server Analyzer — CSS → Figma mapping with full tree context
  const figmaTree = analyzeDOMTree(domTree);

  return {
    name: domTree.name || 'Cloned Page',
    width: domTree.width,
    height: domTree.height,
    tree: figmaTree,
  };
}
