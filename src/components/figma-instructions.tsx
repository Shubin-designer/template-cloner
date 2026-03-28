'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';

interface FigmaInstructionsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
}

const PROMPT_TEMPLATE = `I have a JSON design spec exported from SiteCloner for the website: {URL}

The JSON file is attached / pasted below. Please create a Figma design based on this spec:

1. Create a new Figma page with the specified dimensions
2. For each frame in the spec, create a Figma frame with:
   - Exact position (x, y) and size (width, height)
   - Auto Layout where layoutMode is specified
   - Fill colors from the "fills" property
   - Corner radius and strokes where specified
3. For TEXT nodes, create text layers with the specified font, size, weight, and color
4. Apply the design tokens (colors, typography, spacing) as Figma styles
5. Name each frame according to the "name" property

Use the Figma MCP tools to read and verify the result after creation.`;

export function FigmaInstructions({ open, onOpenChange, url }: FigmaInstructionsProps) {
  const prompt = PROMPT_TEMPLATE.replace('{URL}', url);

  function copyPrompt() {
    navigator.clipboard.writeText(prompt);
    toast.success('Prompt copied to clipboard');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Export to Figma</DialogTitle>
          <DialogDescription>
            Follow these steps to create a Figma design from your clone
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="space-y-3">
            <Step n={1}>
              <strong>Download the JSON</strong> using the &quot;Download JSON&quot; button
              or copy it to clipboard.
            </Step>
            <Step n={2}>
              Open <strong>Claude Code</strong> with Figma MCP configured.
              Make sure the Figma MCP server is connected.
            </Step>
            <Step n={3}>
              Paste the prompt below along with the JSON data.
              Claude will use the Figma Plugin API to create frames,
              apply styles, and build the layout.
            </Step>
            <Step n={4}>
              Review and edit the design in Figma.
              When ready, use &quot;Generate Code&quot; to export to your framework.
            </Step>
          </div>

          <div className="relative">
            <pre className="rounded-lg border border-border bg-muted/50 p-3 text-xs leading-relaxed whitespace-pre-wrap max-h-48 overflow-auto">
              {prompt}
            </pre>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 h-7 w-7"
              onClick={copyPrompt}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
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
