'use client';

import type { ComponentNode } from '@/types/component-tree';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface StyleInspectorProps {
  node: ComponentNode | null;
}

export function StyleInspector({ node }: StyleInspectorProps) {
  if (!node) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Select a node to inspect its styles
      </div>
    );
  }

  const styles = node.styles;
  const entries = Object.entries(styles).filter(([, v]) => v);

  return (
    <ScrollArea className="h-full">
      <div className="space-y-3 p-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{node.type}</Badge>
          <span className="font-mono text-xs text-muted-foreground">
            &lt;{node.tag}&gt;
          </span>
        </div>

        {node.textContent && (
          <div className="text-xs text-muted-foreground">
            &quot;{node.textContent.slice(0, 100)}&quot;
          </div>
        )}

        {entries.length > 0 ? (
          <div className="space-y-1">
            {entries.map(([key, value]) => (
              <div key={key} className="flex items-center gap-2 text-xs">
                <span className="font-mono text-muted-foreground w-36 shrink-0">
                  {camelToKebab(key)}:
                </span>
                <div className="flex items-center gap-1.5">
                  {isColor(value) && (
                    <span
                      className="inline-block h-3 w-3 rounded-sm border border-border"
                      style={{ backgroundColor: value }}
                    />
                  )}
                  <span className="font-mono">{value}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No styles extracted</p>
        )}
      </div>
    </ScrollArea>
  );
}

function camelToKebab(str: string): string {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}

function isColor(value: string): boolean {
  return /^#[0-9a-f]{3,8}$/i.test(value) || /^rgb/i.test(value);
}
