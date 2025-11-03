
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const NotFound: React.FC = () => {
    const { user } = useAuth();
    const destination = user ? '/dashboard' : '/login';

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-ams-gray text-center">
            <h1 className="text-6xl font-bold text-ams-blue">404</h1>
            <h2 className="text-2xl font-semibold text-gray-700 mt-4">Page Not Found</h2>
            <p className="text-gray-500 mt-2">Sorry, the page you are looking for does not exist.</p>
            <Link 
                to={destination} 
                className="mt-6 px-6 py-3 bg-ams-light-blue text-white font-bold rounded-lg shadow-md hover:bg-opacity-90"
            >
                Go to Homepage
            </Link>
        </div>
    );
};

export default NotFound;
