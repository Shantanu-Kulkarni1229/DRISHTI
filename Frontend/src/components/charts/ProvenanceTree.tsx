import { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ProvenanceNode {
  id: string;
  label: string;
  meta?: string;
  children?: ProvenanceNode[];
  defaultOpen?: boolean;
}

function Node({ node, depth }: { node: ProvenanceNode; depth: number }) {
  const [open, setOpen] = useState(node.defaultOpen ?? depth < 2);
  const hasChildren = !!node.children?.length;
  return (
    <div>
      <button
        onClick={() => hasChildren && setOpen((o) => !o)}
        className={cn('flex items-start gap-1 py-1 text-left w-full', hasChildren ? 'cursor-pointer' : 'cursor-default')}
        style={{ paddingLeft: depth * 16 }}
      >
        {hasChildren ? (
          open ? <ChevronDown size={12} className="mt-0.5 text-text-muted shrink-0" /> : <ChevronRight size={12} className="mt-0.5 text-text-muted shrink-0" />
        ) : (
          <span className="w-3 h-3 mt-1 shrink-0 flex items-center justify-center">
            <span className="w-1 h-1 rounded-full bg-text-faint" />
          </span>
        )}
        <span className="text-xs text-text-primary">{node.label}</span>
        {node.meta && <span className="mono text-[11px] text-text-muted ml-auto pl-2 shrink-0">{node.meta}</span>}
      </button>
      {hasChildren && open && (
        <div className="border-l border-border-subtle ml-1.5">
          {node.children!.map((c) => (
            <Node key={c.id} node={c} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ProvenanceTree({ root }: { root: ProvenanceNode }) {
  return (
    <div className="text-xs">
      <Node node={root} depth={0} />
    </div>
  );
}
