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
      className={`flex-1 transition-all duration-300 ${
        sidebarOpen ? 'ml-64' : 'ml-20'
      }`}
    >
      <div className="p-6">
        <Outlet />
      </div>
    </main>
  );
}

