import { useEffect } from 'react';
import { Keyboard } from 'lucide-react';
import { useUiStore } from '../../state/uiStore';

export function ShortcutOverlay() {
  const open = useUiStore((s) => s.shortcutOverlayOpen);
  const hints = useUiStore((s) => s.activeShortcuts);
  const toggle = useUiStore((s) => s.toggleShortcutOverlay);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === '?') toggle(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, toggle]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => toggle(false)}>
      <div
        className="bg-bg-panel border border-border rounded-lg w-[380px] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border-subtle">
          <Keyboard size={15} className="text-accent-soft" />
          <h3 className="text-sm font-semibold">Keyboard shortcuts</h3>
        </div>
        <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
          {hints.length === 0 && <p className="text-xs text-text-muted">No shortcuts on this screen.</p>}
          {hints.map((h) => (
            <div key={h.keys} className="flex items-center justify-between text-xs">
              <span className="text-text-secondary">{h.label}</span>
              <kbd className="mono px-1.5 py-0.5 rounded bg-bg-raised border border-border text-text-primary text-[11px]">
                {h.keys}
              </kbd>
            </div>
          ))}
          <div className="flex items-center justify-between text-xs pt-2 mt-2 border-t border-border-subtle">
            <span className="text-text-secondary">Show this overlay</span>
            <kbd className="mono px-1.5 py-0.5 rounded bg-bg-raised border border-border text-text-primary text-[11px]">?</kbd>
          </div>
        </div>
      </div>
    </div>
  );
}
