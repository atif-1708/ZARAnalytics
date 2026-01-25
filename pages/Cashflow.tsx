
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Coins, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight, 
  History, 
  Store, 
  User, 
  Clock, 
  AlertCircle,
  CheckCircle2,
  Database,
  Loader2,
  Lock,
  Unlock,
  Banknote,
  PiggyBank,
  RefreshCcw,
  Copy
} from 'lucide-react';
import { storage } from '../services/mockStorage';
import { useAuth } from '../context/AuthContext';
import { CashShift, Business, UserRole, CashMovement } from '../types';
import { formatZAR, formatDate } from '../utils/formatters';

const MISSING_CASHFLOW_SCHEMA = `-- Cashflow Management Tables
CREATE TABLE IF NOT EXISTS cash_shifts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid REFERENCES businesses(id),
  user_id uuid REFERENCES profiles(id),
  user_name text,
  opened_at timestamptz DEFAULT now(),
  closed_at timestamptz,
  opening_float numeric DEFAULT 0,
  closing_cash_counted numeric,
  expected_cash numeric,
  variance numeric,
  status text DEFAULT 'OPEN',
  notes text,
  org_id uuid REFERENCES organizations(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cash_movements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_id uuid REFERENCES cash_shifts(id),
  business_id uuid REFERENCES businesses(id),
  type text, -- DROP, PAYOUT, FLOAT_ADD
  amount numeric,
  reason text,
  user_id uuid,
  org_id uuid REFERENCES organizations(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE cash_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all authenticated" ON cash_shifts;
CREATE POLICY "Allow all authenticated" ON cash_shifts FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow all authenticated" ON cash_movements;
CREATE POLICY "Allow all authenticated" ON cash_movements FOR ALL TO authenticated USING (true);`;

export const Cashflow: React.FC = () => {
  const { user } = useAuth();
  const [shifts, setShifts] = useState<CashShift[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>('all');
  const [schemaError, setSchemaError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expandedShift, setExpandedShift] = useState<string | null>(null);
  const [shiftMovements, setShiftMovements] = useState<CashMovement[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);

  // Live Metrics
  const [activeShift, setActiveShift] = useState<CashShift | null>(null);
  const [liveBalance, setLiveBalance] = useState<number>(0);
  const [unbankedCash, setUnbankedCash] = useState<number>(0);

  const loadData = async () => {
    setLoading(true);
    try {
      const [bData, sData] = await Promise.all([
        storage.getBusinesses(),
        storage.getShiftHistory(selectedBusinessId === 'all' ? undefined : selectedBusinessId)
      ]);
      
      const filteredBiz = bData.filter(b => 
        user?.role === UserRole.SUPER_ADMIN || 
        user?.role === UserRole.ORG_ADMIN || 
        user?.role === UserRole.ADMIN ||
        user?.assignedBusinessIds?.includes(b.id)
      );
      setBusinesses(filteredBiz);
      setShifts(sData);
      setSchemaError(false);

      // Check for Active Shift for current user if filtered to specific biz or just generic check
      // For dashboard, we might want to see ALL active shifts, but for simplicity let's show the user's active shift
      // or aggregation of all open shifts.
      // Let's do aggregation of open shifts for the dashboard metrics
      const openShifts = sData.filter(s => s.status === 'OPEN');
      
      if (openShifts.length > 0) {
        // Just grab the first one for the "Live" display for now, or aggregate if multiple
        // Complex logic: If 'all' is selected, sum them. If specific biz, show that one.
        const targetShifts = selectedBusinessId === 'all' 
          ? openShifts 
          : openShifts.filter(s => s.businessId === selectedBusinessId);

        if (targetShifts.length > 0) {
           let totalLive = 0;
           let totalUnbanked = 0;
           
           for (const shift of targetShifts) {
              const sales = await storage.getShiftAggregates(shift.businessId, shift.openedAt);
              const movements = await storage.getShiftMovements(shift.id);
              const adds = movements.filter(m => m.type === 'FLOAT_ADD').reduce((a,c) => a + c.amount, 0);
              const drops = movements.filter(m => m.type === 'DROP').reduce((a,c) => a + c.amount, 0);
              const payouts = movements.filter(m => m.type === 'PAYOUT').reduce((a,c) => a + c.amount, 0);
              
              const shiftBalance = shift.openingFloat + sales + adds - drops - payouts;
              totalLive += shiftBalance;
              totalUnbanked += drops; 
           }
           setLiveBalance(totalLive);
           setUnbankedCash(totalUnbanked);
           setActiveShift(targetShifts[0]); // Just for visual indication that "Active" exists
        } else {
           setLiveBalance(0);
           setUnbankedCash(0);
           setActiveShift(null);
        }
      } else {
        setLiveBalance(0);
        setUnbankedCash(0);
        setActiveShift(null);
      }

    } catch (e: any) {
      if (e.message?.includes('relation') || e.code === '42P01') {
        setSchemaError(true);
      }
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [user, selectedBusinessId]);

  const loadMovements = async (shiftId: string) => {
    if (expandedShift === shiftId) {
      setExpandedShift(null);
      return;
    }
    setExpandedShift(shiftId);
    setMovementsLoading(true);
    try {
      const moves = await storage.getShiftMovements(shiftId);
      setShiftMovements(moves);
    } catch(e) {
      console.error(e);
    } finally {
      setMovementsLoading(false);
    }
  };

  const copySql = () => {
    navigator.clipboard.writeText(MISSING_CASHFLOW_SCHEMA);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-teal-600" size={40} /></div>;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="text-left">
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Liquidity & Cashflow</h2>
          <p className="text-slate-500">Till reconciliation, float management, and cash variance auditing</p>
        </div>
        
        <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
          <Store size={14} className="text-slate-400" />
          <select 
            value={selectedBusinessId} 
            onChange={e => setSelectedBusinessId(e.target.value)} 
            className="bg-transparent text-[11px] font-black text-slate-700 outline-none cursor-pointer w-full uppercase tracking-widest min-w-[150px]"
          >
            <option value="all">All Locations</option>
            {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      </div>

      {schemaError && (
        <div className="p-8 bg-amber-50 border border-amber-100 rounded-[2rem] flex flex-col md:flex-row items-center gap-8 text-left animate-in slide-in-from-top-4">
           <div className="w-16 h-16 bg-amber-500 text-white rounded-3xl flex items-center justify-center shrink-0 shadow-lg shadow-amber-200">
             <Database size={32} />
           </div>
           <div className="flex-1 space-y-2">
              <h4 className="text-lg font-black text-amber-800 uppercase tracking-tight">Database Update Required</h4>
              <p className="text-sm text-amber-700 font-medium leading-relaxed">
                The cash management tables are missing. Please run the SQL script below in your Supabase SQL Editor.
              </p>
           </div>
           <div className="flex flex-col gap-2">
             <button onClick={copySql} className="bg-white text-amber-600 border border-amber-200 px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-amber-50 transition-colors flex items-center justify-center gap-2">
                {copied ? <CheckCircle2 size={14}/> : <Copy size={14}/>} {copied ? 'Script Copied' : 'Copy SQL Script'}
             </button>
             <button onClick={() => setSchemaError(false)} className="text-amber-400 text-[10px] font-bold uppercase tracking-widest hover:underline">Dismiss</button>
           </div>
        </div>
      )}

      {/* Live Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col justify-between h-40 relative overflow-hidden">
            <div className="flex justify-between items-start relative z-10">
               <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><Coins size={24}/></div>
               {activeShift && (
                 <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500 text-white rounded-full text-[9px] font-black uppercase tracking-widest animate-pulse shadow-lg shadow-emerald-200">
                   <div className="w-1.5 h-1.5 bg-white rounded-full" /> Live
                 </span>
               )}
            </div>
            <div className="relative z-10">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Live Till Balance</p>
               <h3 className="text-3xl font-black text-slate-900">{formatZAR(liveBalance)}</h3>
            </div>
         </div>

         <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col justify-between h-40">
            <div className="flex justify-between items-start">
               <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><PiggyBank size={24}/></div>
            </div>
            <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Safe / Unbanked</p>
               <h3 className="text-3xl font-black text-indigo-600">{formatZAR(unbankedCash)}</h3>
            </div>
         </div>

         <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col justify-between h-40">
            <div className="flex justify-between items-start">
               <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl"><AlertCircle size={24}/></div>
            </div>
            <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Net Variance (Month)</p>
               <h3 className={`text-3xl font-black ${shifts.reduce((a,c) => a + (c.variance || 0), 0) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                 {formatZAR(shifts.reduce((a,c) => a + (c.variance || 0), 0))}
               </h3>
            </div>
         </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
         <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
               <History size={18} className="text-slate-400"/> Shift Reconciliation Ledger
            </h3>
            <button onClick={loadData} className="p-2 text-slate-400 hover:text-teal-600 transition-colors">
               <RefreshCcw size={16} />
            </button>
         </div>
         <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <tr>
                     <th className="px-6 py-4">Shift Details</th>
                     <th className="px-6 py-4 text-center">Status</th>
                     <th className="px-6 py-4 text-right">Opening</th>
                     <th className="px-6 py-4 text-right">Expected</th>
                     <th className="px-6 py-4 text-right">Counted</th>
                     <th className="px-6 py-4 text-right">Variance</th>
                     <th className="px-6 py-4 text-center">Audit</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {shifts.length === 0 ? (
                     <tr><td colSpan={7} className="py-20 text-center text-slate-400 italic text-sm">No shift history found</td></tr>
                  ) : (
                     shifts.map(shift => {
                        const biz = businesses.find(b => b.id === shift.businessId);
                        const isExpanded = expandedShift === shift.id;
                        
                        return (
                           <React.Fragment key={shift.id}>
                              <tr className={`hover:bg-slate-50/50 transition-colors ${isExpanded ? 'bg-slate-50' : ''}`}>
                                 <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                       <span className="text-xs font-black text-slate-800">
                                          {biz?.name || 'Unknown Unit'}
                                       </span>
                                       <div className="flex items-center gap-3 mt-1">
                                          <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                                             <Clock size={10} /> {new Date(shift.openedAt).toLocaleDateString()}
                                          </span>
                                          <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                                             <User size={10} /> {shift.userName}
                                          </span>
                                       </div>
                                    </div>
                                 </td>
                                 <td className="px-6 py-4 text-center">
                                    <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${
                                       shift.status === 'OPEN' 
                                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                                    }`}>
                                       {shift.status}
                                    </span>
                                 </td>
                                 <td className="px-6 py-4 text-right text-xs font-bold text-slate-600">
                                    {formatZAR(shift.openingFloat)}
                                 </td>
                                 <td className="px-6 py-4 text-right text-xs font-bold text-slate-600">
                                    {shift.status === 'CLOSED' ? formatZAR(shift.expectedCash || 0) : '-'}
                                 </td>
                                 <td className="px-6 py-4 text-right text-xs font-black text-slate-800">
                                    {shift.status === 'CLOSED' ? formatZAR(shift.closingCashCounted || 0) : '-'}
                                 </td>
                                 <td className="px-6 py-4 text-right">
                                    {shift.status === 'CLOSED' ? (
                                       <span className={`text-xs font-black ${
                                          (shift.variance || 0) < 0 ? 'text-rose-600' : 
                                          (shift.variance || 0) > 0 ? 'text-emerald-600' : 'text-slate-400'
                                       }`}>
                                          {(shift.variance || 0) > 0 ? '+' : ''}{formatZAR(shift.variance || 0)}
                                       </span>
                                    ) : '-'}
                                 </td>
                                 <td className="px-6 py-4 text-center">
                                    <button 
                                      onClick={() => loadMovements(shift.id)}
                                      className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                                    >
                                       {isExpanded ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                                    </button>
                                 </td>
                              </tr>
                              {isExpanded && (
                                 <tr>
                                    <td colSpan={7} className="p-0">
                                       <div className="bg-slate-50 border-y border-slate-200 p-6 animate-in slide-in-from-top-2">
                                          {movementsLoading ? (
                                             <div className="flex justify-center py-4"><Loader2 className="animate-spin text-slate-400" /></div>
                                          ) : shiftMovements.length === 0 ? (
                                             <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">No cash movements recorded</p>
                                          ) : (
                                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {shiftMovements.map(m => (
                                                   <div key={m.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                                                      <div>
                                                         <div className="flex items-center gap-2 mb-1">
                                                            <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${
                                                               m.type === 'DROP' ? 'bg-indigo-50 text-indigo-600' :
                                                               m.type === 'PAYOUT' ? 'bg-rose-50 text-rose-600' :
                                                               'bg-teal-50 text-teal-600'
                                                            }`}>
                                                               {m.type}
                                                            </span>
                                                            <span className="text-[10px] text-slate-400 font-bold">{new Date(m.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                         </div>
                                                         <p className="text-xs font-bold text-slate-700">{m.reason}</p>
                                                      </div>
                                                      <span className="text-sm font-black text-slate-900">{formatZAR(m.amount)}</span>
                                                   </div>
                                                ))}
                                             </div>
                                          )}
                                       </div>
                                    </td>
                                 </tr>
                              )}
                           </React.Fragment>
                        );
                     })
                  )}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
};
