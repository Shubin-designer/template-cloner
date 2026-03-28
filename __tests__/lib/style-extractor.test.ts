import { describe, it, expect } from 'vitest';
import { rgbToHex, cleanStyles } from '@/lib/parser/style-extractor';

describe('rgbToHex', () => {
  it('converts rgb() to hex', () => {
    expect(rgbToHex('rgb(255, 0, 0)')).toBe('#ff0000');
  });

  it('converts rgb with spaces', () => {
    expect(rgbToHex('rgb( 0 , 128 , 255 )')).toBe('#0080ff');
  });

  it('converts rgba() to hex (ignores alpha)', () => {
    expect(rgbToHex('rgba(0, 0, 0, 0.5)')).toBe('#000000');
  });

  it('returns empty string for transparent', () => {
    expect(rgbToHex('transparent')).toBe('');
  });

  it('returns empty string for empty input', () => {
    expect(rgbToHex('')).toBe('');
  });

  it('returns hex value unchanged', () => {
    expect(rgbToHex('#ff0000')).toBe('#ff0000');
  });

  it('handles white correctly', () => {
    expect(rgbToHex('rgb(255, 255, 255)')).toBe('#ffffff');
  });

  it('handles black correctly', () => {
    expect(rgbToHex('rgb(0, 0, 0)')).toBe('#000000');
  });
});

describe('cleanStyles', () => {
  it('removes empty values', () => {
    const result = cleanStyles({ display: '', color: '#000' });
    expect(result).not.toHaveProperty('display');
    expect(result).toHaveProperty('color', '#000');
  });

  it('removes default display: block', () => {
    const result = cleanStyles({ display: 'block' });
    expect(result).not.toHaveProperty('display');
  });

  it('keeps display: flex', () => {
    const result = cleanStyles({ display: 'flex' });
    expect(result).toHaveProperty('display', 'flex');
  });

  it('removes static position', () => {
    const result = cleanStyles({ position: 'static' });
    expect(result).not.toHaveProperty('position');
  });

  it('keeps fixed position', () => {
    const result = cleanStyles({ position: 'fixed' });
    expect(result).toHaveProperty('position', 'fixed');
  });

  it('removes opacity: 1', () => {
    const result = cleanStyles({ opacity: '1' });
    expect(result).not.toHaveProperty('opacity');
  });

  it('converts rgb colors to hex', () => {
    const result = cleanStyles({
      backgroundColor: 'rgb(255, 0, 0)',
      color: 'rgb(0, 0, 255)',
    });
    expect(result.backgroundColor).toBe('#ff0000');
    expect(result.color).toBe('#0000ff');
  });

  it('skips transparent background', () => {
    const result = cleanStyles({
      backgroundColor: 'rgba(0, 0, 0, 0)',
    });
    expect(result).not.toHaveProperty('backgroundColor');
  });

  it('removes default fontWeight 400', () => {
    const result = cleanStyles({ fontWeight: '400' });
    expect(result).not.toHaveProperty('fontWeight');
  });

  it('keeps fontWeight 700', () => {
    const result = cleanStyles({ fontWeight: '700' });
    expect(result).toHaveProperty('fontWeight', '700');
  });
});
