import type { Page } from 'playwright';
import fs from 'fs';
import path from 'path';

export interface FigmaPageData {
  name: string;
  width: number;
  height: number;
  tree: unknown;
}

/**
 * Convert page to Figma nodes using html-to-figma library
 * + full Layout Analyzer enrichment (50 CSS→Figma mappings).
 */
export async function convertPageToFigmaNodes(page: Page): Promise<FigmaPageData> {
  const bundlePath = path.join(
    process.cwd(),
    'node_modules/@magicpatterns/html-to-figma/dist/htmlToFigma.umd.cjs'
  );
  const bundleCode = fs.readFileSync(bundlePath, 'utf8');

  // Force all elements visible (animations hide elements)
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

  // Inject html-to-figma
  await page.addScriptTag({ content: bundleCode });

  // Step 1: Run html-to-figma for base structure
  // Step 2: Collect full CSS data from ALL elements
  // Step 3: Enrich figma tree with Layout Analyzer data
  const rawData = await page.evaluate(() => {
    // @ts-expect-error - UMD bundle
    const lib = globalThis.htmlToFigma || window.htmlToFigma;
    if (!lib?.htmlToFigma) throw new Error('html-to-figma not loaded');

    const result = lib.htmlToFigma(document.body);

    // ========================================
    // LAYOUT ANALYZER — inline (runs in browser)
    // ========================================

    function rgbToFigmaColor(color: string): {r:number,g:number,b:number,a:number}|null {
      if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') return null;
      if (color.startsWith('#')) {
        const h = color.replace('#','');
        const f = h.length===3 ? h[0]+h[0]+h[1]+h[1]+h[2]+h[2] : h.substring(0,6);
        return { r:parseInt(f.substring(0,2),16)/255, g:parseInt(f.substring(2,4),16)/255, b:parseInt(f.substring(4,6),16)/255, a:1 };
      }
      const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/);
      if (!m) return null;
      const a = m[4]!==undefined ? parseFloat(m[4]) : 1;
      if (a===0) return null;
      return { r:parseInt(m[1])/255, g:parseInt(m[2])/255, b:parseInt(m[3])/255, a };
    }

    function pxVal(v: string): number {
      if (!v || v==='none'||v==='normal'||v==='auto') return 0;
      const n = parseFloat(v);
      return isNaN(n) ? 0 : Math.round(n);
    }

    // Collect CSS data for ALL visible elements by bounding rect
    interface LayoutInfo {
      // Layout
      layoutMode?: string;
      layoutWrap?: string;
      itemSpacing?: number;
      counterAxisSpacing?: number;
      primaryAxisAlignItems?: string;
      counterAxisAlignItems?: string;
      primaryAxisSizingMode?: string;
      counterAxisSizingMode?: string;
      // Padding
      paddingTop?: number;
      paddingRight?: number;
      paddingBottom?: number;
      paddingLeft?: number;
      // Fill
      backgroundFill?: Record<string,unknown>;
      // Border
      strokes?: Array<Record<string,unknown>>;
      strokeTopWeight?: number;
      strokeRightWeight?: number;
      strokeBottomWeight?: number;
      strokeLeftWeight?: number;
      topLeftRadius?: number;
      topRightRadius?: number;
      bottomRightRadius?: number;
      bottomLeftRadius?: number;
      // Effects
      effects?: Array<Record<string,unknown>>;
      clipsContent?: boolean;
      opacity?: number;
      blendMode?: string;
      rotation?: number;
      // Sizing
      layoutSizingH?: string;
      layoutSizingV?: string;
      layoutGrow?: number;
      minWidth?: number;
      maxWidth?: number;
      minHeight?: number;
      maxHeight?: number;
      // Text
      textAlignH?: string;
      textDecoration?: string;
      textCase?: string;
      // Children overlap?
      hasOverlap?: boolean;
    }

    const layoutMap = new Map<string, LayoutInfo>();

    document.querySelectorAll('*').forEach((el) => {
      const cs = window.getComputedStyle(el);
      if (cs.display === 'none') return;
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;

      const info: LayoutInfo = {};
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      const cc = el.children.length;

      // --- LAYOUT MODE ---
      const isFlex = cs.display==='flex' || cs.display==='inline-flex';
      const isGrid = cs.display==='grid' || cs.display==='inline-grid';

      if (isFlex) {
        info.layoutMode = (cs.flexDirection==='column'||cs.flexDirection==='column-reverse') ? 'VERTICAL' : 'HORIZONTAL';
        if (cs.flexWrap==='wrap'||cs.flexWrap==='wrap-reverse') info.layoutWrap = 'WRAP';
      } else if (isGrid) {
        info.layoutMode = 'HORIZONTAL';
        info.layoutWrap = 'WRAP';
      } else if (cc > 0 && (cs.display==='block'||cs.display==='inline-block'||cs.display==='list-item')) {
        info.layoutMode = 'VERTICAL';
      }

      if (!info.layoutMode) return; // only process layout containers

      // Check children overlap
      const childRects: Array<{l:number,t:number,r:number,b:number}> = [];
      let hasOverlap = false;
      for (const child of Array.from(el.children)) {
        const cr = child.getBoundingClientRect();
        if (cr.width<1||cr.height<1) continue;
        const childCS = window.getComputedStyle(child);
        // position:absolute children → overlap expected
        if (childCS.position==='absolute'||childCS.position==='fixed') { hasOverlap=true; break; }
        const nr = {l:cr.left,t:cr.top,r:cr.right,b:cr.bottom};
        for (const ex of childRects) {
          if (nr.l<ex.r-2 && nr.r>ex.l+2 && nr.t<ex.b-2 && nr.b>ex.t+2) { hasOverlap=true; break; }
        }
        if (hasOverlap) break;
        childRects.push(nr);
      }
      info.hasOverlap = hasOverlap;

      // --- SPACING ---
      const gap = pxVal(cs.gap) || pxVal(cs.columnGap);
      if (gap>0) info.itemSpacing = gap;
      const rowGap = pxVal(cs.rowGap) || pxVal(cs.gap);
      if (rowGap>0 && info.layoutWrap==='WRAP') info.counterAxisSpacing = rowGap;

      // --- ALIGNMENT ---
      const jc = cs.justifyContent;
      if (jc==='center') info.primaryAxisAlignItems='CENTER';
      else if (jc==='flex-end'||jc==='end') info.primaryAxisAlignItems='MAX';
      else if (jc==='space-between') info.primaryAxisAlignItems='SPACE_BETWEEN';
      const ai = cs.alignItems;
      if (ai==='center') info.counterAxisAlignItems='CENTER';
      else if (ai==='flex-end'||ai==='end') info.counterAxisAlignItems='MAX';

      // --- SIZING MODES ---
      if (info.layoutWrap==='WRAP') {
        info.primaryAxisSizingMode='FIXED';
        info.counterAxisSizingMode='AUTO';
      } else {
        info.primaryAxisSizingMode='AUTO';
        info.counterAxisSizingMode='FIXED';
      }

      // --- PADDING ---
      const pt=pxVal(cs.paddingTop), pr=pxVal(cs.paddingRight), pb=pxVal(cs.paddingBottom), pl=pxVal(cs.paddingLeft);
      if (pt) info.paddingTop=pt;
      if (pr) info.paddingRight=pr;
      if (pb) info.paddingBottom=pb;
      if (pl) info.paddingLeft=pl;

      // --- FILL ---
      const bgC = rgbToFigmaColor(cs.backgroundColor);
      if (bgC && !(bgC.r===0&&bgC.g===0&&bgC.b===0)) {
        info.backgroundFill = { type:'SOLID', color:{r:bgC.r,g:bgC.g,b:bgC.b}, opacity:bgC.a, visible:true };
      }

      // --- BORDER ---
      const btw=pxVal(cs.borderTopWidth), brw=pxVal(cs.borderRightWidth), bbw=pxVal(cs.borderBottomWidth), blw=pxVal(cs.borderLeftWidth);
      if (btw>0||brw>0||bbw>0||blw>0) {
        const bc = rgbToFigmaColor(cs.borderTopColor) || rgbToFigmaColor(cs.borderRightColor);
        if (bc) {
          info.strokes = [{type:'SOLID',color:{r:bc.r,g:bc.g,b:bc.b},opacity:bc.a}];
          info.strokeTopWeight=btw; info.strokeRightWeight=brw; info.strokeBottomWeight=bbw; info.strokeLeftWeight=blw;
        }
      }
      const tlr=pxVal(cs.borderTopLeftRadius), trr=pxVal(cs.borderTopRightRadius);
      const brr=pxVal(cs.borderBottomRightRadius), blr=pxVal(cs.borderBottomLeftRadius);
      if (tlr) info.topLeftRadius=tlr;
      if (trr) info.topRightRadius=trr;
      if (brr) info.bottomRightRadius=brr;
      if (blr) info.bottomLeftRadius=blr;

      // --- EFFECTS ---
      if (cs.overflow==='hidden'||cs.overflowX==='hidden'||cs.overflowY==='hidden') info.clipsContent=true;
      const opV = parseFloat(cs.opacity);
      if (!isNaN(opV)&&opV<1) info.opacity=opV;

      // --- TEXT ---
      if (cs.textAlign==='center') info.textAlignH='CENTER';
      else if (cs.textAlign==='right'||cs.textAlign==='end') info.textAlignH='RIGHT';

      // Store with multiple keys
      layoutMap.set(`${w},${h},${cc}`, info);
      if (!layoutMap.has(`${w},${h}`)) layoutMap.set(`${w},${h}`, info);
    });

    // ========================================
    // APPLY layout info to figma tree
    // ========================================

    function applyLayout(node: Record<string,unknown>): void {
      if (!node) return;

      const w = Math.round(node.width as number||0);
      const h = Math.round(node.height as number||0);
      const cc = Array.isArray(node.children) ? (node.children as unknown[]).length : 0;
      const info = layoutMap.get(`${w},${h},${cc}`) || layoutMap.get(`${w},${h}`);

      if (info && node.type==='FRAME') {
        // Don't apply auto layout if children overlap (needs absolute positioning)
        if (!info.hasOverlap && info.layoutMode) {
          if (!node.layoutMode) {
            node.layoutMode = info.layoutMode;
            if (info.itemSpacing!=null) node.itemSpacing = info.itemSpacing;
            if (info.counterAxisSpacing!=null) node.counterAxisSpacing = info.counterAxisSpacing;
            if (info.layoutWrap) node.layoutWrap = info.layoutWrap;
            if (info.primaryAxisAlignItems) node.primaryAxisAlignItems = info.primaryAxisAlignItems;
            if (info.counterAxisAlignItems) node.counterAxisAlignItems = info.counterAxisAlignItems;
            if (info.primaryAxisSizingMode) node.primaryAxisSizingMode = info.primaryAxisSizingMode;
            if (info.counterAxisSizingMode) node.counterAxisSizingMode = info.counterAxisSizingMode;
          }
        }

        // Padding (always apply if missing)
        if (!node.padding) {
          const p: Record<string,number> = {};
          if (info.paddingTop) p.top = info.paddingTop;
          if (info.paddingRight) p.right = info.paddingRight;
          if (info.paddingBottom) p.bottom = info.paddingBottom;
          if (info.paddingLeft) p.left = info.paddingLeft;
          if (Object.keys(p).length) node.padding = p;
        }

        // Fill (if library didn't set one)
        if (!node.backgroundFill && info.backgroundFill) {
          node.backgroundFill = info.backgroundFill;
        }

        // Border
        if (!node.strokes && info.strokes) {
          node.strokes = info.strokes;
          node.strokeTopWeight = info.strokeTopWeight;
          node.strokeRightWeight = info.strokeRightWeight;
          node.strokeBottomWeight = info.strokeBottomWeight;
          node.strokeLeftWeight = info.strokeLeftWeight;
        }

        // Radius
        if (!node.topLeftRadius && info.topLeftRadius) node.topLeftRadius = info.topLeftRadius;
        if (!node.topRightRadius && info.topRightRadius) node.topRightRadius = info.topRightRadius;
        if (!node.bottomRightRadius && info.bottomRightRadius) node.bottomRightRadius = info.bottomRightRadius;
        if (!node.bottomLeftRadius && info.bottomLeftRadius) node.bottomLeftRadius = info.bottomLeftRadius;

        // Clipping
        if (info.clipsContent) node.clipsContent = true;

        // Opacity
        if (info.opacity!=null && !node.opacity) node.opacity = info.opacity;
      }

      // Recurse
      if (Array.isArray(node.children)) {
        (node.children as Record<string,unknown>[]).forEach(applyLayout);
      }
    }

    applyLayout(result);

    // ========================================
    // STRIP non-serializable metadata
    // ========================================
    function strip(node: unknown): void {
      if (!node || typeof node !== 'object') return;
      const n = node as Record<string, unknown>;
      if (n.metadata && typeof n.metadata === 'object') {
        delete (n.metadata as Record<string, unknown>).node;
      }
      if (Array.isArray(n.children)) {
        for (const child of n.children) strip(child);
      }
    }
    strip(result);

    return result;
  });

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
