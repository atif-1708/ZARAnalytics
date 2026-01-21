
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Send, 
  CheckCircle2, 
  Clock, 
  Store, 
  Loader2, 
  AlertTriangle, 
  BellRing,
  CheckCircle,
  History,
  Info
} from 'lucide-react';
import { storage } from '../services/mockStorage';
import { Reminder, UserRole, Business, DailySale } from '../types';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/formatters';

export const Reminders: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === UserRole.ADMIN;
  const isViewOnly = user?.role === UserRole.VIEW_ONLY;
  const isStaff = user?.role === UserRole.STAFF;
  
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [sales, setSales] = useState<DailySale[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rData, bData, sData] = await Promise.all([
        storage.getReminders(),
        storage.getBusinesses(),
        storage.getSales()
      ]);
      setReminders(rData);
      setBusinesses(bData);
      setSales(sData);
    } catch (err) {
      console.error("Failed to load reminders", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const todayStr = new Date().toISOString().split('T')[0];

  // Logic for different tiers
  const data = useMemo(() => {
    // 1. Missing entries for Staff (Only their assigned shops)
    const assignedBusinesses = businesses.filter(b => user?.assignedBusinessIds?.includes(b.id));
    const missingForStaff = assignedBusinesses.filter(b => 
      !sales.some(s => s.businessId === b.id && s.date === todayStr)
    );

    // 2. Global Missing (For Admin oversight)
    const missingGlobal = businesses.filter(b => 
      !sales.some(s => s.businessId === b.id && s.date === todayStr)
    );

    // 3. Completed Entries (For Admin/View-Only Alerts)
    const completedToday = businesses.filter(b => 
      sales.some(s => s.businessId === b.id && s.date === todayStr)
    ).map(b => {
      const sale = sales.find(s => s.businessId === b.id && s.date === todayStr);
      return { ...b, saleTime: sale?.createdAt };
    });

    return { missingForStaff, missingGlobal, completedToday };
  }, [businesses, sales, user, todayStr]);

  if (loading) return (
    <div className="h-[60vh] flex items-center justify-center">
      <Loader2 className="animate-spin text-teal-600" size={40} />
    </div>
  );

  return (
    <div className="space-y-10 pb-20">
      <div className="text-left">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Compliance & Activity</h2>
        <p className="text-slate-500 font-medium">Real-time status of business unit operations</p>
      </div>

      {/* STAFF VIEW: TASK REMINDERS */}
      {isStaff && (
        <section className="space-y-6">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-100 text-amber-600 rounded-lg">
              <Clock size={18} />
            </div>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Your Task Reminders</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.missingForStaff.length === 0 ? (
              <div className="col-span-full bg-emerald-50 border border-emerald-100 p-10 rounded-[2.5rem] text-center shadow-sm">
                <div className="w-16 h-16 bg-white text-emerald-500 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <CheckCircle2 size={32} />
                </div>
                <h4 className="text-lg font-bold text-slate-900 mb-1">Shift Complete</h4>
                <p className="text-slate-500 text-sm font-medium">All your assigned units have reported sales for today.</p>
              </div>
            ) : (
              data.missingForStaff.map(biz => (
                <div key={biz.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col justify-between group hover:border-amber-400 transition-all">
                  <div className="text-left">
                    <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      <Store size={24} />
                    </div>
                    <h4 className="text-lg font-black text-slate-900">{biz.name}</h4>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1 mb-4">{biz.location}</p>
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-amber-700 text-xs font-bold flex items-center gap-2">
                      <AlertTriangle size={14} />
                      Sales Entry Missing Today
                    </div>
                  </div>
                  <button 
                    onClick={() => navigate('/sales')}
                    className="mt-8 w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-teal-600 transition-all shadow-lg shadow-slate-200"
                  >
                    Go to Entry Portal
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {/* ADMIN & VIEW ONLY: COMPLETION ALERTS */}
      {(isAdmin || isViewOnly) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          
          {/* Section: Activity Alerts (Success) */}
          <section className="space-y-6">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-teal-100 text-teal-600 rounded-lg">
                <BellRing size={18} />
              </div>
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Activity Alerts (Completed)</h3>
            </div>
            
            <div className="space-y-4">
              {data.completedToday.length === 0 ? (
                <div className="p-10 border-2 border-dashed border-slate-200 rounded-[2.5rem] text-center text-slate-400 font-bold text-sm italic">
                  Waiting for staff activity alerts...
                </div>
              ) : (
                data.completedToday.map(biz => (
                  <div key={biz.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center">
                        <CheckCircle size={24} />
                      </div>
                      <div className="text-left">
                        <h4 className="font-black text-slate-800 text-sm uppercase tracking-tight">{biz.name}</h4>
                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Sale Recorded Successfully</p>
                      </div>
                    </div>
                    <div className="text-right">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Status Received</p>
                       <p className="text-xs font-bold text-slate-600">{biz.saleTime ? new Date(biz.saleTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Section: Global Oversight (Missed) */}
          <section className="space-y-6">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-rose-100 text-rose-600 rounded-lg">
                <Info size={18} />
              </div>
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Global Oversight (Missing)</h3>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              {data.missingGlobal.length === 0 ? (
                <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-3xl flex items-center gap-4">
                   <div className="w-10 h-10 bg-white text-emerald-600 rounded-xl flex items-center justify-center shadow-sm"><CheckCircle2 size={20}/></div>
                   <p className="text-xs font-black text-emerald-800 uppercase tracking-widest">Global Synchronization Achieved</p>
                </div>
              ) : (
                data.missingGlobal.map(biz => (
                  <div key={biz.id} className="bg-white p-6 rounded-3xl border border-rose-100 flex items-center justify-between group hover:bg-rose-50/30 transition-colors">
                    <div className="flex items-center gap-4 text-left">
                      <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center">
                        <AlertTriangle size={24} />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{biz.name}</h4>
                        <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Action Required: No Data</p>
                      </div>
                    </div>
                    {isAdmin && (
                      <button 
                        onClick={() => navigate('/sales')}
                        className="p-3 text-slate-400 hover:text-slate-900 transition-colors"
                        title="Force Entry"
                      >
                        <Send size={18} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>

        </div>
      )}
    </div>
  );
};
