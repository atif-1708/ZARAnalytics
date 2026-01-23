
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Building2, 
  Users, 
  Zap, 
  TrendingUp, 
  ShieldCheck, 
  AlertCircle,
  Activity,
  Server,
  Search,
  Filter,
  History,
  CreditCard,
  UserPlus,
  ArrowUpRight,
  PieChart as PieIcon,
  Layers,
  CalendarDays,
  ChevronRight,
  Target,
  ArrowRight,
  MousePointer2,
  Info,
  Clock,
  CheckCircle2,
  Receipt,
  CheckSquare,
  CalendarDays as CalendarIcon,
  UserCheck,
  Download,
  Hash,
  Terminal,
  RefreshCw
} from 'lucide-react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, BarChart, Bar, ComposedChart, Line, Legend, Cell
} from 'recharts';
import { storage } from '../services/mockStorage';
import { Organization, Business, DailySale, User, SubscriptionTier, Reminder } from '../types';
import { StatCard } from '../components/StatCard';
import { formatZAR } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';

const TIER_REVENUE: Record<SubscriptionTier, number> = {
  starter: 300,
  growth: 550,
  enterprise: 1500
};

export const SuperAdminDashboard: React.FC = () => {
  const { setSelectedOrgId } = useAuth();
  const [data, setData] = useState<{
    organizations: Organization[];
    businesses: Business[];
    sales: DailySale[];
    users: User[];
    reminders: Reminder[];
  }>({ organizations: [], businesses: [], sales: [], users: [], reminders: [] });
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter States
  const [filterTier, setFilterTier] = useState<'all' | SubscriptionTier>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [auditMonth, setAuditMonth] = useState(new Date().toISOString().slice(0, 7));

  const fetchGlobalData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setLoading(true);
    
    try {
      const [orgs, biz, sales, users, reminders] = await Promise.all([
        storage.getOrganizations(),
        storage.getBusinesses(),
        storage.getSales(),
        storage.getUsers(),
        storage.getReminders()
      ]);
      setData({ organizations: orgs, businesses: biz, sales: sales, users: users, reminders: reminders });
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchGlobalData();
  }, [fetchGlobalData]);

  const stats = useMemo(() => {
    const today = new Date();

    const getServiceMonth = (r: Reminder): string => {
      const match = r.businessName.match(/FOR: (\d{4}-\d{2})/);
      if (match) return match[1];
      return r.date.slice(0, 7);
    };

    const getTierFromLabel = (label: string): SubscriptionTier => {
      const lower = label.toLowerCase();
      if (lower.includes('[enterprise]')) return 'enterprise';
      if (lower.includes('[growth]')) return 'growth';
      if (lower.includes('[starter]')) return 'starter';
      if (lower.includes('enterprise')) return 'enterprise';
      if (lower.includes('growth')) return 'growth';
      return 'starter';
    };

    const getActionFromLabel = (label: string): string => {
      if (label.includes('AUTHORIZED')) return 'Authorization';
      if (label.includes('PROVISION')) return 'Provisioning';
      if (label.includes('UPDATE')) return 'Plan Update';
      return 'Collection';
    };

    const filteredOrgs = data.organizations.filter(o => {
      const matchesTier = filterTier === 'all' || o.tier === filterTier;
      const matchesSearch = o.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesTier && matchesSearch;
    });

    const activeNow = filteredOrgs.filter(o => o.isActive && new Date(o.subscriptionEndDate) >= today);
    const expiredNow = filteredOrgs.filter(o => !o.isActive || new Date(o.subscriptionEndDate) < today);

    // LIVE PLATFORM MRR: All currently active paying tenants
    const livePlatformMRR = activeNow.reduce((acc, org) => acc + (TIER_REVENUE[org.tier] || 0), 0);

    // REVENUE AUDIT LEDGER: STRICT EVENT-BASED AUDIT (ONLY SHOWS ACTIONS TAKEN THIS MONTH)
    const auditLedgerRecords = data.reminders.filter(r => {
      // Billing records are system alerts marked as read with no linked businessId (meaning they are Org-level)
      const isBillingRecord = r.type === 'system_alert' && r.status === 'read' && !r.businessId;
      // We filter strictly by transaction date (the month the action was recorded)
      const isProcessedInTargetMonth = r.date.slice(0, 7) === auditMonth;
      return isBillingRecord && isProcessedInTargetMonth;
    });

    const groupedMap = new Map<string, any>();
    auditLedgerRecords.forEach(r => {
      if (!r.orgId) return;
      const tier = getTierFromLabel(r.businessName);
      const amount = TIER_REVENUE[tier] || 300;
      const serviceMonth = getServiceMonth(r);
      const action = getActionFromLabel(r.businessName);
      
      const key = r.orgId; 
      const currentOrg = data.organizations.find(o => o.id === r.orgId);
      
      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          orgId: r.orgId,
          orgName: currentOrg?.name || r.businessName.split('[')[0].split('(')[0].trim(),
          tier: tier,
          totalRevenue: amount,
          paymentCount: 1,
          collectionDate: r.date,
          operator: r.sentByUserName,
          servicePeriod: serviceMonth,
          action: action
        });
      } else {
        const existing = groupedMap.get(key);
        // Only keep the LATEST transaction for that organization in that month to prevent double-counting
        if (new Date(r.date).getTime() >= new Date(existing.collectionDate).getTime()) {
           existing.totalRevenue = amount;
           existing.tier = tier;
           existing.collectionDate = r.date;
           existing.operator = r.sentByUserName;
           existing.servicePeriod = serviceMonth;
           existing.action = action;
        }
        existing.paymentCount += 1;
      }
    });

    const auditLedger = Array.from(groupedMap.values())
      .filter(tx => tx.orgName.toLowerCase().includes(ledgerSearch.toLowerCase()))
      .sort((a, b) => new Date(b.collectionDate).getTime() - new Date(a.collectionDate).getTime());

    const auditTotals = {
      mrr: auditLedger.reduce((s, o) => s + o.totalRevenue, 0),
      count: auditLedger.length,
      starter: auditLedger.filter(o => o.tier === 'starter').length,
      growth: auditLedger.filter(o => o.tier === 'growth').length,
      enterprise: auditLedger.filter(o => o.tier === 'enterprise').length,
    };

    // Performance pipeline for charts
    const monthlyPerformance = [...Array(6)].map((_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i)); 
      const monthStr = d.toISOString().slice(0, 7);
      const monthLabel = d.toLocaleDateString('en-ZA', { month: 'short', year: '2-digit' });

      // BAR CHART: Transaction Activity (Total money processed in that specific calendar month)
      const monthTransactions = data.reminders.filter(r => 
        r.type === 'system_alert' && 
        r.status === 'read' && 
        !r.businessId && 
        r.date.slice(0, 7) === monthStr
      );

      const txOrgMap = new Map<string, number>();
      monthTransactions.forEach(r => {
        if (!r.orgId) return;
        const t = getTierFromLabel(r.businessName);
        txOrgMap.set(r.orgId, TIER_REVENUE[t] || 300);
      });
      const totalCollectedInMonth = Array.from(txOrgMap.values()).reduce((s, v) => s + v, 0);

      // LINE CHART: Total Active Capacity (All orgs that had valid service during that month)
      const activeInMonthCount = data.organizations.filter(o => 
        o.createdAt.slice(0, 7) <= monthStr && o.subscriptionEndDate.slice(0, 7) >= monthStr
      ).length;

      return {
        name: monthLabel,
        rawMonth: monthStr,
        active: activeInMonthCount,
        mrr: totalCollectedInMonth, 
        collections: txOrgMap.size
      };
    });

    return { 
      currentMRR: livePlatformMRR,
      totalTenants: filteredOrgs.length,
      activeTenants: activeNow.length, 
      expiredTenants: expiredNow.length,
      monthlyPerformance,
      auditLedger,
      auditTotals
    };
  }, [data, filterTier, searchTerm, auditMonth, ledgerSearch]);

  const handleChartClick = (state: any) => {
    if (state && state.activePayload && state.activePayload.length > 0) {
      const rawMonth = state.activePayload[0].payload.rawMonth;
      if (rawMonth) {
        setAuditMonth(rawMonth);
        const auditSection = document.getElementById('audit-section');
        if (auditSection) {
          auditSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }
  };

  if (loading) return (
    <div className="h-[80vh] flex flex-col items-center justify-center text-indigo-400">
      <div className="w-10 h-10 border-2 border-indigo-900 border-t-indigo-500 rounded-full animate-spin mb-4" />
      <p className="font-black uppercase tracking-widest text-[10px] animate-pulse">Syncing platform audit records...</p>
    </div>
  );

  return (
    <div className="space-y-8 pb-24 text-left">
      {/* Platform Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-indigo-500 font-black uppercase tracking-[0.2em] text-[10px] mb-2">
            <Server size={14} /> Node Alpha-01: Root Intelligence
          </div>
          <h2 className="text-4xl font-black text-white tracking-tighter">Global Control</h2>
          <p className="text-slate-500 font-bold text-sm mt-1">Real-time tenant analytics and collection audit</p>
        </div>
        <div className="flex items-center gap-3">
           <button 
             onClick={() => fetchGlobalData(true)} 
             disabled={isRefreshing}
             className="px-4 py-3 bg-slate-900 border border-white/5 rounded-2xl flex items-center gap-4 shadow-xl hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50"
           >
              <div className="flex items-center gap-2">
                 <RefreshCw size={14} className={`text-emerald-500 ${isRefreshing ? 'animate-spin' : ''}`} />
                 <span className="text-[10px] font-black text-white uppercase">{isRefreshing ? 'Syncing...' : 'Refresh Sync'}</span>
              </div>
              <div className="w-px h-4 bg-white/10" />
              <div className="text-right">
                 <p className="text-[8px] font-black text-slate-500 uppercase leading-none">Last Check</p>
                 <p className="text-[10px] font-black text-indigo-400">Real-Time Active</p>
              </div>
           </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-slate-900 border border-white/5 rounded-[2rem] p-4 flex flex-col md:flex-row items-center gap-6 shadow-2xl">
        <div className="flex items-center gap-2 bg-white/5 px-4 py-2.5 rounded-xl border border-white/10 flex-1 w-full md:w-auto">
          <Search size={16} className="text-slate-500" />
          <input 
            type="text"
            placeholder="Search tenant name..."
            className="bg-transparent text-sm font-bold text-white outline-none w-full placeholder:text-slate-600"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
          {(['all', 'starter', 'growth', 'enterprise'] as const).map((tier) => (
            <button
              key={tier}
              onClick={() => setFilterTier(tier)}
              className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                filterTier === tier ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {tier}
            </button>
          ))}
        </div>
      </div>

      {/* Core Tenant Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Total Tenants" value={stats.totalTenants.toString()} icon={Building2} color="blue" />
        <StatCard label="Active Now" value={stats.activeTenants.toString()} icon={ShieldCheck} color="emerald" />
        <StatCard label="Overdue" value={stats.expiredTenants.toString()} icon={AlertCircle} color="rose" />
        <StatCard label="Live Platform MRR" value={formatZAR(stats.currentMRR)} icon={TrendingUp} color="indigo" />
      </div>

      {/* COLLECTION AUDIT LEDGER */}
      <div id="audit-section" className="bg-slate-900 rounded-[2.5rem] border border-white/5 shadow-2xl flex flex-col transition-all scroll-mt-24 overflow-hidden">
        {/* Ledger Header Area */}
        <div className="p-10 pb-0 border-b border-white/5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-10">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
                <Receipt size={28} />
              </div>
              <div>
                <h3 className="text-2xl font-black text-white tracking-tight">Collection Audit Ledger</h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Audit trail for billing actions processed this month</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 bg-white/5 px-4 py-3 rounded-2xl border border-white/10 flex-1 min-w-[200px]">
                <Search size={14} className="text-slate-500" />
                <input 
                  type="text"
                  placeholder="Filter audit by name..."
                  className="bg-transparent text-xs font-bold text-white outline-none w-full placeholder:text-slate-600"
                  value={ledgerSearch}
                  onChange={(e) => setLedgerSearch(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-3 bg-white/5 p-2 rounded-2xl border border-white/10">
                <div className="flex items-center gap-2 px-3">
                  <CalendarIcon size={14} className="text-indigo-400" />
                  <span className="text-[10px] font-black text-slate-300 uppercase whitespace-nowrap">Transaction Month:</span>
                </div>
                <input 
                  type="month" 
                  value={auditMonth}
                  onChange={(e) => setAuditMonth(e.target.value)}
                  className="bg-slate-950 border border-white/10 px-4 py-2 rounded-xl text-xs font-black text-indigo-400 outline-none cursor-pointer hover:bg-indigo-600 hover:text-white transition-all"
                  style={{ colorScheme: 'dark' }}
                />
              </div>
            </div>
          </div>

          {/* Ledger Summary Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-px bg-white/5 border border-white/10 rounded-2xl mb-10 overflow-hidden">
             <div className="bg-slate-900 p-6 flex flex-col">
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Collected This Month</span>
                <span className="text-lg font-black text-indigo-400">{formatZAR(stats.auditTotals.mrr)}</span>
             </div>
             <div className="bg-slate-900 p-6 flex flex-col">
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Processed Tenants</span>
                <span className="text-lg font-black text-white">{stats.auditTotals.count}</span>
             </div>
             <div className="bg-slate-900 p-6 flex flex-col border-r border-white/5">
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Starter Plans</span>
                <span className="text-lg font-black text-blue-400">{stats.auditTotals.starter}</span>
             </div>
             <div className="bg-slate-900 p-6 flex flex-col border-r border-white/5">
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Growth Plans</span>
                <span className="text-lg font-black text-amber-400">{stats.auditTotals.growth}</span>
             </div>
             <div className="bg-slate-900 p-6 flex flex-col border-r border-white/5">
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Enterprise Plans</span>
                <span className="text-lg font-black text-indigo-500">{stats.auditTotals.enterprise}</span>
             </div>
             <div className="bg-slate-900 p-6 flex items-center justify-center">
                <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase transition-all shadow-lg shadow-indigo-600/20">
                  <Download size={14} /> Download Ledger
                </button>
             </div>
          </div>
        </div>

        {/* Ledger Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/5 border-b border-white/5">
                <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]"><div className="flex items-center gap-2"><Building2 size={12}/> Organization</div></th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center"><div className="flex items-center justify-center gap-2"><Layers size={12}/> Applied Tier</div></th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center"><div className="flex items-center justify-center gap-2"><CheckSquare size={12}/> Action Taken</div></th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center"><div className="flex items-center justify-center gap-2"><Clock size={12}/> Transaction Date</div></th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center"><div className="flex items-center justify-center gap-2"><CalendarIcon size={12}/> Targeted Coverage</div></th>
                <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right"><div className="flex items-center justify-end gap-2"><TrendingUp size={12}/> Collected Value</div></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {stats.auditLedger.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-10 py-32 text-center">
                    <div className="max-w-xs mx-auto space-y-4">
                      <div className="w-20 h-20 bg-white/5 rounded-[2rem] flex items-center justify-center mx-auto text-slate-700">
                        <Terminal size={32} />
                      </div>
                      <h4 className="text-white font-black uppercase tracking-widest text-sm">No Billing Events</h4>
                      <p className="text-slate-500 text-xs font-bold leading-relaxed">No organizations were authorized, updated, or provisioned during {auditMonth}.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                stats.auditLedger.map((tx, idx) => (
                  <tr key={`${tx.orgId}_${idx}`} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-10 py-6">
                      <div className="flex flex-col gap-1 text-left">
                        <span className="text-sm font-black text-white group-hover:text-indigo-400 transition-colors">{tx.orgName}</span>
                        <div className="flex items-center gap-2 text-[9px] font-black text-slate-600 uppercase">
                          <Hash size={10} /> {tx.orgId.substring(0, 12)}...
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-6 text-center">
                      <div className="flex flex-col items-center">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg ${
                          tx.tier === 'starter' ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20' :
                          tx.tier === 'growth' ? 'bg-amber-600/10 text-amber-400 border border-amber-600/20' : 
                          'bg-indigo-600/10 text-indigo-400 border border-indigo-600/20'
                        }`}>
                          <Zap size={10} /> {tx.tier}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-6 text-center">
                       <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${
                         tx.action === 'Provisioning' ? 'text-emerald-400 bg-emerald-400/5 border border-emerald-400/10' :
                         tx.action === 'Plan Update' ? 'text-indigo-400 bg-indigo-400/5 border border-indigo-400/10' :
                         'text-slate-400 bg-white/5 border border-white/10'
                       }`}>
                         {tx.action}
                       </span>
                    </td>
                    <td className="px-6 py-6 text-center">
                      <div className="flex flex-col items-center gap-1">
                         <div className="flex items-center gap-2 text-[10px] font-black text-white uppercase">
                            <Clock size={12} className="text-indigo-500" />
                            {new Date(tx.collectionDate).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                         </div>
                         <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">By: {tx.operator}</span>
                      </div>
                    </td>
                    <td className="px-6 py-6 text-center">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
                        {tx.servicePeriod}
                      </span>
                    </td>
                    <td className="px-10 py-6 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-lg font-black text-indigo-400">{formatZAR(tx.totalRevenue)}</span>
                        {tx.paymentCount > 1 && (
                          <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest bg-white/5 px-1.5 py-0.5 rounded">
                            {tx.paymentCount} entries combined
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Ledger Footer */}
        <div className="p-10 border-t border-white/5 bg-white/5 flex items-center justify-between">
           <div className="flex items-center gap-3">
              <ShieldCheck size={18} className="text-emerald-500" />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest max-w-sm">
                Audit trail displays organizations modified during this period. Sums are deduplicated by entity.
              </p>
           </div>
           <div className="text-right">
              <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Transaction Mode</p>
              <p className="text-xs font-black text-indigo-300">Strict Event Synchronization Active</p>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Historical Collection Activity */}
        <div className="bg-slate-900 rounded-[2.5rem] p-10 border border-white/5 shadow-2xl flex flex-col group/chart">
          <div className="flex items-center justify-between mb-10">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-xl font-black text-white tracking-tight">Collection Activity</h3>
                <div className="flex items-center gap-1 px-2 py-0.5 bg-indigo-500/10 text-indigo-400 rounded-md text-[8px] font-black uppercase tracking-widest opacity-0 group-hover/chart:opacity-100 transition-opacity">
                  <MousePointer2 size={10} /> Jump to Month
                </div>
              </div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Revenue processed based on transaction month</p>
            </div>
            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/10"><CreditCard size={20} /></div>
          </div>
          <div className="flex-1 min-h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={stats.monthlyPerformance} onClick={handleChartClick}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff0a" />
                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#475569', fontWeight: 900 }} dy={10} />
                <YAxis yAxisId="left" orientation="left" stroke="#475569" fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#475569', fontWeight: 900 }} label={{ value: 'Processed Units', angle: -90, position: 'insideLeft', fill: '#475569', fontSize: 10, fontWeight: 900 }} />
                <YAxis yAxisId="right" orientation="right" stroke="#818cf8" fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#818cf8', fontWeight: 900 }} tickFormatter={(v) => `R${v}`} label={{ value: 'Collected Revenue', angle: 90, position: 'insideRight', fill: '#818cf8', fontSize: 10, fontWeight: 900 }} />
                <Tooltip 
                   contentStyle={{ backgroundColor: '#0f172a', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', padding: '12px' }} 
                   itemStyle={{ fontSize: '11px', fontWeight: 900 }}
                   labelStyle={{ fontWeight: 900, color: '#fff', marginBottom: '8px' }}
                   cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }}
                />
                <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '20px', fontSize: '10px', textTransform: 'uppercase', fontWeight: 900 }} />
                <Bar yAxisId="left" dataKey="collections" fill="#334155" radius={[4, 4, 0, 0]} name="Entities Handled" className="cursor-pointer" />
                <Line yAxisId="right" type="monotone" dataKey="mrr" stroke="#6366f1" strokeWidth={4} dot={{ r: 6, fill: '#6366f1' }} name="Event Cash (ZAR)" className="cursor-pointer" activeDot={{ r: 8, strokeWidth: 0 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Platform Node Capacity */}
        <div className="bg-slate-900 rounded-[2.5rem] p-10 border border-white/5 shadow-2xl flex flex-col group/chart">
          <div className="flex items-center justify-between mb-10">
            <div>
               <div className="flex items-center gap-2 mb-1">
                <h3 className="text-xl font-black text-white tracking-tight">Active Capacity</h3>
                <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-md text-[8px] font-black uppercase tracking-widest opacity-0 group-hover/chart:opacity-100 transition-opacity">
                  <Activity size={10} /> Pulse
                </div>
              </div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total organizations with valid service during month</p>
            </div>
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/10"><Building2 size={20} /></div>
          </div>
          <div className="flex-1 min-h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.monthlyPerformance}>
                <defs>
                  <linearGradient id="activeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff0a" />
                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#475569', fontWeight: 900 }} dy={10} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#475569', fontWeight: 900 }} />
                <Tooltip 
                   contentStyle={{ backgroundColor: '#0f172a', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', padding: '12px' }} 
                   itemStyle={{ fontSize: '11px', fontWeight: 900 }}
                   labelStyle={{ fontWeight: 900, color: '#fff', marginBottom: '8px' }}
                />
                <Area type="monotone" dataKey="active" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#activeGrad)" name="Valid Nodes" activeDot={{ r: 8, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
