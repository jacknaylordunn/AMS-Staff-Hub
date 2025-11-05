import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
// Fix: `signOut` is a method on the auth object in v8, not a separate import.
import { auth } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import { useAppContext } from '../hooks/useAppContext';
import { useTheme } from '../hooks/useTheme';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { ProfileIcon, LogoutIcon, EventsIcon, SunIcon, MoonIcon, MenuIcon, BackIcon, WifiOfflineIcon } from './icons';

interface HeaderProps {
    onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { user } = useAuth();
  const { activeEvent, clearActiveEvent } = useAppContext();
  const { theme, toggleTheme } = useTheme();
  const { isOnline } = useOnlineStatus();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const pathSegments = location.pathname.split('/').filter(Boolean);
  const isSubPage = pathSegments.length > 1 && pathSegments[0] !== 'dashboard';


  const getPageTitle = () => {
    // Specific sub-page titles
    if (location.pathname.includes('/assets/vehicle/')) return 'Vehicle Details';
    if (location.pathname.includes('/patients/')) return 'Patient Details';

    const path = pathSegments[0];

    // Specific top-level page titles that differ from simple capitalization
    if (path === 'eprf') return 'Patient Report Form';
    if (path === 'reviews') return 'ePRF Reviews';
    if (path === 'reports') return 'Reporting';
    
    // Default/fallback title generation
    if (!path || path === 'dashboard') return 'Dashboard';
    return path.charAt(0).toUpperCase() + path.slice(1);
  };

  const handleLogout = async () => {
    try {
      // Fix: Use v8 `auth.signOut()` method
      await auth.signOut();
      clearActiveEvent();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out: ', error);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  const userFullName = user ? `${user.firstName} ${user.lastName}`.trim() : 'User';

  return (
    <header className="flex items-center justify-between h-20 px-4 sm:px-6 bg-white dark:bg-gray-800 border-b dark:border-gray-700 sticky top-0 z-30">
        <div className="flex items-center gap-2 sm:gap-4">
            <button onClick={onMenuClick} className="md:hidden p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="Open menu">
                <MenuIcon className="w-6 h-6" />
            </button>
            {isSubPage && (
                 <button onClick={() => navigate(-1)} className="p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="Go back">
                    <BackIcon className="w-6 h-6" />
                </button>
            )}
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-800 dark:text-gray-200">{getPageTitle()}</h1>
            {activeEvent && (
                <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full text-sm">
                    <EventsIcon className="w-4 h-4" />
                    <span>Logged On: <strong>{activeEvent.name}</strong></span>
                </div>
            )}
        </div>
      <div className="flex items-center gap-2 sm:gap-4">
          {!isOnline && (
            <div className="p-2 rounded-full text-red-500" title="Offline Mode: Changes are being saved locally.">
                <WifiOfflineIcon className="w-6 h-6" />
            </div>
          )}
          <button onClick={toggleTheme} className="p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700" aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>
            {theme === 'light' ? <MoonIcon className="w-6 h-6" /> : <SunIcon className="w-6 h-6" />}
          </button>
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="relative z-10 block h-10 w-10 overflow-hidden rounded-full shadow focus:outline-none"
          >
            <ProfileIcon className="w-full h-full object-cover text-gray-600 dark:text-gray-400" />
          </button>
          {dropdownOpen && (
            <div ref={dropdownRef} className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-700 rounded-md overflow-hidden shadow-xl z-20">
              <div className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
                <p className="font-semibold">{userFullName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
                <p className="text-xs text-ams-blue dark:text-ams-light-blue font-bold mt-1">{user?.role}</p>
              </div>
              <hr className="dark:border-gray-600" />
              <button
                onClick={() => {
                  navigate('/profile');
                  setDropdownOpen(false);
                }}
                className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-ams-light-blue hover:text-white dark:hover:bg-ams-light-blue"
              >
                <ProfileIcon className="w-4 h-4 mr-2" /> My Profile
              </button>
              <button
                onClick={handleLogout}
                className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-ams-light-blue hover:text-white dark:hover:bg-ams-light-blue"
              >
                <LogoutIcon className="w-4 h-4 mr-2" /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;