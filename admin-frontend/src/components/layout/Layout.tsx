/**
 * Layout Component
 * Main layout wrapper with Sidebar and MainContent
 */

import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { MainContent } from './MainContent';

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const toggleSidebar = () => {
    setSidebarOpen((prev) => !prev);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />
      <MainContent sidebarOpen={sidebarOpen} />
    </div>
  );
}

