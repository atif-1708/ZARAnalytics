
import React, { useState, useEffect, useMemo } from 'react';
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
  ArrowRight
} from 'lucide-react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, BarChart, Bar, ComposedChart, Line, Legend, Cell
} from 'recharts';
import { storage } from '../services/mockStorage';
import { Organization, Business, DailySale, User, SubscriptionTier } from '../types';
import { StatCard } from '../components/StatCard';
import { formatZAR } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';

const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444'];

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
  }>({ organizations: [], businesses: [], sales: [], users: [] });
  const [loading, setLoading] = useState(true);

  // Filter States
  const [filterTier, setFilterTier] = useState<'all' | SubscriptionTier>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [auditMonth, setAuditMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    const fetchGlobalData = async () => {
      setLoading(true);
      try {
        const [orgs, biz, sales, users] = await Promise.all([
          storage.getOrganizations(),
          storage.getBusinesses(),
          storage.getSales(),
          storage.getUsers()
        ]);
        setData({ organizations: orgs, businesses: biz, sales: sales, users: users });
      } finally {
        setLoading(false);
      }
    };
    fetchGlobalData();
  }, []);

  const stats = useMemo(() => {
    const today = new Date();

    // Apply Global Filters to Organizations for the main dashboard views
    const filteredOrgs = data.organizations.filter(o => {
      const matchesTier = filterTier === 'all' || o.tier === filterTier;
      const matchesSearch = o.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesTier && matchesSearch;
    });

    const activeOrgs = filteredOrgs.filter(o => o.isActive && new Date(o.subscriptionEndDate) >= today);
    const expiredOrgs = filteredOrgs.filter(o => !o.isActive || new Date(o.subscriptionEndDate) < today);
    
    // 1. Current MRR (Active only)
    const currentMRR = activeOrgs.reduce((acc, org) => acc + (TIER_REVENUE[org.tier] || 0), 0);

    // 2. Tier Breakdown
    const tierCounts = {
      starter: filteredOrgs.filter(o => o.tier === 'starter').length,
      growth: filteredOrgs.filter(o => o.tier === 'growth').length,
      enterprise: filteredOrgs.filter(o => o.tier === 'enterprise').length,
    };

    // 3. 6-Month Historical Intelligence (MRR, Active/Expired, Growth)
    const monthlyPerformance = [...Array(6)].map((_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const monthLabel = d.toLocaleDateString('en-ZA', { month: 'short', year: '2-digit' });

      const activeInMonth = filteredOrgs.filter(org => {
        const createdDate = new Date(org.createdAt);
        const expiryDate = new Date(org.subscriptionEndDate);
        return createdDate <= monthEnd && expiryDate >= monthStart && org.isActive;
      });

      const expiredInMonth = filteredOrgs.filter(org => {
        const expiryDate = new Date(org.subscriptionEndDate);
        return expiryDate >= monthStart && expiryDate <= monthEnd;
      });

      const addedInMonth = filteredOrgs.filter(org => {
        const createdDate = new Date(org.createdAt);
        return createdDate >= monthStart && createdDate <= monthEnd;
      });

      const mrrReceived = activeInMonth.reduce((sum, org) => sum + (TIER_REVENUE[org.tier] || 0), 0);

      return {
        name: monthLabel,
        active: activeInMonth.length,
        expired: expiredInMonth.length,
        added: addedInMonth.length,
        mrr: mrrReceived
      };
    });

    // 4. MONTH-WISE MRR AUDIT (DRILL DOWN)
    const [auditYear, auditMonthIdx] = auditMonth.split('-').map(Number);
    const auditStart = new Date(auditYear, auditMonthIdx - 1, 1);
    const auditEnd = new Date(auditYear, auditMonthIdx, 0, 23, 59, 59);

    const auditLedger = data.organizations.filter(org => {
      const createdDate = new Date(org.createdAt);
      const expiryDate = new Date(org.subscriptionEndDate);
      // Organization must have existed and subscription must have been valid for at least 1 day in the selected month
      return createdDate <= auditEnd && expiryDate >= auditStart && org.isActive;
    }).map(org => ({
      ...org,
      revenue: TIER_REVENUE[org.tier] || 0
    })).sort((a, b) => b.revenue - a.revenue);

    const auditTotals = {
      mrr: auditLedger.reduce((s, o) => s + o.revenue, 0),
      count: auditLedger.length,
      starter: auditLedger.filter(o => o.tier === 'starter').length,
      growth: auditLedger.filter(o => o.tier === 'growth').length,
      enterprise: auditLedger.filter(o => o.tier === 'enterprise').length,
    };

    return { 
      currentMRR, 
      totalTenants: filteredOrgs.length,
      activeTenants: activeOrgs.length, 
      expiredTenants: expiredOrgs.length,
      tierCounts,
      monthlyPerformance,
      auditLedger,
      auditTotals
    };
  }, [data, filterTier, searchTerm, auditMonth]);

  if (loading) return (
    <div className="h-[80vh] flex flex-col items-center justify-center text-indigo-400">
      <div className="w-10 h-10 border-2 border-indigo-900 border-t-indigo-500 rounded-full animate-spin mb-4" />
      <p className="font-black uppercase tracking-widest text-[10px] animate-pulse">Scanning Platform Data Registry</p>
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
          <p className="text-slate-500 font-bold text-sm mt-1">Real-time tenant analytics and billing lifecycle</p>
        </div>
        <div className="flex items-center gap-3">
           <div className="px-4 py-3 bg-slate-900 border border-white/5 rounded-2xl flex items-center gap-4 shadow-xl">
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                 <span className="text-[10px] font-black text-white uppercase">Sync Active</span>
              </div>
              <div className="w-px h-4 bg-white/10" />
              <div className="text-right">
                 <p className="text-[8px] font-black text-slate-500 uppercase leading-none">Last Audit</p>
                 <p className="text-[10px] font-black text-indigo-400">Just Now</p>
              </div>
           </div>
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
        <StatCard label="Active Tenants" value={stats.activeTenants.toString()} icon={ShieldCheck} color="emerald" />
        <StatCard label="Expired Tenants" value={stats.expiredTenants.toString()} icon={AlertCircle} color="rose" />
        <StatCard label="Platform MRR" value={formatZAR(stats.currentMRR)} icon={TrendingUp} color="indigo" />
      </div>

      {/* REVENUE DRILL DOWN (AUDIT LEDGER) */}
      <div className="bg-slate-900 rounded-[2.5rem] p-10 border border-white/5 shadow-2xl flex flex-col">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-10 gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/10"><CalendarDays size={20} /></div>
            <div>
              <h3 className="text-xl font-black text-white tracking-tight">Monthly Revenue Audit</h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Cross-sectional MRR Drill down</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 bg-white/5 p-2 rounded-2xl border border-white/10">
            <div className="flex items-center gap-2 px-3">
              <History size={14} className="text-indigo-400" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Audit Month:</span>
            </div>
            <input 
              type="month" 
              value={auditMonth}
              onChange={(e) => setAuditMonth(e.target.value)}
              className="bg-slate-950 border border-white/10 px-4 py-2 rounded-xl text-xs font-black text-indigo-400 outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-10">
           <div className="p-6 bg-white/5 border border-white/5 rounded-3xl">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total MRR (Selected)</p>
              <p className="text-2xl font-black text-indigo-400">{formatZAR(stats.auditTotals.mrr)}</p>
           </div>
           <div className="p-6 bg-white/5 border border-white/5 rounded-3xl">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Active Nodes</p>
              <p className="text-2xl font-black text-white">{stats.auditTotals.count}</p>
           </div>
           <div className="p-6 bg-white/5 border border-white/5 rounded-3xl">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Tier Attribution</p>
              <div className="flex items-center gap-4 mt-1">
                 <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    <span className="text-xs font-black text-slate-400">{stats.auditTotals.starter}S</span>
                 </div>
                 <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    <span className="text-xs font-black text-slate-400">{stats.auditTotals.growth}G</span>
                 </div>
                 <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    <span className="text-xs font-black text-slate-400">{stats.auditTotals.enterprise}E</span>
                 </div>
              </div>
           </div>
           <div className="p-6 bg-indigo-600/10 border border-indigo-600/20 rounded-3xl flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Yield Target</p>
                <p className="text-sm font-black text-white uppercase mt-1">Audit Status: VALID</p>
              </div>
              <Target size={24} className="text-indigo-500" />
           </div>
        </div>

        <div className="overflow-x-auto text-left">
           <table className="w-full">
              <thead>
                 <tr className="border-b border-white/5">
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Organization Unit</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Service Tier</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Contribution (ZAR)</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Action</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                 {stats.auditLedger.length === 0 ? (
                    <tr>
                       <td colSpan={4} className="px-6 py-10 text-center text-slate-600 italic text-sm font-bold uppercase tracking-widest">No active billable nodes found for this period</td>
                    </tr>
                 ) : (
                    stats.auditLedger.map((org) => (
                       <tr key={org.id} className="hover:bg-white/5 transition-colors group">
                          <td className="px-6 py-4 font-bold text-white text-sm">{org.name}</td>
                          <td className="px-6 py-4 text-center">
                             <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-md ${
                                org.tier === 'starter' ? 'bg-blue-500/10 text-blue-400' :
                                org.tier === 'growth' ? 'bg-amber-500/10 text-amber-400' : 'bg-indigo-500/10 text-indigo-400'
                             }`}>
                                {org.tier}
                             </span>
                          </td>
                          <td className="px-6 py-4 text-right text-sm font-black text-indigo-400">{formatZAR(org.revenue)}</td>
                          <td className="px-6 py-4 text-right">
                             <button 
                               onClick={() => setSelectedOrgId(org.id)}
                               className="p-2 text-slate-500 hover:text-indigo-400 transition-colors"
                             >
                                <ArrowRight size={16} />
                             </button>
                          </td>
                       </tr>
                    ))
                 )}
              </tbody>
           </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Financial Velocity Chart */}
        <div className="bg-slate-900 rounded-[2.5rem] p-10 border border-white/5 shadow-2xl flex flex-col">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-xl font-black text-white tracking-tight">Financial Velocity</h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Month-wise MRR Received & Node Status</p>
            </div>
            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/10"><CreditCard size={20} /></div>
          </div>
          <div className="flex-1 min-h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={stats.monthlyPerformance}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff0a" />
                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#475569', fontWeight: 900 }} dy={10} />
                <YAxis yAxisId="left" orientation="left" stroke="#475569" fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#475569', fontWeight: 900 }} label={{ value: 'Active Nodes', angle: -90, position: 'insideLeft', fill: '#475569', fontSize: 10, fontWeight: 900 }} />
                <YAxis yAxisId="right" orientation="right" stroke="#818cf8" fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#818cf8', fontWeight: 900 }} tickFormatter={(v) => `R${v}`} label={{ value: 'Revenue', angle: 90, position: 'insideRight', fill: '#818cf8', fontSize: 10, fontWeight: 900 }} />
                <Tooltip 
                   contentStyle={{ backgroundColor: '#0f172a', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', padding: '12px' }} 
                   itemStyle={{ fontSize: '11px', fontWeight: 900 }}
                   labelStyle={{ fontWeight: 900, color: '#fff', marginBottom: '8px' }}
                />
                <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '20px', fontSize: '10px', textTransform: 'uppercase', fontWeight: 900 }} />
                <Bar yAxisId="left" dataKey="active" fill="#334155" radius={[4, 4, 0, 0]} name="Active (Paid)" />
                <Bar yAxisId="left" dataKey="expired" fill="#ef4444" radius={[4, 4, 0, 0]} name="Expired" />
                <Line yAxisId="right" type="monotone" dataKey="mrr" stroke="#6366f1" strokeWidth={4} dot={{ r: 6, fill: '#6366f1' }} name="MRR" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tenant Growth Chart (Tenants Added Month-wise) */}
        <div className="bg-slate-900 rounded-[2.5rem] p-10 border border-white/5 shadow-2xl flex flex-col">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-xl font-black text-white tracking-tight">Growth Trajectory</h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">New Tenants Added per Month</p>
            </div>
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/10"><UserPlus size={20} /></div>
          </div>
          <div className="flex-1 min-h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.monthlyPerformance}>
                <defs>
                  <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
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
                <Area type="monotone" dataKey="added" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#growthGrad)" name="New Tenants" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
