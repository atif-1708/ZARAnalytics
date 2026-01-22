
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
  Sparkles
} from 'lucide-react';
import { storage } from '../services/mockStorage';
import { Reminder, UserRole, Business, DailySale } from '../types';
import { useAuth } from '../context/AuthContext';

export const Reminders: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const isObserver = user?.role === UserRole.ADMIN || user?.role === UserRole.ORG_ADMIN || user?.role === UserRole.VIEW_ONLY || user?.role === UserRole.SUPER_ADMIN;
  const isStaff = user?.role === UserRole.STAFF;
  
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [sales, setSales] = useState<DailySale[]>([]);
  const [allReminders, setAllReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const [newlySeenThisSession, setNewlySeenThisSession] = useState<string[]>([]);

  const SEEN_STORAGE_KEY = user ? `zarlytics_seen_alerts_${user.id}` : '';

  const loadData = async () => {
    setLoading(true);
    try {
      const [bData, sData, rData] = await Promise.all([
        storage.getBusinesses(),
        storage.getSales(),
        storage.getReminders()
      ]);
      setBusinesses(bData);
      setSales(sData);
      setAllReminders(rData);

      if (SEEN_STORAGE_KEY) {
        const localSeen = JSON.parse(localStorage.getItem(SEEN_STORAGE_KEY) || '[]');
        setSeenIds(localSeen);
      }
    } catch (err) {
      console.error("Failed to load reminders", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [user]);

  const todayStr = new Date().toISOString().split('T')[0];

  const derivedData = useMemo(() => {
    // 1. Missing entries for Staff (Tasks)
    const assignedBusinesses = businesses.filter(b => user?.assignedBusinessIds?.includes(b.id));
    const missingForStaff = assignedBusinesses.filter(b => 
      !sales.some(s => s.businessId === b.id && s.date === todayStr)
    );

    // 2. Activity Alerts (Recent system events)
    const activeAlerts = allReminders
      .filter(r => r.type === 'system_alert' && r.status === 'pending')
      .slice(0, 30);

    return { missingForStaff, activeAlerts };
  }, [businesses, sales, allReminders, user, todayStr]);

  // Automatic "seen" logic for Observers
  useEffect(() => {
    if (!loading && isObserver && derivedData.activeAlerts.length > 0 && SEEN_STORAGE_KEY) {
      const unseenIds = derivedData.activeAlerts
        .map(a => a.id)
        .filter(id => !seenIds.includes(id));

      if (unseenIds.length > 0) {
        setNewlySeenThisSession(unseenIds);
        const timer = setTimeout(() => {
          const updatedSeen = Array.from(new Set([...seenIds, ...unseenIds]));
          localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(updatedSeen));
          setSeenIds(updatedSeen);
          setNewlySeenThisSession([]);
          window.dispatchEvent(new Event('storage'));
        }, 2500);
        return () => clearTimeout(timer);
      }
    }
  }, [loading, isObserver, derivedData.activeAlerts, SEEN_STORAGE_KEY, seenIds]);

  if (loading) return (
    <div className="h-[60vh] flex items-center justify-center">
      <Loader2 className="animate-spin text-teal-600" size={40} />
    </div>
  );

  return (
    <div className="space-y-10 pb-20 max-w-5xl mx-auto">
      <div className="text-left flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Compliance & Operations</h2>
          <p className="text-slate-500 font-medium tracking-tight">
            {isStaff ? 'Daily task list and submission status' : 'Monitoring real-time business unit operations'}
          </p>
        </div>
        <div className="hidden sm:block">
          <div className="px-4 py-2 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></div>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">System Monitor Active</span>
          </div>
        </div>
      </div>

      {/* STAFF VIEW: COMPLIANCE TASKS */}
      {isStaff && (
        <section className="space-y-6">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-rose-100 text-rose-600 rounded-lg">
              <AlertTriangle size={18} />
            </div>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Daily Sales Compliance Checklist</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {derivedData.missingForStaff.length === 0 ? (
              <div className="col-span-full bg-emerald-50 border border-emerald-100 p-10 rounded-[2.5rem] text-center shadow-sm">
                <div className="w-16 h-16 bg-white text-emerald-500 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <CheckCircle2 size={32} />
                </div>
                <h4 className="text-lg font-bold text-slate-900 mb-1">Status: Fully Compliant</h4>
                <p className="text-slate-500 text-sm font-medium leading-relaxed">Great work! All your assigned business units have submitted their reports for today.</p>
              </div>
            ) : (
              derivedData.missingForStaff.map(biz => (
                <div key={biz.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col justify-between group hover:border-rose-400 transition-all">
                  <div className="text-left">
                    <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      <Store size={24} />
                    </div>
                    <h4 className="text-lg font-black text-slate-900">{biz.name}</h4>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1 mb-4">{biz.location}</p>
                    <div className="p-3 bg-rose-50 rounded-xl border border-rose-100 text-rose-700 text-xs font-bold flex items-center gap-2 animate-pulse">
                      <AlertTriangle size={14} />
                      Sales Entry Required Today
                    </div>
                  </div>
                  <button 
                    onClick={() => navigate('/sales')}
                    className="mt-8 w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-600 transition-all shadow-lg shadow-slate-200"
                  >
                    Resolve Now
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {/* OBSERVER ROLES: ACTIVITY LOG */}
      {isObserver && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-slate-100 text-slate-600 rounded-lg">
                <History size={18} />
              </div>
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Recent Activity Feed</h3>
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-4">
            {derivedData.activeAlerts.length === 0 ? (
              <div className="p-20 bg-white border border-slate-200 rounded-[2.5rem] text-center shadow-sm">
                <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-3xl flex items-center justify-center mx-auto mb-4">
                  <Zap size={32} />
                </div>
                <h4 className="text-lg font-bold text-slate-900 mb-1">Quiet Day</h4>
                <p className="text-slate-500 text-sm font-medium italic">No recent system alerts to display.</p>
              </div>
            ) : (
              derivedData.activeAlerts.map(alert => {
                const isNew = newlySeenThisSession.includes(alert.id);
                const hasBeenSeen = seenIds.includes(alert.id);

                return (
                  <div 
                    key={alert.id} 
                    className={`bg-white p-6 rounded-3xl border shadow-sm flex items-center justify-between transition-all group relative overflow-hidden ${
                      isNew ? 'border-teal-400 ring-4 ring-teal-500/10' : hasBeenSeen ? 'border-slate-100 opacity-80' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-5 z-10">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner transition-all duration-500 ${
                        isNew ? 'bg-teal-600 text-white animate-pulse' : 'bg-slate-50 text-slate-400'
                      }`}>
                        <CheckCircle size={28} />
                      </div>
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-slate-900 text-base uppercase tracking-tight">{alert.businessName}</h4>
                          {isNew && (
                            <span className="flex items-center gap-1 bg-teal-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md animate-bounce">
                              <Sparkles size={8} /> NEW
                            </span>
                          )}
                        </div>
                        <p className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-colors ${
                          isNew ? 'text-teal-600' : 'text-slate-400'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isNew ? 'bg-teal-500' : 'bg-slate-300'}`}></span>
                          Logged by {alert.sentByUserName}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6 z-10">
                      <div className="text-right hidden sm:block">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Time Logged</p>
                        <p className={`text-sm font-bold ${isNew ? 'text-teal-700' : 'text-slate-500'}`}>
                          {new Date(alert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                         <div className="p-3 bg-slate-50 text-slate-300 rounded-2xl">
                          <ChevronRight size={18} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}
    </div>
  );
};
