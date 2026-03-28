import { describe, it, expect } from 'vitest';
import { generateFigmaDesignSpec } from '@/lib/export/figma-json';
import type { ComponentNode } from '@/types/component-tree';
import type { PageMetadata } from '@/types/clone';

const mockMetadata: PageMetadata = {
  title: 'Test Page',
  fonts: ['Inter'],
  cssUrls: [],
  imageUrls: [],
};

function makeNode(overrides: Partial<ComponentNode> = {}): ComponentNode {
  return {
    id: 'node-1',
    type: 'section',
    tag: 'section',
    children: [],
    styles: {},
    depth: 0,
    rect: { x: 0, y: 0, width: 1440, height: 500 },
    ...overrides,
  };
}

describe('generateFigmaDesignSpec v2', () => {
  it('returns correct version and source info', () => {
    const spec = generateFigmaDesignSpec([], mockMetadata, 'https://example.com', '2026-01-01');
    expect(spec.version).toBe('2.0');
    expect(spec.source.url).toBe('https://example.com');
    expect(spec.source.title).toBe('Test Page');
  });

  it('creates a page with correct dimensions', () => {
    const nodes = [makeNode({ rect: { x: 0, y: 0, width: 1440, height: 800 } })];
    const spec = generateFigmaDesignSpec(nodes, mockMetadata, 'https://example.com', '2026-01-01');
    expect(spec.page.name).toBe('Test Page');
    expect(spec.page.width).toBe(1440);
  });

  it('flattens nodes with background to elements', () => {
    const nodes = [
      makeNode({
        styles: { backgroundColor: '#1a1a1a' },
      }),
    ];
    const spec = generateFigmaDesignSpec(nodes, mockMetadata, 'https://example.com', '2026-01-01');
    const el = spec.page.elements.find((e) => e.backgroundColor === '#1a1a1a');
    expect(el).toBeDefined();
    expect(el!.type).toBe('FRAME');
  });

  it('creates text elements with correct properties', () => {
    const nodes = [
      makeNode({
        tag: 'h1',
        textContent: 'Hello World',
        children: [],
        styles: {
          color: '#ffffff',
          fontSize: '32px',
          fontWeight: '700',
          fontFamily: '"Inter", sans-serif',
        },
        rect: { x: 100, y: 50, width: 400, height: 40 },
      }),
    ];
    const spec = generateFigmaDesignSpec(nodes, mockMetadata, 'https://example.com', '2026-01-01');
    const textEl = spec.page.elements.find((e) => e.type === 'TEXT');
    expect(textEl).toBeDefined();
    expect(textEl!.characters).toBe('Hello World');
    expect(textEl!.fontFamily).toBe('Inter');
    expect(textEl!.fontSize).toBe(32);
    expect(textEl!.fontWeight).toBe(700);
    expect(textEl!.textColor).toBe('#ffffff');
  });

  it('creates image elements with URL', () => {
    const nodes = [
      makeNode({
        tag: 'img',
        type: 'image',
        children: [],
        attributes: { src: 'https://example.com/img.png' },
        rect: { x: 0, y: 0, width: 200, height: 150 },
      }),
    ];
    const spec = generateFigmaDesignSpec(nodes, mockMetadata, 'https://example.com', '2026-01-01');
    const imgEl = spec.page.elements.find((e) => e.type === 'IMAGE');
    expect(imgEl).toBeDefined();
    expect(imgEl!.imageUrl).toBe('https://example.com/img.png');
  });

  it('preserves absolute positions from rects', () => {
    const nodes = [
      makeNode({
        styles: { backgroundColor: '#ff0000' },
        rect: { x: 100, y: 200, width: 300, height: 150 },
      }),
    ];
    const spec = generateFigmaDesignSpec(nodes, mockMetadata, 'https://example.com', '2026-01-01');
    const el = spec.page.elements[0];
    expect(el.x).toBe(100);
    expect(el.width).toBe(300);
    expect(el.height).toBe(150);
  });

  it('handles border radius', () => {
    const nodes = [
      makeNode({
        styles: { backgroundColor: '#000', borderRadius: '12px' },
        rect: { x: 0, y: 0, width: 100, height: 100 },
      }),
    ];
    const spec = generateFigmaDesignSpec(nodes, mockMetadata, 'https://example.com', '2026-01-01');
    expect(spec.page.elements[0].borderRadius).toBe(12);
  });

  it('handles empty tree', () => {
    const spec = generateFigmaDesignSpec([], mockMetadata, 'https://example.com', '2026-01-01');
    expect(spec.page.elements).toHaveLength(0);
  });

  it('skips elements without visual content', () => {
    const nodes = [
      makeNode({
        // No background, no text, no image, no border
        styles: {},
        rect: { x: 0, y: 0, width: 100, height: 100 },
      }),
    ];
    const spec = generateFigmaDesignSpec(nodes, mockMetadata, 'https://example.com', '2026-01-01');
    // Should not create element for invisible container
    expect(spec.page.elements).toHaveLength(0);
  });

  it('flattens nested children to absolute positions', () => {
    const nodes = [
      makeNode({
        styles: { backgroundColor: '#111' },
        rect: { x: 0, y: 0, width: 1440, height: 500 },
        children: [
          makeNode({
            id: 'child-1',
            tag: 'h1',
            textContent: 'Title',
            depth: 1,
            styles: { fontSize: '24px', color: '#fff' },
            rect: { x: 50, y: 50, width: 300, height: 30 },
          }),
        ],
      }),
    ];
    const spec = generateFigmaDesignSpec(nodes, mockMetadata, 'https://example.com', '2026-01-01');
    // Should have both parent frame and child text
    expect(spec.page.elements.length).toBe(2);
    const textEl = spec.page.elements.find((e) => e.type === 'TEXT');
    expect(textEl).toBeDefined();
    expect(textEl!.x).toBe(50);
  });

  it('converts rgb colors to hex', () => {
    const nodes = [
      makeNode({
        styles: { backgroundColor: 'rgb(255, 0, 0)' },
        rect: { x: 0, y: 0, width: 100, height: 100 },
      }),
    ];
    const spec = generateFigmaDesignSpec(nodes, mockMetadata, 'https://example.com', '2026-01-01');
    // backgroundColor should still work (toHex handles rgb)
    expect(spec.page.elements[0].backgroundColor).toBe('#ff0000');
  });
});
