import type { StyleData } from '@/types/component-tree';

/**
 * Convert rgb/rgba string to hex. Works for both rgb() and rgba().
 */
export function rgbToHex(rgb: string): string {
  if (!rgb || rgb === 'transparent' || rgb === 'none') return '';
  if (rgb.startsWith('#')) return rgb;

  const match = rgb.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+)?\s*\)/
  );
  if (!match) return rgb;

  const r = parseInt(match[1], 10);
  const g = parseInt(match[2], 10);
  const b = parseInt(match[3], 10);

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * Extract computed styles from an element in the browser context.
 * This function runs inside page.evaluate().
 */
export function extractStylesScript(): string {
  return `
    (function extractStyles(el) {
      const cs = window.getComputedStyle(el);
      return {
        display: cs.display,
        flexDirection: cs.flexDirection,
        alignItems: cs.alignItems,
        justifyContent: cs.justifyContent,
        gap: cs.gap,
        padding: cs.padding,
        margin: cs.margin,
        backgroundColor: cs.backgroundColor,
        color: cs.color,
        fontSize: cs.fontSize,
        fontFamily: cs.fontFamily,
        fontWeight: cs.fontWeight,
        lineHeight: cs.lineHeight,
        letterSpacing: cs.letterSpacing,
        textAlign: cs.textAlign,
        borderRadius: cs.borderRadius,
        border: cs.border,
        boxShadow: cs.boxShadow,
        width: cs.width,
        height: cs.height,
        minWidth: cs.minWidth,
        minHeight: cs.minHeight,
        maxWidth: cs.maxWidth,
        position: cs.position,
        overflow: cs.overflow,
        opacity: cs.opacity,
        gridTemplateColumns: cs.gridTemplateColumns,
      };
    })
  `;
}

/**
 * Clean up extracted styles: convert colors to hex, remove defaults.
 */
export function cleanStyles(raw: Record<string, string>): StyleData {
  const styles: StyleData = {};

  for (const [key, value] of Object.entries(raw)) {
    if (!value || value === 'none' || value === 'normal' || value === 'auto') {
      continue;
    }

    let cleaned = value;

    // Convert rgb colors to hex
    if (key === 'backgroundColor' || key === 'color') {
      if (value === 'rgba(0, 0, 0, 0)' || value === 'transparent') continue;
      cleaned = rgbToHex(value);
    }

    // Skip default/uninteresting values
    if (key === 'display' && value === 'block') continue;
    if (key === 'position' && value === 'static') continue;
    if (key === 'overflow' && value === 'visible') continue;
    if (key === 'opacity' && value === '1') continue;
    if (key === 'flexDirection' && value === 'row') continue;
    if (key === 'fontWeight' && value === '400') continue;

    (styles as Record<string, string>)[key] = cleaned;
  }

  return styles;
}
