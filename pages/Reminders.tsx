
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
  Zap
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
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [bData, sData] = await Promise.all([
        storage.getBusinesses(),
        storage.getSales()
      ]);
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

  const data = useMemo(() => {
    // 1. Missing entries for Staff (Only their assigned shops)
    const assignedBusinesses = businesses.filter(b => user?.assignedBusinessIds?.includes(b.id));
    const missingForStaff = assignedBusinesses.filter(b => 
      !sales.some(s => s.businessId === b.id && s.date === todayStr)
    );

    // 2. Completed Entries (For Admin/View-Only Alerts)
    const completedToday = businesses.filter(b => 
      sales.some(s => s.businessId === b.id && s.date === todayStr)
    ).map(b => {
      const sale = sales.find(s => s.businessId === b.id && s.date === todayStr);
      return { ...b, saleTime: sale?.createdAt };
    }).sort((a, b) => new Date(b.saleTime || 0).getTime() - new Date(a.saleTime || 0).getTime());

    return { missingForStaff, completedToday };
  }, [businesses, sales, user, todayStr]);

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
          <p className="text-slate-500 font-medium">Monitoring business unit synchronization</p>
        </div>
        <div className="hidden sm:block">
          <div className="px-4 py-2 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></div>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Live Feed</span>
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
            {data.missingForStaff.length === 0 ? (
              <div className="col-span-full bg-emerald-50 border border-emerald-100 p-10 rounded-[2.5rem] text-center shadow-sm">
                <div className="w-16 h-16 bg-white text-emerald-500 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <CheckCircle2 size={32} />
                </div>
                <h4 className="text-lg font-bold text-slate-900 mb-1">Status: Operational</h4>
                <p className="text-slate-500 text-sm font-medium leading-relaxed">All assigned business units have submitted their daily reports.</p>
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
                      Entry Overdue
                    </div>
                  </div>
                  <button 
                    onClick={() => navigate('/sales')}
                    className="mt-8 w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-teal-600 transition-all shadow-lg shadow-slate-200"
                  >
                    Resolve Now
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {/* ADMIN & VIEW ONLY: ACTIVITY FEED ONLY */}
      {(isAdmin || isViewOnly) && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-teal-100 text-teal-600 rounded-lg">
                <BellRing size={18} />
              </div>
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Activity Alerts (Today's Entries)</h3>
            </div>
            <span className="text-[10px] font-black text-teal-600 bg-teal-50 px-3 py-1 rounded-full uppercase tracking-tighter border border-teal-100">
              {data.completedToday.length} Successful Submissions
            </span>
          </div>
          
          <div className="grid grid-cols-1 gap-4">
            {data.completedToday.length === 0 ? (
              <div className="p-20 bg-white border border-slate-200 rounded-[2.5rem] text-center shadow-sm">
                <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-3xl flex items-center justify-center mx-auto mb-4">
                  <Zap size={32} />
                </div>
                <h4 className="text-lg font-bold text-slate-900 mb-1">Quiet Day So Far</h4>
                <p className="text-slate-500 text-sm font-medium italic">No staff activity has been recorded yet for today.</p>
              </div>
            ) : (
              data.completedToday.map(biz => (
                <div key={biz.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md transition-all group">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center shadow-inner group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                      <CheckCircle size={28} />
                    </div>
                    <div className="text-left">
                      <h4 className="font-black text-slate-900 text-base uppercase tracking-tight">{biz.name}</h4>
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Data Packet Synchronized
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Time Logged</p>
                    <p className="text-sm font-bold text-slate-700">
                      {biz.saleTime ? new Date(biz.saleTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : 'Recently'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}
    </div>
  );
};
