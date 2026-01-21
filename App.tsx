
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Sales } from './pages/Sales';
import { Expenses } from './pages/Expenses';
import { Reports } from './pages/Reports';
import { UsersPage } from './pages/Users';
import { Businesses } from './pages/Businesses';
import { Profile } from './pages/Profile';
import { Reminders } from './pages/Reminders';
import { UserRole } from './types';

const ProtectedRoute: React.FC<{ children: React.ReactNode, roles?: UserRole[] }> = ({ children, roles }) => {
  const { user, isAuthenticated } = useAuth();
  
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && user && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  
  return <Layout>{children}</Layout>;
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/sales" element={
            <ProtectedRoute>
              <Sales />
            </ProtectedRoute>
          } />

          <Route path="/businesses" element={
            <ProtectedRoute>
              <Businesses />
            </ProtectedRoute>
          } />

          <Route path="/expenses" element={
            <ProtectedRoute>
              <Expenses />
            </ProtectedRoute>
          } />

          <Route path="/reports" element={
            <ProtectedRoute>
              <Reports />
            </ProtectedRoute>
          } />

          <Route path="/profile" element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } />

          <Route path="/reminders" element={
            // Fix: UserRole.USER does not exist, using STAFF and VIEW_ONLY instead
            <ProtectedRoute roles={[UserRole.ADMIN, UserRole.STAFF, UserRole.VIEW_ONLY]}>
              <Reminders />
            </ProtectedRoute>
          } />

          <Route path="/users" element={
            <ProtectedRoute roles={[UserRole.ADMIN]}>
              <UsersPage />
            </ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </HashRouter>
  );
};

export default App;
