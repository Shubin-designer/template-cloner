/**
 * Server-side Layout Analyzer.
 * Takes DOMNode tree (with CSS) → produces Figma-ready tree.
 * Runs in Next.js API route, has full context of the entire tree.
 *
 * Key decisions per node:
 * - flex/grid with no overlap → Auto Layout
 * - overlap or position:absolute → absolute positioning (x,y)
 * - block with children → keep html-to-figma's absolute positioning
 */

import type { DOMNode } from './dom-walker';

export interface FigmaOutputNode {
  name: string;
  type: 'FRAME' | 'TEXT' | 'IMAGE' | 'SVG';
  // Position (only for absolute-positioned children)
  x?: number;
  y?: number;
  width: number;
  height: number;
  // Auto Layout
  layoutMode?: 'HORIZONTAL' | 'VERTICAL';
  layoutWrap?: 'WRAP';
  itemSpacing?: number;
  counterAxisSpacing?: number;
  primaryAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
  counterAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX';
  primaryAxisSizingMode?: 'FIXED' | 'AUTO';
  counterAxisSizingMode?: 'FIXED' | 'AUTO';
  layoutAlign?: 'STRETCH' | 'INHERIT';
  // Padding
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  // Visual
  backgroundColor?: string; // hex
  backgroundGradient?: string; // raw CSS for now
  opacity?: number;
  clipsContent?: boolean;
  blendMode?: string;
  rotation?: number;
  // Border
  strokeColor?: string;
  strokeTopWeight?: number;
  strokeRightWeight?: number;
  strokeBottomWeight?: number;
  strokeLeftWeight?: number;
  topLeftRadius?: number;
  topRightRadius?: number;
  bottomRightRadius?: number;
  bottomLeftRadius?: number;
  // Effects
  boxShadow?: string; // raw CSS — plugin parses
  blur?: number;
  backgroundBlur?: number;
  // Text
  characters?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: string;
  lineHeight?: number;
  letterSpacing?: number;
  textAlignHorizontal?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
  textColor?: string; // hex
  textDecoration?: string;
  textCase?: string;
  // Image
  imageUrl?: string;
  svgContent?: string;
  // Children
  children?: FigmaOutputNode[];
  // Flags for plugin
  useAbsolutePosition?: boolean; // children use x,y
}

function mapAlign(v: string): 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN' {
  if (v === 'center') return 'CENTER';
  if (v === 'flex-end' || v === 'end') return 'MAX';
  if (v === 'space-between') return 'SPACE_BETWEEN';
  return 'MIN';
}

function mapCrossAlign(v: string): 'MIN' | 'CENTER' | 'MAX' {
  if (v === 'center') return 'CENTER';
  if (v === 'flex-end' || v === 'end') return 'MAX';
  return 'MIN';
}

function px(v: string): number {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : Math.round(n);
}

/**
 * Convert DOMNode tree → FigmaOutputNode tree.
 * This is the core analyzer that decides layout strategy per container.
 */
export function analyzeDOMTree(root: DOMNode): FigmaOutputNode {
  return convertNode(root, null);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function convertNode(node: DOMNode, _parent: DOMNode | null): FigmaOutputNode {
  // --- TEXT ---
  if (node.isText && node.textContent) {
    const result: FigmaOutputNode = {
      name: node.name,
      type: 'TEXT',
      width: node.width,
      height: node.height,
      characters: node.textContent,
      fontFamily: node.fontFamily || 'Inter',
      fontSize: node.fontSize || 16,
      fontWeight: node.fontWeight || '400',
      lineHeight: node.lineHeight || undefined,
      letterSpacing: node.letterSpacing || undefined,
      textColor: node.color || '#000000',
    };
    // Text alignment
    if (node.textAlign === 'center') result.textAlignHorizontal = 'CENTER';
    else if (node.textAlign === 'right' || node.textAlign === 'end') result.textAlignHorizontal = 'RIGHT';
    // Font style
    if (node.fontStyle === 'italic') result.fontStyle = 'italic';
    // Text decoration
    if (node.textDecoration) result.textDecoration = node.textDecoration;
    // Text transform
    if (node.textTransform === 'uppercase') result.textCase = 'UPPER';
    else if (node.textTransform === 'lowercase') result.textCase = 'LOWER';
    else if (node.textTransform === 'capitalize') result.textCase = 'TITLE';

    return result;
  }

  // --- IMAGE ---
  if (node.isImage && node.imageUrl) {
    return {
      name: node.name,
      type: 'IMAGE',
      width: node.width,
      height: node.height,
      imageUrl: node.imageUrl,
      topLeftRadius: node.borderTopLeftRadius || undefined,
      topRightRadius: node.borderTopRightRadius || undefined,
      bottomRightRadius: node.borderBottomRightRadius || undefined,
      bottomLeftRadius: node.borderBottomLeftRadius || undefined,
    };
  }

  // --- SVG ---
  if (node.isSvg && node.svgContent) {
    return {
      name: node.name,
      type: 'SVG',
      width: node.width,
      height: node.height,
      svgContent: node.svgContent,
    };
  }

  // --- FRAME (container) ---
  const result: FigmaOutputNode = {
    name: node.name,
    type: 'FRAME',
    width: node.width,
    height: node.height,
  };

  // === LAYOUT DECISION ===
  const isFlex = node.display === 'flex' || node.display === 'inline-flex';
  const isGrid = node.display === 'grid' || node.display === 'inline-grid';

  if (node.hasOverlap || !node.hasChildren) {
    // Overlapping children OR leaf frame → absolute positioning
    result.useAbsolutePosition = true;
  } else if (isFlex) {
    // CSS Flex → Figma Auto Layout
    result.layoutMode = (node.flexDirection === 'column' || node.flexDirection === 'column-reverse')
      ? 'VERTICAL' : 'HORIZONTAL';

    if (node.flexWrap === 'wrap' || node.flexWrap === 'wrap-reverse') {
      result.layoutWrap = 'WRAP';
      result.primaryAxisSizingMode = 'FIXED';
      result.counterAxisSizingMode = 'AUTO';
      const rg = px(node.rowGap) || px(node.gap);
      if (rg > 0) result.counterAxisSpacing = rg;
    } else {
      result.primaryAxisSizingMode = 'AUTO';
      result.counterAxisSizingMode = 'FIXED';
    }

    const gap = px(node.gap);
    if (gap > 0) result.itemSpacing = gap;

    result.primaryAxisAlignItems = mapAlign(node.justifyContent);
    result.counterAxisAlignItems = mapCrossAlign(node.alignItems);
  } else if (isGrid) {
    // CSS Grid → HORIZONTAL + WRAP
    result.layoutMode = 'HORIZONTAL';
    result.layoutWrap = 'WRAP';
    result.primaryAxisSizingMode = 'FIXED';
    result.counterAxisSizingMode = 'AUTO';

    const gap = px(node.gap);
    if (gap > 0) result.itemSpacing = gap;
    const rg = px(node.rowGap) || gap;
    if (rg > 0) result.counterAxisSpacing = rg;
  } else {
    // Block / other → absolute positioning (html-to-figma default behavior)
    result.useAbsolutePosition = true;
  }

  // === PADDING ===
  if (node.paddingTop || node.paddingRight || node.paddingBottom || node.paddingLeft) {
    result.paddingTop = node.paddingTop;
    result.paddingRight = node.paddingRight;
    result.paddingBottom = node.paddingBottom;
    result.paddingLeft = node.paddingLeft;
  }

  // === VISUAL ===
  if (node.backgroundColor && node.backgroundColor !== '#000000') {
    result.backgroundColor = node.backgroundColor;
  }
  if (node.backgroundImage && node.backgroundImage.includes('gradient')) {
    result.backgroundGradient = node.backgroundImage;
  }
  const op = parseFloat(node.opacity);
  if (!isNaN(op) && op < 1) result.opacity = op;

  if (node.overflow === 'hidden') result.clipsContent = true;
  if (node.mixBlendMode && node.mixBlendMode !== 'normal') result.blendMode = node.mixBlendMode;

  // === BORDER ===
  if (node.borderTopWidth || node.borderRightWidth || node.borderBottomWidth || node.borderLeftWidth) {
    if (node.borderColor && node.borderStyle !== 'none') {
      result.strokeColor = node.borderColor;
      result.strokeTopWeight = node.borderTopWidth;
      result.strokeRightWeight = node.borderRightWidth;
      result.strokeBottomWeight = node.borderBottomWidth;
      result.strokeLeftWeight = node.borderLeftWidth;
    }
  }
  if (node.borderTopLeftRadius) result.topLeftRadius = node.borderTopLeftRadius;
  if (node.borderTopRightRadius) result.topRightRadius = node.borderTopRightRadius;
  if (node.borderBottomRightRadius) result.bottomRightRadius = node.borderBottomRightRadius;
  if (node.borderBottomLeftRadius) result.bottomLeftRadius = node.borderBottomLeftRadius;

  // === EFFECTS ===
  if (node.boxShadow) result.boxShadow = node.boxShadow;
  if (node.filter) {
    const bm = node.filter.match(/blur\(([\d.]+)px\)/);
    if (bm) result.blur = parseFloat(bm[1]);
  }
  if (node.backdropFilter) {
    const bm = node.backdropFilter.match(/blur\(([\d.]+)px\)/);
    if (bm) result.backgroundBlur = parseFloat(bm[1]);
  }

  // === CHILDREN ===
  if (node.children.length > 0) {
    const parentOffsetX = node.x;
    const parentOffsetY = node.y;

    result.children = node.children.map(child => {
      const figmaChild = convertNode(child, node);

      // Set position relative to parent
      if (result.useAbsolutePosition) {
        figmaChild.x = child.x - parentOffsetX;
        figmaChild.y = child.y - parentOffsetY;
      }

      // Sizing in auto layout parent
      if (result.layoutMode && !result.useAbsolutePosition) {
        // In wrap/grid: children keep their size
        if (result.layoutWrap === 'WRAP') {
          figmaChild.layoutAlign = 'INHERIT';
        }
        // Small elements (icons, badges): keep fixed size
        else if (child.width < 100 && child.height < 100) {
          figmaChild.layoutAlign = 'INHERIT';
        }
        // Large elements: stretch to fill
        else {
          figmaChild.layoutAlign = 'STRETCH';
        }
      }

      return figmaChild;
    });
  }

  return result;
}
