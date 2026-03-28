/**
 * Download images from URLs and convert to base64 PNG.
 * AVIF/WebP are converted to PNG via Playwright browser canvas.
 * SVGs are kept as-is (plugin handles them via createNodeFromSvg).
 */

import { chromium, type Browser } from 'playwright';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const FETCH_TIMEOUT = 10_000;
const MAX_CONCURRENT = 5;

let converterBrowser: Browser | null = null;

async function getConverterBrowser(): Promise<Browser> {
  if (!converterBrowser || !converterBrowser.isConnected()) {
    converterBrowser = await chromium.launch({ headless: true });
  }
  return converterBrowser;
}

export async function fetchImagesAsBase64(
  imageUrls: string[],
  baseUrl: string
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  const uniqueUrls = [...new Set(imageUrls)];

  for (let i = 0; i < uniqueUrls.length; i += MAX_CONCURRENT) {
    const batch = uniqueUrls.slice(i, i + MAX_CONCURRENT);
    const promises = batch.map((url) => fetchSingleImage(url, baseUrl));
    const batchResults = await Promise.allSettled(promises);

    batchResults.forEach((result, idx) => {
      if (result.status === 'fulfilled' && result.value) {
        results.set(batch[idx], result.value);
      }
    });
  }

  return results;
}

function resolveUrl(url: string, baseUrl: string): string | null {
  if (url.startsWith('data:image/')) return url;
  if (url.startsWith('//')) return 'https:' + url;
  if (url.startsWith('http')) return url;
  if (url.startsWith('/')) {
    try { return new URL(url, baseUrl).toString(); } catch { return null; }
  }
  try { return new URL(url, baseUrl).toString(); } catch { return null; }
}

async function fetchSingleImage(
  url: string,
  baseUrl: string
): Promise<string | null> {
  try {
    const fullUrl = resolveUrl(url, baseUrl);
    if (!fullUrl) return null;

    // Data URLs
    if (fullUrl.startsWith('data:image/')) {
      const commaIndex = fullUrl.indexOf(',');
      return commaIndex > 0 ? fullUrl.substring(commaIndex + 1) : null;
    }

    const response = await fetch(fullUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });

    if (!response.ok) return null;

    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_IMAGE_SIZE) return null;

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_IMAGE_SIZE || buffer.byteLength < 100) return null;

    const contentType = response.headers.get('content-type') || '';

    // SVG: keep as-is
    if (contentType.includes('svg') || fullUrl.endsWith('.svg')) {
      return Buffer.from(buffer).toString('base64');
    }

    // PNG/JPG/GIF: Figma supports natively
    if (contentType.includes('png') || contentType.includes('jpeg') ||
        contentType.includes('jpg') || contentType.includes('gif')) {
      return Buffer.from(buffer).toString('base64');
    }

    // AVIF/WebP/other: convert to PNG via browser canvas
    return await convertToPngViaCanvas(fullUrl);
  } catch {
    return null;
  }
}

/**
 * Convert any browser-supported image format to PNG using Playwright.
 * Works for AVIF, WebP, and any format Chrome can render.
 */
async function convertToPngViaCanvas(imageUrl: string): Promise<string | null> {
  try {
    const browser = await getConverterBrowser();
    const page = await browser.newPage();

    try {
      const pngBase64 = await page.evaluate(async (url: string) => {
        return new Promise<string | null>((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) { resolve(null); return; }
            ctx.drawImage(img, 0, 0);
            const dataUrl = canvas.toDataURL('image/png');
            const base64 = dataUrl.split(',')[1];
            resolve(base64);
          };
          img.onerror = () => resolve(null);
          // 5 second timeout
          setTimeout(() => resolve(null), 5000);
          img.src = url;
        });
      }, imageUrl);

      return pngBase64;
    } finally {
      await page.close();
    }
  } catch {
    return null;
  }
}
