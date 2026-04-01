/**
 * DOM Walker — single-pass extraction of structure + CSS for every element.
 * Runs inside Playwright page.evaluate().
 * Returns a tree where each node has position, size, AND full CSS data.
 * No second pass needed — no matching, no collisions.
 */

export interface DOMNode {
  // Identity
  tag: string;
  name: string; // tag.className for Figma layer name
  // Position & size (absolute from viewport)
  x: number;
  y: number;
  width: number;
  height: number;
  // CSS Layout
  display: string;
  position: string;
  flexDirection: string;
  flexWrap: string;
  justifyContent: string;
  alignItems: string;
  alignSelf: string;
  flexGrow: string;
  gap: string;
  rowGap: string;
  // Sizing
  cssWidth: string;
  cssHeight: string;
  minWidth: string;
  maxWidth: string;
  // Spacing
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  // Visual
  backgroundColor: string; // already hex or rgba
  backgroundImage: string;
  opacity: string;
  overflow: string;
  mixBlendMode: string;
  // Border
  borderTopWidth: number;
  borderRightWidth: number;
  borderBottomWidth: number;
  borderLeftWidth: number;
  borderColor: string;
  borderStyle: string;
  borderTopLeftRadius: number;
  borderTopRightRadius: number;
  borderBottomRightRadius: number;
  borderBottomLeftRadius: number;
  // Effects
  boxShadow: string;
  filter: string;
  backdropFilter: string;
  transform: string;
  // Typography
  color: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  fontStyle: string;
  lineHeight: number;
  letterSpacing: number;
  textAlign: string;
  textDecoration: string;
  textTransform: string;
  // Content
  textContent?: string;
  imageUrl?: string;
  svgContent?: string;
  // Type hints
  isText: boolean;
  isImage: boolean;
  isSvg: boolean;
  hasChildren: boolean;
  hasOverlap: boolean; // children overlap each other
  // Children
  children: DOMNode[];
}

/**
 * Script that runs in page.evaluate() to walk the entire DOM
 * and collect structure + CSS in one pass.
 */
export function getDomWalkerScript(): string {
  return `
(function walkDOM() {
  const SKIP_TAGS = new Set(['SCRIPT','STYLE','LINK','META','NOSCRIPT','BR','HEAD','TITLE','BASE']);
  const INLINE_TAGS = new Set(['SPAN','STRONG','EM','B','I','U','A','MARK','SMALL','SUB','SUP','ABBR','CODE','KBD','VAR']);

  function px(v) { const n = parseFloat(v); return isNaN(n) ? 0 : Math.round(n); }

  function rgbToHex(color) {
    if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') return '';
    if (color.startsWith('#')) return color;
    const m = color.match(/rgba?\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)/);
    if (!m) return color;
    return '#' + ((1<<24)+(parseInt(m[1])<<16)+(parseInt(m[2])<<8)+parseInt(m[3])).toString(16).slice(1);
  }

  function getTextContent(el) {
    // Get full text for elements with only inline children
    const hasBlockChild = Array.from(el.children).some(c => !INLINE_TAGS.has(c.tagName));
    if (!hasBlockChild && el.children.length > 0) {
      return (el.textContent || '').trim().slice(0, 500);
    }
    // Only direct text nodes
    let text = '';
    for (const child of el.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        const t = (child.textContent || '').trim();
        if (t) text += (text ? ' ' : '') + t;
      }
    }
    return text.slice(0, 500);
  }

  function checkOverlap(el) {
    const rects = [];
    for (const child of el.children) {
      const cr = child.getBoundingClientRect();
      if (cr.width < 1 || cr.height < 1) continue;
      const cs = window.getComputedStyle(child);
      if (cs.position === 'absolute' || cs.position === 'fixed') return true;
      const nr = { l: cr.left, t: cr.top, r: cr.right, b: cr.bottom };
      for (const ex of rects) {
        if (nr.l < ex.r - 2 && nr.r > ex.l + 2 && nr.t < ex.b - 2 && nr.b > ex.t + 2) return true;
      }
      rects.push(nr);
    }
    return false;
  }

  function walkElement(el, depth) {
    if (depth > 15) return null;
    const tag = el.tagName;
    if (SKIP_TAGS.has(tag)) return null;

    const cs = window.getComputedStyle(el);
    if (cs.display === 'none') return null;

    const rect = el.getBoundingClientRect();
    if (rect.width < 1 && rect.height < 1) return null;

    const isImg = tag === 'IMG';
    const isSvg = tag === 'SVG';
    const hasBlockChild = Array.from(el.children).some(c => !INLINE_TAGS.has(c.tagName) && !SKIP_TAGS.has(c.tagName));
    const textContent = getTextContent(el);
    const isText = !!(textContent && !hasBlockChild && !isImg && !isSvg);

    // Build children (skip if this is a text/image leaf)
    const children = [];
    if (!isText && !isImg) {
      for (const child of el.children) {
        if (SKIP_TAGS.has(child.tagName)) continue;
        const node = walkElement(child, depth + 1);
        if (node) children.push(node);
      }
    }

    const className = (el.className && typeof el.className === 'string') ? el.className.split(/\\s+/)[0] : '';
    const name = tag.toLowerCase() + (className ? '.' + className : '');

    return {
      tag: tag.toLowerCase(),
      name: name,
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      // CSS Layout
      display: cs.display,
      position: cs.position,
      flexDirection: cs.flexDirection,
      flexWrap: cs.flexWrap,
      justifyContent: cs.justifyContent,
      alignItems: cs.alignItems,
      alignSelf: cs.alignSelf,
      flexGrow: cs.flexGrow,
      gap: cs.gap,
      rowGap: cs.rowGap,
      // Sizing
      cssWidth: cs.width,
      cssHeight: cs.height,
      minWidth: cs.minWidth,
      maxWidth: cs.maxWidth,
      // Spacing
      paddingTop: px(cs.paddingTop),
      paddingRight: px(cs.paddingRight),
      paddingBottom: px(cs.paddingBottom),
      paddingLeft: px(cs.paddingLeft),
      // Visual
      backgroundColor: rgbToHex(cs.backgroundColor),
      backgroundImage: cs.backgroundImage !== 'none' ? cs.backgroundImage : '',
      opacity: cs.opacity,
      overflow: cs.overflow,
      mixBlendMode: cs.mixBlendMode,
      // Border
      borderTopWidth: px(cs.borderTopWidth),
      borderRightWidth: px(cs.borderRightWidth),
      borderBottomWidth: px(cs.borderBottomWidth),
      borderLeftWidth: px(cs.borderLeftWidth),
      borderColor: rgbToHex(cs.borderTopColor),
      borderStyle: cs.borderStyle,
      borderTopLeftRadius: px(cs.borderTopLeftRadius),
      borderTopRightRadius: px(cs.borderTopRightRadius),
      borderBottomRightRadius: px(cs.borderBottomRightRadius),
      borderBottomLeftRadius: px(cs.borderBottomLeftRadius),
      // Effects
      boxShadow: cs.boxShadow !== 'none' ? cs.boxShadow : '',
      filter: cs.filter !== 'none' ? cs.filter : '',
      backdropFilter: cs.backdropFilter || '',
      transform: cs.transform !== 'none' ? cs.transform : '',
      // Typography
      color: rgbToHex(cs.color),
      fontSize: px(cs.fontSize),
      fontFamily: cs.fontFamily.split(',')[0].replace(/['"]/g, '').trim(),
      fontWeight: cs.fontWeight,
      fontStyle: cs.fontStyle,
      lineHeight: px(cs.lineHeight),
      letterSpacing: px(cs.letterSpacing),
      textAlign: cs.textAlign,
      textDecoration: cs.textDecorationLine !== 'none' ? cs.textDecorationLine : '',
      textTransform: cs.textTransform !== 'none' ? cs.textTransform : '',
      // Content
      textContent: isText ? textContent : (tag === 'BUTTON' || tag === 'A') ? textContent || undefined : undefined,
      imageUrl: isImg ? (el.getAttribute('src') || '') : undefined,
      svgContent: isSvg ? el.outerHTML : undefined,
      // Type hints
      isText: isText,
      isImage: isImg,
      isSvg: isSvg,
      hasChildren: children.length > 0,
      hasOverlap: children.length > 1 ? checkOverlap(el) : false,
      // Children
      children: children,
    };
  }

  // Walk from body
  const body = document.body;
  if (!body) return null;

  const children = [];
  for (const child of body.children) {
    const node = walkElement(child, 0);
    if (node) children.push(node);
  }

  return {
    tag: 'body',
    name: 'page',
    x: 0, y: 0,
    width: Math.max(document.body.scrollWidth, window.innerWidth),
    height: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
    display: 'block', position: 'static',
    flexDirection: '', flexWrap: '', justifyContent: '', alignItems: '', alignSelf: '', flexGrow: '0',
    gap: '', rowGap: '',
    cssWidth: '100%', cssHeight: 'auto', minWidth: '', maxWidth: '',
    paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
    backgroundColor: '#ffffff', backgroundImage: '', opacity: '1', overflow: 'visible', mixBlendMode: 'normal',
    borderTopWidth: 0, borderRightWidth: 0, borderBottomWidth: 0, borderLeftWidth: 0,
    borderColor: '', borderStyle: 'none',
    borderTopLeftRadius: 0, borderTopRightRadius: 0, borderBottomRightRadius: 0, borderBottomLeftRadius: 0,
    boxShadow: '', filter: '', backdropFilter: '', transform: '',
    color: '#000000', fontSize: 16, fontFamily: 'system-ui', fontWeight: '400', fontStyle: 'normal',
    lineHeight: 24, letterSpacing: 0, textAlign: 'start', textDecoration: '', textTransform: '',
    isText: false, isImage: false, isSvg: false, hasChildren: children.length > 0, hasOverlap: false,
    children: children,
  };
})()
`;
}
