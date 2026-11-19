import { create } from 'zustand';

interface OfflineState {
  blockedCalls: number;
  lastBlockedUrl: string | null;
  registerBlocked: (url: string) => void;
}

export const useOfflineStore = create<OfflineState>((set) => ({
  blockedCalls: 0,
  lastBlockedUrl: null,
  registerBlocked: (url) => set((s) => ({ blockedCalls: s.blockedCalls + 1, lastBlockedUrl: url })),
}));

// Installed once at app start. The prototype never needs the network — every
// screen runs off the in-memory mock dataset — so we prove it live instead of
// just asserting it: any attempted fetch/XHR to a non-local origin is caught,
// counted, and rejected before it leaves the browser. See spec §10.
export function installOfflineGuard() {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
    if (isExternal(url)) {
      useOfflineStore.getState().registerBlocked(url);
      throw new Error(`Blocked outbound call in offline mode: ${url}`);
    }
    return originalFetch(input, init);
  };

  const OriginalXHR = window.XMLHttpRequest;
  class GuardedXHR extends OriginalXHR {
    open(method: string, url: string | URL, ...rest: unknown[]) {
      const href = typeof url === 'string' ? url : url.href;
      if (isExternal(href)) {
        useOfflineStore.getState().registerBlocked(href);
        throw new Error(`Blocked outbound call in offline mode: ${href}`);
      }
      // @ts-expect-error - forwarding variadic args to the native implementation
      return super.open(method, url, ...rest);
    }
  }
  window.XMLHttpRequest = GuardedXHR as unknown as typeof XMLHttpRequest;
}

function isExternal(url: string): boolean {
  try {
    const u = new URL(url, window.location.href);
    return u.origin !== window.location.origin;
  } catch {
    return false;
  }
}
