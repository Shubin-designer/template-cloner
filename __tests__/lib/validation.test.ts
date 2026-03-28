import { describe, it, expect } from 'vitest';
import { validateUrl } from '@/lib/validation';

describe('validateUrl', () => {
  it('accepts valid HTTPS URLs', () => {
    const result = validateUrl('https://example.com');
    expect(result.valid).toBe(true);
    expect(result.url).toBe('https://example.com/');
  });

  it('accepts valid HTTP URLs', () => {
    const result = validateUrl('http://example.com');
    expect(result.valid).toBe(true);
  });

  it('auto-adds https:// protocol when missing', () => {
    const result = validateUrl('example.com');
    expect(result.valid).toBe(true);
    expect(result.url).toContain('https://');
  });

  it('rejects empty input', () => {
    const result = validateUrl('');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('URL is required');
  });

  it('rejects URLs longer than 2048 chars', () => {
    const result = validateUrl('https://example.com/' + 'a'.repeat(2050));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('too long');
  });

  it('rejects localhost', () => {
    const result = validateUrl('http://localhost:3000');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Private/local');
  });

  it('rejects 127.0.0.1', () => {
    const result = validateUrl('http://127.0.0.1');
    expect(result.valid).toBe(false);
  });

  it('rejects 10.x private IP', () => {
    const result = validateUrl('http://10.0.0.1');
    expect(result.valid).toBe(false);
  });

  it('rejects 192.168.x private IP', () => {
    const result = validateUrl('http://192.168.1.1');
    expect(result.valid).toBe(false);
  });

  it('rejects 172.16-31.x private IP', () => {
    const result = validateUrl('http://172.16.0.1');
    expect(result.valid).toBe(false);
  });

  it('rejects invalid URL format', () => {
    const result = validateUrl('not a url at all !!!');
    expect(result.valid).toBe(false);
  });

  it('rejects ftp protocol', () => {
    const result = validateUrl('ftp://files.example.com');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('HTTP and HTTPS');
  });

  it('accepts URLs with paths and query params', () => {
    const result = validateUrl('https://example.com/page?q=test&lang=en');
    expect(result.valid).toBe(true);
  });

  it('trims whitespace', () => {
    const result = validateUrl('  https://example.com  ');
    expect(result.valid).toBe(true);
  });
});
