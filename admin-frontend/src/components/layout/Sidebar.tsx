/**
 * Sidebar Component
 * Navigation sidebar for the admin panel
 */

import { Link, useLocation } from 'react-router-dom';
import { 
  FiHome, 
  FiCalendar, 
  FiMapPin, 
  FiUsers, 
  FiSettings,
  FiMenu,
  FiCode,
} from 'react-icons/fi';

interface SidebarProps {
  isOpen?: boolean;
  onToggle?: () => void;
}

export function Sidebar({ isOpen = true, onToggle }: SidebarProps) {
  const location = useLocation();

  const menuItems = [
    { path: '/', label: 'Dashboard', icon: FiHome },
    { path: '/reservations', label: 'Reservations', icon: FiCalendar },
    { path: '/restaurants', label: 'Restaurants', icon: FiMapPin },
    { path: '/users', label: 'Users', icon: FiUsers },
    { path: '/settings', label: 'Settings', icon: FiSettings },
    { path: '/test', label: 'Test', icon: FiCode },
  ];

  const isActive = (path: string): boolean => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-gray-900 text-white transition-all duration-300 z-40 ${
        isOpen ? 'w-64' : 'w-20'
      }`}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          {isOpen && (
            <h1 className="text-xl font-bold text-white">SaveIt Admin</h1>
          )}
          <button
            onClick={onToggle}
            className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
            aria-label="Toggle sidebar"
          >
            <FiMenu className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);

              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      active
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {isOpen && <span className="font-medium">{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </aside>
  );
}

