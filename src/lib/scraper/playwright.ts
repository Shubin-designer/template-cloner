import { chromium, type Browser, type Page } from 'playwright';
import type { ScrapeResult, PageMetadata } from '@/types/clone';
import { buildComponentTree } from '@/lib/parser/tree-builder';
import { v4 as uuidv4 } from 'uuid';

let browser: Browser | null = null;
let browserLastUsed = 0;
const BROWSER_IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

async function getBrowser(): Promise<Browser> {
  if (browser && browser.isConnected()) {
    browserLastUsed = Date.now();
    return browser;
  }

  browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  browserLastUsed = Date.now();

  // Auto-close after idle
  const checkIdle = setInterval(async () => {
    if (Date.now() - browserLastUsed > BROWSER_IDLE_TIMEOUT && browser) {
      await browser.close().catch(() => {});
      browser = null;
      clearInterval(checkIdle);
    }
  }, 60_000);

  return browser;
}

async function extractMetadata(page: Page): Promise<PageMetadata> {
  return page.evaluate(() => {
    const title = document.title || '';
    const descMeta = document.querySelector('meta[name="description"]');
    const description = descMeta?.getAttribute('content') || undefined;

    const faviconLink = document.querySelector(
      'link[rel="icon"], link[rel="shortcut icon"]'
    );
    const favicon = faviconLink?.getAttribute('href') || undefined;

    const ogImageMeta = document.querySelector('meta[property="og:image"]');
    const ogImage = ogImageMeta?.getAttribute('content') || undefined;

    // Extract fonts from loaded stylesheets
    const fonts: string[] = [];
    try {
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule instanceof CSSFontFaceRule) {
              const family = rule.style.getPropertyValue('font-family');
              if (family && !fonts.includes(family.replace(/['"]/g, ''))) {
                fonts.push(family.replace(/['"]/g, ''));
              }
            }
          }
        } catch {
          // Cross-origin stylesheet, skip
        }
      }
    } catch {
      // No stylesheets
    }

    // Extract CSS URLs
    const cssUrls: string[] = [];
    document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
      const href = link.getAttribute('href');
      if (href) cssUrls.push(href);
    });

    // Extract image URLs
    const imageUrls: string[] = [];
    document.querySelectorAll('img').forEach((img) => {
      const src = img.getAttribute('src');
      if (src) imageUrls.push(src);
    });

    return { title, description, favicon, ogImage, fonts, cssUrls, imageUrls };
  });
}

export async function scrapePage(url: string): Promise<ScrapeResult> {
  const instance = await getBrowser();
  const context = await instance.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  try {
    // Navigate with timeout
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30_000,
    });

    // Wait a bit for any lazy-loaded content
    await page.waitForTimeout(1000);

    // Extract data in parallel
    const [html, screenshotBuffer, metadata, tree] = await Promise.all([
      page.content(),
      page.screenshot({ fullPage: true, type: 'png' }),
      extractMetadata(page),
      buildComponentTree(page),
    ]);

    const screenshot = screenshotBuffer.toString('base64');

    return {
      id: uuidv4(),
      url,
      html,
      screenshot,
      tree,
      metadata,
      createdAt: new Date().toISOString(),
    };
  } finally {
    await context.close();
  }
}
