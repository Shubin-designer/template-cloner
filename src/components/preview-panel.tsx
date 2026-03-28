'use client';

import { useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PreviewPanelProps {
  screenshot: string;
  html: string;
  url: string;
}

/**
 * Inject a <base> tag so relative URLs (CSS, images, fonts) resolve
 * against the original site. Also remove any existing <base> tags.
 */
function prepareHtml(html: string, url: string): string {
  // Remove existing base tags
  let prepared = html.replace(/<base[^>]*>/gi, '');

  // Extract origin for base href
  let baseHref: string;
  try {
    const parsed = new URL(url);
    baseHref = parsed.origin + '/';
  } catch {
    baseHref = url;
  }

  // Inject <base> right after <head> (or at the beginning if no <head>)
  if (/<head[^>]*>/i.test(prepared)) {
    prepared = prepared.replace(
      /(<head[^>]*>)/i,
      `$1<base href="${baseHref}" />`
    );
  } else {
    prepared = `<base href="${baseHref}" />` + prepared;
  }

  return prepared;
}

export function PreviewPanel({ screenshot, html, url }: PreviewPanelProps) {
  const preparedHtml = useMemo(() => prepareHtml(html, url), [html, url]);

  return (
    <Tabs defaultValue="screenshot" className="flex h-full flex-col">
      <TabsList className="mx-3 mt-3 w-fit">
        <TabsTrigger value="screenshot">Screenshot</TabsTrigger>
        <TabsTrigger value="html">HTML Preview</TabsTrigger>
      </TabsList>

      <TabsContent value="screenshot" className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-3">
            {screenshot ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={`data:image/png;base64,${screenshot}`}
                alt="Website screenshot"
                className="w-full rounded-lg border border-border"
              />
            ) : (
              <div className="flex h-64 items-center justify-center text-muted-foreground">
                No screenshot available
              </div>
            )}
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="html" className="flex-1 overflow-hidden">
        <div className="h-full p-3">
          <iframe
            srcDoc={preparedHtml}
            sandbox="allow-same-origin allow-scripts"
            className="h-full w-full rounded-lg border border-border bg-white"
            title="HTML Preview"
          />
        </div>
      </TabsContent>
    </Tabs>
  );
}
