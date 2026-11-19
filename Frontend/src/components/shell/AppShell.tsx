import { Outlet } from 'react-router-dom';
import { TopBar } from './TopBar';
import { SideNav } from './SideNav';
import { ShortcutOverlay } from '../ui/ShortcutOverlay';

export function AppShell() {
  return (
    <div className="h-[100dvh] w-screen flex flex-col bg-bg-canvas text-text-primary overflow-hidden">
      <TopBar />
      <div className="flex flex-1 min-h-0">
        <SideNav />
        <main className="flex-1 min-w-0 overflow-y-auto pb-14 md:pb-0">
          <Outlet />
        </main>
      </div>
      <ShortcutOverlay />
    </div>
  );
}
