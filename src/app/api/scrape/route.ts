import { NextRequest, NextResponse } from 'next/server';
import { validateUrl } from '@/lib/validation';
import { checkRateLimit } from '@/lib/rate-limit';
import { scrapePage } from '@/lib/scraper/playwright';

export const maxDuration = 60; // seconds (Vercel Pro)

export async function POST(request: NextRequest) {
  // Rate limiting
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  const rateCheck = checkRateLimit(ip);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(rateCheck.retryAfter) },
      }
    );
  }

  // Parse body
  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  // Validate URL
  const validation = validateUrl(body.url || '');
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error },
      { status: 400 }
    );
  }

  // Scrape
  try {
    const result = await scrapePage(validation.url);

    // Return without the full HTML to reduce response size
    // HTML is still available in the result for iframe preview
    return NextResponse.json({
      id: result.id,
      url: result.url,
      screenshot: result.screenshot,
      html: result.html,
      tree: result.tree,
      metadata: result.metadata,
      createdAt: result.createdAt,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to scrape the page';

    // Classify common errors
    if (message.includes('net::ERR_NAME_NOT_RESOLVED')) {
      return NextResponse.json(
        { error: 'Could not resolve the domain. Please check the URL.' },
        { status: 400 }
      );
    }

    if (message.includes('Timeout')) {
      return NextResponse.json(
        { error: 'The page took too long to load (30s timeout).' },
        { status: 504 }
      );
    }

    if (message.includes('net::ERR_CONNECTION_REFUSED')) {
      return NextResponse.json(
        { error: 'Connection refused by the server.' },
        { status: 502 }
      );
    }

    console.error('Scrape error:', error);
    return NextResponse.json(
      { error: 'Failed to scrape the page. Please try a different URL.' },
      { status: 500 }
    );
  }
}
