
import React, { useState, useRef, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { ToastContainer } from './Toast';

const Layout: React.FC = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isHeaderVisible, setHeaderVisible] = useState(true);
  const mainContentRef = useRef<HTMLElement>(null);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const mainContent = mainContentRef.current;
    if (!mainContent) return;

    const handleScroll = () => {
        const currentScrollY = mainContent.scrollTop;
        if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
            // Scrolling down
            setHeaderVisible(false);
        } else {
            // Scrolling up
            setHeaderVisible(true);
        }
        lastScrollY.current = currentScrollY;
    };

    mainContent.addEventListener('scroll', handleScroll);
    return () => {
        mainContent.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <>
      <div className="flex h-screen bg-ams-gray dark:bg-gray-900">
        <Sidebar isOpen={isSidebarOpen} setIsOpen={setSidebarOpen} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header onMenuClick={() => setSidebarOpen(true)} isVisible={isHeaderVisible} />
          <main ref={mainContentRef} className="flex-1 overflow-x-hidden overflow-y-auto bg-ams-gray dark:bg-gray-900">
            <div className="container mx-auto px-4 sm:px-6 py-8">
              <ReactRouterDOM.Outlet />
            </div>
          </main>
        </div>
      </div>
      <ToastContainer />
    </>
  );
};

export default Layout;