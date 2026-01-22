
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  Users, 
  Zap, 
  TrendingUp, 
  ShieldCheck, 
  CalendarDays,
  Store,
  Clock,
  ChevronRight,
  Box,
  AlertCircle,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  MousePointerClick,
  Database,
  PieChart as PieIcon,
  BarChart3,
  Server
} from 'lucide-react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar
} from 'recharts';
import { storage } from '../services/mockStorage';
import { Organization, Business, DailySale, User, UserRole, SubscriptionTier } from '../types';
import { StatCard } from '../components/StatCard';
import { formatZAR, formatDate } from '../utils/formatters';
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
    const activeOrgs = data.organizations.filter(o => o.isActive);
    
    // 1. ECONOMIC HEALTH (Platform Revenue using Tier-based logic)
    const estimatedMRR = activeOrgs.reduce((acc, org) => {
      const tierPrice = TIER_REVENUE[org.tier] || 0;
      return acc + tierPrice;
    }, 0);

    // 2. INFRASTRUCTURE PULSE (Throughput)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const recentActivityCount = data.sales.filter(s => new Date(s.date) >= yesterday).length;

    // 3. TENANT SEGMENTATION
    const segmentation = [
      { name: 'Active', value: activeOrgs.length },
      { name: 'Inactive', value: data.organizations.length - activeOrgs.length }
    ];

    // 4. CHURN ANALYSIS
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const staleTenants = activeOrgs.filter(org => {
      const orgBizIds = data.businesses.filter(b => b.orgId === org.id).map(b => b.id);
      const hasActivity = data.sales.some(s => orgBizIds.includes(s.businessId) && new Date(s.date) >= sevenDaysAgo);
      return !hasActivity;
    }).map(org => ({
      ...org,
      unitCount: data.businesses.filter(b => b.orgId === org.id).length
    })).sort((a,b) => b.unitCount - a.unitCount);

    // 5. REVENUE BY TENANT (Top 5 based on Tier)
    const revenueByTenant = activeOrgs.map(org => {
      return {
        name: org.name,
        mrr: TIER_REVENUE[org.tier] || 0,
        id: org.id
      };
    }).sort((a,b) => b.mrr - a.mrr).slice(0, 5);

    // 6. SYSTEM THROUGHPUT HISTORY
    const last7Days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dateStr = d.toISOString().split('T')[0];
      return {
        name: d.toLocaleDateString('en-ZA', { weekday: 'short' }),
        events: data.sales.filter(s => s.date.split('T')[0] === dateStr).length
      };
    });

    return { 
      estimatedMRR, 
      activeOrgsCount: activeOrgs.length, 
      recentActivityCount, 
      staleCount: staleTenants.length,
      staleTenants,
      last7Days,
      revenueByTenant,
      segmentation
    };
  }, [data]);

  if (loading) return (
    <div className="h-[80vh] flex flex-col items-center justify-center text-indigo-400">
      <div className="w-10 h-10 border-2 border-indigo-900 border-t-indigo-500 rounded-full animate-spin mb-4" />
      <p className="font-black uppercase tracking-widest text-[10px] animate-pulse">Synchronizing Platform Command</p>
    </div>
  );

  return (
    <div className="space-y-8 pb-24 text-left">
      {/* Platform Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-indigo-500 font-black uppercase tracking-[0.2em] text-[10px] mb-2">
            <Server size={14} /> System Node: Root Node-01 Alpha
          </div>
          <h2 className="text-4xl font-black text-white tracking-tighter">Global Control</h2>
          <p className="text-slate-500 font-bold text-sm mt-1">Cross-tenant infrastructure & commercial overview</p>
        </div>
        <div className="flex items-center gap-3">
           <div className="px-4 py-3 bg-slate-900 border border-white/5 rounded-2xl flex items-center gap-4 shadow-xl">
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                 <span className="text-[10px] font-black text-white uppercase">Cloud Operational</span>
              </div>
              <div className="w-px h-4 bg-white/10" />
              <div className="text-right">
                 <p className="text-[8px] font-black text-slate-500 uppercase leading-none">Uptime</p>
                 <p className="text-[10px] font-black text-indigo-400">99.998%</p>
              </div>
           </div>
        </div>
      </div>

      {/* Infrastructure Core Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Platform MRR" value={formatZAR(stats.estimatedMRR)} icon={TrendingUp} color="indigo" trend={{ value: 12, isUp: true }} />
        <StatCard label="Live Tenants" value={stats.activeOrgsCount.toString()} icon={Building2} color="blue" />
        <StatCard label="Transaction Load" value={stats.recentActivityCount.toString()} icon={Zap} color="emerald" />
        <StatCard label="High Churn Risk" value={stats.staleCount.toString()} icon={AlertCircle} color="rose" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Utilization Chart */}
        <div className="lg:col-span-2 bg-slate-900 rounded-[2.5rem] p-10 border border-white/5 shadow-2xl flex flex-col">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-xl font-black text-white tracking-tight">Infrastructure Throughput</h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Global Record Generation Volume (Last 7 Days)</p>
            </div>
            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/10"><Activity size={20} /></div>
          </div>
          <div className="flex-1 min-h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.last7Days}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff0a" />
                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#475569', fontWeight: 900 }} dy={10} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#475569', fontWeight: 900 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', padding: '12px' }} 
                  itemStyle={{ fontSize: '11px', fontWeight: 900, color: '#818cf8' }}
                  labelStyle={{ fontWeight: 900, color: '#fff', marginBottom: '4px' }}
                />
                <Area type="step" dataKey="events" name="Records" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#areaGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Churn Prevention Center */}
        <div className="bg-slate-900 rounded-[2.5rem] p-10 border border-white/5 shadow-2xl flex flex-col">
           <div className="flex items-center gap-3 mb-8">
             <div className="p-3 bg-rose-500/10 text-rose-500 rounded-2xl"><AlertCircle size={20} /></div>
             <div>
               <h3 className="text-xl font-black text-white tracking-tight">Churn Alert</h3>
               <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Actionable Churn Risks</p>
             </div>
           </div>
           
           <div className="flex-1 space-y-4 overflow-y-auto max-h-[350px] pr-2 custom-scrollbar text-left">
             {stats.staleTenants.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-white/5 rounded-3xl">
                 <ShieldCheck size={40} className="text-emerald-500 mb-3 opacity-30" />
                 <p className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-relaxed">System-wide Tenant Integrity Maintained</p>
               </div>
             ) : (
               stats.staleTenants.map(tenant => (
                 <div key={tenant.id} className="p-5 bg-white/5 border border-white/5 rounded-3xl group hover:border-rose-500/30 transition-all cursor-default">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="text-sm font-black text-white">{tenant.name}</p>
                        <p className="text-[9px] text-slate-500 font-bold uppercase mt-0.5 tracking-widest">{tenant.unitCount} Business Units</p>
                      </div>
                      <div className="w-2 h-2 rounded-full bg-rose-500 shadow-lg shadow-rose-500/50" />
                    </div>
                    <button 
                       onClick={() => setSelectedOrgId(tenant.id)}
                       className="w-full py-2 bg-rose-500/10 text-rose-500 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all border border-rose-500/20"
                    >
                      DIVE INTO CONTEXT
                    </button>
                 </div>
               ))
             )}
           </div>

           <button 
             onClick={() => window.location.hash = '#/organizations'}
             className="mt-8 w-full py-4 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/5 transition-all"
           >
             Manage All Tenants
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Economic Leaders */}
        <div className="bg-slate-900 rounded-[2.5rem] p-10 border border-white/5 shadow-2xl flex flex-col">
           <div className="flex items-center gap-3 mb-10">
             <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/10"><BarChart3 size={20} /></div>
             <div>
               <h3 className="text-xl font-black text-white tracking-tight">Economic Leaders</h3>
               <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tenants contributing highest Platform MRR</p>
             </div>
           </div>

           <div className="flex-1 min-h-[300px]">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={stats.revenueByTenant} layout="vertical" margin={{ left: 20 }}>
                 <XAxis type="number" hide />
                 <YAxis dataKey="name" type="category" width={100} fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#475569', fontWeight: 900 }} />
                 <Tooltip 
                   cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                   contentStyle={{ backgroundColor: '#0f172a', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', padding: '12px' }} 
                   itemStyle={{ fontSize: '11px', fontWeight: 900, color: '#10b981' }}
                   labelStyle={{ fontWeight: 900, color: '#fff', marginBottom: '4px' }}
                   formatter={(val: number) => [formatZAR(val), 'Platform MRR']}
                 />
                 <Bar dataKey="mrr" radius={[0, 8, 8, 0]}>
                    {stats.revenueByTenant.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                 </Bar>
               </BarChart>
             </ResponsiveContainer>
           </div>
        </div>

        {/* Management Controls */}
        <div className="bg-indigo-600 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:scale-110 transition-transform pointer-events-none">
             <ShieldCheck size={200} />
           </div>
           
           <div className="relative z-10 flex flex-col h-full text-left">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-white/20 rounded-2xl"><Users size={24} /></div>
                <div>
                  <h3 className="text-2xl font-black tracking-tighter">System Authority</h3>
                  <p className="text-indigo-100 text-[10px] font-black uppercase tracking-widest">Platform Identity Audit</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 flex-1">
                 <div className="p-6 bg-white/10 rounded-3xl border border-white/5 flex flex-col justify-between">
                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-100 mb-2">Total Managed Users</p>
                    <p className="text-4xl font-black">{data.users.length}</p>
                    <div className="mt-4 flex items-center gap-2 text-[9px] font-black bg-white/10 w-fit px-2 py-1 rounded-md">
                       <div className="w-1 h-1 rounded-full bg-emerald-400" /> SYNCED
                    </div>
                 </div>
                 <div className="p-6 bg-white/10 rounded-3xl border border-white/5 flex flex-col justify-between">
                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-100 mb-2">Provisioned Shops</p>
                    <p className="text-4xl font-black">{data.businesses.length}</p>
                    <div className="mt-4 flex items-center gap-2 text-[9px] font-black bg-white/10 w-fit px-2 py-1 rounded-md">
                       <div className="w-1 h-1 rounded-full bg-indigo-300" /> DEPLOYED
                    </div>
                 </div>
              </div>

              <div className="mt-10 flex gap-4">
                 <button onClick={() => window.location.hash = '#/users'} className="flex-1 py-4 bg-white text-indigo-600 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-indigo-50 transition-all">
                   IDENTITY ACCESS
                 </button>
                 <button onClick={() => window.location.hash = '#/reminders'} className="flex-1 py-4 bg-indigo-800 text-indigo-100 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-indigo-900 transition-all border border-indigo-500/30">
                   FULL AUDIT LOG
                 </button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
