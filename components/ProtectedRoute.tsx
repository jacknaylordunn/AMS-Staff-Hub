
import React from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { User } from '../types';

interface ProtectedRouteProps {
  children: React.ReactElement;
  roles?: (User['role'])[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, roles }) => {
  const { user } = useAuth();

  if (!user) {
    return <ReactRouterDOM.Navigate to="/login" replace />;
  }
  
  if (roles && (!user.role || !roles.includes(user.role))) {
    // User does not have the required role, redirect them.
    // You could redirect to a dedicated 'unauthorized' page as well.
    return <ReactRouterDOM.Navigate to="/dashboard" replace />;
  }

  return children;
};

export default ProtectedRoute;