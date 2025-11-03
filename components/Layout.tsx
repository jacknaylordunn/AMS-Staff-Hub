
import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { ToastContainer } from './Toast';

const Layout: React.FC = () => {
  return (
    <>
      <div className="flex h-screen bg-ams-gray dark:bg-gray-900">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-x-hidden overflow-y-auto bg-ams-gray dark:bg-gray-900">
            <div className="container mx-auto px-6 py-8">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
      <ToastContainer />
    </>
  );
};

export default Layout;