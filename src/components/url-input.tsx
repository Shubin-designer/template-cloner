'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { setCloneResult } from '@/lib/clone-store';

export function UrlInput() {
  const [url, setUrl] = useState('');
  const [figmaUrl, setFigmaUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const router = useRouter();

  // Check bridge status on mount and periodically
  useEffect(() => {
    checkBridge();
    const interval = setInterval(checkBridge, 10000);
    return () => clearInterval(interval);
  }, []);

  async function checkBridge() {
    try {
      const res = await fetch('/api/figma-bridge', { signal: AbortSignal.timeout(3000) });
      const data = await res.json();
      setBridgeStatus(data.pluginConnected ? 'connected' : 'disconnected');
    } catch {
      setBridgeStatus('disconnected');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || isLoading) return;

    setIsLoading(true);

    const sendToFigma = figmaUrl.trim().length > 0 && bridgeStatus === 'connected';

    toast.info('Cloning website...', {
      description: sendToFigma
        ? 'Scraping page and sending to Figma...'
        : 'This may take up to 30 seconds.',
    });

    try {
      // Step 1: Scrape the website
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

      // Store result in memory
      setCloneResult(data.id, data);

      // Step 2: Send to Figma if URL provided and bridge connected
      if (sendToFigma) {
        toast.info('Sending to Figma...', { description: 'Creating frames and layout...' });

        try {
          const figmaTree = data.figmaData?.tree || data.figmaData || data.tree;
          const payload = {
            figmaTree,
            pageInfo: {
              name: data.figmaData?.name || data.metadata.title || 'Cloned Page',
              width: data.figmaData?.width || 1440,
              height: data.figmaData?.height || 3000,
            },
            sourceUrl: data.url,
          };

          const figmaRes = await fetch('/api/figma-bridge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          const figmaResult = await figmaRes.json();

          if (figmaResult.error) {
            toast.error('Figma export failed', { description: figmaResult.error });
          } else {
            toast.success('Design created in Figma!', {
              description: `Created ${figmaResult.data?.createdNodeIds?.length || 0} frame(s).`,
            });
          }
        } catch (figmaErr) {
          toast.error('Figma export failed', {
            description: figmaErr instanceof Error ? figmaErr.message : 'Unknown error',
          });
        }
      } else {
        toast.success('Clone complete!');
      }

      router.push(`/clone/${data.id}`);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        toast.error('Timeout', { description: 'The request took too long.' });
      } else {
        toast.error('Network error', { description: 'Failed to connect to the server.' });
      }
      console.error('Scrape error:', error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-2xl flex-col gap-3">
      <div className="flex gap-3">
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
      </div>

      {/* Figma URL — optional */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Input
            type="text"
            placeholder="Figma page URL (optional) — auto-sends clone to Figma"
            value={figmaUrl}
            onChange={(e) => setFigmaUrl(e.target.value)}
            disabled={isLoading}
            className="h-10 text-sm pr-8"
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
            {bridgeStatus === 'connected' ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : bridgeStatus === 'disconnected' ? (
              <XCircle className="h-4 w-4 text-red-500" />
            ) : (
              <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground animate-spin" />
            )}
          </div>
        </div>
      </div>

      {bridgeStatus === 'disconnected' && figmaUrl.trim() && (
        <p className="text-xs text-red-400">
          Figma plugin not connected. Open the MCP Bridge plugin in Figma to enable auto-export.
        </p>
      )}
    </form>
  );
}
