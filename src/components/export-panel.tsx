'use client';

import { useState } from 'react';
import type { ScrapeResult } from '@/types/clone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FigmaInstructions } from './figma-instructions';
import { Palette, Copy, Download, Loader2, Code2 } from 'lucide-react';
import { toast } from 'sonner';
import type { FigmaDesignSpec } from '@/lib/export/figma-json';

interface ExportPanelProps {
  data: ScrapeResult;
}

export function ExportPanel({ data }: ExportPanelProps) {
  const [figmaSpec, setFigmaSpec] = useState<FigmaDesignSpec | null>(null);
  const [loading, setLoading] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  async function generateSpec() {
    if (figmaSpec) return figmaSpec;

    setLoading(true);
    try {
      const res = await fetch('/api/export/figma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tree: data.tree,
          metadata: data.metadata,
          url: data.url,
          createdAt: data.createdAt,
        }),
      });

      if (!res.ok) {
        toast.error('Failed to generate Figma spec');
        return null;
      }

      const spec = await res.json();
      setFigmaSpec(spec);
      return spec;
    } catch {
      toast.error('Network error');
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    const spec = await generateSpec();
    if (!spec) return;

    await navigator.clipboard.writeText(JSON.stringify(spec, null, 2));
    toast.success('JSON copied to clipboard');
  }

  async function handleDownload() {
    const spec = await generateSpec();
    if (!spec) return;

    const blob = new Blob([JSON.stringify(spec, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sitecloner-figma-${data.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('JSON downloaded');
  }

  async function handleInstructions() {
    await generateSpec();
    setShowInstructions(true);
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
            </CardTitle>
            <CardDescription className="text-xs">
              Generate a design spec for Claude Code + Figma MCP
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
              <span className="ml-1.5">Copy JSON</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              <span className="ml-1.5">Download JSON</span>
            </Button>
            <Button
              size="sm"
              onClick={handleInstructions}
              disabled={loading}
            >
              <Palette className="h-3.5 w-3.5" />
              <span className="ml-1.5">View Instructions</span>
            </Button>
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

      <FigmaInstructions
        open={showInstructions}
        onOpenChange={setShowInstructions}
        url={data.url}
      />
    </>
  );
}
