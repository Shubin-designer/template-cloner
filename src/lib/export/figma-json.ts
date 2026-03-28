import type { ComponentNode } from '@/types/component-tree';
import type { PageMetadata } from '@/types/clone';

// --- Types ---

export interface FigmaDesignSpec {
  version: '2.0';
  source: {
    url: string;
    title: string;
    scrapedAt: string;
  };
  page: {
    name: string;
    width: number;
    height: number;
    backgroundColor?: string;
    elements: FigmaElement[];
  };
}

export interface FigmaElement {
  name: string;
  type: 'FRAME' | 'TEXT' | 'IMAGE';
  // Absolute position relative to page top-left
  x: number;
  y: number;
  width: number;
  height: number;
  // Visual
  backgroundColor?: string; // hex
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string; // hex
  opacity?: number;
  // Text (only for TEXT type)
  characters?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  lineHeight?: number;
  letterSpacing?: number;
  textColor?: string; // hex
  textAlign?: string;
  // Image (only for IMAGE type)
  imageUrl?: string;
  imageBase64?: string;
}

// --- Helpers ---

function toHex(color: string | undefined): string | null {
  if (!color || color === 'transparent' || color === 'none' || color === '') return null;
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

function parseSize(value: string | undefined): number {
  if (!value) return 0;
  const num = parseFloat(value);
  return isNaN(num) ? 0 : Math.round(num);
}

// --- Flatten tree to absolute-positioned elements ---

function flattenNode(
  node: ComponentNode,
  elements: FigmaElement[],
  pageOffsetY: number
): void {
  if (!node.rect || node.rect.width < 1 || node.rect.height < 1) return;

  const styles = node.styles;
  const isImg = node.tag === 'img';
  const isTextLeaf = !!(node.textContent && node.children.length === 0 && !isImg);

  const bgColor = toHex(styles.backgroundColor);
  const borderWidth = parseSize(styles.borderWidth);
  const borderColor = toHex(styles.borderColor);
  const borderRadius = parseSize(styles.borderRadius);
  const opacity = styles.opacity ? parseFloat(styles.opacity) : undefined;

  // Determine element type
  let type: FigmaElement['type'] = 'FRAME';
  if (isImg) type = 'IMAGE';
  else if (isTextLeaf) type = 'TEXT';

  const element: FigmaElement = {
    name: `${node.type}/${node.tag}${node.className ? '.' + node.className.split(/\s+/)[0] : ''}`,
    type,
    x: Math.round(node.rect.x),
    y: Math.round(node.rect.y - pageOffsetY),
    width: Math.round(node.rect.width),
    height: Math.round(node.rect.height),
  };

  // Background
  if (bgColor) element.backgroundColor = bgColor;

  // Border
  if (borderWidth > 0 && borderColor) {
    element.borderWidth = borderWidth;
    element.borderColor = borderColor;
  }
  if (borderRadius > 0) element.borderRadius = borderRadius;

  // Opacity
  if (opacity != null && opacity < 1 && !isNaN(opacity)) element.opacity = opacity;

  // Text
  if (type === 'TEXT' && node.textContent) {
    element.characters = node.textContent;
    element.fontFamily = styles.fontFamily?.split(',')[0]?.replace(/['"]/g, '').trim() || 'Inter';
    element.fontSize = parseSize(styles.fontSize) || 16;
    element.fontWeight = styles.fontWeight ? parseInt(styles.fontWeight, 10) || 400 : 400;
    element.textColor = toHex(styles.color) || '#000000';
    if (styles.lineHeight) {
      const lh = parseSize(styles.lineHeight);
      if (lh > 0) element.lineHeight = lh;
    }
    if (styles.letterSpacing) {
      const ls = parseSize(styles.letterSpacing);
      if (ls !== 0) element.letterSpacing = ls;
    }
    if (styles.textAlign) element.textAlign = styles.textAlign;
  }

  // Image
  if (type === 'IMAGE' && node.attributes?.src) {
    element.imageUrl = node.attributes.src;
  }

  // Only add elements that have visual content
  const hasVisual = bgColor || type === 'TEXT' || type === 'IMAGE' ||
    (borderWidth > 0 && borderColor) || borderRadius > 0;

  if (hasVisual) {
    elements.push(element);
  }

  // Recurse into children
  for (const child of node.children) {
    flattenNode(child, elements, pageOffsetY);
  }
}

// --- Image collection ---

export function collectImageUrls(elements: FigmaElement[]): string[] {
  return elements
    .filter((e) => e.type === 'IMAGE' && e.imageUrl)
    .map((e) => e.imageUrl!);
}

export function injectImageBase64(
  elements: FigmaElement[],
  imageMap: Map<string, string>
): void {
  for (const el of elements) {
    if (el.imageUrl && imageMap.has(el.imageUrl)) {
      el.imageBase64 = imageMap.get(el.imageUrl)!;
    }
  }
}

// --- Main export ---

export function generateFigmaDesignSpec(
  tree: ComponentNode[],
  metadata: PageMetadata,
  url: string,
  scrapedAt: string
): FigmaDesignSpec {
  // Calculate page dimensions from tree
  let maxBottom = 0;
  let pageOffsetY = Infinity;

  for (const node of tree) {
    if (node.rect) {
      if (node.rect.y < pageOffsetY) pageOffsetY = node.rect.y;
      const bottom = node.rect.y + node.rect.height;
      if (bottom > maxBottom) maxBottom = bottom;
    }
  }
  if (pageOffsetY === Infinity) pageOffsetY = 0;

  // Flatten all nodes to absolute-positioned elements
  const elements: FigmaElement[] = [];
  for (const node of tree) {
    flattenNode(node, elements, pageOffsetY);
  }

  return {
    version: '2.0',
    source: {
      url,
      title: metadata.title || 'Untitled',
      scrapedAt,
    },
    page: {
      name: metadata.title || 'Cloned Page',
      width: 1440,
      height: Math.max(900, Math.round(maxBottom - pageOffsetY)),
      backgroundColor: '#ffffff',
      elements,
    },
  };
}
