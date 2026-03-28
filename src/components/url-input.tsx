'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { setCloneResult } from '@/lib/clone-store';

export function UrlInput() {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || isLoading) return;

    setIsLoading(true);
    toast.info('Cloning website...', { description: 'This may take up to 30 seconds.' });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60_000);

      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        toast.error('Clone failed', { description: data.error });
        return;
      }

      // Store result in memory for the results page
      setCloneResult(data.id, data);
      toast.success('Clone complete!');
      router.push(`/clone/${data.id}`);
    } catch (error) {
      toast.error('Network error', {
        description: 'Failed to connect to the server.',
      });
      console.error('Scrape error:', error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-2xl gap-3">
      <Input
        type="text"
        placeholder="https://example.com"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        disabled={isLoading}
        className="h-12 text-base"
        autoFocus
      />
      <Button type="submit" size="lg" disabled={isLoading || !url.trim()} className="h-12 px-6">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Search className="h-4 w-4" />
        )}
        <span className="ml-2">{isLoading ? 'Cloning...' : 'Clone'}</span>
      </Button>
    </form>
  );
}
