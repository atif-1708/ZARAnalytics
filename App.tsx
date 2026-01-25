
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { SuperAdminDashboard } from './pages/SuperAdminDashboard';
import { Sales } from './pages/Sales';
import { Expenses } from './pages/Expenses';
import { Reports } from './pages/Reports';
import { UsersPage } from './pages/Users';
import { Businesses } from './pages/Businesses';
import { Profile } from './pages/Profile';
import { Reminders } from './pages/Reminders';
import { Organizations } from './pages/Organizations';
import { Billing } from './pages/Billing';
import { SubscriptionRequests } from './pages/SubscriptionRequests';
import { POS } from './pages/POS';
import { Inventory } from './pages/Inventory';
import { MovementLedger } from './pages/MovementLedger';
import { Transactions } from './pages/Transactions';
import { Suppliers } from './pages/Suppliers';
import { StockReception } from './pages/StockReception';
import { UserRole } from './types';

const ProtectedRoute: React.FC<{ children: React.ReactNode, roles?: UserRole[] }> = ({ children, roles }) => {
  const { user, isAuthenticated } = useAuth();
  
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && user && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  
  return <Layout>{children}</Layout>;
};

const DashboardRouter: React.FC = () => {
  const { user, selectedOrgId } = useAuth();
  if (user?.role === UserRole.SUPER_ADMIN && !selectedOrgId) {
    return <SuperAdminDashboard />;
  }
  return <Dashboard />;
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/dashboard" element={
            <ProtectedRoute roles={[UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ORG_ADMIN, UserRole.STAFF, UserRole.VIEW_ONLY]}>
              <DashboardRouter />
            </ProtectedRoute>
          } />

          <Route path="/pos" element={
            <ProtectedRoute roles={[UserRole.ADMIN, UserRole.ORG_ADMIN, UserRole.STAFF]}>
              <POS />
            </ProtectedRoute>
          } />

          <Route path="/inventory" element={
            <ProtectedRoute roles={[UserRole.ADMIN, UserRole.ORG_ADMIN, UserRole.STAFF]}>
              <Inventory />
            </ProtectedRoute>
          } />

          <Route path="/stock-reception" element={
            <ProtectedRoute roles={[UserRole.ADMIN, UserRole.ORG_ADMIN, UserRole.STAFF]}>
              <StockReception />
            </ProtectedRoute>
          } />

          <Route path="/suppliers" element={
            <ProtectedRoute roles={[UserRole.ADMIN, UserRole.ORG_ADMIN, UserRole.STAFF]}>
              <Suppliers />
            </ProtectedRoute>
          } />

          <Route path="/movements" element={
            <ProtectedRoute roles={[UserRole.ADMIN, UserRole.ORG_ADMIN, UserRole.STAFF]}>
              <MovementLedger />
            </ProtectedRoute>
          } />

          <Route path="/transactions" element={
            <ProtectedRoute roles={[UserRole.ADMIN, UserRole.ORG_ADMIN, UserRole.STAFF, UserRole.VIEW_ONLY]}>
              <Transactions />
            </ProtectedRoute>
          } />
          
          <Route path="/sales" element={
            <ProtectedRoute roles={[UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ORG_ADMIN, UserRole.STAFF, UserRole.VIEW_ONLY]}>
              <Sales />
            </ProtectedRoute>
          } />

          <Route path="/businesses" element={
            <ProtectedRoute roles={[UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ORG_ADMIN]}>
              <Businesses />
            </ProtectedRoute>
          } />

          <Route path="/organizations" element={
            <ProtectedRoute roles={[UserRole.SUPER_ADMIN]}>
              <Organizations />
            </ProtectedRoute>
          } />

          <Route path="/subscription-requests" element={
            <ProtectedRoute roles={[UserRole.SUPER_ADMIN]}>
              <SubscriptionRequests />
            </ProtectedRoute>
          } />

          <Route path="/billing" element={
            <ProtectedRoute roles={[UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ORG_ADMIN]}>
              <Billing />
            </ProtectedRoute>
          } />

          <Route path="/expenses" element={
            <ProtectedRoute roles={[UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ORG_ADMIN, UserRole.STAFF, UserRole.VIEW_ONLY]}>
              <Expenses />
            </ProtectedRoute>
          } />

          <Route path="/reports" element={
            <ProtectedRoute roles={[UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ORG_ADMIN, UserRole.STAFF, UserRole.VIEW_ONLY]}>
              <Reports />
            </ProtectedRoute>
          } />

          <Route path="/profile" element={
            <ProtectedRoute roles={[UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ORG_ADMIN, UserRole.STAFF, UserRole.VIEW_ONLY]}>
              <Profile />
            </ProtectedRoute>
          } />

          <Route path="/reminders" element={
            <ProtectedRoute roles={[UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ORG_ADMIN, UserRole.STAFF, UserRole.VIEW_ONLY]}>
              <Reminders />
            </ProtectedRoute>
          } />

          <Route path="/users" element={
            <ProtectedRoute roles={[UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ORG_ADMIN]}>
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
