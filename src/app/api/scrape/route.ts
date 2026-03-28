import { NextRequest, NextResponse } from 'next/server';
import { validateUrl } from '@/lib/validation';
import { checkRateLimit } from '@/lib/rate-limit';
import { scrapePage } from '@/lib/scraper/playwright';
import { createClient } from '@/lib/supabase/server';

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

    // Try to persist if user is authenticated
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let savedId = result.id;

    if (user) {
      try {
        // Upload screenshot to Storage
        const screenshotBuffer = Buffer.from(result.screenshot, 'base64');
        const screenshotPath = `${user.id}/${result.id}.png`;

        await supabase.storage
          .from('screenshots')
          .upload(screenshotPath, screenshotBuffer, {
            contentType: 'image/png',
            upsert: false,
          });

        // Upload HTML to Storage
        const htmlPath = `${user.id}/${result.id}.html`;
        await supabase.storage
          .from('html-dumps')
          .upload(htmlPath, result.html, {
            contentType: 'text/html',
            upsert: false,
          });

        // Save clone record
        const { data: clone, error: insertError } = await supabase
          .from('clones')
          .insert({
            user_id: user.id,
            url: result.url,
            title: result.metadata.title || 'Untitled',
            screenshot_path: screenshotPath,
            component_tree: result.tree,
            metadata: result.metadata,
          })
          .select('id')
          .single();

        if (!insertError && clone) {
          savedId = clone.id;
        }
      } catch (saveError) {
        // Don't fail the request if save fails — still return the scrape data
        console.error('Failed to save clone:', saveError);
      }
    }

    return NextResponse.json({
      id: savedId,
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
