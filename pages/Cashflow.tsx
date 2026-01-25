
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
  Copy, 
  TrendingUp, 
  Package, 
  Building2, 
  Briefcase 
} from 'lucide-react';
import { storage } from '../services/mockStorage';
import { useAuth } from '../context/AuthContext';
import { CashShift, Business, UserRole, CashMovement, Product, DailySale, MonthlyExpense } from '../types';
import { formatZAR, formatDate } from '../utils/formatters';

const MISSING_CASHFLOW_SCHEMA = `-- Cashflow Management Tables & Updates
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

-- ADD INITIAL CAPITAL COLUMN IF MISSING
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS initial_capital numeric DEFAULT 0;

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

  // Valuation Data
  const [valuationData, setValuationData] = useState({
    stockValue: 0,
    cashLiquidity: 0,
    totalWorth: 0
  });

  // Live Metrics (Operational)
  const [activeShift, setActiveShift] = useState<CashShift | null>(null);
  const [liveBalance, setLiveBalance] = useState<number>(0);
  const [unbankedCash, setUnbankedCash] = useState<number>(0);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Core Data
      const [bData, sData, pData, salesData, expData] = await Promise.all([
        storage.getBusinesses(),
        storage.getShiftHistory(selectedBusinessId === 'all' ? undefined : selectedBusinessId),
        storage.getProducts(selectedBusinessId === 'all' ? undefined : selectedBusinessId),
        storage.getSales(),
        storage.getExpenses()
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

      // 2. Calculate Business Valuation (Worth)
      // Filter Sales & Expenses by Business Selection
      const relevantSales = salesData.filter(s => selectedBusinessId === 'all' || s.businessId === selectedBusinessId);
      const relevantExpenses = expData.filter(e => selectedBusinessId === 'all' || e.businessId === selectedBusinessId);

      // A. Stock Worth (Asset Value)
      const stockWorth = pData.reduce((sum, p) => sum + ((p.costPrice || 0) * (p.currentStock || 0)), 0);

      // B. Cash Liquidity (Initial Capital + Net Retained Earnings)
      // Cash Worth = Opening Balance + (Gross Profit Generated) - (Expenses Paid)
      const totalGrossProfit = relevantSales.reduce((sum, s) => sum + Number(s.profitAmount), 0);
      const totalExpenses = relevantExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
      
      // Calculate Initial Capital from selected businesses
      const targetBizForCalc = selectedBusinessId === 'all' 
        ? filteredBiz 
        : filteredBiz.filter(b => b.id === selectedBusinessId);
      
      const totalInitialCapital = targetBizForCalc.reduce((acc, b) => acc + (b.initialCapital || 0), 0);

      const liquidity = totalInitialCapital + totalGrossProfit - totalExpenses;

      setValuationData({
        stockValue: stockWorth,
        cashLiquidity: liquidity,
        totalWorth: stockWorth + liquidity
      });

      // 3. Operational Metrics (Shift & Till)
      const openShifts = sData.filter(s => s.status === 'OPEN');
      
      if (openShifts.length > 0) {
        const targetShifts = selectedBusinessId === 'all' 
          ? openShifts 
          : openShifts.filter(s => s.businessId === selectedBusinessId);

        if (targetShifts.length > 0) {
           let totalLive = 0;
           let totalUnbanked = 0;
           
           for (const shift of targetShifts) {
              const salesCash = await storage.getShiftAggregates(shift.businessId, shift.openedAt);
              const movements = await storage.getShiftMovements(shift.id);
              const adds = movements.filter(m => m.type === 'FLOAT_ADD').reduce((a,c) => a + c.amount, 0);
              const drops = movements.filter(m => m.type === 'DROP').reduce((a,c) => a + c.amount, 0);
              const payouts = movements.filter(m => m.type === 'PAYOUT').reduce((a,c) => a + c.amount, 0);
              
              const shiftBalance = shift.openingFloat + salesCash + adds - drops - payouts;
              totalLive += shiftBalance;
              totalUnbanked += drops; 
           }
           setLiveBalance(totalLive);
           setUnbankedCash(totalUnbanked);
           setActiveShift(targetShifts[0]); 
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
    <div className="space-y-10 pb-20">
      
      {/* 1. TOP HEADER & FILTER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="text-left">
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Financial Position</h2>
          <p className="text-slate-500 font-medium">Real-time business valuation and operational cash control</p>
        </div>
        
        <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-2xl border border-slate-200 shadow-sm">
          <Store size={16} className="text-slate-400" />
          <select 
            value={selectedBusinessId} 
            onChange={e => setSelectedBusinessId(e.target.value)} 
            className="bg-transparent text-xs font-black text-slate-700 outline-none cursor-pointer w-full uppercase tracking-widest min-w-[150px]"
          >
            <option value="all">All Business Assets</option>
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
                The cash management tables (including Initial Capital) are missing. Please run the SQL script below in your Supabase SQL Editor.
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

      {/* 2. BUSINESS VALUATION CARDS (NET WORTH) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         {/* Asset Value */}
         <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 flex flex-col justify-between h-48 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform"><Package size={100}/></div>
            <div className="flex justify-between items-start relative z-10">
               <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm text-indigo-300"><Package size={24}/></div>
            </div>
            <div className="relative z-10">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Stock Asset Value</p>
               <h3 className="text-4xl font-black text-white tracking-tight">{formatZAR(valuationData.stockValue)}</h3>
               <p className="text-[10px] font-bold text-slate-500 mt-2">Cost value of inventory on hand</p>
            </div>
         </div>

         {/* Liquid Cash */}
         <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col justify-between h-48">
            <div className="flex justify-between items-start">
               <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><Wallet size={24}/></div>
            </div>
            <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Net Liquid Liquidity</p>
               <h3 className={`text-4xl font-black tracking-tight ${valuationData.cashLiquidity >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                 {formatZAR(valuationData.cashLiquidity)}
               </h3>
               <p className="text-[10px] font-bold text-slate-400 mt-2">Capital + Profit - Expenses</p>
            </div>
         </div>

         {/* Total Worth */}
         <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col justify-between h-48">
            <div className="flex justify-between items-start">
               <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><Building2 size={24}/></div>
            </div>
            <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Shop Valuation</p>
               <h3 className="text-4xl font-black text-slate-900 tracking-tight">{formatZAR(valuationData.totalWorth)}</h3>
               <p className="text-[10px] font-bold text-slate-400 mt-2">Combined Assets + Liquidity</p>
            </div>
         </div>
      </div>

      <div className="border-t border-slate-200 my-4"></div>

      {/* 3. OPERATIONAL SECTION HEADER */}
      <div className="text-left flex items-center gap-3">
         <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><Briefcase size={20} /></div>
         <div>
            <h3 className="text-xl font-bold text-slate-800">Operational Cash Control</h3>
            <p className="text-xs text-slate-500 font-medium">Daily till management, safe drops, and reconciliation</p>
         </div>
      </div>

      {/* 4. LIVE TILL METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
               <div className="p-3 bg-teal-50 text-teal-600 rounded-2xl"><Coins size={20}/></div>
               <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Till</p>
                  <div className="flex items-center gap-2">
                     <span className={`w-2 h-2 rounded-full ${activeShift ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></span>
                     <span className="text-xs font-bold text-slate-600">{activeShift ? 'Shift Open' : 'Closed'}</span>
                  </div>
               </div>
            </div>
            <h3 className="text-2xl font-black text-slate-900">{formatZAR(liveBalance)}</h3>
            <p className="text-[10px] text-slate-400 font-bold mt-1">Expected cash in drawer</p>
         </div>

         <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
               <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><PiggyBank size={20}/></div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Safe / Unbanked</p>
            </div>
            <h3 className="text-2xl font-black text-blue-600">{formatZAR(unbankedCash)}</h3>
            <p className="text-[10px] text-slate-400 font-bold mt-1">Cash dropped from till</p>
         </div>

         <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
               <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl"><AlertCircle size={20}/></div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Net Variance</p>
            </div>
            <h3 className={`text-2xl font-black ${shifts.reduce((a,c) => a + (c.variance || 0), 0) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
               {formatZAR(shifts.reduce((a,c) => a + (c.variance || 0), 0))}
            </h3>
            <p className="text-[10px] text-slate-400 font-bold mt-1">Total reconciled difference</p>
         </div>
      </div>

      {/* 5. LEDGER TABLE */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
         <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
               <History size={18} className="text-slate-400"/> Reconciliation Ledger
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
