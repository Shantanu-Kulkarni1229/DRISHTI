import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { useOfflineStore } from '../../state/offlineStore';

export function OfflineBadge() {
  const blocked = useOfflineStore((s) => s.blockedCalls);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (blocked === 0) return;
    setPulse(true);
    const t = window.setTimeout(() => setPulse(false), 900);
    return () => window.clearTimeout(t);
  }, [blocked]);

  return (
    <div
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
        blocked > 0 ? 'border-status-warn/50 bg-status-warn/10 text-status-warn' : 'border-status-good/40 bg-status-good/10 text-status-good'
      }`}
      title="Every screen in this prototype runs off the local dataset — no network calls leave the browser."
    >
      <WifiOff size={12} className={pulse ? 'animate-pulse-soft' : ''} />
      <span>offline</span>
      <span className="mono text-text-muted">·</span>
      <span className="mono">{blocked} blocked call{blocked === 1 ? '' : 's'}</span>
    </div>
  );
}
