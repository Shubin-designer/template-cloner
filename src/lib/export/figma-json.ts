import type { ComponentNode } from '@/types/component-tree';
import type { PageMetadata } from '@/types/clone';

// --- Types ---

export interface FigmaDesignSpec {
  version: '3.0';
  source: { url: string; title: string; scrapedAt: string };
  page: {
    name: string;
    width: number;
    height: number;
    children: FigmaNode[];
  };
}

export interface FigmaNode {
  name: string;
  type: 'FRAME' | 'TEXT' | 'IMAGE';
  width: number;
  height: number;
  // Layout (for FRAME with children)
  layoutMode?: 'HORIZONTAL' | 'VERTICAL';
  itemSpacing?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  primaryAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
  counterAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX';
  // Sizing in parent's auto layout
  layoutSizingHorizontal?: 'FILL' | 'HUG' | 'FIXED';
  layoutSizingVertical?: 'FILL' | 'HUG' | 'FIXED';
  // Visual
  backgroundColor?: string;
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;
  opacity?: number;
  boxShadow?: string;
  // Text
  characters?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  lineHeight?: number;
  letterSpacing?: number;
  textColor?: string;
  textAlign?: string;
  // Image
  imageUrl?: string;
  imageBase64?: string;
  // Children
  children?: FigmaNode[];
}

// --- Helpers ---

function toHex(color: string | undefined): string | null {
  if (!color || color === '' || color === 'transparent' || color === 'none') return null;
  if (/^#[0-9a-fA-F]{3,8}$/.test(color)) {
    const h = color.replace('#', '');
    if (h.length === 3) return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
    return `#${h.substring(0, 6)}`;
  }
  const match = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (match) {
    const r = parseInt(match[1], 10);
    const g = parseInt(match[2], 10);
    const b = parseInt(match[3], 10);
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }
  return null;
}

function px(value: string | undefined): number {
  if (!value) return 0;
  const n = parseFloat(value);
  return isNaN(n) ? 0 : Math.round(n);
}

function mapAlign(v: string | undefined): 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN' {
  if (v === 'center') return 'CENTER';
  if (v === 'flex-end' || v === 'end') return 'MAX';
  if (v === 'space-between') return 'SPACE_BETWEEN';
  return 'MIN';
}

function mapCrossAlign(v: string | undefined): 'MIN' | 'CENTER' | 'MAX' {
  if (v === 'center') return 'CENTER';
  if (v === 'flex-end' || v === 'end') return 'MAX';
  return 'MIN';
}

// --- Convert ComponentNode → FigmaNode (recursive, keeps hierarchy) ---

function convertNode(node: ComponentNode): FigmaNode {
  const s = node.styles;
  const isImg = node.tag === 'img' || node.tag === 'svg';
  const isText = !!(node.textContent && node.children.length === 0 && !isImg);
  const hasChildren = node.children.length > 0;

  const w = Math.max(1, node.rect?.width || px(s.width) || 100);
  const h = Math.max(1, node.rect?.height || px(s.height) || 20);

  const figNode: FigmaNode = {
    name: `${node.type}/${node.tag}${node.className ? '.' + node.className.split(/\s+/)[0] : ''}`,
    type: isImg ? 'IMAGE' : isText ? 'TEXT' : 'FRAME',
    width: w,
    height: h,
    // Default: fill parent width, hug height
    layoutSizingHorizontal: 'FILL',
    layoutSizingVertical: 'HUG',
  };

  // --- Layout (Auto Layout) ---
  if (figNode.type === 'FRAME') {
    const isFlex = s.display === 'flex' || s.display === 'inline-flex';
    const isGrid = s.display === 'grid' || s.display === 'inline-grid';

    if (isFlex || isGrid || hasChildren) {
      // Determine direction
      if (isFlex && s.flexDirection === 'row') {
        figNode.layoutMode = 'HORIZONTAL';
      } else if (isGrid) {
        // Approximate grid as horizontal (most common for card grids)
        figNode.layoutMode = 'HORIZONTAL';
      } else {
        // Default: vertical stack (block flow)
        figNode.layoutMode = 'VERTICAL';
      }

      figNode.itemSpacing = px(s.gap) || 0;
      figNode.primaryAxisAlignItems = mapAlign(s.justifyContent);
      figNode.counterAxisAlignItems = mapCrossAlign(s.alignItems);
    }

    // Padding
    const pt = px(s.paddingTop) || 0;
    const pr = px(s.paddingRight) || 0;
    const pb = px(s.paddingBottom) || 0;
    const pl = px(s.paddingLeft) || 0;
    if (pt || pr || pb || pl) {
      figNode.paddingTop = pt;
      figNode.paddingRight = pr;
      figNode.paddingBottom = pb;
      figNode.paddingLeft = pl;
    }
  }

  // --- Visual ---
  const bg = toHex(s.backgroundColor);
  if (bg) figNode.backgroundColor = bg;

  const br = px(s.borderRadius);
  if (br > 0) figNode.borderRadius = br;

  const bw = px(s.borderWidth);
  const bc = toHex(s.borderColor);
  if (bw > 0 && bc) {
    figNode.borderWidth = bw;
    figNode.borderColor = bc;
  }

  if (s.opacity) {
    const op = parseFloat(s.opacity);
    if (!isNaN(op) && op < 1) figNode.opacity = op;
  }

  if (s.boxShadow && s.boxShadow !== 'none') {
    figNode.boxShadow = s.boxShadow;
  }

  // --- Text ---
  if (isText && node.textContent) {
    figNode.characters = node.textContent;
    figNode.fontFamily = s.fontFamily?.split(',')[0]?.replace(/['"]/g, '').trim() || 'Inter';
    figNode.fontSize = px(s.fontSize) || 16;
    figNode.fontWeight = s.fontWeight ? parseInt(s.fontWeight, 10) || 400 : 400;
    figNode.textColor = toHex(s.color) || '#000000';
    if (s.lineHeight) {
      const lh = px(s.lineHeight);
      if (lh > 0) figNode.lineHeight = lh;
    }
    if (s.letterSpacing) {
      const ls = px(s.letterSpacing);
      if (ls !== 0) figNode.letterSpacing = ls;
    }
    if (s.textAlign) figNode.textAlign = s.textAlign;
    // Text: fill width, hug height
    figNode.layoutSizingHorizontal = 'FILL';
    figNode.layoutSizingVertical = 'HUG';
  }

  // --- Image ---
  if (isImg && node.attributes?.src) {
    figNode.imageUrl = node.attributes.src;
    // Image: fixed size
    figNode.layoutSizingHorizontal = 'FIXED';
    figNode.layoutSizingVertical = 'FIXED';
  }

  // --- Children (recursive) ---
  if (hasChildren) {
    figNode.children = node.children.map(convertNode);
  }

  return figNode;
}

// --- Image helpers ---

export function collectImageUrls(nodes: FigmaNode[]): string[] {
  const urls: string[] = [];
  function walk(n: FigmaNode) {
    if (n.imageUrl) urls.push(n.imageUrl);
    if (n.children) n.children.forEach(walk);
  }
  nodes.forEach(walk);
  return urls;
}

export function injectImageBase64(nodes: FigmaNode[], imageMap: Map<string, string>): void {
  function walk(n: FigmaNode) {
    if (n.imageUrl && imageMap.has(n.imageUrl)) {
      n.imageBase64 = imageMap.get(n.imageUrl)!;
    }
    if (n.children) n.children.forEach(walk);
  }
  nodes.forEach(walk);
}

// --- Main ---

export function generateFigmaDesignSpec(
  tree: ComponentNode[],
  metadata: PageMetadata,
  url: string,
  scrapedAt: string
): FigmaDesignSpec {
  const children = tree.map(convertNode);

  // Page height = sum of top-level children or max bottom coordinate
  let totalHeight = 0;
  for (const node of tree) {
    if (node.rect) {
      const bottom = node.rect.y + node.rect.height;
      if (bottom > totalHeight) totalHeight = bottom;
    }
  }

  return {
    version: '3.0',
    source: { url, title: metadata.title || 'Untitled', scrapedAt },
    page: {
      name: metadata.title || 'Cloned Page',
      width: 1440,
      height: Math.max(900, Math.round(totalHeight)),
      children,
    },
  };
}
