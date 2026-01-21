
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
  Trash2,
  Check,
  ChevronRight
} from 'lucide-react';
import { storage } from '../services/mockStorage';
import { Reminder, UserRole, Business, DailySale } from '../types';
import { useAuth } from '../context/AuthContext';

export const Reminders: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === UserRole.ADMIN;
  const isViewOnly = user?.role === UserRole.VIEW_ONLY;
  const isStaff = user?.role === UserRole.STAFF;
  
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [sales, setSales] = useState<DailySale[]>([]);
  const [allReminders, setAllReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

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

      // Auto-clear local badge for this user upon viewing the data
      if ((isAdmin || isViewOnly) && user) {
        const pendingIds = rData.filter(r => r.type === 'system_alert' && r.status === 'pending').map(r => r.id);
        if (pendingIds.length > 0) {
          const seenKey = `seen_alerts_${user.id}`;
          const currentSeen = JSON.parse(localStorage.getItem(seenKey) || '[]');
          const updatedSeen = Array.from(new Set([...currentSeen, ...pendingIds]));
          localStorage.setItem(seenKey, JSON.stringify(updatedSeen));
        }
      }
    } catch (err) {
      console.error("Failed to load reminders", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const todayStr = new Date().toISOString().split('T')[0];

  const derivedData = useMemo(() => {
    // 1. Missing entries for Staff (Tasks)
    const assignedBusinesses = businesses.filter(b => user?.assignedBusinessIds?.includes(b.id));
    const missingForStaff = assignedBusinesses.filter(b => 
      !sales.some(s => s.businessId === b.id && s.date === todayStr)
    );

    // 2. Activity Alerts (For Admin/View-Only - Based on global pending status)
    const activeAlerts = allReminders.filter(r => 
      r.type === 'system_alert' && r.status === 'pending'
    );

    return { missingForStaff, activeAlerts };
  }, [businesses, sales, allReminders, user, todayStr]);

  const handleDismissGlobal = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger the card click
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await storage.saveReminder({ id, status: 'read' });
      setAllReminders(prev => prev.map(r => r.id === id ? { ...r, status: 'read' as const } : r));
    } catch (err) {
      console.error("Failed to dismiss alert globally", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearLocal = (id: string) => {
    // This card is already considered "seen" once the page loads, 
    // but clicking it provides feedback and marks it locally.
    if (!user) return;
    const seenKey = `seen_alerts_${user.id}`;
    const currentSeen = JSON.parse(localStorage.getItem(seenKey) || '[]');
    if (!currentSeen.includes(id)) {
      localStorage.setItem(seenKey, JSON.stringify([...currentSeen, id]));
      // Trigger a refresh of any components listening to the badge
      window.dispatchEvent(new Event('storage'));
    }
    // Visually "hide" it by marking globally as read? 
    // The user said "auto hide alert when clicked", so we'll do the global mark-as-read on click 
    // to remove it from the list entirely for EVERYONE, but the badge clearing was the user-specific part.
    handleDismissGlobal(id, { stopPropagation: () => {} } as any);
  };

  const handleDismissAllGlobal = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const pending = derivedData.activeAlerts;
      await Promise.all(pending.map(r => storage.saveReminder({ id: r.id, status: 'read' })));
      await loadData();
    } catch (err) {
      console.error("Failed to dismiss all alerts globally", err);
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) return (
    <div className="h-[60vh] flex items-center justify-center">
      <Loader2 className="animate-spin text-teal-600" size={40} />
    </div>
  );

  return (
    <div className="space-y-10 pb-20 max-w-5xl mx-auto">
      <div className="text-left flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Compliance & Alerts</h2>
          <p className="text-slate-500 font-medium tracking-tight">Monitoring real-time business unit operations</p>
        </div>
        <div className="hidden sm:block">
          <div className="px-4 py-2 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></div>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Live Monitoring</span>
          </div>
        </div>
      </div>

      {/* STAFF VIEW: TASK REMINDERS */}
      {isStaff && (
        <section className="space-y-6">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-100 text-amber-600 rounded-lg">
              <Clock size={18} />
            </div>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Your Action Required</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {derivedData.missingForStaff.length === 0 ? (
              <div className="col-span-full bg-emerald-50 border border-emerald-100 p-10 rounded-[2.5rem] text-center shadow-sm">
                <div className="w-16 h-16 bg-white text-emerald-500 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <CheckCircle2 size={32} />
                </div>
                <h4 className="text-lg font-bold text-slate-900 mb-1">Status: Operational</h4>
                <p className="text-slate-500 text-sm font-medium leading-relaxed">All assigned business units have submitted their daily reports.</p>
              </div>
            ) : (
              derivedData.missingForStaff.map(biz => (
                <div key={biz.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col justify-between group hover:border-amber-400 transition-all">
                  <div className="text-left">
                    <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      <Store size={24} />
                    </div>
                    <h4 className="text-lg font-black text-slate-900">{biz.name}</h4>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1 mb-4">{biz.location}</p>
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-amber-700 text-xs font-bold flex items-center gap-2">
                      <AlertTriangle size={14} />
                      Entry Overdue for Today
                    </div>
                  </div>
                  <button 
                    onClick={() => navigate('/sales')}
                    className="mt-8 w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-teal-600 transition-all shadow-lg shadow-slate-200"
                  >
                    Resolve Entry
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {/* ADMIN & VIEW ONLY: DISMISSIBLE ACTIVITY ALERTS */}
      {(isAdmin || isViewOnly) && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-teal-100 text-teal-600 rounded-lg">
                <BellRing size={18} />
              </div>
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Activity Alerts (New Entries)</h3>
            </div>
            {derivedData.activeAlerts.length > 0 && (
              <button 
                onClick={handleDismissAllGlobal}
                disabled={isProcessing}
                className="text-[10px] font-black text-teal-600 hover:text-teal-800 flex items-center gap-2 uppercase tracking-widest bg-teal-50 px-4 py-2 rounded-xl transition-all border border-teal-100 disabled:opacity-50"
              >
                <Check size={14} />
                Dismiss All Globally
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-1 gap-4">
            {derivedData.activeAlerts.length === 0 ? (
              <div className="p-20 bg-white border border-slate-200 rounded-[2.5rem] text-center shadow-sm">
                <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-3xl flex items-center justify-center mx-auto mb-4">
                  <Zap size={32} />
                </div>
                <h4 className="text-lg font-bold text-slate-900 mb-1">No New Alerts</h4>
                <p className="text-slate-500 text-sm font-medium italic">You're all caught up with staff activity.</p>
              </div>
            ) : (
              derivedData.activeAlerts.map(alert => (
                <div 
                  key={alert.id} 
                  onClick={() => handleClearLocal(alert.id)}
                  className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md hover:border-teal-200 transition-all group cursor-pointer relative overflow-hidden"
                >
                  <div className="flex items-center gap-5 z-10">
                    <div className="w-14 h-14 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center shadow-inner group-hover:bg-teal-600 group-hover:text-white transition-all duration-300">
                      <CheckCircle size={28} />
                    </div>
                    <div className="text-left">
                      <h4 className="font-black text-slate-900 text-base uppercase tracking-tight">{alert.businessName}</h4>
                      <p className="text-[10px] font-black text-emerald-600 group-hover:text-teal-700 uppercase tracking-widest flex items-center gap-1.5 transition-colors">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 group-hover:bg-teal-600 transition-colors"></span>
                        Logged by {alert.sentByUserName}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6 z-10">
                    <div className="text-right hidden sm:block">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Time Logged</p>
                      <p className="text-sm font-bold text-slate-700">
                        {new Date(alert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                       <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity translate-x-4 group-hover:translate-x-0 duration-300">
                         Dismiss Alert
                       </span>
                       <div className="p-3 bg-slate-50 text-slate-300 group-hover:bg-teal-50 group-hover:text-teal-600 rounded-2xl transition-all">
                        <ChevronRight size={18} />
                      </div>
                    </div>
                  </div>

                  <div className="absolute inset-y-0 right-0 w-1 bg-teal-500 translate-x-full group-hover:translate-x-0 transition-transform duration-300" />
                </div>
              ))
            )}
          </div>
        </section>
      )}
    </div>
  );
};
