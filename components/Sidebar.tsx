import React from 'react';
import { NavLink } from 'react-router-dom';
import { DashboardIcon, EprfIcon, DocsIcon, RotaIcon, PatientsIcon, EventsIcon, CheckIcon, AmbulanceIcon, ChartIcon, MegaphoneIcon, AdminIcon } from './icons';
import { useAuth } from '../hooks/useAuth';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
  const { isManager, isAdmin } = useAuth();

  const handleLinkClick = () => {
    if (isOpen) {
      setIsOpen(false);
    }
  }

  const navLinkClasses = ({ isActive }: { isActive: boolean }): string =>
    `flex items-center px-6 py-3 text-lg transition-colors duration-200 ${
      isActive
        ? 'text-white bg-ams-light-blue'
        : 'text-gray-300 hover:bg-gray-700 dark:hover:bg-gray-600 hover:text-white'
    }`;

  return (
    <>
      {/* Overlay for mobile */}
      <div 
        className={`fixed inset-0 z-30 bg-black opacity-50 transition-opacity md:hidden ${isOpen ? 'block' : 'hidden'}`}
        onClick={() => setIsOpen(false)}
      ></div>

      <div className={`fixed inset-y-0 left-0 z-40 flex flex-col w-64 bg-ams-blue dark:bg-gray-800 text-white transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out md:relative md:translate-x-0 md:flex`}>
        <div className="flex items-center justify-center h-20 border-b border-gray-700 dark:border-gray-700">
          <img src="https://145955222.fs1.hubspotusercontent-eu1.net/hubfs/145955222/AMS/Logo%20FINAL%20(2).png" alt="AMS Logo" className="h-12" />
        </div>
        <div className="flex flex-col flex-1 overflow-y-auto">
          <nav className="flex-1 px-2 py-4">
            <NavLink to="/dashboard" className={navLinkClasses} onClick={handleLinkClick}>
              <DashboardIcon className="w-6 h-6 mr-3" />
              Dashboard
            </NavLink>
            <NavLink to="/eprf" className={navLinkClasses} onClick={handleLinkClick}>
              <EprfIcon className="w-6 h-6 mr-3" />
              ePRF
            </NavLink>
            <NavLink to="/documents" className={navLinkClasses} onClick={handleLinkClick}>
              <DocsIcon className="w-6 h-6 mr-3" />
              Documents
            </NavLink>
            <NavLink to="/rota" className={navLinkClasses} onClick={handleLinkClick}>
              <RotaIcon className="w-6 h-6 mr-3" />
              Rota
            </NavLink>
            <div className="px-6 py-4 text-gray-400 dark:text-gray-500 text-sm uppercase">Clinical</div>
            <NavLink to="/patients" className={navLinkClasses} onClick={handleLinkClick}>
              <PatientsIcon className="w-6 h-6 mr-3" />
              Patients
            </NavLink>
            <NavLink to="/events" className={navLinkClasses} onClick={handleLinkClick}>
              <EventsIcon className="w-6 h-6 mr-3" />
              Events
            </NavLink>
            {isManager && (
              <>
                <div className="px-6 py-4 text-gray-400 dark:text-gray-500 text-sm uppercase">Management</div>
                <NavLink to="/reviews" className={navLinkClasses} onClick={handleLinkClick}>
                  <CheckIcon className="w-6 h-6 mr-3" />
                  ePRF Reviews
                </NavLink>
                <NavLink to="/assets" className={navLinkClasses} onClick={handleLinkClick}>
                  <AmbulanceIcon className="w-6 h-6 mr-3" />
                  Assets
                </NavLink>
                <NavLink to="/reports" className={navLinkClasses} onClick={handleLinkClick}>
                  <ChartIcon className="w-6 h-6 mr-3" />
                  Reporting
                </NavLink>
                <NavLink to="/announcements" className={navLinkClasses} onClick={handleLinkClick}>
                    <MegaphoneIcon className="w-6 h-6 mr-3" />
                    Announcements
                </NavLink>
                {isAdmin && (
                    <NavLink to="/admin" className={navLinkClasses} onClick={handleLinkClick}>
                        <AdminIcon className="w-6 h-6 mr-3" />
                        Admin
                    </NavLink>
                )}
              </>
            )}
          </nav>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
