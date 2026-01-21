
import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  ArrowDownCircle, 
  Loader2,
  Trophy,
  Target,
  Zap,
  Activity,
  Layers,
  Store
} from 'lucide-react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Legend
} from 'recharts';
import { StatCard } from '../components/StatCard';
import { FilterPanel } from '../components/FilterPanel';
import { Filters, DailySale, MonthlyExpense, Business, UserRole } from '../types';
import { storage } from '../services/mockStorage';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/formatters';

const CHART_COLORS = ['#0d9488', '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#4f46e5', '#e11d48', '#6366f1', '#8b5cf6'];

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [sales, setSales] = useState<DailySale[]>([]);
  const [expenses, setExpenses] = useState<MonthlyExpense[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState<'ZAR' | 'PKR'>('ZAR');
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [isFetchingRate, setIsFetchingRate] = useState(false);
  
  const isAdmin = user?.role === UserRole.ADMIN;
  const isScoped = !isAdmin && (user?.assignedBusinessIds?.length || 0) > 0;

  const [filters, setFilters] = useState<Filters>({
    businessId: 'all',
    dateRange: { start: '', end: '' },
    selectedMonth: '',
    timeframe: 'this_month'
  });

  const fetchExchangeRate = async () => {
    setIsFetchingRate(true);
    try {
      const response = await fetch('https://open.er-api.com/v6/latest/ZAR');
      const data = await response.json();
      if (data?.rates?.PKR) setExchangeRate(data.rates.PKR);
    } catch (err) {
      setExchangeRate(15.5); 
    } finally {
      setIsFetchingRate(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [s, e, b] = await Promise.all([
        storage.getSales(), 
        storage.getExpenses(),
        storage.getBusinesses()
      ]);
      setSales(s);
      setExpenses(e);
      setBusinesses(b);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    fetchExchangeRate();
  }, []);

  const convert = (val: number) => currency === 'PKR' ? val * exchangeRate : val;

  const metrics = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (filters.dateRange.start || filters.dateRange.end) {
      startDate = filters.dateRange.start ? new Date(filters.dateRange.start) : new Date(2000, 0, 1);
      endDate = filters.dateRange.end ? new Date(filters.dateRange.end) : endOfToday;
      endDate.setHours(23, 59, 59, 999);
    } else {
      switch (filters.timeframe) {
        case 'today':
          startDate = new Date(); startDate.setHours(0,0,0,0);
          endDate = endOfToday;
          break;
        case 'yesterday':
          startDate = new Date(); startDate.setDate(now.getDate() - 1); startDate.setHours(0,0,0,0);
          endDate = new Date(); endDate.setDate(now.getDate() - 1); endDate.setHours(23,59,59,999);
          break;
        case 'this_month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = endOfToday;
          break;
        case 'select_month':
          if (filters.selectedMonth) {
            const [y, m] = filters.selectedMonth.split('-').map(Number);
            startDate = new Date(y, m - 1, 1);
            endDate = new Date(y, m, 0, 23, 59, 59, 999);
          } else {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = endOfToday;
          }
          break;
        case 'lifetime':
        default:
          endDate = endOfToday;
          startDate = new Date(2000, 0, 1);
          break;
      }
    }

    const filterData = (data: any[]) => {
      return data.filter(item => {
        const itemDate = new Date(item.date || item.month + '-01');
        const inRange = itemDate >= startDate && itemDate <= endDate;
        
        const userHasAccess = isAdmin || user?.assignedBusinessIds?.includes(item.businessId);
        if (!userHasAccess) return false;

        const matchesBizFilter = filters.businessId === 'all' || item.businessId === filters.businessId;
        return inRange && matchesBizFilter;
      });
    };

    const currentSales = filterData(sales);
    const currentExpenses = filterData(expenses);
    
    const rev = currentSales.reduce((acc, curr) => acc + Number(curr.salesAmount), 0);
    const gp = currentSales.reduce((acc, curr) => acc + Number(curr.profitAmount), 0);
    const ex = currentExpenses.reduce((acc, curr) => acc + Number(curr.amount), 0);

    const businessRanking = businesses
      .filter(biz => {
        const userHasAccess = isAdmin || user?.assignedBusinessIds?.includes(biz.id);
        const matchesBizFilter = filters.businessId === 'all' || biz.id === filters.businessId;
        return userHasAccess && matchesBizFilter;
      })
      .map(biz => {
        const bizSales = currentSales.filter(s => s.businessId === biz.id);
        const bizExpenses = currentExpenses.filter(e => e.businessId === biz.id);
        const bRev = bizSales.reduce((sum, s) => sum + Number(s.salesAmount), 0);
        const bGp = bizSales.reduce((sum, s) => sum + Number(s.profitAmount), 0);
        const bEx = bizExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
        return {
          id: biz.id, name: biz.name, location: biz.location,
          revenue: convert(bRev), profit: convert(bGp - bEx)
        };
      })
      .sort((a, b) => b.profit - a.profit);

    // DAILY VELOCITY CHART RECREATION
    const comparisonData = [];
    
    // Generate dates based on the active timeframe for the X-Axis
    let chartDays = 30; // default
    let year = now.getFullYear();
    let month = now.getMonth();

    if (filters.timeframe === 'select_month' && filters.selectedMonth) {
       const [y, m] = filters.selectedMonth.split('-').map(Number);
       year = y;
       month = m - 1;
       chartDays = new Date(year, m, 0).getDate();
    } else {
       chartDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    }

    for (let day = 1; day <= chartDays; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayPoint: any = { 
        dayLabel: `${day}/${month + 1}`,
        fullDate: dateStr
      };
      
      businesses.forEach(biz => {
        const userHasAccess = isAdmin || user?.assignedBusinessIds?.includes(biz.id);
        if (!userHasAccess) return;
        
        // Respect the specific business filter if not "all"
        if (filters.businessId !== 'all' && biz.id !== filters.businessId) return;
        
        const sale = sales.find(s => s.businessId === biz.id && s.date === dateStr);
        dayPoint[`${biz.name} (${biz.location})`] = sale ? convert(Number(sale.salesAmount)) : 0;
      });
      comparisonData.push(dayPoint);
    }

    return { 
      totalRevenue: convert(rev), totalGrossProfit: convert(gp), 
      totalExpenses: convert(ex), netProfit: convert(gp - ex),
      expenseRatio: rev > 0 ? (ex / rev) * 100 : 0,
      bestUnit: businessRanking[0] || null,
      businessRanking,
      comparisonData
    };
  }, [filters, sales, expenses, businesses, currency, exchangeRate, user, isAdmin]);

  if (loading) return <div className="h-[60vh] flex flex-col items-center justify-center text-slate-400"><Loader2 className="animate-spin mb-4" size={40} /><p className="font-bold uppercase tracking-widest text-[10px]">Syncing Portal</p></div>;

  if (!isAdmin && (user?.assignedBusinessIds?.length || 0) === 0) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center p-10 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200">
        <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-3xl flex items-center justify-center mb-6"><Store size={32} /></div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">Shop Assignment Required</h3>
        <p className="text-slate-500 max-w-sm">Contact your Admin to link your profile to one or more shop locations.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <FilterPanel 
        filters={filters} setFilters={setFilters} currency={currency} setCurrency={setCurrency}
        exchangeRate={exchangeRate} isFetchingRate={isFetchingRate} onRefreshRate={fetchExchangeRate}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Gross Revenue" value={formatCurrency(metrics.totalRevenue, currency)} icon={DollarSign} color="blue" />
        <StatCard label="Gross Profit" value={formatCurrency(metrics.totalGrossProfit, currency)} icon={TrendingUp} color="emerald" />
        <StatCard label="Net Position" value={formatCurrency(metrics.netProfit, currency)} icon={Zap} color="teal" />
        <StatCard label="Operational Costs" value={formatCurrency(metrics.totalExpenses, currency)} icon={ArrowDownCircle} color="rose" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0"><Target size={24} /></div>
          <div className="text-left">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Expense Ratio</p>
            <h4 className="text-xl font-bold text-slate-800">{metrics.expenseRatio.toFixed(1)}%</h4>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0"><Trophy size={24} /></div>
          <div className="overflow-hidden text-left">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Top Unit</p>
            <h4 className="text-sm font-bold text-slate-800 truncate leading-tight">{metrics.bestUnit?.name || 'N/A'}</h4>
            {metrics.bestUnit && <p className="text-[9px] font-black text-amber-600 uppercase tracking-tighter truncate">{metrics.bestUnit.location}</p>}
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0"><Activity size={24} /></div>
          <div className="text-left">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Health Index</p>
            <h4 className="text-xl font-bold text-emerald-600">Dynamic</h4>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* RECREATED DAILY VELOCITY GRAPH */}
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-8 pb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-900 text-white rounded-lg"><Layers size={20} /></div>
              <div className="text-left">
                <h3 className="text-xl font-black text-slate-900 tracking-tight">
                  {isScoped ? 'My Unit Velocity' : 'Global Daily Velocity'}
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Revenue Impact Stream</p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2">
               <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
               <span className="text-[9px] font-black uppercase text-slate-400 tracking-tighter">Live Transaction Mapping</span>
            </div>
          </div>
          
          <div className="p-8 flex-1 h-[850px] transition-all duration-500">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={metrics.comparisonData}
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="dayLabel" 
                  fontSize={10} 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontWeight: 700 }}
                  dy={10}
                />
                <YAxis 
                  fontSize={10} 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontWeight: 700 }}
                  tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(0)}k` : val}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
                    padding: '12px'
                  }} 
                  itemStyle={{ fontSize: '12px', fontWeight: 800 }}
                />
                <Legend 
                  verticalAlign="top" 
                  align="right"
                  wrapperStyle={{ paddingBottom: '30px', fontSize: '10px', textTransform: 'uppercase', fontWeight: '900' }} 
                  iconType="circle" 
                />
                {businesses.map((biz, idx) => {
                  const userHasAccess = isAdmin || user?.assignedBusinessIds?.includes(biz.id);
                  if (!userHasAccess) return null;
                  
                  // Filter bar visibility based on local UI filter
                  if (filters.businessId !== 'all' && biz.id !== filters.businessId) return null;
                  
                  return (
                    <Bar 
                      key={biz.id} 
                      dataKey={`${biz.name} (${biz.location})`} 
                      stackId="a" 
                      fill={CHART_COLORS[idx % CHART_COLORS.length]} 
                      radius={[idx === businesses.length - 1 ? 4 : 0, idx === businesses.length - 1 ? 4 : 0, 0, 0]}
                    />
                  );
                })}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
          <h3 className="font-bold text-slate-800 mb-6 uppercase text-xs tracking-widest text-left">Performance Standings</h3>
          <div className="space-y-4">
            {metrics.businessRanking.map((biz, idx) => (
              <div key={biz.id} className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-white text-slate-500 flex items-center justify-center text-xs font-black shadow-sm">#{idx + 1}</span>
                  <div className="text-left"><h4 className="text-xs font-bold text-slate-800">{biz.name}</h4><p className="text-[9px] text-slate-400 font-bold uppercase">{biz.location}</p></div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black text-emerald-600 block">{formatCurrency(biz.profit, currency)}</span>
                  <span className="text-[9px] font-black text-slate-400 uppercase">Profit</span>
                </div>
              </div>
            ))}
            {metrics.businessRanking.length === 0 && (
               <div className="py-10 text-center text-slate-400 italic text-xs">No business units match criteria.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
