import { NavLink } from 'react-router-dom';
import {
  Search,
  GitCompareArrows,
  History,
  Sparkles,
  ListChecks,
  FileSearch,
  Database,
  BarChart3,
  FileOutput,
  HelpCircle,
} from 'lucide-react';
import { useUiStore } from '../../state/uiStore';
import { cn } from '../../lib/utils';

const ITEMS = [
  { to: '/search', label: 'Search', icon: Search },
  { to: '/change', label: 'Change', icon: GitCompareArrows },
  { to: '/timeline', label: 'Timeline', icon: History },
  { to: '/discovery', label: 'Discovery', icon: Sparkles },
  { to: '/review', label: 'Review', icon: ListChecks },
  { to: '/evidence', label: 'Evidence', icon: FileSearch },
  { to: '/data', label: 'Data', icon: Database },
  { to: '/evaluation', label: 'Eval', icon: BarChart3 },
  { to: '/export', label: 'Export', icon: FileOutput },
];

export function SideNav() {
  const toggleShortcuts = useUiStore((s) => s.toggleShortcutOverlay);

  return (
    <>
      {/* Desktop / tablet: left rail */}
      <nav className="hidden md:flex w-16 shrink-0 border-r border-border-subtle bg-bg-base flex-col items-center py-3 gap-1 overflow-y-auto">
        {ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'w-12 h-12 flex flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] font-medium transition-colors shrink-0',
                isActive ? 'bg-accent/15 text-accent-soft' : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover'
              )
            }
          >
            <item.icon size={16} strokeWidth={2} />
            {item.label}
          </NavLink>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => toggleShortcuts(true)}
          className="w-12 h-12 flex flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] font-medium text-text-faint hover:text-text-secondary hover:bg-bg-hover shrink-0"
          title="Keyboard shortcuts (?)"
        >
          <HelpCircle size={16} />
          Help
        </button>
      </nav>

      {/* Phones: scrollable bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 h-14 bg-bg-base/95 backdrop-blur border-t border-border-subtle flex items-stretch overflow-x-auto">
        {ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex-1 min-w-[60px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
                isActive ? 'text-accent-soft border-t-2 border-accent' : 'text-text-muted border-t-2 border-transparent'
              )
            }
          >
            <item.icon size={17} strokeWidth={2} />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
