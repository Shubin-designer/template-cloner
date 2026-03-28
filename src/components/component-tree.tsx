'use client';

import { useState } from 'react';
import type { ComponentNode } from '@/types/component-tree';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ComponentTreeProps {
  nodes: ComponentNode[];
  selectedId?: string;
  onSelect?: (node: ComponentNode) => void;
}

export function ComponentTree({ nodes, selectedId, onSelect }: ComponentTreeProps) {
  return (
    <ScrollArea className="h-full">
      <div className="p-3">
        {nodes.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

interface TreeNodeProps {
  node: ComponentNode;
  selectedId?: string;
  onSelect?: (node: ComponentNode) => void;
}

const TYPE_COLORS: Record<string, string> = {
  header: 'bg-blue-500/20 text-blue-400',
  nav: 'bg-blue-500/20 text-blue-400',
  hero: 'bg-purple-500/20 text-purple-400',
  section: 'bg-green-500/20 text-green-400',
  block: 'bg-yellow-500/20 text-yellow-400',
  card: 'bg-orange-500/20 text-orange-400',
  footer: 'bg-gray-500/20 text-gray-400',
  button: 'bg-pink-500/20 text-pink-400',
  image: 'bg-cyan-500/20 text-cyan-400',
  form: 'bg-red-500/20 text-red-400',
  text: 'bg-emerald-500/20 text-emerald-400',
  link: 'bg-indigo-500/20 text-indigo-400',
  element: 'bg-gray-500/20 text-gray-400',
};

function TreeNode({ node, selectedId, onSelect }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(node.depth < 2);
  const hasChildren = node.children.length > 0;
  const isSelected = node.id === selectedId;

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1.5 rounded-md px-2 py-1 text-sm cursor-pointer hover:bg-accent/50 transition-colors',
          isSelected && 'bg-accent'
        )}
        style={{ paddingLeft: `${node.depth * 16 + 8}px` }}
        onClick={() => {
          if (hasChildren) setExpanded(!expanded);
          onSelect?.(node);
        }}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )
        ) : (
          <span className="w-3.5 shrink-0" />
        )}

        <Badge
          variant="secondary"
          className={cn(
            'h-5 px-1.5 text-[10px] font-medium',
            TYPE_COLORS[node.type] || TYPE_COLORS.element
          )}
        >
          {node.type}
        </Badge>

        <span className="truncate text-muted-foreground font-mono text-xs">
          &lt;{node.tag}&gt;
        </span>

        {node.textContent && (
          <span className="truncate text-xs text-muted-foreground/60 ml-1">
            {node.textContent.slice(0, 40)}
          </span>
        )}
      </div>

      {expanded &&
        hasChildren &&
        node.children.map((child) => (
          <TreeNode
            key={child.id}
            node={child}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ))}
    </div>
  );
}
