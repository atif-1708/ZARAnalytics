
import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Store, 
  TrendingUp, 
  Receipt, 
  FileBarChart, 
  Users, 
  LogOut, 
  Menu, 
  UserCircle,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

interface SidebarItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick?: () => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ to, icon, label, active, onClick }) => (
  <Link
    to={to}
    onClick={onClick}
    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
      active 
        ? 'bg-teal-600 text-white shadow-lg shadow-teal-900/20' 
        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
    }`}
  >
    {icon}
    <span className="font-medium">{label}</span>
    {active && <ChevronRight className="ml-auto w-4 h-4" />}
  </Link>
);

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const isAdmin = user?.role === UserRole.ADMIN;

  const menuItems = [
    { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} />, roles: [UserRole.ADMIN, UserRole.USER] },
    { to: '/businesses', label: 'Businesses', icon: <Store size={20} />, roles: [UserRole.ADMIN, UserRole.USER] },
    { to: '/sales', label: 'Daily Sales', icon: <TrendingUp size={20} />, roles: [UserRole.ADMIN, UserRole.USER] },
    { to: '/expenses', label: 'Monthly Expenses', icon: <Receipt size={20} />, roles: [UserRole.ADMIN, UserRole.USER] },
    { to: '/reports', label: 'Reports', icon: <FileBarChart size={20} />, roles: [UserRole.ADMIN, UserRole.USER] },
    { to: '/users', label: 'User Management', icon: <Users size={20} />, roles: [UserRole.ADMIN] },
    { to: '/profile', label: 'My Profile', icon: <UserCircle size={20} />, roles: [UserRole.ADMIN, UserRole.USER] },
  ];

  const filteredItems = menuItems.filter(item => item.roles.includes(user?.role as UserRole));

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 w-64 bg-slate-900 text-white z-50 transition-transform duration-300 lg:translate-x-0 lg:static lg:block
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-teal-500 rounded-xl flex items-center justify-center font-bold text-white shadow-lg shadow-teal-500/30">ZL</div>
            <h1 className="text-xl font-bold tracking-tight">ZARlytics</h1>
          </div>

          <nav className="space-y-2">
            {filteredItems.map((item) => (
              <SidebarItem
                key={item.to}
                {...item}
                active={location.pathname === item.to}
                onClick={() => setIsSidebarOpen(false)}
              />
            ))}
          </nav>
        </div>

        <div className="absolute bottom-0 w-full p-6 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-6 px-2">
            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold">
              {user?.name.charAt(0)}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold truncate">{user?.name}</p>
              <p className="text-xs text-slate-400 truncate">{user?.role}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors"
          >
            <LogOut size={20} />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-30">
          <button 
            className="p-2 -ml-2 text-slate-500 lg:hidden"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu size={24} />
          </button>
          <div className="flex-1 px-4">
             <h2 className="text-lg font-semibold text-slate-800 capitalize">
               {location.pathname.substring(1).replace('-', ' ') || 'Dashboard'}
             </h2>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/profile" className="flex items-center gap-2 text-slate-500 hover:text-teal-600 transition-colors">
              <UserCircle size={20} />
              <span className="text-sm font-medium hidden sm:inline">{user?.name}</span>
            </Link>
          </div>
        </header>

        <div className="p-6 max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
};
