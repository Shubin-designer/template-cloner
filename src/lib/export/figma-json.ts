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

function nodeToFigmaFrame(node: ComponentNode): FigmaFrameSpec {
  const styles = node.styles;
  const padding = parsePadding(styles.padding);
  const layoutMode = mapLayoutMode(styles);

  const frame: FigmaFrameSpec = {
    name: `${node.type}/${node.tag}${node.className ? '.' + node.className.split(' ')[0] : ''}`,
    type: node.tag === 'img' ? 'IMAGE' : (node.textContent && node.children.length === 0) ? 'TEXT' : 'FRAME',
    x: node.rect?.x ?? 0,
    y: node.rect?.y ?? 0,
    width: node.rect?.width ?? parseSize(styles.width),
    height: node.rect?.height ?? parseSize(styles.height),
  };

  // Layout
  if (layoutMode !== 'NONE') {
    frame.layoutMode = layoutMode;
    frame.itemSpacing = parseSize(styles.gap);
    frame.primaryAxisAlignItems = mapAlign(styles.justifyContent);
    frame.counterAxisAlignItems = mapCounterAlign(styles.alignItems);
  }

  // Padding
  if (padding.top || padding.right || padding.bottom || padding.left) {
    frame.paddingTop = padding.top;
    frame.paddingRight = padding.right;
    frame.paddingBottom = padding.bottom;
    frame.paddingLeft = padding.left;
  }

  // Fills
  if (styles.backgroundColor) {
    frame.fills = [{ type: 'SOLID', color: styles.backgroundColor }];
  }

  // Border
  if (styles.border && styles.border !== 'none' && !styles.border.startsWith('0px')) {
    const borderMatch = styles.border.match(/(\d+)px\s+\w+\s+(#[0-9a-fA-F]+|rgb[^)]+\))/);
    if (borderMatch) {
      frame.strokes = [{ type: 'SOLID', color: borderMatch[2], weight: parseInt(borderMatch[1], 10) }];
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
    if (styles.color) {
      frame.fills = [{ type: 'SOLID', color: styles.color }];
    }
  }

  // Image
  if (frame.type === 'IMAGE' && node.attributes?.src) {
    frame.imageUrl = node.attributes.src;
  }

  // Children
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
    if (s.backgroundColor && s.backgroundColor.startsWith('#')) {
      colorMap.set(s.backgroundColor, 'background');
    }
    if (s.color && s.color.startsWith('#')) {
      colorMap.set(s.color, 'text');
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
  const frames = tree.map(nodeToFigmaFrame);

  // Calculate page dimensions from all frames
  let maxWidth = 1440;
  let maxHeight = 900;
  for (const frame of frames) {
    const right = frame.x + frame.width;
    const bottom = frame.y + frame.height;
    if (right > maxWidth) maxWidth = right;
    if (bottom > maxHeight) maxHeight = bottom;
  }

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
        width: Math.round(maxWidth),
        height: Math.round(maxHeight),
        children: frames,
      },
    ],
  };
}
