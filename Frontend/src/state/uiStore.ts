import { create } from 'zustand';

export interface ShortcutHint {
  keys: string;
  label: string;
}

interface UiState {
  shortcutOverlayOpen: boolean;
  activeShortcuts: ShortcutHint[];
  toggleShortcutOverlay: (open?: boolean) => void;
  setActiveShortcuts: (hints: ShortcutHint[]) => void;
}

export const useUiStore = create<UiState>((set) => ({
  shortcutOverlayOpen: false,
  activeShortcuts: [],
  toggleShortcutOverlay: (open) => set((s) => ({ shortcutOverlayOpen: open ?? !s.shortcutOverlayOpen })),
  setActiveShortcuts: (hints) => set({ activeShortcuts: hints }),
}));
