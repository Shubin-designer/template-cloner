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

describe('generateFigmaDesignSpec', () => {
  it('returns correct version and source info', () => {
    const spec = generateFigmaDesignSpec([], mockMetadata, 'https://example.com', '2026-01-01');
    expect(spec.version).toBe('1.0');
    expect(spec.source.url).toBe('https://example.com');
    expect(spec.source.title).toBe('Test Page');
  });

  it('creates a page with correct dimensions', () => {
    const nodes = [makeNode({ rect: { x: 0, y: 0, width: 1440, height: 800 } })];
    const spec = generateFigmaDesignSpec(nodes, mockMetadata, 'https://example.com', '2026-01-01');

    expect(spec.pages).toHaveLength(1);
    expect(spec.pages[0].name).toBe('Test Page');
    expect(spec.pages[0].width).toBeGreaterThanOrEqual(1440);
  });

  it('converts nodes to Figma frames', () => {
    const nodes = [
      makeNode({
        styles: {
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          padding: '20px',
          backgroundColor: '#1a1a1a',
        },
      }),
    ];

    const spec = generateFigmaDesignSpec(nodes, mockMetadata, 'https://example.com', '2026-01-01');
    const frame = spec.pages[0].children[0];

    expect(frame.type).toBe('FRAME');
    expect(frame.layoutMode).toBe('VERTICAL');
    expect(frame.itemSpacing).toBe(16);
    expect(frame.paddingTop).toBe(20);
    expect(frame.fills).toEqual([{ type: 'SOLID', color: '#1a1a1a' }]);
  });

  it('converts text nodes correctly', () => {
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
      }),
    ];

    const spec = generateFigmaDesignSpec(nodes, mockMetadata, 'https://example.com', '2026-01-01');
    const frame = spec.pages[0].children[0];

    expect(frame.type).toBe('TEXT');
    expect(frame.characters).toBe('Hello World');
    expect(frame.textStyle?.fontFamily).toBe('Inter');
    expect(frame.textStyle?.fontSize).toBe(32);
    expect(frame.textStyle?.fontWeight).toBe(700);
    expect(frame.fills).toEqual([{ type: 'SOLID', color: '#ffffff' }]);
  });

  it('converts image nodes correctly', () => {
    const nodes = [
      makeNode({
        tag: 'img',
        type: 'image',
        children: [],
        attributes: { src: 'https://example.com/img.png', alt: 'Test' },
      }),
    ];

    const spec = generateFigmaDesignSpec(nodes, mockMetadata, 'https://example.com', '2026-01-01');
    const frame = spec.pages[0].children[0];

    expect(frame.type).toBe('IMAGE');
    expect(frame.imageUrl).toBe('https://example.com/img.png');
  });

  it('extracts design tokens', () => {
    const nodes = [
      makeNode({
        styles: {
          backgroundColor: '#1a1a1a',
          color: '#ffffff',
          fontSize: '16px',
          fontFamily: 'Inter',
          fontWeight: '400',
          gap: '8px',
          padding: '16px 24px',
        },
      }),
    ];

    const spec = generateFigmaDesignSpec(nodes, mockMetadata, 'https://example.com', '2026-01-01');

    expect(spec.designTokens.colors.length).toBeGreaterThan(0);
    expect(spec.designTokens.colors.some((c) => c.hex === '#1a1a1a')).toBe(true);
    expect(spec.designTokens.colors.some((c) => c.hex === '#ffffff')).toBe(true);

    expect(spec.designTokens.typography.length).toBeGreaterThan(0);
    expect(spec.designTokens.typography[0].fontFamily).toBe('Inter');

    expect(spec.designTokens.spacing).toContain(8);
    expect(spec.designTokens.spacing).toContain(16);
    expect(spec.designTokens.spacing).toContain(24);
  });

  it('handles nested children', () => {
    const nodes = [
      makeNode({
        children: [
          makeNode({ id: 'child-1', tag: 'div', depth: 1 }),
          makeNode({ id: 'child-2', tag: 'p', textContent: 'Text', depth: 1 }),
        ],
      }),
    ];

    const spec = generateFigmaDesignSpec(nodes, mockMetadata, 'https://example.com', '2026-01-01');
    const frame = spec.pages[0].children[0];

    expect(frame.children).toHaveLength(2);
  });

  it('handles empty tree', () => {
    const spec = generateFigmaDesignSpec([], mockMetadata, 'https://example.com', '2026-01-01');
    expect(spec.pages[0].children).toHaveLength(0);
    expect(spec.designTokens.colors).toHaveLength(0);
  });

  it('maps flex-direction row to HORIZONTAL', () => {
    const nodes = [
      makeNode({
        styles: { display: 'flex' },
      }),
    ];

    const spec = generateFigmaDesignSpec(nodes, mockMetadata, 'https://example.com', '2026-01-01');
    expect(spec.pages[0].children[0].layoutMode).toBe('HORIZONTAL');
  });

  it('handles corner radius', () => {
    const nodes = [
      makeNode({
        styles: { borderRadius: '12px' },
      }),
    ];

    const spec = generateFigmaDesignSpec(nodes, mockMetadata, 'https://example.com', '2026-01-01');
    expect(spec.pages[0].children[0].cornerRadius).toBe(12);
  });
});
