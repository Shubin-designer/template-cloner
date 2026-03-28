/**
 * Download images from URLs and convert to base64.
 * Used to embed images in the Figma design spec so the plugin
 * can create image fills without needing network access.
 */

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB per image
const FETCH_TIMEOUT = 10_000; // 10s per image
const MAX_CONCURRENT = 5;

export async function fetchImagesAsBase64(
  imageUrls: string[],
  baseUrl: string
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  const uniqueUrls = [...new Set(imageUrls)];

  // Process in batches
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

async function fetchSingleImage(
  url: string,
  baseUrl: string
): Promise<string | null> {
  try {
    // Resolve relative URLs
    let fullUrl = url;
    if (url.startsWith('//')) {
      fullUrl = 'https:' + url;
    } else if (url.startsWith('/')) {
      try {
        const base = new URL(baseUrl);
        fullUrl = base.origin + url;
      } catch {
        return null;
      }
    } else if (!url.startsWith('http')) {
      try {
        fullUrl = new URL(url, baseUrl).toString();
      } catch {
        return null;
      }
    }

    // Skip data URLs — they're already base64
    if (fullUrl.startsWith('data:image/')) {
      const commaIndex = fullUrl.indexOf(',');
      if (commaIndex > 0) {
        return fullUrl.substring(commaIndex + 1);
      }
      return null;
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
    if (buffer.byteLength > MAX_IMAGE_SIZE) return null;

    return Buffer.from(buffer).toString('base64');
  } catch {
    return null;
  }
}
