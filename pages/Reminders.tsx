
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CheckCircle2, 
  Clock, 
  Store, 
  Loader2, 
  AlertTriangle, 
  BellRing,
  CheckCircle,
  Zap,
  ChevronRight,
  CheckCheck,
  History,
  Sparkles,
  ShieldAlert,
  Terminal,
  Activity,
  User,
  Building2,
  ShieldCheck,
  CalendarX,
  AlertCircle,
  CreditCard,
  ArrowRight
} from 'lucide-react';
import { storage } from '../services/mockStorage';
import { Reminder, UserRole, Business, DailySale, Organization } from '../types';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/formatters';

export const Reminders: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;
  const isObserver = user?.role === UserRole.ADMIN || user?.role === UserRole.ORG_ADMIN || user?.role === UserRole.VIEW_ONLY || isSuperAdmin;
  const isStaff = user?.role === UserRole.STAFF;
  
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [sales, setSales] = useState<DailySale[]>([]);
  const [allReminders, setAllReminders] = useState<Reminder[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [bData, sData, rData, oData] = await Promise.all([
        storage.getBusinesses(),
        storage.getSales(),
        storage.getReminders(),
        isSuperAdmin ? storage.getOrganizations() : Promise.resolve([])
      ]);
      setBusinesses(bData);
      setSales(sData);
      setAllReminders(rData);
      setOrganizations(oData);
    } catch (err) {
      console.error("Failed to load audit data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [user]);

  const todayStr = new Date().toISOString().split('T')[0];
  const today = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(today.getDate() + 30);

  const derivedData = useMemo(() => {
    // 1. Staff Tasks (Still relevant for staff users)
    const assignedBusinesses = businesses.filter(b => user?.assignedBusinessIds?.includes(b.id));
    const missingForStaff = assignedBusinesses.filter(b => 
      !sales.some(s => s.businessId === b.id && s.date === todayStr)
    );

    // 2. Super Admin Subscription Audit
    let subscriptionAlerts: any[] = [];
    if (isSuperAdmin) {
      subscriptionAlerts = organizations.map(org => {
        const endDate = new Date(org.subscriptionEndDate);
        const isExpired = endDate < today;
        const isExpiringSoon = !isExpired && endDate <= thirtyDaysFromNow;
        
        return {
          ...org,
          isExpired,
          isExpiringSoon,
          daysRemaining: Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        };
      }).filter(org => org.isExpired || org.isExpiringSoon)
        .sort((a, b) => {
          // Expired items first, then by date proximity
          if (a.isExpired && !b.isExpired) return -1;
          if (!a.isExpired && b.isExpired) return 1;
          return new Date(a.subscriptionEndDate).getTime() - new Date(b.subscriptionEndDate).getTime();
        });
    }

    // 3. Regular System Alerts for non-super admins
    const activeAlerts = !isSuperAdmin 
      ? allReminders.filter(r => r.type === 'system_alert' && r.status === 'pending')
      : [];

    return { missingForStaff, subscriptionAlerts, activeAlerts };
  }, [businesses, sales, allReminders, organizations, user, todayStr, isSuperAdmin]);

  if (loading) return (
    <div className={`h-[60vh] flex flex-col items-center justify-center ${isSuperAdmin ? 'text-indigo-400' : 'text-teal-600'}`}>
      <Loader2 className="animate-spin mb-4" size={40} />
      <p className="text-[10px] font-black uppercase tracking-widest animate-pulse">Scanning Platform Nodes...</p>
    </div>
  );

  return (
    <div className="space-y-10 pb-20 max-w-5xl mx-auto">
      <div className="text-left flex items-end justify-between">
        <div>
          <h2 className={`text-3xl font-black tracking-tight ${isSuperAdmin ? 'text-white' : 'text-slate-900'}`}>
            {isSuperAdmin ? 'Platform Lifecycle Audit' : 'Compliance & Operations'}
          </h2>
          <p className="text-slate-500 font-medium tracking-tight">
            {isSuperAdmin ? 'Dynamic monitoring of tenant billing cycles and subscription health' : (isStaff ? 'Daily task list and submission status' : 'Monitoring real-time business unit operations')}
          </p>
        </div>
        <div className="hidden sm:block">
          <div className={`px-4 py-2 border rounded-2xl shadow-sm flex items-center gap-2 ${isSuperAdmin ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}>
            <div className={`w-2 h-2 rounded-full animate-pulse ${isSuperAdmin ? 'bg-indigo-500' : 'bg-teal-500'}`}></div>
            <span className={`text-[10px] font-black uppercase tracking-widest ${isSuperAdmin ? 'text-indigo-400' : 'text-slate-400'}`}>
              {isSuperAdmin ? 'Kernel Audit Active' : 'System Monitor Active'}
            </span>
          </div>
        </div>
      </div>

      {isSuperAdmin && (
        <div className="p-10 bg-indigo-600 rounded-[3rem] text-white flex flex-col md:flex-row items-center gap-8 shadow-2xl shadow-indigo-500/20 text-left relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:scale-110 transition-transform pointer-events-none">
             <CreditCard size={180} />
           </div>
           <div className="w-20 h-20 bg-white/20 rounded-[2rem] flex items-center justify-center shrink-0 shadow-inner">
             <ShieldCheck size={40} />
           </div>
           <div className="relative z-10">
             <h3 className="text-2xl font-black tracking-tighter">Billing Compliance Center</h3>
             <p className="text-indigo-100 text-sm font-medium mt-2 max-w-lg leading-relaxed">
               The system has automatically filtered all operational logs to prioritize high-risk tenant expirations. Act quickly on expired nodes to maintain platform integrity.
             </p>
           </div>
        </div>
      )}

      {/* STAFF VIEW: COMPLIANCE TASKS */}
      {isStaff && (
        <section className="space-y-6">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-rose-100 text-rose-600 rounded-lg">
              <AlertTriangle size={18} />
            </div>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Daily Sales Compliance Checklist</h3>
          </div>
          {/* ... existing staff view code can go here ... */}
        </section>
      )}

      {/* SUPER ADMIN SUBSCRIPTION AUDIT */}
      {isSuperAdmin && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-600/20 text-indigo-400">
                <Terminal size={18} />
              </div>
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                Subscription Lifecycle Stream
              </h3>
            </div>
            <div className="text-[10px] font-black text-indigo-500 uppercase tracking-widest px-3 py-1 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
               {derivedData.subscriptionAlerts.length} Flagged Tenants
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-6">
            {derivedData.subscriptionAlerts.length === 0 ? (
              <div className="p-20 border-2 border-dashed border-white/5 rounded-[3rem] text-center bg-white/5">
                <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-3xl flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={32} />
                </div>
                <h4 className="text-xl font-black text-white mb-1">Contract Compliance Maintained</h4>
                <p className="text-slate-500 text-sm font-medium italic">All tenants are within safe subscription bounds.</p>
              </div>
            ) : (
              derivedData.subscriptionAlerts.map(org => (
                <div 
                  key={org.id} 
                  className={`p-8 rounded-[2.5rem] border shadow-2xl flex flex-col md:flex-row items-center justify-between transition-all group relative overflow-hidden ${
                    org.isExpired 
                      ? 'bg-rose-950/20 border-rose-500/30' 
                      : 'bg-amber-950/20 border-amber-500/30'
                  }`}
                >
                  <div className="flex items-center gap-6 z-10 text-left w-full">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-500 shrink-0 ${
                      org.isExpired 
                        ? 'bg-rose-600 text-white animate-pulse' 
                        : 'bg-amber-500 text-white'
                    }`}>
                      {org.isExpired ? <CalendarX size={32} /> : <AlertCircle size={32} />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h4 className="font-black text-2xl text-white tracking-tighter uppercase">{org.name}</h4>
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg ${
                          org.isExpired ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'
                        }`}>
                          {org.isExpired ? 'LICENSE_EXPIRED' : 'LICENSE_STALE'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-2">
                         <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                           <Building2 size={12} className="text-indigo-400" />
                           Node ID: {org.id.substring(0, 8)}...
                         </p>
                         <p className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${org.isExpired ? 'text-rose-400' : 'text-amber-400'}`}>
                           <Clock size={12} />
                           {org.isExpired 
                              ? `Contract ended on ${formatDate(org.subscriptionEndDate)}` 
                              : `Ends in ${org.daysRemaining} days (${formatDate(org.subscriptionEndDate)})`}
                         </p>
                      </div>
                    </div>
                    
                    <button 
                       onClick={() => navigate('/organizations')}
                       className={`px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all shadow-xl group/btn ${
                         org.isExpired 
                           ? 'bg-rose-600 text-white hover:bg-rose-500' 
                           : 'bg-white text-slate-900 hover:bg-indigo-50'
                       }`}
                    >
                      {org.isExpired ? 'Renew License' : 'Manage Subscription'}
                      <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {/* REGULAR ALERTS VIEW (For other roles) */}
      {!isSuperAdmin && isObserver && (
        <section className="space-y-6 text-left">
          <div className="flex items-center gap-2">
             <div className="p-1.5 bg-slate-100 text-slate-600 rounded-lg">
                <BellRing size={18} />
             </div>
             <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Activity Alerts</h3>
          </div>
          <div className="grid grid-cols-1 gap-4">
             {derivedData.activeAlerts.map(alert => (
               <div key={alert.id} className="p-6 bg-white border border-slate-200 rounded-3xl shadow-sm flex items-center justify-between">
                 <div className="flex items-center gap-4">
                   <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center">
                     <CheckCircle size={24} />
                   </div>
                   <div>
                     <p className="text-sm font-black text-slate-900">{alert.businessName}</p>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Entry Confirmed • {formatDate(alert.date)}</p>
                   </div>
                 </div>
                 <button onClick={() => navigate('/sales')} className="p-2 text-slate-300 hover:text-teal-600 transition-colors">
                   <ChevronRight size={20} />
                 </button>
               </div>
             ))}
          </div>
        </section>
      )}
    </div>
  );
};
