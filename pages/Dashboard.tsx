
import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  ArrowDownCircle, 
  Loader2,
  Trophy,
  Zap,
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
      setSales(s || []);
      setExpenses(e || []);
      setBusinesses(b || []);
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
    const currentYear = now.getFullYear();
    const currentMonthIndex = now.getMonth();
    
    // Range Calculation
    let startDate: Date;
    let endDate: Date;
    let prevStartDate: Date;
    let prevEndDate: Date;
    const endOfToday = new Date(currentYear, currentMonthIndex, now.getDate(), 23, 59, 59, 999);

    if (filters.dateRange.start || filters.dateRange.end) {
      startDate = filters.dateRange.start ? new Date(filters.dateRange.start) : new Date(2000, 0, 1);
      endDate = filters.dateRange.end ? new Date(filters.dateRange.end) : endOfToday;
      endDate.setHours(23, 59, 59, 999);
      
      // For custom ranges, we compare to the same duration before the start
      const duration = endDate.getTime() - startDate.getTime();
      prevStartDate = new Date(startDate.getTime() - duration);
      prevEndDate = new Date(startDate.getTime() - 1);
    } else {
      switch (filters.timeframe) {
        case 'today':
          startDate = new Date(); startDate.setHours(0,0,0,0);
          endDate = endOfToday;
          prevStartDate = new Date(startDate); prevStartDate.setDate(startDate.getDate() - 1);
          prevEndDate = new Date(endDate); prevEndDate.setDate(endDate.getDate() - 1);
          break;
        case 'yesterday':
          startDate = new Date(); startDate.setDate(now.getDate() - 1); startDate.setHours(0,0,0,0);
          endDate = new Date(); endDate.setDate(now.getDate() - 1); endDate.setHours(23,59,59,999);
          prevStartDate = new Date(startDate); prevStartDate.setDate(startDate.getDate() - 1);
          prevEndDate = new Date(endDate); prevEndDate.setDate(endDate.getDate() - 1);
          break;
        case 'this_month':
          startDate = new Date(currentYear, currentMonthIndex, 1);
          endDate = endOfToday;
          prevStartDate = new Date(currentYear, currentMonthIndex - 1, 1);
          prevEndDate = new Date(currentYear, currentMonthIndex, 0, 23, 59, 59, 999);
          break;
        case 'select_month':
          if (filters.selectedMonth) {
            const [y, m] = filters.selectedMonth.split('-').map(Number);
            startDate = new Date(y, m - 1, 1);
            endDate = new Date(y, m, 0, 23, 59, 59, 999);
            prevStartDate = new Date(y, m - 2, 1);
            prevEndDate = new Date(y, m - 1, 0, 23, 59, 59, 999);
          } else {
            startDate = new Date(currentYear, currentMonthIndex, 1);
            endDate = endOfToday;
            prevStartDate = new Date(currentYear, currentMonthIndex - 1, 1);
            prevEndDate = new Date(currentYear, currentMonthIndex, 0, 23, 59, 59, 999);
          }
          break;
        case 'lifetime':
        default:
          endDate = endOfToday;
          startDate = new Date(2000, 0, 1);
          prevStartDate = new Date(0);
          prevEndDate = new Date(0);
          break;
      }
    }

    const calculateData = (dataSales: DailySale[], dataExpenses: MonthlyExpense[], start: Date, end: Date) => {
      const filteredSales = dataSales.filter(item => {
        const itemDate = new Date(item.date);
        const inRange = itemDate >= start && itemDate <= end;
        const userHasAccess = isAdmin || user?.assignedBusinessIds?.includes(item.businessId);
        const matchesBiz = filters.businessId === 'all' || item.businessId === filters.businessId;
        return inRange && userHasAccess && matchesBiz;
      });

      const filteredExpenses = dataExpenses.filter(item => {
        const itemDate = new Date(item.month + '-01');
        const inRange = itemDate >= start && itemDate <= end;
        const userHasAccess = isAdmin || user?.assignedBusinessIds?.includes(item.businessId);
        const matchesBiz = filters.businessId === 'all' || item.businessId === filters.businessId;
        return inRange && userHasAccess && matchesBiz;
      });

      const rev = filteredSales.reduce((acc, curr) => acc + Number(curr.salesAmount), 0);
      const gp = filteredSales.reduce((acc, curr) => acc + Number(curr.profitAmount), 0);
      const ex = filteredExpenses.reduce((acc, curr) => acc + Number(curr.amount), 0);
      
      return { rev, gp, ex, net: gp - ex };
    };

    const current = calculateData(sales, expenses, startDate, endDate);
    const previous = calculateData(sales, expenses, prevStartDate, prevEndDate);

    const calcTrend = (curr: number, prev: number) => {
      if (prev <= 0) return undefined;
      const diff = ((curr - prev) / prev) * 100;
      return {
        value: Math.abs(Math.round(diff)),
        isUp: diff >= 0
      };
    };

    const businessRanking = businesses
      .filter(biz => {
        const userHasAccess = isAdmin || user?.assignedBusinessIds?.includes(biz.id);
        const matchesBizFilter = filters.businessId === 'all' || biz.id === filters.businessId;
        return userHasAccess && matchesBizFilter;
      })
      .map(biz => {
        const bizSales = sales.filter(s => {
           const sDate = new Date(s.date);
           return sDate >= startDate && sDate <= endDate && s.businessId === biz.id;
        });
        const bizExpenses = expenses.filter(e => {
           const eDate = new Date(e.month + '-01');
           return eDate >= startDate && eDate <= endDate && e.businessId === biz.id;
        });
        const bRev = bizSales.reduce((sum, s) => sum + Number(s.salesAmount), 0);
        const bGp = bizSales.reduce((sum, s) => sum + Number(s.profitAmount), 0);
        const bEx = bizExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
        return {
          id: biz.id, name: biz.name, location: biz.location,
          revenue: convert(bRev), profit: convert(bGp - bEx)
        };
      })
      .sort((a, b) => b.profit - a.profit);

    // GRAPH DATA (Current Month)
    const chartData = [];
    const daysInMonth = new Date(currentYear, currentMonthIndex + 1, 0).getDate();
    const currentMonthSalesMap = new Map();
    
    sales.forEach(s => {
      const sDate = new Date(s.date);
      if (sDate.getFullYear() === currentYear && sDate.getMonth() === currentMonthIndex) {
        const dateKey = s.date.split('T')[0];
        currentMonthSalesMap.set(`${dateKey}_${s.businessId}`, s);
      }
    });

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentYear}-${String(currentMonthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayEntry: any = { dayLabel: day.toString(), fullDate: dateStr };
      
      businesses.forEach(biz => {
        const userHasAccess = isAdmin || user?.assignedBusinessIds?.includes(biz.id);
        if (!userHasAccess) return;
        if (filters.businessId !== 'all' && biz.id !== filters.businessId) return;
        
        const sale = currentMonthSalesMap.get(`${dateStr}_${biz.id}`);
        dayEntry[`biz_${biz.id}`] = sale ? convert(Number(sale.salesAmount)) : 0;
      });
      chartData.push(dayEntry);
    }

    return { 
      totalRevenue: convert(current.rev), 
      totalGrossProfit: convert(current.gp), 
      totalExpenses: convert(current.ex), 
      netProfit: convert(current.net),
      trends: {
        revenue: calcTrend(current.rev, previous.rev),
        gp: calcTrend(current.gp, previous.gp),
        expenses: calcTrend(current.ex, previous.ex),
        net: calcTrend(current.net, previous.net)
      },
      bestUnit: businessRanking[0] || null,
      businessRanking,
      chartData
    };
  }, [filters, sales, expenses, businesses, currency, exchangeRate, user, isAdmin]);

  if (loading) return (
    <div className="h-[60vh] flex flex-col items-center justify-center text-slate-400">
      <Loader2 className="animate-spin mb-4" size={40} />
      <p className="font-bold uppercase tracking-widest text-[10px]">Syncing Portal</p>
    </div>
  );

  return (
    <div className="space-y-6 pb-20">
      <FilterPanel 
        filters={filters} setFilters={setFilters} currency={currency} setCurrency={setCurrency}
        exchangeRate={exchangeRate} isFetchingRate={isFetchingRate} onRefreshRate={fetchExchangeRate}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          label="Gross Revenue" 
          value={formatCurrency(metrics.totalRevenue, currency)} 
          icon={DollarSign} 
          color="blue" 
          trend={metrics.trends.revenue}
        />
        <StatCard 
          label="Gross Profit" 
          value={formatCurrency(metrics.totalGrossProfit, currency)} 
          icon={TrendingUp} 
          color="emerald" 
          trend={metrics.trends.gp}
        />
        <StatCard 
          label="Net Position" 
          value={formatCurrency(metrics.netProfit, currency)} 
          icon={Zap} 
          color="teal" 
          trend={metrics.trends.net}
        />
        <StatCard 
          label="Operational Costs" 
          value={formatCurrency(metrics.totalExpenses, currency)} 
          icon={ArrowDownCircle} 
          color="rose" 
          trend={metrics.trends.expenses}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Graph Card */}
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-8 pb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-900 text-white rounded-lg"><Layers size={20} /></div>
              <div className="text-left">
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Daily Sales Volume</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Calendar Month Velocity</p>
              </div>
            </div>
          </div>
          <div className="p-8 flex-1 min-h-[500px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.chartData} margin={{ top: 20, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="dayLabel" fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontWeight: 700 }} dy={10} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontWeight: 700 }} tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(0)}k` : val} />
                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', padding: '12px' }} labelStyle={{ fontWeight: 900, color: '#0f172a', marginBottom: '8px' }} itemStyle={{ fontSize: '11px', fontWeight: 700 }} />
                <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '30px', fontSize: '10px', textTransform: 'uppercase', fontWeight: '900' }} iconType="circle" />
                {businesses.map((biz, idx) => {
                  if (!(isAdmin || user?.assignedBusinessIds?.includes(biz.id))) return null;
                  if (filters.businessId !== 'all' && biz.id !== filters.businessId) return null;
                  return (
                    <Bar 
                      key={biz.id} 
                      dataKey={`biz_${biz.id}`} 
                      name={`${biz.name} (${biz.location})`}
                      stackId="a" 
                      fill={CHART_COLORS[idx % CHART_COLORS.length]} 
                      radius={[4, 4, 0, 0]}
                    />
                  );
                })}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Unit Standings Sidebar */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 flex flex-col">
          <h3 className="font-bold text-slate-800 mb-6 uppercase text-xs tracking-widest text-left">Unit Standings</h3>
          
          <div className="mb-8">
             <div className="flex items-center gap-3 bg-indigo-50 p-5 rounded-3xl border border-indigo-100/50 shadow-sm">
                <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200"><Trophy size={20} /></div>
                <div className="text-left overflow-hidden">
                   <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest leading-none mb-1.5">Current Leader</p>
                   <p className="text-base font-black text-slate-900 truncate leading-tight">
                     {metrics.bestUnit ? `${metrics.bestUnit.name} (${metrics.bestUnit.location})` : '...'}
                   </p>
                </div>
             </div>
          </div>

          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <span className="w-4 h-[1px] bg-slate-200"></span>
            Performance Ranking
          </h4>

          <div className="space-y-4 flex-1 overflow-y-auto pr-1">
            {metrics.businessRanking.map((biz, idx) => (
              <div key={biz.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between hover:bg-white hover:shadow-lg hover:border-teal-200 transition-all group cursor-default">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-xl bg-white text-slate-500 group-hover:bg-teal-600 group-hover:text-white flex items-center justify-center text-xs font-black shadow-sm transition-all">#{idx + 1}</span>
                  <div className="text-left">
                    <h4 className="text-xs font-bold text-slate-800 group-hover:text-teal-900 transition-colors">{biz.name}</h4>
                    <p className="text-[9px] text-slate-400 font-bold uppercase">{biz.location}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-xs font-black block ${biz.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {formatCurrency(biz.profit, currency)}
                  </span>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Profit</span>
                </div>
              </div>
            ))}
            {metrics.businessRanking.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                <Store size={40} className="mb-4 opacity-20" />
                <p className="text-xs font-bold uppercase tracking-widest italic">No Ranking Data</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
