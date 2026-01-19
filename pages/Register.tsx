
import React from 'react';
import { Navigate } from 'react-router-dom';

// Explicitly preventing access to registration as requested
export const Register: React.FC = () => {
  return <Navigate to="/login" replace />;
};
