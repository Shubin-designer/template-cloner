import { describe, it, expect } from 'vitest';
import { classifySection } from '@/lib/parser/section-classifier';

const defaults = {
  childCount: 0,
  hasImage: false,
  hasText: false,
  hasButton: false,
  hasInput: false,
  parentWidth: 1440,
  elementWidth: 1440,
};

describe('classifySection', () => {
  it('classifies <header> tag as header', () => {
    const result = classifySection({
      tag: 'header',
      depth: 0,
      isFirstLargeSection: false,
      ...defaults,
    });
    expect(result).toBe('header');
  });

  it('classifies <nav> tag as nav', () => {
    const result = classifySection({
      tag: 'nav',
      depth: 0,
      isFirstLargeSection: false,
      ...defaults,
    });
    expect(result).toBe('nav');
  });

  it('classifies <footer> tag as footer', () => {
    const result = classifySection({
      tag: 'footer',
      depth: 0,
      isFirstLargeSection: false,
      ...defaults,
    });
    expect(result).toBe('footer');
  });

  it('classifies <section> tag as section', () => {
    const result = classifySection({
      tag: 'section',
      depth: 0,
      isFirstLargeSection: false,
      ...defaults,
    });
    expect(result).toBe('section');
  });

  it('classifies <article> as card', () => {
    const result = classifySection({
      tag: 'article',
      depth: 2,
      isFirstLargeSection: false,
      ...defaults,
    });
    expect(result).toBe('card');
  });

  it('detects hero from class name', () => {
    const result = classifySection({
      tag: 'div',
      className: 'hero-section',
      depth: 1,
      isFirstLargeSection: false,
      ...defaults,
    });
    expect(result).toBe('hero');
  });

  it('detects nav from class name', () => {
    const result = classifySection({
      tag: 'div',
      className: 'navbar-container',
      depth: 1,
      isFirstLargeSection: false,
      ...defaults,
    });
    expect(result).toBe('nav');
  });

  it('detects card from class name', () => {
    const result = classifySection({
      tag: 'div',
      className: 'feature-card',
      depth: 2,
      isFirstLargeSection: false,
      ...defaults,
    });
    expect(result).toBe('card');
  });

  it('detects button from class name', () => {
    const result = classifySection({
      tag: 'div',
      className: 'btn-primary',
      depth: 3,
      isFirstLargeSection: false,
      ...defaults,
    });
    expect(result).toBe('button');
  });

  it('classifies first large section as hero', () => {
    const result = classifySection({
      tag: 'div',
      depth: 1,
      isFirstLargeSection: true,
      ...defaults,
    });
    expect(result).toBe('hero');
  });

  it('classifies shallow div as section', () => {
    const result = classifySection({
      tag: 'div',
      depth: 0,
      isFirstLargeSection: false,
      ...defaults,
    });
    expect(result).toBe('section');
  });

  it('classifies mid-depth div as block', () => {
    const result = classifySection({
      tag: 'div',
      depth: 2,
      isFirstLargeSection: false,
      ...defaults,
    });
    expect(result).toBe('block');
  });

  it('classifies deep div as element', () => {
    const result = classifySection({
      tag: 'div',
      depth: 5,
      isFirstLargeSection: false,
      ...defaults,
    });
    expect(result).toBe('element');
  });

  it('detects footer from id', () => {
    const result = classifySection({
      tag: 'div',
      id: 'footer',
      depth: 0,
      isFirstLargeSection: false,
      ...defaults,
    });
    expect(result).toBe('footer');
  });
});
