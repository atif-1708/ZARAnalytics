
import React, { useState, useEffect } from 'react';
// Added useNavigate import to resolve the missing navigate variable error
import { useNavigate } from 'react-router-dom';
import { Send, Trash2, CheckCircle, Clock, Store, Loader2, AlertCircle, AlertTriangle, BellRing } from 'lucide-react';
import { storage } from '../services/mockStorage';
import { Reminder, UserRole, Business, DailySale } from '../types';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/formatters';

export const Reminders: React.FC = () => {
  const { user } = useAuth();
  // Initialize navigate using the useNavigate hook
  const navigate = useNavigate();
  const isAdmin = user?.role === UserRole.ADMIN;
  
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

  const handleSendReminder = async (biz: Business) => {
    if (!user) return;
    setProcessingId(biz.id);
    try {
      const today = new Date().toISOString().split('T')[0];
      await storage.saveReminder({
        businessId: biz.id,
        businessName: biz.name,
        date: today,
        sentBy: user.id,
        sentByUserName: user.name,
        status: 'pending',
        type: 'user_sent'
      });
      await loadData();
    } finally {
      setProcessingId(null);
    }
  };

  const handleMarkRead = async (reminder: Reminder) => {
    setProcessingId(reminder.id);
    try {
      await storage.saveReminder({ ...reminder, status: 'read' });
      await loadData();
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete record?")) return;
    setProcessingId(id);
    try {
      await storage.deleteReminder(id);
      await loadData();
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-teal-600" size={40} /></div>;

  const today = new Date().toISOString().split('T')[0];
  const missingEntries = businesses.filter(b => !sales.some(s => s.businessId === b.id && s.date === today));
  
  const pending = reminders.filter(r => r.status === 'pending');
  const handled = reminders.filter(r => r.status === 'read');

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Business Compliance Center</h2>
        <p className="text-slate-500">Monitor and alert for missing daily data entries</p>
      </div>

      {!isAdmin && (
        <section className="space-y-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" />
            Pending Your Action: Missing Entries
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {missingEntries.length === 0 ? (
              <div className="col-span-full bg-emerald-50 border border-emerald-100 p-8 rounded-2xl text-center">
                <CheckCircle className="mx-auto mb-2 text-emerald-500" />
                <p className="text-emerald-700 font-bold">All businesses are up to date for today!</p>
              </div>
            ) : (
              missingEntries.map(biz => {
                const alreadySent = reminders.some(r => r.businessId === biz.id && r.date === today && r.status === 'pending');
                return (
                  <div key={biz.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between group">
                    <div>
                      <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-4 group-hover:bg-amber-100 transition-colors">
                        <Store size={20} />
                      </div>
                      <h4 className="font-bold text-slate-900">{biz.name}</h4>
                      <p className="text-xs text-slate-500 mt-1">Daily sales entry missing for {formatDate(today)}</p>
                    </div>
                    <div className="mt-6 pt-4 border-t border-slate-50">
                      {alreadySent ? (
                        <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold bg-emerald-50 p-2 rounded-lg">
                          <CheckCircle size={14} />
                          Reminder Sent to Admin
                        </div>
                      ) : (
                        <button 
                          onClick={() => handleSendReminder(biz)}
                          disabled={processingId === biz.id}
                          className="w-full flex items-center justify-center gap-2 bg-teal-600 text-white py-2 rounded-xl text-sm font-bold hover:bg-teal-700 transition-all shadow-lg shadow-teal-600/10"
                        >
                          {processingId === biz.id ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                          Notify Administrator
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}

      {isAdmin && (
        <div className="grid grid-cols-1 gap-10">
          {/* Admin System Alerts */}
          <section className="space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-rose-500 flex items-center gap-2">
              <Clock size={16} />
              System Alerts: Missed Deadlines ({missingEntries.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {missingEntries.map(biz => (
                <div key={biz.id} className="bg-white p-6 rounded-2xl border-l-4 border-rose-500 border-y border-r border-slate-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900">{biz.name}</h4>
                    <p className="text-xs text-rose-500 font-medium">Auto-alert: Entry required immediately</p>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Deadline: 10 PM PKT</span>
                    <button onClick={() => navigate('/sales')} className="text-xs font-bold text-teal-600 hover:underline">Add Sale</button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* User Reminders */}
          <section className="space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <BellRing size={16} />
              User Reminders for You ({pending.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pending.length === 0 ? (
                <p className="text-slate-400 text-sm italic col-span-full py-4 text-center">No active reminders from users.</p>
              ) : (
                pending.map(r => (
                  <div key={r.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col group">
                    <div className="flex justify-between mb-4">
                      <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                        <Store size={20} />
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => handleMarkRead(r)} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg"><CheckCircle size={18} /></button>
                         <button onClick={() => handleDelete(r.id)} className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg"><Trash2 size={18} /></button>
                      </div>
                    </div>
                    <h4 className="font-bold text-slate-900">{r.businessName}</h4>
                    <p className="text-xs text-slate-500 mb-4">Requesting sales entry for {formatDate(r.date)}</p>
                    <div className="mt-auto pt-4 border-t border-slate-50 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold">
                        {r.sentByUserName.charAt(0)}
                      </div>
                      <span className="text-[10px] text-slate-400">Alert from <strong className="text-slate-700">{r.sentByUserName}</strong></span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* History */}
          {handled.length > 0 && (
            <section className="space-y-4 opacity-50">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <CheckCircle size={16} />
                Handled Reminders ({handled.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {handled.map(r => (
                  <div key={r.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-center">
                    <div>
                      <p className="text-xs font-bold text-slate-900 truncate">{r.businessName}</p>
                      <p className="text-[10px] text-slate-400">{formatDate(r.date)}</p>
                    </div>
                    <button onClick={() => handleDelete(r.id)} className="p-2 text-slate-400 hover:text-rose-600"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};
