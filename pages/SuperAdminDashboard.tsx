
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  Users, 
  Zap, 
  BarChart3, 
  ArrowUpRight, 
  LayoutGrid, 
  Activity,
  History,
  ShieldCheck,
  CalendarDays,
  Store,
  ArrowRight
} from 'lucide-react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area
} from 'recharts';
import { storage } from '../services/mockStorage';
import { Organization, Business, DailySale, User, UserRole, Reminder } from '../types';
import { StatCard } from '../components/StatCard';
import { formatZAR, formatDate } from '../utils/formatters';

export const SuperAdminDashboard: React.FC = () => {
  const [data, setData] = useState<{
    organizations: Organization[];
    businesses: Business[];
    sales: DailySale[];
    users: User[];
    logs: Reminder[];
  }>({ organizations: [], businesses: [], sales: [], users: [], logs: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGlobalData = async () => {
      setLoading(true);
      try {
        const [orgs, biz, sales, users, logs] = await Promise.all([
          storage.getOrganizations(),
          storage.getBusinesses(),
          storage.getSales(),
          storage.getUsers(),
          storage.getReminders()
        ]);
        setData({ organizations: orgs, businesses: biz, sales: sales, users: users, logs: logs });
      } finally {
        setLoading(false);
      }
    };
    fetchGlobalData();
  }, []);

  const stats = useMemo(() => {
    const throughput = data.sales.reduce((acc, s) => acc + s.salesAmount, 0);
    const activeOrgs = data.organizations.filter(o => o.isActive).length;
    
    // Aggregating sales by organization for the leaderboard
    const orgPerformance = data.organizations.map(org => {
      const orgBizIds = data.businesses.filter(b => b.orgId === org.id).map(b => b.id);
      const orgSales = data.sales.filter(s => orgBizIds.includes(s.businessId));
      const orgRev = orgSales.reduce((sum, s) => sum + s.salesAmount, 0);
      const orgProfit = orgSales.reduce((sum, s) => sum + s.profitAmount, 0);
      return { 
        ...org, 
        revenue: orgRev, 
        profit: orgProfit,
        bizCount: orgBizIds.length,
        userCount: data.users.filter(u => u.orgId === org.id).length
      };
    }).sort((a, b) => b.revenue - a.revenue);

    // Chart Data: Global Sales Trend
    const last30Days = [...Array(30)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      const dateStr = d.toISOString().split('T')[0];
      const daySales = data.sales.filter(s => s.date.split('T')[0] === dateStr);
      return {
        name: d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' }),
        value: daySales.reduce((acc, s) => acc + s.salesAmount, 0)
      };
    });

    return { throughput, activeOrgs, orgPerformance, last30Days };
  }, [data]);

  if (loading) return (
    <div className="h-[60vh] flex flex-col items-center justify-center text-indigo-400">
      <Zap className="animate-pulse mb-4" size={48} fill="currentColor" />
      <p className="font-black uppercase tracking-widest text-xs">Accessing Global Kernel</p>
    </div>
  );

  return (
    <div className="space-y-8 pb-12">
      {/* Header Overview */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="text-left">
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Global Kernel Pulse</h2>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mt-1">Platform Performance Engine • Real-time Monitoring</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-indigo-900 text-white rounded-2xl shadow-xl flex items-center gap-2">
            <Activity size={16} className="text-indigo-400" />
            <span className="text-xs font-black uppercase tracking-widest">Active Status</span>
          </div>
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          label="Total Tenants" 
          value={data.organizations.length.toString()} 
          icon={Building2} 
          color="blue" 
          trend={{ value: stats.activeOrgs, isUp: true }}
        />
        <StatCard 
          label="Active Shops" 
          value={data.businesses.length.toString()} 
          icon={Store} 
          color="teal" 
        />
        <StatCard 
          label="Platform Flow" 
          value={formatZAR(stats.throughput)} 
          icon={BarChart3} 
          color="emerald" 
        />
        <StatCard 
          label="Global Users" 
          value={data.users.length.toString()} 
          icon={Users} 
          color="amber" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Global Volume Chart */}
        <div className="lg:col-span-2 bg-white rounded-[3rem] p-10 border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div className="text-left">
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Platform Throughput</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Aggregate Daily Sales Volume (ZAR)</p>
            </div>
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><Activity size={24} /></div>
          </div>
          <div className="flex-1 min-h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.last30Days}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontWeight: 900 }} dy={10} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontWeight: 900 }} tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(0)}k` : val} />
                <Tooltip 
                  contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)', padding: '16px' }} 
                  itemStyle={{ fontSize: '12px', fontWeight: 900, color: '#4f46e5' }}
                  labelStyle={{ fontWeight: 900, color: '#0f172a', marginBottom: '8px' }}
                />
                <Area type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={4} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tenant Rankings */}
        <div className="bg-white rounded-[3rem] p-10 border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-black text-slate-900 tracking-tight">Tenant Rankings</h3>
            <LayoutGrid size={20} className="text-slate-400" />
          </div>
          <div className="space-y-4 overflow-y-auto max-h-[500px] pr-2 custom-scrollbar">
            {stats.orgPerformance.map((org, idx) => (
              <div key={org.id} className="group relative bg-slate-50 p-5 rounded-3xl border border-slate-100 hover:bg-white hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-500/10 transition-all">
                <div className="flex justify-between items-start">
                  <div className="flex gap-4 items-center">
                    <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center font-black text-indigo-600 shadow-sm group-hover:bg-indigo-600 group-hover:text-white transition-all">
                      {idx + 1}
                    </div>
                    <div className="text-left">
                      <h4 className="font-black text-slate-800 text-sm truncate max-w-[120px]">{org.name}</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                        {org.bizCount} Units • {org.userCount} Active Users
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-indigo-600 leading-none">{formatZAR(org.revenue)}</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase mt-1">Total Rev</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                   <div className="flex items-center gap-2">
                     <span className={`w-2 h-2 rounded-full ${org.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                     <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                       {org.isActive ? 'System Healthy' : 'Access Restricted'}
                     </span>
                   </div>
                   <button onClick={() => window.location.hash = `#/organizations`} className="text-indigo-600 hover:underline text-[10px] font-black uppercase tracking-widest">Control</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* System Feed & Subscriptions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* System Activity Log */}
        <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-2xl"><History size={20} /></div>
              <div className="text-left">
                <h3 className="text-xl font-black tracking-tight">System Event Stream</h3>
                <p className="text-[10px] font-bold text-indigo-400/60 uppercase tracking-widest">Global Activity Feed</p>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            {data.logs.slice(0, 6).map((log) => (
              <div key={log.id} className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/20 flex items-center justify-center shrink-0">
                  <Activity size={16} className="text-indigo-400" />
                </div>
                <div className="text-left flex-1 overflow-hidden">
                  <p className="text-xs font-bold text-white/90 truncate">
                    Entry for <span className="text-indigo-400">{log.businessName}</span>
                  </p>
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">
                    Authorized by {log.sentByUserName}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-white/30 uppercase">{formatDate(log.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Subscription Watchlist */}
        <div className="bg-white rounded-[3rem] p-10 border border-slate-200 shadow-sm">
           <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl"><CalendarDays size={20} /></div>
              <div className="text-left">
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Contract Watchlist</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Expiring or Inactive Clients</p>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            {data.organizations.filter(o => !o.isActive || new Date(o.subscriptionEndDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)).map(org => (
              <div key={org.id} className="flex items-center justify-between p-5 rounded-3xl bg-rose-50 border border-rose-100">
                <div className="flex items-center gap-4 text-left">
                  <div className="p-3 bg-white text-rose-500 rounded-2xl shadow-sm"><ShieldCheck size={18} /></div>
                  <div>
                    <h4 className="text-sm font-black text-slate-800">{org.name}</h4>
                    <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mt-0.5">Expires: {formatDate(org.subscriptionEndDate)}</p>
                  </div>
                </div>
                <button 
                  onClick={() => window.location.hash = `#/organizations`}
                  className="p-3 bg-white text-rose-600 hover:bg-rose-600 hover:text-white rounded-2xl shadow-sm transition-all"
                >
                  <ArrowRight size={18} />
                </button>
              </div>
            ))}
            {data.organizations.filter(o => !o.isActive || new Date(o.subscriptionEndDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)).length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-slate-300">
                 <ShieldCheck size={48} className="opacity-10 mb-2" />
                 <p className="text-xs font-black uppercase tracking-[0.2em]">All Contracts Up-to-Date</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
