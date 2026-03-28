'use client';

import { useMemo, useState } from 'react';
import type { ScrapeResult } from '@/types/clone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FigmaInstructions } from './figma-instructions';
import { Palette, Copy, Download, Code2, Send, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { generateFigmaDesignSpec } from '@/lib/export/figma-json';

const BRIDGE_URL = 'http://localhost:1994';

interface ExportPanelProps {
  data: ScrapeResult;
}

export function ExportPanel({ data }: ExportPanelProps) {
  const [sending, setSending] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown');

  const figmaSpec = useMemo(
    () => generateFigmaDesignSpec(data.tree, data.metadata, data.url, data.createdAt),
    [data]
  );

  const specJson = useMemo(() => JSON.stringify(figmaSpec, null, 2), [figmaSpec]);

  async function checkBridge(): Promise<boolean> {
    try {
      const res = await fetch(`${BRIDGE_URL}/ping`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        setBridgeStatus('connected');
        return true;
      }
    } catch {
      // bridge not running
    }
    setBridgeStatus('disconnected');
    return false;
  }

  async function handleSendToFigma() {
    setSending(true);

    const alive = await checkBridge();
    if (!alive) {
      toast.error('Figma Bridge not running', {
        description: 'Start the Figma MCP Bridge plugin and server first.',
      });
      setSending(false);
      return;
    }

    try {
      const res = await fetch(`${BRIDGE_URL}/api/create-design`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(figmaSpec),
      });

      const result = await res.json();

      if (result.error) {
        toast.error('Failed to create design', { description: result.error });
      } else {
        toast.success('Design created in Figma!', {
          description: `Created ${result.data?.createdNodeIds?.length || 0} frame(s). Check your Figma file.`,
        });
      }
    } catch (error) {
      toast.error('Connection error', {
        description: 'Could not reach the Figma Bridge server.',
      });
      console.error('Send to Figma error:', error);
    } finally {
      setSending(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(specJson).then(
      () => toast.success('JSON copied to clipboard'),
      () => {
        const textarea = document.createElement('textarea');
        textarea.value = specJson;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        toast.success('JSON copied to clipboard');
      }
    );
  }

  function handleDownload() {
    const blob = new Blob([specJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sitecloner-figma-${data.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('JSON downloaded');
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Figma Export */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Palette className="h-4 w-4" />
              Export to Figma
              {bridgeStatus === 'connected' && <CheckCircle className="h-3.5 w-3.5 text-green-500" />}
              {bridgeStatus === 'disconnected' && <XCircle className="h-3.5 w-3.5 text-red-500" />}
            </CardTitle>
            <CardDescription className="text-xs">
              Send directly to Figma via MCP Bridge
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button
              size="sm"
              onClick={handleSendToFigma}
              disabled={sending}
            >
              {sending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              <span className="ml-1.5">{sending ? 'Sending...' : 'Send to Figma'}</span>
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={handleCopy}>
                <Copy className="h-3.5 w-3.5" />
                <span className="ml-1.5">Copy JSON</span>
              </Button>
              <Button variant="outline" size="sm" className="flex-1" onClick={handleDownload}>
                <Download className="h-3.5 w-3.5" />
                <span className="ml-1.5">Download</span>
              </Button>
            </div>
            <FigmaInstructionsButton url={data.url} />
          </CardContent>
        </Card>

        {/* Code Generation (coming in v0.5) */}
        <Card className="opacity-60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Code2 className="h-4 w-4" />
              Generate Code
            </CardTitle>
            <CardDescription className="text-xs">
              Export to React, Next.js, or Astro (coming soon)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" disabled>
              <Code2 className="h-3.5 w-3.5" />
              <span className="ml-1.5">Coming in v0.5</span>
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function FigmaInstructionsButton({ url }: { url: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Palette className="h-3.5 w-3.5" />
        <span className="ml-1.5">Setup Instructions</span>
      </Button>
      <FigmaInstructions open={open} onOpenChange={setOpen} url={url} />
    </>
  );
}
