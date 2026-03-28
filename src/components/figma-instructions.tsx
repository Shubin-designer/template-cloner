'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface FigmaInstructionsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
}

export function FigmaInstructions({ open, onOpenChange }: FigmaInstructionsProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Figma Bridge Setup</DialogTitle>
          <DialogDescription>
            One-time setup to enable direct export to Figma
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="space-y-3">
            <Step n={1}>
              <strong>Build the bridge server</strong>: open a terminal in{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">figma-mcp-bridge-main/server</code>{' '}
              and run <code className="rounded bg-muted px-1 py-0.5 text-xs">npm install && npm run build</code>,{' '}
              then <code className="rounded bg-muted px-1 py-0.5 text-xs">node dist/index.js</code>
            </Step>
            <Step n={2}>
              <strong>Build the Figma plugin</strong>: in{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">figma-mcp-bridge-main/plugin</code>{' '}
              run <code className="rounded bg-muted px-1 py-0.5 text-xs">npm install && npm run build</code>
            </Step>
            <Step n={3}>
              <strong>Install plugin in Figma</strong>: In Figma, go to{' '}
              <em>Plugins &rarr; Development &rarr; Import plugin from manifest</em>,{' '}
              select <code className="rounded bg-muted px-1 py-0.5 text-xs">plugin/manifest.json</code>
            </Step>
            <Step n={4}>
              <strong>Run the plugin</strong>: Open your Figma file, run the MCP Bridge plugin.
              It should show &quot;Connected&quot; status.
            </Step>
            <Step n={5}>
              <strong>Click &quot;Send to Figma&quot;</strong> in SiteCloner — the design will be
              created directly in your open Figma file.
            </Step>
          </div>

          <div className="rounded-lg border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
            The bridge runs on <strong>localhost:1994</strong>. The green indicator next to
            &quot;Export to Figma&quot; shows the connection status. Keep the plugin running
            in Figma while exporting.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
        {n}
      </span>
      <p className="text-muted-foreground pt-0.5">{children}</p>
    </div>
  );
}
