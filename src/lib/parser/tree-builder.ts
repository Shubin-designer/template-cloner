import type { Page } from 'playwright';
import type { ComponentNode } from '@/types/component-tree';

const SKIP_TAGS = new Set([
  'script', 'style', 'link', 'meta', 'noscript', 'svg', 'br', 'hr',
  'head', 'title', 'base',
]);

const MAX_DEPTH = 8;
const MAX_CHILDREN = 50;

/**
 * Build a component tree by evaluating the DOM in Playwright's browser context.
 * Extracts structure, styles, and basic classification for each visible element.
 */
export async function buildComponentTree(page: Page): Promise<ComponentNode[]> {
  const tree = await page.evaluate(
    ({ maxDepth, maxChildren, skipTags }) => {
      let nodeCounter = 0;
      let isFirstLargeSection = true;

      // Semantic tag → type mapping (inline for browser context)
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
        tag: string,
        cls: string,
        id: string,
        depth: number,
        isLarge: boolean
      ): string {
        const mapped = SEMANTIC_TAGS[tag.toLowerCase()];
        if (mapped) return mapped;

        const text = `${cls} ${id}`.toLowerCase();
        for (const [pattern, type] of CLASS_PATTERNS) {
          if (text.includes(pattern)) return type;
        }

        if (isLarge && depth <= 2) {
          return 'hero';
        }

        if (depth <= 1) return 'section';
        if (depth <= 3) return 'block';
        return 'element';
      }

      function extractStyles(el: Element): Record<string, string> {
        const cs = window.getComputedStyle(el);
        return {
          display: cs.display,
          flexDirection: cs.flexDirection !== 'row' ? cs.flexDirection : '',
          alignItems: cs.alignItems,
          justifyContent: cs.justifyContent,
          gap: cs.gap !== 'normal' ? cs.gap : '',
          padding: cs.padding !== '0px' ? cs.padding : '',
          margin: cs.margin !== '0px' ? cs.margin : '',
          backgroundColor: cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ? cs.backgroundColor : '',
          color: cs.color,
          fontSize: cs.fontSize,
          fontFamily: cs.fontFamily,
          fontWeight: cs.fontWeight !== '400' ? cs.fontWeight : '',
          lineHeight: cs.lineHeight,
          borderRadius: cs.borderRadius !== '0px' ? cs.borderRadius : '',
          border: cs.border,
          width: cs.width,
          height: cs.height,
          position: cs.position !== 'static' ? cs.position : '',
          overflow: cs.overflow !== 'visible' ? cs.overflow : '',
          opacity: cs.opacity !== '1' ? cs.opacity : '',
        };
      }

      function isVisible(el: Element): boolean {
        const cs = window.getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return false;
        return true;
      }

      function getTextContent(el: Element): string {
        let text = '';
        for (const child of Array.from(el.childNodes)) {
          if (child.nodeType === Node.TEXT_NODE) {
            const t = (child.textContent || '').trim();
            if (t) text += (text ? ' ' : '') + t;
          }
        }
        return text.slice(0, 200); // Limit text length
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
          ? el.className.trim().slice(0, 200)
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
        const textContent = getTextContent(el);

        // Build children (limit count)
        const children: TreeNodeData[] = [];
        const childElements = el.children;
        const limit = Math.min(childElements.length, maxChildren);
        for (let i = 0; i < limit; i++) {
          const child = walk(childElements[i], depth + 1);
          if (child) children.push(child);
        }

        // Collapse single-child wrapper divs
        if (
          children.length === 1 &&
          (tag === 'div' || tag === 'span') &&
          !textContent &&
          !className
        ) {
          const child = children[0];
          child.depth = depth;
          return child;
        }

        const attributes: Record<string, string> = {};
        if (tag === 'a') {
          const href = el.getAttribute('href');
          if (href) attributes.href = href;
        }
        if (tag === 'img') {
          const src = el.getAttribute('src');
          const alt = el.getAttribute('alt');
          if (src) attributes.src = src;
          if (alt) attributes.alt = alt;
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

      // Start from body
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
 * Uses jsdom-compatible structure, not Playwright.
 */
export function buildTreeFromHTML(
  document: { body: Element | null },
  classify: (
    tag: string,
    className: string,
    id: string,
    depth: number,
    isLarge: boolean
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
      textContent: el.textContent?.trim().slice(0, 200) || undefined,
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
