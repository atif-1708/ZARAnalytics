
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
  X,
  AlertCircle,
  CalendarDays,
  Send,
  CheckCircle2,
  BellRing,
  Wallet
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
}

const SidebarItem: React.FC<SidebarItemProps> = ({ to, icon, label, active, onClick, badge }) => (
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
    {badge ? (
      <span className={`ml-auto bg-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full ring-2 ring-slate-900 ${badge > 0 ? 'animate-pulse scale-110 shadow-lg shadow-rose-900/50' : ''}`}>
        {badge}
      </span>
    ) : active && <ChevronRight className="ml-auto w-4 h-4" />}
  </Link>
);

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [remindersCount, setRemindersCount] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);
  
  // High-precision tracking for new entries
  const lastSalesIds = useRef<Set<string> | null>(null);
  const lastExpenseIds = useRef<Set<string> | null>(null);
  const lastReminderIds = useRef<Set<string> | null>(null);

  const isAdmin = user?.role === UserRole.ADMIN;

  const isPast10PMPakistan = () => {
    try {
      const pktHour = parseInt(new Intl.DateTimeFormat('en-US', { 
        timeZone: 'Asia/Karachi', 
        hour: 'numeric', 
        hour12: false 
      }).format(new Date()));
      return pktHour >= 22 || pktHour < 5;
    } catch (e) {
      return false;
    }
  };

  useEffect(() => {
    const checkAlerts = async () => {
      if (!user) return;
      
      try {
        const [businesses, sales, expenses, reminders] = await Promise.all([
          storage.getBusinesses(),
          storage.getSales(),
          storage.getExpenses(),
          storage.getReminders()
        ]);

        const today = new Date().toISOString().split('T')[0];
        const isUrgentWindow = isPast10PMPakistan();
        const newNotifs: Notification[] = [];

        // 1. MISSING ENTRY ALERTS (Both Roles)
        businesses.forEach(business => {
          const hasSaleToday = sales.some(s => s.businessId === business.id && s.date === today);
          if (!hasSaleToday) {
            newNotifs.push({
              id: `missing-sale-${business.id}-${today}`,
              title: isUrgentWindow ? "URGENT: Entry Deadline" : "Pending Daily Entry",
              description: isUrgentWindow 
                ? `10 PM PKT Reached. ${business.name} sales are missing!` 
                : `No sales record found for ${business.name} today.`,
              type: isUrgentWindow ? 'urgent' : 'warning',
              timestamp: new Date().toISOString(),
              link: '/reminders',
              isRead: false,
              actionLabel: 'Go to Reminders',
              businessId: business.id
            });
          }
        });

        // 2. DETECTION FOR STANDARD USERS (Admin Activity)
        if (!isAdmin) {
          // Detect New Sales
          const currentSalesIds = new Set(sales.map(s => s.id));
          if (lastSalesIds.current !== null) {
            const addedSales = sales.filter(s => !lastSalesIds.current!.has(s.id));
            addedSales.forEach(sale => {
              const bizName = businesses.find(b => b.id === sale.businessId)?.name || 'a business';
              newNotifs.push({
                id: `sale-added-${sale.id}`,
                title: "New Sale Recorded",
                description: `Admin published a new sale entry for ${bizName}.`,
                type: 'info',
                timestamp: new Date().toISOString(),
                isRead: false,
                actionLabel: 'View Sales',
                link: '/sales'
              });
            });
          }
          lastSalesIds.current = currentSalesIds;

          // Detect New Expenses
          const currentExpenseIds = new Set(expenses.map(e => e.id));
          if (lastExpenseIds.current !== null) {
            const addedExpenses = expenses.filter(e => !lastExpenseIds.current!.has(e.id));
            addedExpenses.forEach(exp => {
              const bizName = businesses.find(b => b.id === exp.businessId)?.name || 'a business';
              newNotifs.push({
                id: `expense-added-${exp.id}`,
                title: "New Expense Logged",
                description: `Admin recorded a new expense for ${bizName}.`,
                type: 'info',
                timestamp: new Date().toISOString(),
                isRead: false,
                actionLabel: 'Check Expenses',
                link: '/expenses'
              });
            });
          }
          lastExpenseIds.current = currentExpenseIds;
        }

        // 3. DETECTION FOR ADMINS (User Activity)
        if (isAdmin) {
          const currentReminderIds = new Set(reminders.map(r => r.id));
          if (lastReminderIds.current !== null) {
            const addedReminders = reminders.filter(r => !lastReminderIds.current!.has(r.id) && r.status === 'pending');
            addedReminders.forEach(rem => {
              newNotifs.push({
                id: `reminder-sent-${rem.id}`,
                title: "User Action Request",
                description: `${rem.sentByUserName} sent a compliance reminder for ${rem.businessName}.`,
                type: 'info',
                timestamp: new Date().toISOString(),
                isRead: false,
                actionLabel: 'Handle Now',
                link: '/reminders'
              });
            });
          }
          lastReminderIds.current = currentReminderIds;
        }

        // Apply findings to state
        setNotifications(prev => {
          const existingIds = new Set(prev.map(n => n.id));
          const filteredNew = newNotifs.filter(n => !existingIds.has(n.id));
          if (filteredNew.length === 0) return prev;
          return [...filteredNew, ...prev].slice(0, 15);
        });

        // 4. UPDATE SIDEBAR BADGES
        const missingCount = businesses.filter(b => !sales.some(s => s.businessId === b.id && s.date === today)).length;
        if (isAdmin) {
          const userSentReminders = reminders.filter(r => r.status === 'pending').length;
          setRemindersCount(userSentReminders + missingCount);
        } else {
          setRemindersCount(missingCount);
        }
      } catch (err) {
        console.error("Integrity Check Error:", err);
      }
    };

    checkAlerts();
    const interval = setInterval(checkAlerts, 8000); // More frequent polling (8s)
    return () => clearInterval(interval);
  }, [user, location.pathname]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const menuItems = [
    { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} />, roles: [UserRole.ADMIN, UserRole.USER] },
    { to: '/businesses', label: 'Businesses', icon: <Store size={20} />, roles: [UserRole.ADMIN, UserRole.USER] },
    { to: '/sales', label: 'Daily Sales', icon: <TrendingUp size={20} />, roles: [UserRole.ADMIN, UserRole.USER] },
    { to: '/expenses', label: 'Monthly Expenses', icon: <Receipt size={20} />, roles: [UserRole.ADMIN, UserRole.USER] },
    { to: '/reports', label: 'Reports', icon: <FileBarChart size={20} />, roles: [UserRole.ADMIN, UserRole.USER] },
    { to: '/reminders', label: 'Reminders', icon: <Send size={20} />, roles: [UserRole.ADMIN, UserRole.USER], badge: remindersCount },
    { to: '/users', label: 'User Management', icon: <Users size={20} />, roles: [UserRole.ADMIN] },
    { to: '/profile', label: 'My Profile', icon: <UserCircle size={20} />, roles: [UserRole.ADMIN, UserRole.USER] },
  ];

  const filteredItems = menuItems.filter(item => item.roles.includes(user?.role as UserRole));

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 w-64 bg-slate-900 text-white z-50 transition-transform duration-300 lg:translate-x-0 lg:static lg:block ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-teal-500 rounded-xl flex items-center justify-center font-bold text-white shadow-lg shadow-teal-500/30">ZL</div>
            <h1 className="text-xl font-bold tracking-tight">ZARlytics</h1>
          </div>
          <nav className="space-y-2">
            {filteredItems.map((item) => (
              <SidebarItem key={item.to} {...item} active={location.pathname === item.to} onClick={() => setIsSidebarOpen(false)} />
            ))}
          </nav>
        </div>
        <div className="absolute bottom-0 w-full p-6 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-6 px-2">
            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold">{user?.name.charAt(0)}</div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold truncate">{user?.name}</p>
              <p className="text-xs text-slate-400 truncate uppercase tracking-tighter font-black">{user?.role}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors">
            <LogOut size={20} />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-30">
          <button className="p-2 -ml-2 text-slate-500 lg:hidden" onClick={() => setIsSidebarOpen(true)}>
            <Menu size={24} />
          </button>
          <div className="flex-1 px-4">
             <h2 className="text-lg font-semibold text-slate-800 capitalize">
               {location.pathname.substring(1).replace('-', ' ') || 'Dashboard'}
             </h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative" ref={notifRef}>
              <button onClick={() => setIsNotifOpen(!isNotifOpen)} className={`p-2 rounded-xl transition-all relative ${isNotifOpen ? 'bg-slate-100 text-teal-600' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}>
                <Bell size={22} />
                {unreadCount > 0 && (
                  <span className={`absolute top-2 right-2 w-2.5 h-2.5 ${notifications.some(n => n.type === 'urgent') ? 'bg-rose-500 animate-ping' : 'bg-rose-500'} border-2 border-white rounded-full`} />
                )}
              </button>

              {isNotifOpen && (
                <div className="absolute right-0 mt-3 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                  <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 text-sm">Action Center</h3>
                    <span className="px-2 py-0.5 bg-teal-100 text-teal-700 text-[10px] font-black rounded-full uppercase">{unreadCount} Updates</span>
                  </div>
                  
                  <div className="max-h-[400px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-10 text-center text-slate-400">
                        <CheckCircle2 size={24} className="mx-auto mb-2 opacity-20" />
                        <p className="text-xs font-medium">All caught up!</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {notifications.map((notif) => (
                          <div key={notif.id} className={`p-4 hover:bg-slate-50/80 transition-colors ${notif.type === 'urgent' ? 'bg-rose-50/30' : ''}`}>
                            <div className="flex gap-3">
                              <div className={`mt-1 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                notif.type === 'urgent' ? 'bg-rose-100 text-rose-600 animate-pulse' : 
                                notif.type === 'info' ? 'bg-blue-100 text-blue-600' :
                                notif.type === 'warning' ? 'bg-amber-100 text-amber-600' : 
                                'bg-teal-100 text-teal-600'
                              }`}>
                                {notif.type === 'info' ? <BellRing size={16} /> : <CalendarDays size={16} />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-bold truncate ${notif.type === 'urgent' ? 'text-rose-600' : 'text-slate-900'}`}>{notif.title}</p>
                                <p className="text-xs text-slate-500 leading-relaxed mb-2">{notif.description}</p>
                                {notif.actionLabel && (
                                  <button onClick={() => { if (notif.link) { navigate(notif.link); setIsNotifOpen(false); } }} className="text-[10px] font-black uppercase tracking-widest text-teal-600 hover:text-teal-700 flex items-center gap-1">
                                    {notif.actionLabel} <ChevronRight size={12} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="h-6 w-px bg-slate-200 hidden sm:block" />
            <Link to="/profile" className="flex items-center gap-2 text-slate-500 hover:text-teal-600 transition-colors">
              <UserCircle size={20} />
              <span className="text-sm font-medium hidden sm:inline">{user?.name}</span>
            </Link>
          </div>
        </header>
        <div className="p-6 max-w-7xl mx-auto w-full">{children}</div>
      </main>
    </div>
  );
};
