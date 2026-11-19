import { useEffect, useRef } from 'react';
import { useUiStore, type ShortcutHint } from '../state/uiStore';

type Handler = (e: KeyboardEvent) => void;

// Registers page-local keyboard shortcuts and publishes them to the global
// "?" overlay (spec §7's shortcut legend) while the page is mounted. Bindings
// are read from a ref on every keystroke so callers can pass a fresh closure
// each render without re-attaching the listener or going stale.
export function useShortcuts(bindings: Record<string, Handler>, hints: ShortcutHint[], enabled = true) {
  const setActiveShortcuts = useUiStore((s) => s.setActiveShortcuts);
  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;

  useEffect(() => {
    if (!enabled) return;
    setActiveShortcuts(hints);
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      // only skip fields you actually type into — a ticked checkbox or slider must not disable shortcuts
      const typing =
        !!target &&
        (target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable ||
          (target.tagName === 'INPUT' && !['checkbox', 'radio', 'range', 'button'].includes((target as HTMLInputElement).type)));
      if (typing) return;
      if (e.key === '?' && !useUiStore.getState().shortcutOverlayOpen) {
        useUiStore.getState().toggleShortcutOverlay(true);
        return;
      }
      const handler = bindingsRef.current[e.key.toLowerCase()] ?? bindingsRef.current[e.key];
      if (handler) {
        e.preventDefault();
        handler(e);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      setActiveShortcuts([]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, JSON.stringify(hints)]);
}
