/**
 * Adapts FigmaOutputNode (from server-analyzer) to the format
 * that the Figma plugin expects (html-to-figma compatible).
 *
 * This bridges the gap between our new server-analyzed format
 * and the existing plugin's buildFromHtmlToFigma function.
 */

import type { FigmaOutputNode } from './server-analyzer';

/**
 * Convert FigmaOutputNode tree to plugin-compatible format.
 */
export function adaptForPlugin(node: FigmaOutputNode): Record<string, unknown> {
  const result: Record<string, unknown> = {
    type: node.type,
    name: node.name,
    width: node.width,
    height: node.height,
  };

  // Position (for absolute positioning)
  if (node.x != null) result.x = node.x;
  if (node.y != null) result.y = node.y;

  // --- FRAME ---
  if (node.type === 'FRAME') {
    // Auto Layout
    if (node.layoutMode) {
      result.layoutMode = node.layoutMode;
      if (node.itemSpacing != null) result.itemSpacing = node.itemSpacing;
      if (node.counterAxisSpacing != null) result.counterAxisSpacing = node.counterAxisSpacing;
      if (node.layoutWrap) result.layoutWrap = node.layoutWrap;
      if (node.primaryAxisAlignItems) result.primaryAxisAlignItems = node.primaryAxisAlignItems;
      if (node.counterAxisAlignItems) result.counterAxisAlignItems = node.counterAxisAlignItems;
      if (node.primaryAxisSizingMode) result.primaryAxisSizingMode = node.primaryAxisSizingMode;
      if (node.counterAxisSizingMode) result.counterAxisSizingMode = node.counterAxisSizingMode;
    }

    // Flag for plugin: use absolute positioning for children
    if (node.useAbsolutePosition) result.useAbsolutePosition = true;

    // Padding
    if (node.paddingTop || node.paddingRight || node.paddingBottom || node.paddingLeft) {
      result.padding = {
        top: node.paddingTop || 0,
        right: node.paddingRight || 0,
        bottom: node.paddingBottom || 0,
        left: node.paddingLeft || 0,
      };
    }

    // Background fill
    if (node.backgroundColor) {
      const c = hexToRgb01(node.backgroundColor);
      if (c) {
        result.backgroundFill = { type: 'SOLID', color: c, opacity: 1, visible: true };
      }
    }

    // Clipping
    if (node.clipsContent) result.clipsContent = true;
    if (node.opacity != null) result.opacity = node.opacity;

    // Border strokes
    if (node.strokeColor && (node.strokeTopWeight || node.strokeRightWeight || node.strokeBottomWeight || node.strokeLeftWeight)) {
      const c = hexToRgb01(node.strokeColor);
      if (c) {
        result.strokes = [{ type: 'SOLID', color: c, opacity: 1 }];
        result.strokeTopWeight = node.strokeTopWeight || 0;
        result.strokeRightWeight = node.strokeRightWeight || 0;
        result.strokeBottomWeight = node.strokeBottomWeight || 0;
        result.strokeLeftWeight = node.strokeLeftWeight || 0;
      }
    }

    // Border radius
    if (node.topLeftRadius) result.topLeftRadius = node.topLeftRadius;
    if (node.topRightRadius) result.topRightRadius = node.topRightRadius;
    if (node.bottomRightRadius) result.bottomRightRadius = node.bottomRightRadius;
    if (node.bottomLeftRadius) result.bottomLeftRadius = node.bottomLeftRadius;

    // Effects (box-shadow as raw CSS — plugin parses)
    if (node.boxShadow) result.boxShadow = node.boxShadow;

    // Image URL (for frames that are image containers)
    if (node.imageUrl) result.imageUrl = node.imageUrl;
  }

  // --- TEXT ---
  if (node.type === 'TEXT') {
    result.characters = node.characters;
    result.fontFamily = node.fontFamily;
    result.fontWeight = node.fontWeight;
    result.fontSize = node.fontSize;
    if (node.fontStyle) result.fontStyle = node.fontStyle;
    if (node.lineHeight) result.lineHeight = { unit: 'PIXELS', value: node.lineHeight };
    if (node.letterSpacing) result.letterSpacing = node.letterSpacing;
    if (node.textAlignHorizontal) result.textAlignHorizontal = node.textAlignHorizontal;
    if (node.textColor) {
      const c = hexToRgb01(node.textColor);
      if (c) result.color = { type: 'SOLID', color: c, opacity: 1, visible: true };
    }
    if (node.textDecoration) result.textDecoration = node.textDecoration;
    if (node.textCase) result.textCase = node.textCase;
  }

  // --- IMAGE ---
  if (node.type === 'IMAGE') {
    result.imageUrl = node.imageUrl;
    if (node.topLeftRadius) result.topLeftRadius = node.topLeftRadius;
    if (node.topRightRadius) result.topRightRadius = node.topRightRadius;
    if (node.bottomRightRadius) result.bottomRightRadius = node.bottomRightRadius;
    if (node.bottomLeftRadius) result.bottomLeftRadius = node.bottomLeftRadius;
  }

  // --- SVG ---
  if (node.type === 'SVG') {
    result.svg = node.svgContent;
  }

  // Layout align for this node in parent
  if (node.layoutAlign) result.layoutAlign = node.layoutAlign;

  // --- CHILDREN ---
  if (node.children && node.children.length > 0) {
    result.children = node.children.map(adaptForPlugin);
  }

  return result;
}

function hexToRgb01(hex: string): { r: number; g: number; b: number } | null {
  if (!hex || !hex.startsWith('#')) return null;
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h[0]+h[0]+h[1]+h[1]+h[2]+h[2] : h.substring(0, 6);
  const r = parseInt(full.substring(0, 2), 16) / 255;
  const g = parseInt(full.substring(2, 4), 16) / 255;
  const b = parseInt(full.substring(4, 6), 16) / 255;
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  return { r, g, b };
}
