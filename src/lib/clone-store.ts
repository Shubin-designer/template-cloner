import type { ScrapeResult } from '@/types/clone';

/**
 * In-memory store for clone results.
 * sessionStorage has a ~5MB limit which is easily exceeded by base64 screenshots.
 * This store lives in the client-side JS bundle and persists across navigation.
 */
const store = new Map<string, ScrapeResult>();

export function setCloneResult(id: string, data: ScrapeResult) {
  store.set(id, data);
}

export function getCloneResult(id: string): ScrapeResult | undefined {
  return store.get(id);
}

export function deleteCloneResult(id: string) {
  store.delete(id);
}
