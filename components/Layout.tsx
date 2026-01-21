
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
  Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole, Business, DailySale, Reminder } from '../types';
import { storage } from '../services/mockStorage';

interface SidebarItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick?: () => void;
  badge?: number;
  hasNew?: boolean;
  badgeColor?: 'rose' | 'teal';
}

const SidebarItem: React.FC<SidebarItemProps> = ({ to, icon, label, active, onClick, badge, hasNew, badgeColor = 'rose' }) => (
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
    <span className="font-medium text-sm">{label}</span>
    {hasNew && !active && (
      <span className="ml-auto flex items-center gap-1 bg-blue-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md animate-bounce">
        <Sparkles size={8} /> NEW
      </span>
    )}
    {badge && badge > 0 ? (
      <span className={`ml-auto text-white text-[10px] font-black px-2 py-0.5 rounded-full ring-2 ring-slate-900 ${badgeColor === 'rose' ? 'bg-rose-600' : 'bg-teal-500'}`}>
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

  interface MenuItem extends Omit<SidebarItemProps, 'active'> {
    roles: UserRole[];
  }

  const menuItems: MenuItem[] = [
    { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} />, roles: [UserRole.ADMIN, UserRole.STAFF, UserRole.VIEW_ONLY] },
    { to: '/businesses', label: 'Businesses', icon: <Store size={20} />, roles: [UserRole.ADMIN] },
    { to: '/sales', label: 'Daily Sales', icon: <TrendingUp size={20} />, roles: [UserRole.ADMIN, UserRole.STAFF, UserRole.VIEW_ONLY] },
    { to: '/expenses', label: 'Monthly Expenses', icon: <Receipt size={20} />, roles: [UserRole.ADMIN, UserRole.STAFF, UserRole.VIEW_ONLY] },
    { to: '/reports', label: 'Reports', icon: <FileBarChart size={20} />, roles: [UserRole.ADMIN, UserRole.STAFF, UserRole.VIEW_ONLY] },
    { 
      to: '/reminders', 
      label: 'Compliance', 
      icon: <Bell size={20} />, 
      roles: [UserRole.ADMIN, UserRole.STAFF, UserRole.VIEW_ONLY], 
      badge: remindersCount,
      badgeColor: isStaff ? 'rose' : 'teal' 
    },
    { to: '/users', label: 'User Management', icon: <Users size={20} />, roles: [UserRole.ADMIN] },
    { to: '/profile', label: 'My Profile', icon: <UserCircle size={20} />, roles: [UserRole.ADMIN, UserRole.STAFF, UserRole.VIEW_ONLY] },
  ];

  const filteredItems = menuItems.filter(item => item.roles.includes(user?.role as UserRole));

  const checkAlerts = async () => {
    if (!user) return;
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      
      if (isStaff) {
        const [businesses, sales] = await Promise.all([
          storage.getBusinesses(),
          storage.getSales()
        ]);
        const missingForStaff = businesses.filter(b => 
          user.assignedBusinessIds?.includes(b.id) &&
          !sales.some(s => s.businessId === b.id && s.date === todayStr)
        );
        setRemindersCount(missingForStaff.length);
      } else {
        // Admin / View Only: Per-user "Seen" Tracking for Badge Count
        const reminders = await storage.getReminders();
        const pendingAlerts = reminders.filter(r => r.type === 'system_alert' && r.status === 'pending');
        
        // seenKey tracks which alerts the user has seen (to clear the 1,2,3 badge)
        const seenKey = `seen_alerts_${user.id}`;
        const seenIds = JSON.parse(localStorage.getItem(seenKey) || '[]');
        
        // Count only alerts NOT in the seenIds list
        const unseenCount = pendingAlerts.filter(r => !seenIds.includes(r.id)).length;
        setRemindersCount(unseenCount);

        // If user is currently on the compliance page, mark all current alerts as seen (clears badge)
        if (location.pathname === '/reminders' && pendingAlerts.length > 0) {
          const allCurrentPendingIds = pendingAlerts.map(r => r.id);
          const updatedSeenIds = Array.from(new Set([...seenIds, ...allCurrentPendingIds]));
          localStorage.setItem(seenKey, JSON.stringify(updatedSeenIds));
          setRemindersCount(0);
        }
      }
    } catch (err) {
      console.error("Alert check error:", err);
    }
  };

  useEffect(() => {
    checkAlerts();
    const interval = setInterval(checkAlerts, 10000);
    return () => clearInterval(interval);
  }, [user, isStaff, location.pathname]);

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
            {filteredItems.map((item) => {
              const { roles, ...sidebarProps } = item;
              return (
                <SidebarItem 
                  key={item.to} 
                  {...sidebarProps} 
                  active={location.pathname === item.to} 
                  onClick={() => setIsSidebarOpen(false)} 
                />
              );
            })}
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
