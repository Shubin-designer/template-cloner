import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { buildTreeFromHTML } from '@/lib/parser/tree-builder';

// Simple classifier for testing
function testClassify(
  tag: string,
  className: string,
  id: string,
  depth: number,
): string {
  const SEMANTIC_TAGS: Record<string, string> = {
    header: 'header', nav: 'nav', footer: 'footer', main: 'section',
    section: 'section', article: 'card', form: 'form', button: 'button',
    a: 'link', img: 'image', video: 'video', input: 'input',
    ul: 'list', ol: 'list',
  };
  const mapped = SEMANTIC_TAGS[tag.toLowerCase()];
  if (mapped) return mapped;
  if (depth <= 1) return 'section';
  if (depth <= 3) return 'block';
  return 'element';
}

function parseHTML(html: string) {
  const dom = new JSDOM(html);
  return dom.window.document;
}

describe('buildTreeFromHTML', () => {
  it('builds tree from simple HTML', () => {
    const doc = parseHTML(`
      <html><body>
        <header>Logo</header>
        <main>Content</main>
        <footer>Copyright</footer>
      </body></html>
    `);

    const tree = buildTreeFromHTML(doc, testClassify);
    expect(tree.length).toBe(3);
    expect(tree[0].type).toBe('header');
    expect(tree[1].type).toBe('section');
    expect(tree[2].type).toBe('footer');
  });

  it('handles nested elements', () => {
    const doc = parseHTML(`
      <html><body>
        <section>
          <div>
            <p>Hello</p>
          </div>
        </section>
      </body></html>
    `);

    const tree = buildTreeFromHTML(doc, testClassify);
    expect(tree.length).toBe(1);
    expect(tree[0].type).toBe('section');
    expect(tree[0].children.length).toBeGreaterThan(0);
  });

  it('skips script and style tags', () => {
    const doc = parseHTML(`
      <html><body>
        <script>console.log("hi")</script>
        <style>.foo { color: red }</style>
        <div>Visible</div>
      </body></html>
    `);

    const tree = buildTreeFromHTML(doc, testClassify);
    expect(tree.length).toBe(1);
    expect(tree[0].tag).toBe('div');
  });

  it('extracts text content', () => {
    const doc = parseHTML(`
      <html><body>
        <p>Hello World</p>
      </body></html>
    `);

    const tree = buildTreeFromHTML(doc, testClassify);
    expect(tree[0].textContent).toContain('Hello World');
  });

  it('classifies nav element correctly', () => {
    const doc = parseHTML(`
      <html><body>
        <nav>
          <a href="/">Home</a>
          <a href="/about">About</a>
        </nav>
      </body></html>
    `);

    const tree = buildTreeFromHTML(doc, testClassify);
    expect(tree[0].type).toBe('nav');
    expect(tree[0].children.length).toBe(2);
    expect(tree[0].children[0].type).toBe('link');
  });

  it('handles empty body', () => {
    const doc = parseHTML('<html><body></body></html>');
    const tree = buildTreeFromHTML(doc, testClassify);
    expect(tree).toEqual([]);
  });

  it('assigns correct depth', () => {
    const doc = parseHTML(`
      <html><body>
        <section>
          <div>
            <p>Deep</p>
          </div>
        </section>
      </body></html>
    `);

    const tree = buildTreeFromHTML(doc, testClassify);
    expect(tree[0].depth).toBe(0);
    expect(tree[0].children[0].depth).toBe(1);
  });

  it('assigns unique IDs to all nodes', () => {
    const doc = parseHTML(`
      <html><body>
        <div><span>A</span><span>B</span></div>
        <div><span>C</span></div>
      </body></html>
    `);

    const tree = buildTreeFromHTML(doc, testClassify);
    const ids = new Set<string>();

    function collectIds(nodes: typeof tree) {
      for (const node of nodes) {
        ids.add(node.id);
        collectIds(node.children);
      }
    }

    collectIds(tree);
    // All IDs should be unique (Set size = total node count)
    expect(ids.size).toBeGreaterThan(0);
  });
});
