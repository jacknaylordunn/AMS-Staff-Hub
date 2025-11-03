
import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import { ProfileIcon, LogoutIcon } from './icons';

const Header: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const getPageTitle = () => {
    const path = location.pathname.split('/')[1];
    if (!path || path === 'dashboard') return 'Dashboard';
    return path.charAt(0).toUpperCase() + path.slice(1);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
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

  return (
    <header className="flex items-center justify-between h-20 px-6 bg-white border-b">
      <h1 className="text-2xl font-semibold text-gray-800">{getPageTitle()}</h1>
      <div className="relative">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="relative z-10 block h-10 w-10 overflow-hidden rounded-full shadow focus:outline-none"
        >
          <ProfileIcon className="w-full h-full object-cover" />
        </button>
        {dropdownOpen && (
          <div ref={dropdownRef} className="absolute right-0 mt-2 w-48 bg-white rounded-md overflow-hidden shadow-xl z-20">
            <div className="px-4 py-2 text-sm text-gray-700">
              <p className="font-semibold">{user?.displayName || 'User'}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
            <hr />
            <button
              onClick={() => {
                navigate('/profile');
                setDropdownOpen(false);
              }}
              className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-ams-light-blue hover:text-white"
            >
              <ProfileIcon className="w-4 h-4 mr-2" /> Profile
            </button>
            <button
              onClick={handleLogout}
              className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-ams-light-blue hover:text-white"
            >
              <LogoutIcon className="w-4 h-4 mr-2" /> Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
