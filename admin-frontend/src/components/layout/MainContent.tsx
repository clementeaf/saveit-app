/**
 * MainContent Component
 * Container for route views
 */

import { Outlet } from 'react-router-dom';

interface MainContentProps {
  sidebarOpen?: boolean;
}

export function MainContent({ sidebarOpen = true }: MainContentProps) {
  return (
    <main
      className={`flex-1 transition-all duration-300 h-screen overflow-hidden ${
        sidebarOpen ? 'ml-64' : 'ml-20'
      }`}
    >
      <div className="h-full p-6 overflow-y-auto">
        <Outlet />
      </div>
    </main>
  );
}

