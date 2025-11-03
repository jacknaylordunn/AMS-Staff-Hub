import React from 'react';
import { NavLink } from 'react-router-dom';
import { DashboardIcon, EprfIcon, DocsIcon, RotaIcon, PatientsIcon, EventsIcon, CheckIcon } from './icons';
import { useAuth } from '../hooks/useAuth';

const Sidebar: React.FC = () => {
  const { isManager } = useAuth();

  const navLinkClasses = ({ isActive }: { isActive: boolean }): string =>
    `flex items-center px-6 py-3 text-lg transition-colors duration-200 ${
      isActive
        ? 'text-white bg-ams-light-blue'
        : 'text-gray-300 hover:bg-gray-700 dark:hover:bg-gray-600 hover:text-white'
    }`;

  return (
    <div className="hidden md:flex flex-col w-64 bg-ams-blue dark:bg-gray-800 text-white">
      <div className="flex items-center justify-center h-20 border-b border-gray-700 dark:border-gray-700">
        <img src="https://145955222.fs1.hubspotusercontent-eu1.net/hubfs/145955222/AMS/Logo%20FINAL%20(2).png" alt="AMS Logo" className="h-12" />
      </div>
      <div className="flex flex-col flex-1 overflow-y-auto">
        <nav className="flex-1 px-2 py-4">
          <NavLink to="/dashboard" className={navLinkClasses}>
            <DashboardIcon className="w-6 h-6 mr-3" />
            Dashboard
          </NavLink>
          <NavLink to="/eprf" className={navLinkClasses}>
            <EprfIcon className="w-6 h-6 mr-3" />
            ePRF
          </NavLink>
          <NavLink to="/documents" className={navLinkClasses}>
            <DocsIcon className="w-6 h-6 mr-3" />
            Documents
          </NavLink>
          <NavLink to="/rota" className={navLinkClasses}>
            <RotaIcon className="w-6 h-6 mr-3" />
            Rota
          </NavLink>
          <div className="px-6 py-4 text-gray-400 dark:text-gray-500 text-sm uppercase">Clinical</div>
           <NavLink to="/patients" className={navLinkClasses}>
            <PatientsIcon className="w-6 h-6 mr-3" />
            Patients
          </NavLink>
           <NavLink to="/events" className={navLinkClasses}>
            <EventsIcon className="w-6 h-6 mr-3" />
            Events
          </NavLink>
           {isManager && (
            <>
              <div className="px-6 py-4 text-gray-400 dark:text-gray-500 text-sm uppercase">Management</div>
              <NavLink to="/reviews" className={navLinkClasses}>
                <CheckIcon className="w-6 h-6 mr-3" />
                ePRF Reviews
              </NavLink>
            </>
          )}
        </nav>
      </div>
    </div>
  );
};

export default Sidebar;