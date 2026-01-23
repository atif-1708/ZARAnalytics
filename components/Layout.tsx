
import React, { useState, useEffect } from 'react';
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
  Sparkles,
  Building2,
  Globe,
  ShieldCheck,
  Activity,
  Server,
  CreditCard,
  AlertTriangle,
  ArrowRight,
  Loader2,
  Lock,
  BellRing
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole, Organization } from '../types';
import { storage } from '../services/mockStorage';

interface SidebarItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick?: () => void;
  badge?: number;
  hasNew?: boolean;
  badgeColor?: 'rose' | 'teal' | 'indigo';
  theme: 'standard' | 'admin';
}

const SidebarItem: React.FC<SidebarItemProps> = ({ to, icon, label, active, onClick, badge, hasNew, badgeColor = 'rose', theme }) => {
  const activeClasses = theme === 'admin' 
    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40' 
    : 'bg-teal-600 text-white shadow-lg shadow-teal-900/20';

  const hoverClasses = theme === 'admin'
    ? 'text-indigo-300 hover:bg-indigo-800 hover:text-white'
    : 'text-slate-400 hover:bg-slate-800 hover:text-white';

  const badgeBg = badgeColor === 'rose' ? 'bg-rose-600' : badgeColor === 'indigo' ? 'bg-indigo-500' : 'bg-teal-500';

  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 relative group ${
        active ? activeClasses : hoverClasses
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
        <span className={`ml-auto text-white text-[10px] font-black px-2 py-0.5 rounded-full ring-2 ring-slate-900 ${badgeBg}`}>
          {badge}
        </span>
      ) : (active && !hasNew) && <ChevronRight className="ml-auto w-4 h-4" />}
    </Link>
  );
};

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout, selectedOrgId, setSelectedOrgId, isSuspended, suspendedOrgName } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [remindersCount, setRemindersCount] = useState(0);
  const [subRequestsCount, setSubRequestsCount] = useState(0);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  
  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;
  const isGlobalKernelMode = isSuperAdmin && !selectedOrgId;
  const currentTheme = isGlobalKernelMode ? 'admin' : 'standard';

  useEffect(() => {
    if (isSuperAdmin) {
      storage.getOrganizations().then(setOrganizations);
    }
  }, [isSuperAdmin]);

  const menuItems: any[] = [
    { to: '/dashboard', label: isGlobalKernelMode ? 'Global Control' : 'Dashboard', icon: <LayoutDashboard size={20} />, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ORG_ADMIN, UserRole.STAFF, UserRole.VIEW_ONLY] },
    { to: '/organizations', label: 'Tenants & Billing', icon: <Building2 size={20} />, roles: [UserRole.SUPER_ADMIN], showOnlyInGlobalMode: true },
    { to: '/subscription-requests', label: 'Sub Requests', icon: <BellRing size={20} />, roles: [UserRole.SUPER_ADMIN], showOnlyInGlobalMode: true, badge: subRequestsCount, badgeColor: 'indigo' },
    { to: '/billing', label: 'Plan & Payment', icon: <CreditCard size={20} />, roles: [UserRole.ADMIN, UserRole.ORG_ADMIN], hideInGlobalMode: true },
    { to: '/businesses', label: 'Businesses', icon: <Store size={20} />, roles: [UserRole.ADMIN, UserRole.ORG_ADMIN], hideInGlobalMode: true },
    { to: '/sales', label: 'Daily Sales', icon: <TrendingUp size={20} />, roles: [UserRole.ADMIN, UserRole.ORG_ADMIN, UserRole.STAFF, UserRole.VIEW_ONLY], hideInGlobalMode: true },
    { to: '/expenses', label: 'Expenses', icon: <Receipt size={20} />, roles: [UserRole.ADMIN, UserRole.ORG_ADMIN, UserRole.STAFF, UserRole.VIEW_ONLY], hideInGlobalMode: true },
    { to: '/reports', label: 'Financial Reports', icon: <FileBarChart size={20} />, roles: [UserRole.ADMIN, UserRole.ORG_ADMIN, UserRole.STAFF, UserRole.VIEW_ONLY], hideInGlobalMode: true },
    { 
      to: '/reminders', 
      label: isGlobalKernelMode ? 'System Audit' : 'Compliance', 
      icon: isGlobalKernelMode ? <Activity size={20} /> : <Bell size={20} />, 
      roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ORG_ADMIN, UserRole.STAFF, UserRole.VIEW_ONLY], 
      badge: remindersCount,
      badgeColor: user?.role === UserRole.STAFF ? 'rose' : (isGlobalKernelMode ? 'indigo' : 'teal') 
    },
    { to: '/users', label: 'Identity & Access', icon: <ShieldCheck size={20} />, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ORG_ADMIN] },
    { to: '/profile', label: 'My Profile', icon: <UserCircle size={20} />, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ORG_ADMIN, UserRole.STAFF, UserRole.VIEW_ONLY] },
  ];

  const filteredItems = menuItems.filter(item => {
    const hasRole = item.roles.includes(user?.role as UserRole) || (isSuperAdmin && item.roles.includes(UserRole.SUPER_ADMIN));
    if (!hasRole) return false;
    if (isGlobalKernelMode) {
      if (item.hideInGlobalMode) return false;
    } else if (isSuperAdmin && selectedOrgId) {
      return true;
    } else {
      if (item.showOnlyInGlobalMode) return false;
    }
    return true;
  });

  const checkAlerts = async () => {
    if (!user) return;
    try {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(today.getDate() + 30);
      
      if (isGlobalKernelMode) {
        const [orgs, reminders] = await Promise.all([
          storage.getOrganizations(),
          storage.getReminders()
        ]);
        const flaggedCount = orgs.filter(org => {
          const endDate = new Date(org.subscriptionEndDate);
          return endDate < today || endDate <= thirtyDaysFromNow;
        }).length;
        setRemindersCount(flaggedCount);

        // Count pending sub requests for the new tab (distinguished by null businessId)
        const subReqs = reminders.filter(r => r.type === 'system_alert' && r.status === 'pending' && !r.businessId);
        setSubRequestsCount(subReqs.length);
      } else if (user.role === UserRole.STAFF) {
        const [businesses, sales] = await Promise.all([
          storage.getBusinesses(),
          storage.getSales()
        ]);
        const assignedBizIds = user.assignedBusinessIds || [];
        const missingCount = businesses
          .filter(b => assignedBizIds.includes(b.id))
          .filter(b => !sales.some(s => s.businessId === b.id && s.date === todayStr))
          .length;
        setRemindersCount(missingCount);
      } else {
        const reminders = await storage.getReminders();
        const pendingAlerts = reminders.filter(r => r.type === 'system_alert' && r.status === 'pending');
        const seenKey = `zarlytics_seen_alerts_${user.id}`;
        const seenIds = JSON.parse(localStorage.getItem(seenKey) || '[]');
        const unseenCount = pendingAlerts.filter(r => !seenIds.includes(r.id)).length;
        setRemindersCount(unseenCount);
      }
    } catch (err) {
      console.error("Alert check error:", err);
    }
  };

  useEffect(() => {
    checkAlerts();
    const interval = setInterval(checkAlerts, 8000);
    return () => clearInterval(interval);
  }, [user, location.pathname, isGlobalKernelMode]);

  return (
    <div className={`min-h-screen ${isGlobalKernelMode ? 'bg-slate-950' : 'bg-slate-50'} flex transition-colors duration-500`}>
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 w-64 ${isGlobalKernelMode ? 'bg-slate-900 border-r border-white/5 shadow-2xl shadow-indigo-500/10' : 'bg-slate-900'} text-white z-50 transition-all duration-300 lg:translate-x-0 lg:static lg:block flex flex-col ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex-1 overflow-y-auto p-6 text-left">
          <div className="flex items-center gap-3 mb-10">
            <div className={`w-10 h-10 ${isGlobalKernelMode ? 'bg-indigo-600' : 'bg-teal-500'} rounded-xl flex items-center justify-center font-bold text-white shadow-lg shadow-black/20`}>
              {isGlobalKernelMode ? <Server size={20} /> : 'ZL'}
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight leading-none">ZARlytics</h1>
              <p className={`text-[9px] font-black uppercase tracking-widest ${isGlobalKernelMode ? 'text-indigo-400' : 'text-teal-500'}`}>
                {isGlobalKernelMode ? 'Global Command' : 'Business Portal'}
              </p>
            </div>
          </div>
          <nav className="space-y-2">
            {filteredItems.map((item) => {
              const { roles, hideInGlobalMode, WoodOnlyInGlobalMode, ...sidebarProps } = item;
              return (
                <SidebarItem 
                  key={item.to} 
                  {...sidebarProps} 
                  theme={currentTheme}
                  active={location.pathname === item.to} 
                  onClick={() => setIsSidebarOpen(false)} 
                />
              );
            })}
          </nav>
        </div>

        <div className={`p-6 border-t ${isGlobalKernelMode ? 'border-white/5 bg-slate-900' : 'border-slate-800 bg-slate-900'}`}>
          <div className="flex items-center gap-3 mb-6 px-2 text-left">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="w-10 h-10 rounded-full object-cover ring-2 ring-indigo-500/30" />
            ) : (
              <div className={`w-10 h-10 rounded-full ${isGlobalKernelMode ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-700 text-slate-300'} flex items-center justify-center text-sm font-bold ring-2 ring-slate-600 uppercase`}>
                {user?.name.charAt(0)}
              </div>
            )}
            <div className="overflow-hidden">
              <p className="text-sm font-semibold truncate">{user?.name}</p>
              <p className={`text-[9px] ${isGlobalKernelMode ? 'text-indigo-400' : 'text-slate-400'} truncate uppercase tracking-tighter font-black`}>
                {user?.role?.replace('_', ' ')}
              </p>
            </div>
          </div>
          <button onClick={() => { logout(); navigate('/login'); }} className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg ${isGlobalKernelMode ? 'text-slate-400 hover:bg-white/5 hover:text-white' : 'text-rose-400 hover:bg-rose-500/10'} transition-all group`}>
            <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        <header className={`${isGlobalKernelMode ? 'bg-slate-900 text-white border-b border-white/5' : 'bg-white text-slate-900 border-b border-slate-200'} h-16 flex items-center justify-between px-6 sticky top-0 z-30 transition-all`}>
          <div className="flex items-center gap-4">
            <button className={`p-2 -ml-2 ${isGlobalKernelMode ? 'text-indigo-300' : 'text-slate-500'} lg:hidden`} onClick={() => setIsSidebarOpen(true)}>
              <Menu size={24} />
            </button>
            <div className="text-left hidden sm:block">
               <h2 className={`text-xs font-black uppercase tracking-widest leading-none ${isGlobalKernelMode ? 'text-indigo-300/60' : 'text-slate-400'}`}>
                 {isGlobalKernelMode ? 'Platform Kernel' : 'Store Context'}
               </h2>
               <p className="text-sm font-bold truncate max-w-[200px]">
                 {location.pathname.substring(1).replace('-', ' ') || 'Dashboard'}
               </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {isSuperAdmin && (
              <div className={`flex items-center gap-2 px-3 py-1.5 ${isGlobalKernelMode ? 'bg-white/5 border-white/10' : 'bg-indigo-50 border-indigo-100'} border rounded-xl animate-in fade-in zoom-in`}>
                <Globe size={14} className={isGlobalKernelMode ? 'text-indigo-400' : 'text-indigo-600'} />
                <select 
                  value={selectedOrgId || ''} 
                  onChange={(e) => setSelectedOrgId(e.target.value || null)}
                  className={`bg-transparent text-[11px] font-black uppercase outline-none cursor-pointer ${isGlobalKernelMode ? 'text-white' : 'text-indigo-700'}`}
                >
                  <option value="" className="text-slate-900">Global View</option>
                  {organizations.map(org => (
                    <option key={org.id} value={org.id} className="text-slate-900">{org.name}</option>
                  ))}
                </select>
                {selectedOrgId && (
                  <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-indigo-200">
                    <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-black text-amber-600">GHOST</span>
                  </div>
                )}
              </div>
            )}
            <Link to="/profile" className={`flex items-center gap-2 transition-colors ${isGlobalKernelMode ? 'text-indigo-300 hover:text-white' : 'text-slate-500 hover:text-teal-600'}`}>
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="w-8 h-8 rounded-full object-cover ring-2 ring-indigo-500/20" />
              ) : (
                <UserCircle size={20} />
              )}
            </Link>
          </div>
        </header>

        {isSuspended && !isGlobalKernelMode && location.pathname !== '/billing' && location.pathname !== '/profile' && (
          <div className="bg-rose-600 text-white px-6 py-2 flex items-center justify-center gap-4 sticky top-16 z-20 shadow-lg animate-in slide-in-from-top duration-300">
             <AlertTriangle size={16} className="animate-pulse" />
             <p className="text-xs font-black uppercase tracking-widest">
               Read-Only Mode: {suspendedOrgName} Subscription has expired. Data entry is restricted.
             </p>
             {(user?.role === UserRole.ORG_ADMIN || user?.role === UserRole.ADMIN) && (
               <button 
                 onClick={() => navigate('/billing')} 
                 className="bg-white text-rose-600 px-3 py-1 rounded-lg text-[9px] font-black hover:bg-rose-50 transition-colors uppercase tracking-widest ml-2 shadow-sm"
               >
                 Resubscribe
               </button>
             )}
          </div>
        )}

        <div className="p-6 max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
};
