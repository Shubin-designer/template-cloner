'use client';

import { useState } from 'react';
import type { ComponentNode } from '@/types/component-tree';
import type { ScrapeResult } from '@/types/clone';
import { ComponentTree } from './component-tree';
import { PreviewPanel } from './preview-panel';
import { StyleInspector } from './style-inspector';
import { ExportPanel } from './export-panel';

interface CloneResultsProps {
  data: ScrapeResult;
}

export function CloneResults({ data }: CloneResultsProps) {
  const [selectedNode, setSelectedNode] = useState<ComponentNode | null>(null);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Top info bar */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-2">
        <span className="text-sm font-medium">{data.metadata.title || 'Untitled'}</span>
        <span className="text-xs text-muted-foreground truncate">{data.url}</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {data.tree.length} top-level sections
        </span>
      </div>

      {/* Main split view */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Component tree + Style inspector + Export */}
        <div className="w-[350px] shrink-0 border-r border-border overflow-hidden flex flex-col">
          <div className="border-b border-border px-3 py-2">
            <h2 className="text-xs font-semibold uppercase text-muted-foreground">
              Component Tree
            </h2>
          </div>
          <div className="flex-1 overflow-hidden">
            <ComponentTree
              nodes={data.tree}
              selectedId={selectedNode?.id}
              onSelect={setSelectedNode}
            />
          </div>

          {/* Style inspector */}
          <div className="h-[200px] shrink-0 border-t border-border overflow-hidden">
            <div className="border-b border-border px-3 py-2">
              <h2 className="text-xs font-semibold uppercase text-muted-foreground">
                Style Inspector
              </h2>
            </div>
            <StyleInspector node={selectedNode} />
          </div>
        </div>

        {/* Center: Preview */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-hidden">
            <PreviewPanel screenshot={data.screenshot} html={data.html} url={data.url} />
          </div>

          {/* Bottom: Export panel */}
          <div className="shrink-0 border-t border-border p-3">
            <ExportPanel data={data} />
          </div>
        </div>
      </div>
    </div>
  );
}
