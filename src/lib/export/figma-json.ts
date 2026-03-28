import type { ComponentNode, StyleData } from '@/types/component-tree';
import type { PageMetadata } from '@/types/clone';

/**
 * Figma MCP payload types — structured format that maps directly
 * to Figma concepts for use with Claude Code + Figma Plugin API.
 */

export interface FigmaDesignSpec {
  version: '1.0';
  source: {
    url: string;
    title: string;
    scrapedAt: string;
  };
  designTokens: {
    colors: FigmaColor[];
    typography: FigmaTextStyle[];
    spacing: number[];
  };
  pages: FigmaPageSpec[];
}

export interface FigmaColor {
  name: string;
  hex: string;
  usage: string; // e.g. "background", "text", "border"
}

export interface FigmaTextStyle {
  name: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight?: number;
  letterSpacing?: number;
}

export interface FigmaPageSpec {
  name: string;
  width: number;
  height: number;
  backgroundColor?: string;
  children: FigmaFrameSpec[];
}

export interface FigmaFrameSpec {
  name: string;
  type: 'FRAME' | 'TEXT' | 'RECTANGLE' | 'IMAGE';
  x: number;
  y: number;
  width: number;
  height: number;
  // Layout
  layoutMode?: 'HORIZONTAL' | 'VERTICAL' | 'NONE';
  itemSpacing?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  primaryAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
  counterAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX';
  // Visual
  fills?: FigmaFill[];
  strokes?: FigmaStroke[];
  cornerRadius?: number;
  opacity?: number;
  // Text
  characters?: string;
  textStyle?: FigmaTextStyle;
  // Children
  children?: FigmaFrameSpec[];
  // Image reference
  imageUrl?: string;
}

interface FigmaFill {
  type: 'SOLID';
  color: string; // hex
  opacity?: number;
}

interface FigmaStroke {
  type: 'SOLID';
  color: string;
  weight: number;
}

// --- Helpers ---

/**
 * Convert any CSS color (hex, rgb(), rgba()) to a valid #rrggbb hex string.
 * Returns null if the color can't be parsed or is transparent.
 */
function toHex(color: string | undefined): string | null {
  if (!color || color === 'transparent' || color === 'none') return null;

  // Already hex
  if (/^#[0-9a-fA-F]{3,8}$/.test(color)) {
    const h = color.replace('#', '');
    if (h.length === 3) {
      return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
    }
    return `#${h.substring(0, 6)}`;
  }

  // rgb() or rgba()
  const match = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (match) {
    const r = parseInt(match[1], 10);
    const g = parseInt(match[2], 10);
    const b = parseInt(match[3], 10);
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }

  // rgba(0, 0, 0, 0) — transparent
  if (/rgba\(.+,\s*0\s*\)/.test(color)) return null;

  return null;
}

function parseSize(value: string | undefined): number {
  if (!value) return 0;
  const num = parseFloat(value);
  return isNaN(num) ? 0 : Math.round(num);
}

function parsePadding(value: string | undefined): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  if (!value || value === '0px') return { top: 0, right: 0, bottom: 0, left: 0 };

  const parts = value.split(/\s+/).map((p) => parseSize(p));
  if (parts.length === 1) return { top: parts[0], right: parts[0], bottom: parts[0], left: parts[0] };
  if (parts.length === 2) return { top: parts[0], right: parts[1], bottom: parts[0], left: parts[1] };
  if (parts.length === 3) return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[1] };
  return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[3] };
}

function parseFontWeight(value: string | undefined): number {
  if (!value) return 400;
  const num = parseInt(value, 10);
  return isNaN(num) ? 400 : num;
}

function mapLayoutMode(styles: StyleData): 'HORIZONTAL' | 'VERTICAL' | 'NONE' {
  if (styles.display === 'flex' || styles.display === 'inline-flex') {
    return styles.flexDirection === 'column' ? 'VERTICAL' : 'HORIZONTAL';
  }
  return 'NONE';
}

function mapAlign(value: string | undefined): 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN' {
  switch (value) {
    case 'center': return 'CENTER';
    case 'flex-end':
    case 'end': return 'MAX';
    case 'space-between': return 'SPACE_BETWEEN';
    default: return 'MIN';
  }
}

function mapCounterAlign(value: string | undefined): 'MIN' | 'CENTER' | 'MAX' {
  switch (value) {
    case 'center': return 'CENTER';
    case 'flex-end':
    case 'end': return 'MAX';
    default: return 'MIN';
  }
}

// --- Core conversion ---

/**
 * Determine the best layout mode for a node.
 * In Figma, Auto Layout handles child positioning — no absolute coords needed.
 * If CSS has flex, use that direction. Otherwise default to VERTICAL for containers.
 */
function inferLayoutMode(node: ComponentNode): 'HORIZONTAL' | 'VERTICAL' | 'NONE' {
  const s = node.styles;
  if (s.display === 'flex' || s.display === 'inline-flex') {
    return s.flexDirection === 'column' ? 'VERTICAL' : 'HORIZONTAL';
  }
  if (s.display === 'grid') return 'HORIZONTAL'; // simplified grid → row
  // Block-level containers with children → vertical stack
  if (node.children.length > 0) return 'VERTICAL';
  return 'NONE';
}

/**
 * Estimate spacing between children by looking at their rects.
 */
function estimateGap(children: ComponentNode[], direction: 'HORIZONTAL' | 'VERTICAL'): number {
  if (children.length < 2) return 0;

  const gaps: number[] = [];
  for (let i = 1; i < children.length; i++) {
    const prev = children[i - 1].rect;
    const curr = children[i].rect;
    if (!prev || !curr) continue;

    const gap = direction === 'VERTICAL'
      ? curr.y - (prev.y + prev.height)
      : curr.x - (prev.x + prev.width);

    if (gap > 0 && gap < 200) gaps.push(Math.round(gap));
  }

  if (gaps.length === 0) return 0;
  // Use median gap
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)];
}

function nodeToFigmaFrame(node: ComponentNode): FigmaFrameSpec {
  const styles = node.styles;
  const padding = parsePadding(styles.padding);
  const isText = node.textContent && node.children.length === 0 && node.tag !== 'img';
  const isImage = node.tag === 'img';

  const frame: FigmaFrameSpec = {
    name: `${node.type}/${node.tag}${node.className ? '.' + node.className.split(' ')[0] : ''}`,
    type: isImage ? 'IMAGE' : isText ? 'TEXT' : 'FRAME',
    // Children inside Auto Layout don't need x/y — Figma positions them automatically.
    // We set 0,0 here; the parent's Auto Layout handles placement.
    x: 0,
    y: 0,
    width: Math.max(1, (node.rect?.width ?? parseSize(styles.width)) || 100),
    height: Math.max(1, (node.rect?.height ?? parseSize(styles.height)) || 40),
  };

  // Auto Layout for containers
  if (frame.type === 'FRAME' && node.children.length > 0) {
    const layoutMode = inferLayoutMode(node);
    if (layoutMode !== 'NONE') {
      frame.layoutMode = layoutMode;
      frame.itemSpacing = parseSize(styles.gap) || estimateGap(node.children, layoutMode);
      frame.primaryAxisAlignItems = mapAlign(styles.justifyContent);
      frame.counterAxisAlignItems = mapCounterAlign(styles.alignItems);
    }
  }

  // Padding
  if (padding.top || padding.right || padding.bottom || padding.left) {
    frame.paddingTop = padding.top;
    frame.paddingRight = padding.right;
    frame.paddingBottom = padding.bottom;
    frame.paddingLeft = padding.left;
  }

  // Fills
  const bgHex = toHex(styles.backgroundColor);
  if (bgHex) {
    frame.fills = [{ type: 'SOLID', color: bgHex }];
  }

  // Border
  if (styles.border && styles.border !== 'none' && !styles.border.startsWith('0px')) {
    const borderMatch = styles.border.match(/(\d+)px\s+\w+\s+(#[0-9a-fA-F]+|rgb[^)]+\))/);
    if (borderMatch) {
      const strokeHex = toHex(borderMatch[2]);
      if (strokeHex) {
        frame.strokes = [{ type: 'SOLID', color: strokeHex, weight: parseInt(borderMatch[1], 10) }];
      }
    }
  }

  // Corner radius
  if (styles.borderRadius) {
    frame.cornerRadius = parseSize(styles.borderRadius);
  }

  // Opacity
  if (styles.opacity) {
    frame.opacity = parseFloat(styles.opacity);
  }

  // Text content
  if (frame.type === 'TEXT' && node.textContent) {
    frame.characters = node.textContent;
    frame.textStyle = {
      name: 'inline',
      fontFamily: styles.fontFamily?.split(',')[0]?.replace(/['"]/g, '').trim() || 'Inter',
      fontSize: parseSize(styles.fontSize) || 16,
      fontWeight: parseFontWeight(styles.fontWeight),
      lineHeight: parseSize(styles.lineHeight) || undefined,
      letterSpacing: parseSize(styles.letterSpacing) || undefined,
    };
    const textHex = toHex(styles.color);
    if (textHex) {
      frame.fills = [{ type: 'SOLID', color: textHex }];
    }
  }

  // Image
  if (frame.type === 'IMAGE' && node.attributes?.src) {
    frame.imageUrl = node.attributes.src;
  }

  // Children — recurse
  if (node.children.length > 0) {
    frame.children = node.children.map(nodeToFigmaFrame);
  }

  return frame;
}

function extractDesignTokens(nodes: ComponentNode[]): FigmaDesignSpec['designTokens'] {
  const colorMap = new Map<string, string>();
  const fontMap = new Map<string, FigmaTextStyle>();
  const spacingSet = new Set<number>();

  function walkNode(node: ComponentNode) {
    const s = node.styles;

    // Colors
    const bgToken = toHex(s.backgroundColor);
    if (bgToken) {
      colorMap.set(bgToken, 'background');
    }
    const textToken = toHex(s.color);
    if (textToken) {
      colorMap.set(textToken, 'text');
    }

    // Typography
    if (s.fontSize) {
      const size = parseSize(s.fontSize);
      if (size > 0) {
        const family = s.fontFamily?.split(',')[0]?.replace(/['"]/g, '').trim() || 'Inter';
        const weight = parseFontWeight(s.fontWeight);
        const key = `${family}-${size}-${weight}`;
        if (!fontMap.has(key)) {
          fontMap.set(key, {
            name: `${family} ${size}/${weight}`,
            fontFamily: family,
            fontSize: size,
            fontWeight: weight,
            lineHeight: parseSize(s.lineHeight) || undefined,
          });
        }
      }
    }

    // Spacing
    if (s.gap) {
      const g = parseSize(s.gap);
      if (g > 0) spacingSet.add(g);
    }
    if (s.padding) {
      const p = parsePadding(s.padding);
      [p.top, p.right, p.bottom, p.left].forEach((v) => {
        if (v > 0) spacingSet.add(v);
      });
    }

    node.children.forEach(walkNode);
  }

  nodes.forEach(walkNode);

  const colors: FigmaColor[] = Array.from(colorMap.entries()).map(([hex, usage], i) => ({
    name: `color-${i + 1}`,
    hex,
    usage,
  }));

  const typography = Array.from(fontMap.values()).sort((a, b) => b.fontSize - a.fontSize);
  const spacing = Array.from(spacingSet).sort((a, b) => a - b);

  return { colors, typography, spacing };
}

// --- Main export ---

export function generateFigmaDesignSpec(
  tree: ComponentNode[],
  metadata: PageMetadata,
  url: string,
  scrapedAt: string
): FigmaDesignSpec {
  const designTokens = extractDesignTokens(tree);
  const sectionFrames = tree.map(nodeToFigmaFrame);

  // Each section gets full page width
  for (const frame of sectionFrames) {
    frame.width = 1440;
  }

  // Total height = sum of all sections
  const totalHeight = sectionFrames.reduce((sum, f) => sum + f.height, 0);

  return {
    version: '1.0',
    source: {
      url,
      title: metadata.title || 'Untitled',
      scrapedAt,
    },
    designTokens,
    pages: [
      {
        name: metadata.title || 'Home',
        width: 1440,
        height: Math.max(900, Math.round(totalHeight)),
        children: sectionFrames,
      },
    ],
  };
}
