import React, { useState, useRef, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
// FIX: The error indicates signOut is not exported. Using namespace import `* as firebaseAuth` from 'firebase/auth' to fix module resolution issues.
import * as firebaseAuth from 'firebase/auth';
import { auth } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import { useAppContext } from '../hooks/useAppContext';
import { useTheme } from '../hooks/useTheme';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { ProfileIcon, LogoutIcon, EventsIcon, SunIcon, MoonIcon, MenuIcon, BackIcon, WifiOfflineIcon, BellIcon } from './icons';
import EPRFTabs from './EPRFTabs';
import type { Notification } from '../types';
import { listenToNotificationsForUser, markNotificationAsRead } from '../services/notificationService';
import NotificationPanel from './NotificationPanel';

interface HeaderProps {
    onMenuClick: () => void;
    isVisible: boolean;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick, isVisible }) => {
  const { user } = useAuth();
  const { activeEvent, activeShift, clearActiveSession } = useAppContext();
  const { theme, toggleTheme } = useTheme();
  const { isOnline } = useOnlineStatus();
  const navigate = ReactRouterDOM.useNavigate();
  const location = ReactRouterDOM.useLocation();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user?.uid) {
      const unsubscribe = listenToNotificationsForUser(user.uid, (newNotifications) => {
        setNotifications(newNotifications);
      });
      return () => unsubscribe();
    }
  }, [user]);

  const pathSegments = location.pathname.split('/').filter(Boolean);
  const isSubPage = pathSegments.length > 1 && pathSegments[0] !== 'dashboard';
  const isEPRFPage = pathSegments[0] === 'eprf';


  const getPageTitle = () => {
    // Specific sub-page titles
    if (location.pathname.includes('/inventory/vehicle/')) return 'Vehicle Details';
    if (location.pathname.includes('/inventory/kit/')) return 'Kit Details';
    if (location.pathname.includes('/patients/')) return 'Patient Details';
    if (location.pathname.includes('/admin')) return 'Admin Panel';
    if (location.pathname.includes('/staff-analytics')) return 'Staff Analytics';

    const path = pathSegments[0];

    // Specific top-level page titles that differ from simple capitalization
    if (path === 'eprf') return 'Patient Report Form';
    if (path === 'reviews') return 'ePRF Reviews';
    if (path === 'reports') return 'Reporting';
    if (path === 'events') return 'Duty Logon';
    if (path === 'inventory') return 'Inventory';
    if (path === 'controlled-drugs') return 'Controlled Drugs';
    
    // Default/fallback title generation
    if (!path || path === 'dashboard') return 'Dashboard';
    return path.charAt(0).toUpperCase() + path.slice(1);
  };

  const handleLogout = async () => {
    try {
      await firebaseAuth.signOut(auth);
      clearActiveSession();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out: ', error);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    setNotificationsOpen(false);
    navigate(notification.link || '/dashboard');
    await markNotificationAsRead(notification.id!);
    // Listener will update state automatically
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  const userFullName = user ? `${user.firstName} ${user.lastName}`.trim() : 'User';

  return (
    <div className={`sticky top-0 z-30 transition-transform duration-300 ${isVisible ? 'translate-y-0' : '-translate-y-full'}`}>
        <header className="flex items-center justify-between h-20 px-4 sm:px-6 bg-white dark:bg-gray-800 border-b dark:border-gray-700">
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
                {activeShift ? (
                    <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full text-sm">
                        <EventsIcon className="w-4 h-4" />
                        <span>On Duty: <strong>{activeShift.roleRequired}</strong> at <strong>{activeShift.eventName}</strong></span>
                    </div>
                ) : activeEvent && (
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
                <button onClick={() => setNotificationsOpen(!notificationsOpen)} className="relative p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="Notifications">
                    <BellIcon className="w-6 h-6" />
                    {notifications.length > 0 && (
                        <span className="absolute top-0 right-0 block h-4 w-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold">{notifications.length}</span>
                    )}
                </button>
                 {notificationsOpen && (
                    <div ref={notificationsRef} className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-700 rounded-md overflow-hidden shadow-xl z-20">
                        <NotificationPanel notifications={notifications} onNotificationClick={handleNotificationClick} />
                    </div>
                )}
            </div>
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
        {isEPRFPage && <EPRFTabs />}
    </div>
  );
};

export default Header;