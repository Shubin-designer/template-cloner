/**
 * Layout Analyzer — полный маппинг CSS → Figma.
 *
 * Принимает дерево от html-to-figma + CSS данные из DOM,
 * возвращает дерево с правильными Figma layout properties.
 *
 * 50 CSS→Figma маппингов.
 */

// ============================================================
// TYPES
// ============================================================

export interface CSSData {
  // Layout
  display: string;
  position: string;
  flexDirection: string;
  flexWrap: string;
  justifyContent: string;
  alignItems: string;
  alignSelf: string;
  flexGrow: string;
  flexShrink: string;
  flexBasis: string;
  gap: string;
  rowGap: string;
  columnGap: string;
  gridTemplateColumns: string;
  gridTemplateRows: string;
  overflow: string;
  overflowX: string;
  overflowY: string;
  zIndex: string;
  // Sizing
  width: string;
  height: string;
  minWidth: string;
  maxWidth: string;
  minHeight: string;
  maxHeight: string;
  boxSizing: string;
  // Spacing
  paddingTop: string;
  paddingRight: string;
  paddingBottom: string;
  paddingLeft: string;
  // Typography
  fontSize: string;
  fontFamily: string;
  fontWeight: string;
  fontStyle: string;
  lineHeight: string;
  letterSpacing: string;
  textAlign: string;
  textDecoration: string;
  textTransform: string;
  whiteSpace: string;
  webkitLineClamp: string;
  // Colors
  color: string;
  backgroundColor: string;
  backgroundImage: string;
  backgroundSize: string;
  // Border
  borderTopWidth: string;
  borderRightWidth: string;
  borderBottomWidth: string;
  borderLeftWidth: string;
  borderTopColor: string;
  borderRightColor: string;
  borderBottomColor: string;
  borderLeftColor: string;
  borderStyle: string;
  borderTopLeftRadius: string;
  borderTopRightRadius: string;
  borderBottomRightRadius: string;
  borderBottomLeftRadius: string;
  // Effects
  opacity: string;
  boxShadow: string;
  filter: string;
  backdropFilter: string;
  mixBlendMode: string;
  transform: string;
  // Image
  objectFit: string;
}

export interface FigmaLayoutProps {
  // Layout mode
  layoutMode?: 'HORIZONTAL' | 'VERTICAL' | 'NONE';
  layoutWrap?: 'WRAP' | 'NO_WRAP';
  layoutPositioning?: 'ABSOLUTE' | 'AUTO';
  // Spacing
  itemSpacing?: number;
  counterAxisSpacing?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  // Alignment
  primaryAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
  counterAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX';
  primaryAxisSizingMode?: 'FIXED' | 'AUTO';
  counterAxisSizingMode?: 'FIXED' | 'AUTO';
  // Child sizing
  layoutSizingHorizontal?: 'FILL' | 'HUG' | 'FIXED';
  layoutSizingVertical?: 'FILL' | 'HUG' | 'FIXED';
  layoutAlign?: 'STRETCH' | 'INHERIT' | 'CENTER' | 'MIN' | 'MAX';
  layoutGrow?: number;
  // Size constraints
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  // Visual
  fills?: FigmaFill[];
  strokes?: FigmaStroke[];
  strokeTopWeight?: number;
  strokeRightWeight?: number;
  strokeBottomWeight?: number;
  strokeLeftWeight?: number;
  topLeftRadius?: number;
  topRightRadius?: number;
  bottomRightRadius?: number;
  bottomLeftRadius?: number;
  opacity?: number;
  blendMode?: string;
  clipsContent?: boolean;
  rotation?: number;
  effects?: FigmaEffect[];
  // Text
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  lineHeight?: { value: number; unit: string };
  letterSpacing?: { value: number; unit: string };
  textAlignHorizontal?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
  textDecoration?: 'NONE' | 'UNDERLINE' | 'STRIKETHROUGH';
  textCase?: 'ORIGINAL' | 'UPPER' | 'LOWER' | 'TITLE';
  textTruncation?: 'DISABLED' | 'ENDING';
  textAutoResize?: 'NONE' | 'WIDTH_AND_HEIGHT' | 'HEIGHT';
  textColor?: FigmaFill;
  // Image
  imageScaleMode?: 'FILL' | 'FIT' | 'CROP' | 'TILE';
}

export interface FigmaFill {
  type: 'SOLID' | 'GRADIENT_LINEAR' | 'IMAGE';
  color?: { r: number; g: number; b: number };
  opacity?: number;
  visible?: boolean;
  // Gradient
  gradientStops?: Array<{ color: { r: number; g: number; b: number; a: number }; position: number }>;
  gradientTransform?: number[][];
  // Image
  imageUrl?: string;
  scaleMode?: 'FILL' | 'FIT' | 'CROP' | 'TILE';
}

export interface FigmaStroke {
  type: 'SOLID';
  color: { r: number; g: number; b: number };
  opacity?: number;
}

export interface FigmaEffect {
  type: 'DROP_SHADOW' | 'INNER_SHADOW' | 'LAYER_BLUR' | 'BACKGROUND_BLUR';
  visible: boolean;
  radius?: number;
  color?: { r: number; g: number; b: number; a: number };
  offset?: { x: number; y: number };
  spread?: number;
  blendMode?: string;
}

// ============================================================
// HELPERS
// ============================================================

function px(value: string): number {
  if (!value || value === 'none' || value === 'normal' || value === 'auto') return 0;
  const n = parseFloat(value);
  return isNaN(n) ? 0 : Math.round(n);
}

function rgbToFigma(color: string): { r: number; g: number; b: number; a: number } | null {
  if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') return null;

  // hex
  if (color.startsWith('#')) {
    const h = color.replace('#', '');
    const full = h.length === 3
      ? h[0]+h[0]+h[1]+h[1]+h[2]+h[2]
      : h.substring(0, 6);
    return {
      r: parseInt(full.substring(0, 2), 16) / 255,
      g: parseInt(full.substring(2, 4), 16) / 255,
      b: parseInt(full.substring(4, 6), 16) / 255,
      a: 1,
    };
  }

  // rgb/rgba
  const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (m) {
    const a = m[4] !== undefined ? parseFloat(m[4]) : 1;
    if (a === 0) return null;
    return {
      r: parseInt(m[1]) / 255,
      g: parseInt(m[2]) / 255,
      b: parseInt(m[3]) / 255,
      a,
    };
  }

  return null;
}

function parseGradient(bg: string): FigmaFill | null {
  if (!bg || !bg.includes('gradient')) return null;

  const match = bg.match(/linear-gradient\(([^)]+)\)/);
  if (!match) return null;

  // Simplified gradient parsing
  const parts = match[1].split(',').map(s => s.trim());
  const stops: FigmaFill['gradientStops'] = [];

  for (let i = 0; i < parts.length; i++) {
    const color = rgbToFigma(parts[i]);
    if (color) {
      stops.push({
        color,
        position: stops.length === 0 ? 0 : 1,
      });
    }
  }

  if (stops.length < 2) return null;

  // Distribute stops evenly
  for (let i = 0; i < stops.length; i++) {
    stops[i].position = i / (stops.length - 1);
  }

  return {
    type: 'GRADIENT_LINEAR',
    gradientStops: stops,
    gradientTransform: [[0, 1, 0], [-1, 0, 1]], // top to bottom
    opacity: 1,
    visible: true,
  };
}

function parseBoxShadows(shadow: string): FigmaEffect[] {
  if (!shadow || shadow === 'none') return [];

  const effects: FigmaEffect[] = [];
  // Match: optional "inset", color, x, y, blur, spread
  const regex = /(inset\s+)?(?:rgba?\([^)]+\)|#[0-9a-f]+)\s+-?\d+px\s+-?\d+px\s+\d+px(?:\s+-?\d+px)?/gi;
  const matches = shadow.match(regex);

  if (!matches) return [];

  for (const m of matches) {
    const isInner = m.includes('inset');
    const colorMatch = m.match(/(rgba?\([^)]+\)|#[0-9a-f]+)/i);
    const nums = m.match(/-?\d+(?:\.\d+)?px/g);

    if (!colorMatch || !nums || nums.length < 3) continue;

    const color = rgbToFigma(colorMatch[1]);
    if (!color) continue;

    effects.push({
      type: isInner ? 'INNER_SHADOW' : 'DROP_SHADOW',
      visible: true,
      color,
      offset: { x: px(nums[0]), y: px(nums[1]) },
      radius: px(nums[2]),
      spread: nums[3] ? px(nums[3]) : 0,
      blendMode: 'NORMAL',
    });
  }

  return effects;
}

function parseBlur(filter: string): FigmaEffect | null {
  if (!filter || filter === 'none') return null;
  const match = filter.match(/blur\((\d+(?:\.\d+)?)px\)/);
  if (!match) return null;
  return {
    type: 'LAYER_BLUR',
    visible: true,
    radius: parseFloat(match[1]),
  };
}

function parseBackdropBlur(filter: string): FigmaEffect | null {
  if (!filter || filter === 'none') return null;
  const match = filter.match(/blur\((\d+(?:\.\d+)?)px\)/);
  if (!match) return null;
  return {
    type: 'BACKGROUND_BLUR',
    visible: true,
    radius: parseFloat(match[1]),
  };
}

function parseRotation(transform: string): number {
  if (!transform || transform === 'none') return 0;
  const match = transform.match(/rotate\((-?\d+(?:\.\d+)?)deg\)/);
  if (!match) return 0;
  return parseFloat(match[1]);
}

// ============================================================
// MAIN: CSS → Figma mapping (50 properties)
// ============================================================

export function cssToFigma(css: CSSData, hasChildren: boolean, parentDisplay?: string): FigmaLayoutProps {
  const result: FigmaLayoutProps = {};

  // --------------------------------------------------------
  // 1-5: LAYOUT MODE
  // --------------------------------------------------------

  // #1: display: flex → layoutMode
  if (css.display === 'flex' || css.display === 'inline-flex') {
    // #2: flex-direction
    result.layoutMode = css.flexDirection === 'column' || css.flexDirection === 'column-reverse'
      ? 'VERTICAL' : 'HORIZONTAL';
  }
  // #3: display: grid → HORIZONTAL + WRAP
  else if (css.display === 'grid' || css.display === 'inline-grid') {
    result.layoutMode = 'HORIZONTAL';
    result.layoutWrap = 'WRAP';
  }
  // #4: display: block with children → VERTICAL
  else if (hasChildren && (css.display === 'block' || css.display === 'inline-block' || css.display === 'list-item')) {
    result.layoutMode = 'VERTICAL';
  }

  // #5: flex-wrap
  if (css.flexWrap === 'wrap' || css.flexWrap === 'wrap-reverse') {
    result.layoutWrap = 'WRAP';
  }

  // --------------------------------------------------------
  // 6-8: POSITIONING
  // --------------------------------------------------------

  // #6: position: absolute/fixed → absolute in Figma
  if (css.position === 'absolute' || css.position === 'fixed') {
    result.layoutPositioning = 'ABSOLUTE';
  }

  // #7: overflow: hidden → clipsContent
  if (css.overflow === 'hidden' || css.overflowX === 'hidden' || css.overflowY === 'hidden') {
    result.clipsContent = true;
  }

  // #8: z-index → handled by child order (not a direct property)

  // --------------------------------------------------------
  // 9-12: SPACING
  // --------------------------------------------------------

  // #9: gap
  const gapVal = px(css.gap) || px(css.columnGap);
  if (gapVal > 0) result.itemSpacing = gapVal;

  // #10: row-gap
  const rowGapVal = px(css.rowGap) || px(css.gap);
  if (rowGapVal > 0 && result.layoutWrap === 'WRAP') {
    result.counterAxisSpacing = rowGapVal;
  }

  // #11-14: padding (individual sides)
  const pt = px(css.paddingTop);
  const pr = px(css.paddingRight);
  const pb = px(css.paddingBottom);
  const pl = px(css.paddingLeft);
  if (pt) result.paddingTop = pt;
  if (pr) result.paddingRight = pr;
  if (pb) result.paddingBottom = pb;
  if (pl) result.paddingLeft = pl;

  // --------------------------------------------------------
  // 15-18: ALIGNMENT
  // --------------------------------------------------------

  // #15: justify-content
  const jc = css.justifyContent;
  if (jc === 'center') result.primaryAxisAlignItems = 'CENTER';
  else if (jc === 'flex-end' || jc === 'end') result.primaryAxisAlignItems = 'MAX';
  else if (jc === 'space-between') result.primaryAxisAlignItems = 'SPACE_BETWEEN';
  else result.primaryAxisAlignItems = 'MIN';

  // #16: align-items
  const ai = css.alignItems;
  if (ai === 'center') result.counterAxisAlignItems = 'CENTER';
  else if (ai === 'flex-end' || ai === 'end') result.counterAxisAlignItems = 'MAX';
  else result.counterAxisAlignItems = 'MIN';

  // #17: align-self (per-child)
  if (css.alignSelf === 'center') result.layoutAlign = 'CENTER';
  else if (css.alignSelf === 'flex-end' || css.alignSelf === 'end') result.layoutAlign = 'MAX';
  else if (css.alignSelf === 'stretch') result.layoutAlign = 'STRETCH';

  // #18: sizing modes for auto layout
  if (result.layoutMode) {
    result.primaryAxisSizingMode = 'AUTO'; // hug on primary
    result.counterAxisSizingMode = 'FIXED'; // fill on counter
    if (result.layoutWrap === 'WRAP') {
      result.primaryAxisSizingMode = 'FIXED';
      result.counterAxisSizingMode = 'AUTO';
    }
  }

  // --------------------------------------------------------
  // 19-26: CHILD SIZING
  // --------------------------------------------------------

  // #19: width → layoutSizingHorizontal
  if (css.width === '100%' || css.width === '-webkit-fill-available') {
    result.layoutSizingHorizontal = 'FILL';
  } else if (css.width === 'auto' || css.width === 'fit-content' || css.width === 'max-content') {
    result.layoutSizingHorizontal = 'HUG';
  } else if (px(css.width) > 0) {
    result.layoutSizingHorizontal = 'FIXED';
  }

  // #20: height → layoutSizingVertical
  if (css.height === '100%' || css.height === '-webkit-fill-available') {
    result.layoutSizingVertical = 'FILL';
  } else if (css.height === 'auto') {
    result.layoutSizingVertical = 'HUG';
  } else if (px(css.height) > 0) {
    result.layoutSizingVertical = 'FIXED';
  }

  // #21: flex-grow
  const grow = parseFloat(css.flexGrow);
  if (!isNaN(grow) && grow > 0) {
    result.layoutGrow = grow;
    result.layoutSizingHorizontal = 'FILL';
  }

  // #22-25: min/max constraints
  const minW = px(css.minWidth);
  const maxW = px(css.maxWidth);
  const minH = px(css.minHeight);
  const maxH = px(css.maxHeight);
  if (minW > 0) result.minWidth = minW;
  if (maxW > 0 && maxW < 10000) result.maxWidth = maxW;
  if (minH > 0) result.minHeight = minH;
  if (maxH > 0 && maxH < 10000) result.maxHeight = maxH;

  // #26: if parent is flex and child has no explicit width → FILL
  if (parentDisplay === 'flex' || parentDisplay === 'inline-flex') {
    if (!result.layoutSizingHorizontal) {
      result.layoutSizingHorizontal = 'FILL';
    }
  }

  // --------------------------------------------------------
  // 27-31: FILLS & COLORS
  // --------------------------------------------------------

  // #27: background-color
  const bgColor = rgbToFigma(css.backgroundColor);
  if (bgColor && !(bgColor.r === 0 && bgColor.g === 0 && bgColor.b === 0)) {
    result.fills = [{
      type: 'SOLID',
      color: { r: bgColor.r, g: bgColor.g, b: bgColor.b },
      opacity: bgColor.a,
      visible: true,
    }];
  }

  // #28: background: linear-gradient
  const gradient = parseGradient(css.backgroundImage);
  if (gradient) {
    result.fills = [gradient];
  }

  // #29: opacity
  const opVal = parseFloat(css.opacity);
  if (!isNaN(opVal) && opVal < 1) {
    result.opacity = opVal;
  }

  // #30: mix-blend-mode
  if (css.mixBlendMode && css.mixBlendMode !== 'normal') {
    result.blendMode = css.mixBlendMode.toUpperCase().replace(/-/g, '_');
  }

  // #31: object-fit (for images)
  if (css.objectFit === 'contain') result.imageScaleMode = 'FIT';
  else if (css.objectFit === 'cover') result.imageScaleMode = 'FILL';
  else if (css.objectFit === 'fill') result.imageScaleMode = 'FILL';

  // --------------------------------------------------------
  // 32-38: BORDER & RADIUS
  // --------------------------------------------------------

  // #32-35: border per side
  const btw = px(css.borderTopWidth);
  const brw = px(css.borderRightWidth);
  const bbw = px(css.borderBottomWidth);
  const blw = px(css.borderLeftWidth);

  if (btw > 0 || brw > 0 || bbw > 0 || blw > 0) {
    // Use top border color as stroke color (most common case)
    const borderColor = rgbToFigma(css.borderTopColor) || rgbToFigma(css.borderRightColor);
    if (borderColor) {
      result.strokes = [{
        type: 'SOLID',
        color: { r: borderColor.r, g: borderColor.g, b: borderColor.b },
        opacity: borderColor.a,
      }];
      result.strokeTopWeight = btw;
      result.strokeRightWeight = brw;
      result.strokeBottomWeight = bbw;
      result.strokeLeftWeight = blw;
    }
  }

  // #36-39: border-radius per corner
  const tlr = px(css.borderTopLeftRadius);
  const trr = px(css.borderTopRightRadius);
  const brr = px(css.borderBottomRightRadius);
  const blr = px(css.borderBottomLeftRadius);
  if (tlr) result.topLeftRadius = tlr;
  if (trr) result.topRightRadius = trr;
  if (brr) result.bottomRightRadius = brr;
  if (blr) result.bottomLeftRadius = blr;

  // --------------------------------------------------------
  // 40-44: EFFECTS
  // --------------------------------------------------------

  const effects: FigmaEffect[] = [];

  // #40: box-shadow → DROP_SHADOW / INNER_SHADOW
  effects.push(...parseBoxShadows(css.boxShadow));

  // #41: filter: blur() → LAYER_BLUR
  const blur = parseBlur(css.filter);
  if (blur) effects.push(blur);

  // #42: backdrop-filter: blur() → BACKGROUND_BLUR
  const bgBlur = parseBackdropBlur(css.backdropFilter);
  if (bgBlur) effects.push(bgBlur);

  if (effects.length > 0) result.effects = effects;

  // #43: transform: rotate() → rotation
  const rot = parseRotation(css.transform);
  if (rot !== 0) result.rotation = rot;

  // --------------------------------------------------------
  // 44-50: TYPOGRAPHY
  // --------------------------------------------------------

  // #44: font-size
  const fs = px(css.fontSize);
  if (fs > 0) result.fontSize = fs;

  // #45: font-family
  if (css.fontFamily) {
    result.fontFamily = css.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
  }

  // #46: font-weight
  if (css.fontWeight) result.fontWeight = css.fontWeight;

  // #47: font-style
  if (css.fontStyle === 'italic') result.fontStyle = 'italic';

  // #48: line-height
  const lh = px(css.lineHeight);
  if (lh > 0) result.lineHeight = { value: lh, unit: 'PIXELS' };

  // #49: letter-spacing
  const ls = px(css.letterSpacing);
  if (ls !== 0) result.letterSpacing = { value: ls, unit: 'PIXELS' };

  // #50: text-align
  if (css.textAlign === 'center') result.textAlignHorizontal = 'CENTER';
  else if (css.textAlign === 'right' || css.textAlign === 'end') result.textAlignHorizontal = 'RIGHT';
  else if (css.textAlign === 'justify') result.textAlignHorizontal = 'JUSTIFIED';
  else result.textAlignHorizontal = 'LEFT';

  // BONUS: text-decoration
  if (css.textDecoration?.includes('underline')) result.textDecoration = 'UNDERLINE';
  else if (css.textDecoration?.includes('line-through')) result.textDecoration = 'STRIKETHROUGH';

  // BONUS: text-transform
  if (css.textTransform === 'uppercase') result.textCase = 'UPPER';
  else if (css.textTransform === 'lowercase') result.textCase = 'LOWER';
  else if (css.textTransform === 'capitalize') result.textCase = 'TITLE';

  // BONUS: text-overflow / line-clamp
  if (css.webkitLineClamp && px(css.webkitLineClamp) > 0) {
    result.textTruncation = 'ENDING';
  }

  // BONUS: text color
  const textColor = rgbToFigma(css.color);
  if (textColor) {
    result.textColor = {
      type: 'SOLID',
      color: { r: textColor.r, g: textColor.g, b: textColor.b },
      opacity: textColor.a,
      visible: true,
    };
  }

  return result;
}

// ============================================================
// CSS EXTRACTION SCRIPT (runs in Playwright page.evaluate)
// ============================================================

/**
 * Returns a script string that extracts CSSData from a DOM element.
 * Used in page.evaluate() context.
 */
export const CSS_PROPERTIES_TO_EXTRACT = [
  'display', 'position', 'flexDirection', 'flexWrap',
  'justifyContent', 'alignItems', 'alignSelf',
  'flexGrow', 'flexShrink', 'flexBasis',
  'gap', 'rowGap', 'columnGap',
  'gridTemplateColumns', 'gridTemplateRows',
  'overflow', 'overflowX', 'overflowY', 'zIndex',
  'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight', 'boxSizing',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'fontSize', 'fontFamily', 'fontWeight', 'fontStyle',
  'lineHeight', 'letterSpacing', 'textAlign',
  'textDecorationLine', 'textTransform', 'whiteSpace',
  'color', 'backgroundColor', 'backgroundImage', 'backgroundSize',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
  'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor',
  'borderStyle',
  'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius',
  'opacity', 'boxShadow', 'filter', 'backdropFilter', 'mixBlendMode', 'transform',
  'objectFit',
] as const;

export function extractCSSFromElement(cs: CSSStyleDeclaration): CSSData {
  return {
    display: cs.display,
    position: cs.position,
    flexDirection: cs.flexDirection,
    flexWrap: cs.flexWrap,
    justifyContent: cs.justifyContent,
    alignItems: cs.alignItems,
    alignSelf: cs.alignSelf,
    flexGrow: cs.flexGrow,
    flexShrink: cs.flexShrink,
    flexBasis: cs.flexBasis,
    gap: cs.gap,
    rowGap: cs.rowGap,
    columnGap: cs.columnGap,
    gridTemplateColumns: cs.gridTemplateColumns,
    gridTemplateRows: cs.gridTemplateRows,
    overflow: cs.overflow,
    overflowX: cs.overflowX,
    overflowY: cs.overflowY,
    zIndex: cs.zIndex,
    width: cs.width,
    height: cs.height,
    minWidth: cs.minWidth,
    maxWidth: cs.maxWidth,
    minHeight: cs.minHeight,
    maxHeight: cs.maxHeight,
    boxSizing: cs.boxSizing,
    paddingTop: cs.paddingTop,
    paddingRight: cs.paddingRight,
    paddingBottom: cs.paddingBottom,
    paddingLeft: cs.paddingLeft,
    fontSize: cs.fontSize,
    fontFamily: cs.fontFamily,
    fontWeight: cs.fontWeight,
    fontStyle: cs.fontStyle,
    lineHeight: cs.lineHeight,
    letterSpacing: cs.letterSpacing,
    textAlign: cs.textAlign,
    textDecoration: cs.textDecorationLine,
    textTransform: cs.textTransform,
    whiteSpace: cs.whiteSpace,
    webkitLineClamp: (cs as unknown as Record<string, string>).webkitLineClamp || '',
    color: cs.color,
    backgroundColor: cs.backgroundColor,
    backgroundImage: cs.backgroundImage,
    backgroundSize: cs.backgroundSize,
    borderTopWidth: cs.borderTopWidth,
    borderRightWidth: cs.borderRightWidth,
    borderBottomWidth: cs.borderBottomWidth,
    borderLeftWidth: cs.borderLeftWidth,
    borderTopColor: cs.borderTopColor,
    borderRightColor: cs.borderRightColor,
    borderBottomColor: cs.borderBottomColor,
    borderLeftColor: cs.borderLeftColor,
    borderStyle: cs.borderStyle,
    borderTopLeftRadius: cs.borderTopLeftRadius,
    borderTopRightRadius: cs.borderTopRightRadius,
    borderBottomRightRadius: cs.borderBottomRightRadius,
    borderBottomLeftRadius: cs.borderBottomLeftRadius,
    opacity: cs.opacity,
    boxShadow: cs.boxShadow,
    filter: cs.filter,
    backdropFilter: (cs as unknown as Record<string, string>).backdropFilter || '',
    mixBlendMode: cs.mixBlendMode,
    transform: cs.transform,
    objectFit: cs.objectFit,
  };
}
