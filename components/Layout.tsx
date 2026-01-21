
import React, { useState, useEffect, useRef } from 'react';
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
  ChevronRight,
  Bell,
  CheckCircle2,
  BellRing,
  Clock,
  Sparkles,
  Send,
  CalendarDays
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole, Notification, Business, DailySale, Reminder, MonthlyExpense } from '../types';
import { storage } from '../services/mockStorage';

interface SidebarItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick?: () => void;
  badge?: number;
  hasNew?: boolean;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ to, icon, label, active, onClick, badge, hasNew }) => (
  <Link
    to={to}
    onClick={onClick}
    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 relative group ${
      active 
        ? 'bg-teal-600 text-white shadow-lg shadow-teal-900/20' 
        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
    }`}
  >
    {icon}
    <span className="font-medium">{label}</span>
    {hasNew && !active && (
      <span className="ml-auto flex items-center gap-1 bg-blue-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md animate-bounce">
        <Sparkles size={8} /> NEW
      </span>
    )}
    {badge && badge > 0 ? (
      <span className="ml-auto bg-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full ring-2 ring-slate-900">
        {badge}
      </span>
    ) : (active && !hasNew) && <ChevronRight className="ml-auto w-4 h-4" />}
  </Link>
);

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [remindersCount, setRemindersCount] = useState(0);
  
  const isAdmin = user?.role === UserRole.ADMIN;
  const isStaff = user?.role === UserRole.STAFF;
  const isViewOnly = user?.role === UserRole.VIEW_ONLY;

  const menuItems = [
    { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} />, roles: [UserRole.ADMIN, UserRole.STAFF, UserRole.VIEW_ONLY] },
    { to: '/businesses', label: 'Businesses', icon: <Store size={20} />, roles: [UserRole.ADMIN] },
    { to: '/sales', label: 'Daily Sales', icon: <TrendingUp size={20} />, roles: [UserRole.ADMIN, UserRole.STAFF, UserRole.VIEW_ONLY] },
    { to: '/expenses', label: 'Monthly Expenses', icon: <Receipt size={20} />, roles: [UserRole.ADMIN, UserRole.STAFF, UserRole.VIEW_ONLY] },
    { to: '/reports', label: 'Reports', icon: <FileBarChart size={20} />, roles: [UserRole.ADMIN, UserRole.STAFF, UserRole.VIEW_ONLY] },
    { to: '/reminders', label: 'Reminders', icon: <Send size={20} />, roles: [UserRole.ADMIN, UserRole.STAFF, UserRole.VIEW_ONLY], badge: remindersCount },
    { to: '/users', label: 'User Management', icon: <Users size={20} />, roles: [UserRole.ADMIN] },
    { to: '/profile', label: 'My Profile', icon: <UserCircle size={20} />, roles: [UserRole.ADMIN, UserRole.STAFF, UserRole.VIEW_ONLY] },
  ];

  const filteredItems = menuItems.filter(item => item.roles.includes(user?.role as UserRole));

  useEffect(() => {
    const checkAlerts = async () => {
      if (!user) return;
      try {
        const [businesses, sales, reminders] = await Promise.all([
          storage.getBusinesses(),
          storage.getSales(),
          storage.getReminders()
        ]);
        const today = new Date().toISOString().split('T')[0];
        
        // Scope alert logic to assigned business IDs
        const missingBusinesses = businesses.filter(b => {
            const hasAccess = isAdmin || user.assignedBusinessIds?.includes(b.id);
            if (!hasAccess) return false;
            return !sales.some(s => s.businessId === b.id && s.date === today);
        });
        
        setRemindersCount(isAdmin ? reminders.filter(r => r.status === 'pending').length + missingBusinesses.length : missingBusinesses.length);
      } catch (err) {
        console.error("Alert check error:", err);
      }
    };
    checkAlerts();
    const interval = setInterval(checkAlerts, 10000);
    return () => clearInterval(interval);
  }, [user]);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 w-64 bg-slate-900 text-white z-50 transition-transform duration-300 lg:translate-x-0 lg:static lg:block flex flex-col ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-teal-500 rounded-xl flex items-center justify-center font-bold text-white shadow-lg">ZL</div>
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

        <div className="p-6 border-t border-slate-800 bg-slate-900">
          <div className="flex items-center gap-3 mb-6 px-2">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-700" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold ring-2 ring-slate-600 uppercase">
                {user?.name.charAt(0)}
              </div>
            )}
            <div className="overflow-hidden text-left">
              <p className="text-sm font-semibold truncate">{user?.name}</p>
              <p className="text-[9px] text-slate-400 truncate uppercase tracking-tighter font-black">{user?.role?.replace('_', ' ')}</p>
            </div>
          </div>
          <button onClick={() => { logout(); navigate('/login'); }} className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-all group">
            <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-30">
          <button className="p-2 -ml-2 text-slate-500 lg:hidden" onClick={() => setIsSidebarOpen(true)}>
            <Menu size={24} />
          </button>
          <div className="flex-1 px-4 text-left">
             <h2 className="text-lg font-semibold text-slate-800 capitalize">
               {location.pathname.substring(1).replace('-', ' ') || 'Dashboard'}
             </h2>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/profile" className="flex items-center gap-2 text-slate-500 hover:text-teal-600 transition-colors">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <UserCircle size={20} />
              )}
              <span className="text-sm font-medium hidden sm:inline">{user?.name}</span>
            </Link>
          </div>
        </header>
        <div className="p-6 max-w-7xl mx-auto w-full">{children}</div>
      </main>
    </div>
  );
};
