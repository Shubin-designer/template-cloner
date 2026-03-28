import type { Page } from 'playwright';
import type { ComponentNode } from '@/types/component-tree';

const SKIP_TAGS = new Set([
  'script', 'style', 'link', 'meta', 'noscript', 'br',
  'head', 'title', 'base',
]);

const MAX_DEPTH = 12;
const MAX_CHILDREN = 80;

/**
 * Build a component tree by evaluating the DOM in Playwright's browser context.
 * Extracts structure, styles, and basic classification for each visible element.
 */
export async function buildComponentTree(page: Page): Promise<ComponentNode[]> {
  const tree = await page.evaluate(
    ({ maxDepth, maxChildren, skipTags }) => {
      let nodeCounter = 0;
      let isFirstLargeSection = true;

      const SEMANTIC_TAGS: Record<string, string> = {
        header: 'header', nav: 'nav', footer: 'footer', main: 'section',
        section: 'section', article: 'card', form: 'form', button: 'button',
        a: 'link', img: 'image', video: 'video', input: 'input',
        textarea: 'input', select: 'input', ul: 'list', ol: 'list',
      };

      const CLASS_PATTERNS: [string, string][] = [
        ['hero', 'hero'], ['nav', 'nav'], ['header', 'header'],
        ['footer', 'footer'], ['card', 'card'], ['btn', 'button'],
        ['button', 'button'], ['form', 'form'], ['menu', 'nav'],
        ['banner', 'hero'], ['sidebar', 'block'],
      ];

      function classify(
        tag: string, cls: string, id: string, depth: number, isLarge: boolean
      ): string {
        const mapped = SEMANTIC_TAGS[tag.toLowerCase()];
        if (mapped) return mapped;
        const text = `${cls} ${id}`.toLowerCase();
        for (const [pattern, type] of CLASS_PATTERNS) {
          if (text.includes(pattern)) return type;
        }
        if (isLarge && depth <= 2) return 'hero';
        if (depth <= 1) return 'section';
        if (depth <= 3) return 'block';
        return 'element';
      }

      function rgbToHex(rgb: string): string {
        if (!rgb || rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return '';
        if (rgb.startsWith('#')) return rgb;
        const match = rgb.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
        if (!match) return rgb;
        const r = parseInt(match[1], 10);
        const g = parseInt(match[2], 10);
        const b = parseInt(match[3], 10);
        return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
      }

      function extractStyles(el: Element): Record<string, string> {
        const cs = window.getComputedStyle(el);

        // Convert colors to hex right here in browser context
        const bgColor = rgbToHex(cs.backgroundColor);
        const textColor = rgbToHex(cs.color);

        return {
          // Layout
          display: cs.display,
          flexDirection: cs.flexDirection,
          flexWrap: cs.flexWrap !== 'nowrap' ? cs.flexWrap : '',
          alignItems: cs.alignItems,
          justifyContent: cs.justifyContent,
          gap: cs.gap !== 'normal' ? cs.gap : '',
          gridTemplateColumns: cs.gridTemplateColumns !== 'none' ? cs.gridTemplateColumns : '',
          // Spacing
          padding: cs.padding,
          paddingTop: cs.paddingTop,
          paddingRight: cs.paddingRight,
          paddingBottom: cs.paddingBottom,
          paddingLeft: cs.paddingLeft,
          margin: cs.margin,
          // Colors (already hex)
          backgroundColor: bgColor,
          color: textColor,
          // Background extras
          backgroundImage: cs.backgroundImage !== 'none' ? cs.backgroundImage : '',
          // Typography
          fontSize: cs.fontSize,
          fontFamily: cs.fontFamily,
          fontWeight: cs.fontWeight,
          lineHeight: cs.lineHeight,
          letterSpacing: cs.letterSpacing !== 'normal' ? cs.letterSpacing : '',
          textAlign: cs.textAlign,
          textTransform: cs.textTransform !== 'none' ? cs.textTransform : '',
          textDecoration: cs.textDecorationLine !== 'none' ? cs.textDecorationLine : '',
          // Dimensions
          width: cs.width,
          height: cs.height,
          minWidth: cs.minWidth !== '0px' ? cs.minWidth : '',
          maxWidth: cs.maxWidth !== 'none' ? cs.maxWidth : '',
          minHeight: cs.minHeight !== '0px' ? cs.minHeight : '',
          // Border
          borderRadius: cs.borderRadius !== '0px' ? cs.borderRadius : '',
          borderWidth: cs.borderWidth !== '0px' ? cs.borderWidth : '',
          borderColor: cs.borderWidth !== '0px' ? rgbToHex(cs.borderColor) : '',
          borderStyle: cs.borderStyle !== 'none' ? cs.borderStyle : '',
          // Effects
          boxShadow: cs.boxShadow !== 'none' ? cs.boxShadow : '',
          opacity: cs.opacity !== '1' ? cs.opacity : '',
          // Position
          position: cs.position !== 'static' ? cs.position : '',
          overflow: cs.overflow !== 'visible' ? cs.overflow : '',
          zIndex: cs.zIndex !== 'auto' ? cs.zIndex : '',
        };
      }

      function isVisible(el: Element): boolean {
        const cs = window.getComputedStyle(el);
        // Only skip display:none — these truly don't exist in layout
        if (cs.display === 'none') return false;
        // DON'T skip opacity:0 or visibility:hidden — these elements exist
        // in the layout and may be animated into view by JS.
        // Skip only truly zero-size elements (not even 1px)
        const rect = el.getBoundingClientRect();
        if (rect.width < 1 && rect.height < 1) return false;
        return true;
      }

      function getDirectText(el: Element): string {
        // Get only direct text nodes (not from children)
        let text = '';
        for (const child of Array.from(el.childNodes)) {
          if (child.nodeType === Node.TEXT_NODE) {
            const t = (child.textContent || '').trim();
            if (t) text += (text ? ' ' : '') + t;
          }
        }
        return text.slice(0, 500);
      }

      function getFullText(el: Element): string {
        // Get ALL text including from inline children (spans, a, strong, em, etc.)
        return (el.textContent || '').trim().slice(0, 500);
      }

      // Inline elements that don't create separate visual blocks
      const INLINE_TAGS = new Set([
        'span', 'strong', 'em', 'b', 'i', 'u', 'a', 'mark', 'small',
        'sub', 'sup', 'abbr', 'code', 'kbd', 'var', 'br',
      ]);

      function hasOnlyInlineChildren(el: Element): boolean {
        for (const child of Array.from(el.children)) {
          if (!INLINE_TAGS.has(child.tagName.toLowerCase())) return false;
        }
        return true;
      }

      interface TreeNodeData {
        id: string;
        type: string;
        tag: string;
        className?: string;
        children: TreeNodeData[];
        styles: Record<string, string>;
        textContent?: string;
        attributes?: Record<string, string>;
        depth: number;
        rect?: { x: number; y: number; width: number; height: number };
      }

      function walk(el: Element, depth: number): TreeNodeData | null {
        if (depth > maxDepth) return null;
        const tag = el.tagName.toLowerCase();
        if (skipTags.includes(tag)) return null;
        if (!isVisible(el)) return null;
        return buildNode(el, tag, depth);
      }

      function buildNode(el: Element, tag: string, depth: number): TreeNodeData {
        const id = `node-${nodeCounter++}`;
        const className = el.className && typeof el.className === 'string'
          ? el.className.trim().slice(0, 300)
          : undefined;
        const elId = el.id || undefined;

        const rect = el.getBoundingClientRect();
        const isLargeSection =
          isFirstLargeSection && depth <= 2 && rect.height > 300 && rect.width > 600;

        if (isLargeSection && isFirstLargeSection) {
          isFirstLargeSection = false;
        }

        const type = classify(tag, className || '', elId || '', depth, isLargeSection);
        const styles = extractStyles(el);

        // Text extraction strategy:
        // If element has ONLY inline children (span, strong, a, etc.),
        // treat it as a text element with full text content.
        // This handles: <h1>Welcome <span>back!</span></h1> → "Welcome back!"
        const onlyInline = hasOnlyInlineChildren(el);
        let textContent: string;
        if (onlyInline && el.children.length > 0) {
          textContent = getFullText(el);
        } else {
          textContent = getDirectText(el);
        }

        // Build children — skip inline children if we already got full text
        const children: TreeNodeData[] = [];
        if (!onlyInline || el.children.length === 0) {
          const childElements = el.children;
          const childLimit = Math.min(childElements.length, maxChildren);
          for (let i = 0; i < childLimit; i++) {
            const child = walk(childElements[i], depth + 1);
            if (child) children.push(child);
          }
        }

        // Collect attributes
        const attributes: Record<string, string> = {};
        if (tag === 'a') {
          const href = el.getAttribute('href');
          if (href) attributes.href = href;
          // Link text
          if (!textContent) textContent = getFullText(el);
        }
        if (tag === 'img') {
          const src = el.getAttribute('src');
          const alt = el.getAttribute('alt');
          if (src) attributes.src = src;
          if (alt) attributes.alt = alt;
        }
        if (tag === 'svg') {
          attributes.svg = 'true';
        }
        // Input placeholder as text content
        if (tag === 'input' || tag === 'textarea') {
          const placeholder = el.getAttribute('placeholder');
          if (placeholder && !textContent) textContent = placeholder;
          const inputType = el.getAttribute('type');
          if (inputType) attributes.type = inputType;
        }
        // Button text
        if (tag === 'button' && !textContent) {
          textContent = getFullText(el);
        }

        return {
          id,
          type,
          tag,
          className,
          children,
          styles,
          textContent: textContent || undefined,
          attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
          depth,
          rect: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
        };
      }

      const body = document.body;
      if (!body) return [];

      const result: TreeNodeData[] = [];
      for (const child of Array.from(body.children)) {
        const node = walk(child, 0);
        if (node) result.push(node);
      }

      return result;
    },
    {
      maxDepth: MAX_DEPTH,
      maxChildren: MAX_CHILDREN,
      skipTags: Array.from(SKIP_TAGS),
    }
  );

  return tree as ComponentNode[];
}

/**
 * Build a component tree from a static HTML string (for testing).
 */
export function buildTreeFromHTML(
  document: { body: Element | null },
  classify: (
    tag: string, className: string, id: string, depth: number, isLarge: boolean
  ) => string
): ComponentNode[] {
  const body = document.body;
  if (!body) return [];

  let nodeCounter = 0;

  function walk(el: Element, depth: number): ComponentNode | null {
    if (depth > MAX_DEPTH) return null;
    const tag = el.tagName.toLowerCase();
    if (SKIP_TAGS.has(tag)) return null;

    const id = `node-${nodeCounter++}`;
    const className =
      el.className && typeof el.className === 'string'
        ? el.className.trim()
        : undefined;
    const elId = el.id || undefined;
    const type = classify(tag, className || '', elId || '', depth, false) as ComponentNode['type'];

    const children: ComponentNode[] = [];
    for (const child of Array.from(el.children || [])) {
      const node = walk(child, depth + 1);
      if (node) children.push(node);
    }

    return {
      id,
      type,
      tag,
      className,
      children,
      styles: {},
      textContent: el.textContent?.trim().slice(0, 500) || undefined,
      depth,
    };
  }

  const result: ComponentNode[] = [];
  for (const child of Array.from(body.children || [])) {
    const node = walk(child, 0);
    if (node) result.push(node);
  }

  return result;
}
