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

describe('generateFigmaDesignSpec v3', () => {
  it('returns version 3.0 with source info', () => {
    const spec = generateFigmaDesignSpec([], mockMetadata, 'https://example.com', '2026-01-01');
    expect(spec.version).toBe('3.0');
    expect(spec.source.url).toBe('https://example.com');
  });

  it('includes ALL containers even without background', () => {
    const nodes = [makeNode({ styles: {} })]; // no bg
    const spec = generateFigmaDesignSpec(nodes, mockMetadata, 'https://example.com', '2026-01-01');
    expect(spec.page.children.length).toBe(1);
    expect(spec.page.children[0].type).toBe('FRAME');
  });

  it('sets Auto Layout VERTICAL for containers with children', () => {
    const nodes = [
      makeNode({
        children: [makeNode({ id: 'c1', tag: 'div', depth: 1 })],
      }),
    ];
    const spec = generateFigmaDesignSpec(nodes, mockMetadata, 'https://example.com', '2026-01-01');
    expect(spec.page.children[0].layoutMode).toBe('VERTICAL');
  });

  it('sets Auto Layout HORIZONTAL for flex-direction row', () => {
    const nodes = [
      makeNode({
        styles: { display: 'flex', flexDirection: 'row' },
        children: [makeNode({ id: 'c1', tag: 'div', depth: 1 })],
      }),
    ];
    const spec = generateFigmaDesignSpec(nodes, mockMetadata, 'https://example.com', '2026-01-01');
    expect(spec.page.children[0].layoutMode).toBe('HORIZONTAL');
  });

  it('creates text nodes with all properties', () => {
    const nodes = [
      makeNode({
        tag: 'h1', textContent: 'Hello', children: [],
        styles: { color: '#ffffff', fontSize: '32px', fontWeight: '700', fontFamily: '"Inter"' },
      }),
    ];
    const spec = generateFigmaDesignSpec(nodes, mockMetadata, 'https://example.com', '2026-01-01');
    const t = spec.page.children[0];
    expect(t.type).toBe('TEXT');
    expect(t.characters).toBe('Hello');
    expect(t.fontSize).toBe(32);
    expect(t.fontWeight).toBe(700);
    expect(t.textColor).toBe('#ffffff');
  });

  it('creates image nodes with URL', () => {
    const nodes = [
      makeNode({
        tag: 'img', type: 'image', children: [],
        attributes: { src: 'https://example.com/img.png' },
      }),
    ];
    const spec = generateFigmaDesignSpec(nodes, mockMetadata, 'https://example.com', '2026-01-01');
    expect(spec.page.children[0].type).toBe('IMAGE');
    expect(spec.page.children[0].imageUrl).toBe('https://example.com/img.png');
  });

  it('preserves nested hierarchy', () => {
    const nodes = [
      makeNode({
        children: [
          makeNode({ id: 'c1', tag: 'div', depth: 1, children: [
            makeNode({ id: 'c2', tag: 'p', textContent: 'Deep text', depth: 2 }),
          ]}),
        ],
      }),
    ];
    const spec = generateFigmaDesignSpec(nodes, mockMetadata, 'https://example.com', '2026-01-01');
    expect(spec.page.children[0].children![0].children![0].type).toBe('TEXT');
  });

  it('handles padding', () => {
    const nodes = [
      makeNode({
        styles: { paddingTop: '20px', paddingRight: '16px', paddingBottom: '20px', paddingLeft: '16px' },
        children: [makeNode({ id: 'c1', tag: 'div', depth: 1 })],
      }),
    ];
    const spec = generateFigmaDesignSpec(nodes, mockMetadata, 'https://example.com', '2026-01-01');
    expect(spec.page.children[0].paddingTop).toBe(20);
    expect(spec.page.children[0].paddingRight).toBe(16);
  });

  it('handles border', () => {
    const nodes = [
      makeNode({
        styles: { borderWidth: '1px', borderColor: '#cccccc', borderStyle: 'solid' },
      }),
    ];
    const spec = generateFigmaDesignSpec(nodes, mockMetadata, 'https://example.com', '2026-01-01');
    expect(spec.page.children[0].borderWidth).toBe(1);
    expect(spec.page.children[0].borderColor).toBe('#cccccc');
  });

  it('handles empty tree', () => {
    const spec = generateFigmaDesignSpec([], mockMetadata, 'https://example.com', '2026-01-01');
    expect(spec.page.children).toHaveLength(0);
  });

  it('converts rgb colors to hex', () => {
    const nodes = [makeNode({ styles: { backgroundColor: 'rgb(255, 0, 0)' } })];
    const spec = generateFigmaDesignSpec(nodes, mockMetadata, 'https://example.com', '2026-01-01');
    expect(spec.page.children[0].backgroundColor).toBe('#ff0000');
  });
});
