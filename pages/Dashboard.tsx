import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  ArrowDownCircle, 
  LineChart as LineChartIcon,
  Loader2,
  LayoutGrid,
  Coins,
  RefreshCw,
  Trophy,
  Percent,
  Target,
  Zap,
  Activity,
  Calendar
} from 'lucide-react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell
} from 'recharts';
import { StatCard } from '../components/StatCard';
import { FilterPanel } from '../components/FilterPanel';
import { Filters, DailySale, MonthlyExpense, Business } from '../types';
import { storage } from '../services/mockStorage';
import { formatCurrency } from '../utils/formatters';

export const Dashboard: React.FC = () => {
  const [sales, setSales] = useState<DailySale[]>([]);
  const [expenses, setExpenses] = useState<MonthlyExpense[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState<'ZAR' | 'PKR'>('ZAR');
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [isFetchingRate, setIsFetchingRate] = useState(false);
  
  const [filters, setFilters] = useState<Filters>({
    businessId: 'all',
    dateRange: { start: '', end: '' },
    selectedMonth: '',
    timeframe: 'today'
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
    } catch (err) {
      console.error("Data load error", err);
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

    // 1. Calculate Date Ranges (Manual Date Range takes Priority)
    if (filters.dateRange.start || filters.dateRange.end) {
      startDate = filters.dateRange.start ? new Date(filters.dateRange.start) : new Date(2000, 0, 1);
      endDate = filters.dateRange.end ? new Date(filters.dateRange.end) : now;
      endDate.setHours(23, 59, 59, 999);
    } else {
      switch (filters.timeframe) {
        case 'today':
          startDate = new Date();
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date();
          endDate.setHours(23, 59, 59, 999);
          break;
        case 'yesterday':
          startDate = new Date();
          startDate.setDate(now.getDate() - 1);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date();
          endDate.setDate(now.getDate() - 1);
          endDate.setHours(23, 59, 59, 999);
          break;
        case 'this_month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = now;
          break;
        case 'select_month':
          if (filters.selectedMonth) {
            const [year, month] = filters.selectedMonth.split('-').map(Number);
            startDate = new Date(year, month - 1, 1);
            endDate = new Date(year, month, 0, 23, 59, 59, 999);
          } else {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = now;
          }
          break;
        case 'lifetime':
        default:
          endDate = now;
          startDate = new Date(2000, 0, 1);
          break;
      }
    }

    // 2. Define Previous Period for Real-Time Trends
    const durationMs = endDate.getTime() - startDate.getTime();
    const prevPeriodEnd = new Date(startDate.getTime() - 1);
    const prevPeriodStart = new Date(prevPeriodEnd.getTime() - durationMs);

    const filterDataByRange = (data: any[], start: Date, end: Date, bizId: string) => {
      return data.filter(item => {
        const itemDate = new Date(item.date || item.month + '-01');
        const inRange = itemDate >= start && itemDate <= end;
        const matchesBiz = bizId === 'all' || item.businessId === bizId;
        return inRange && matchesBiz;
      });
    };

    const currentSales = filterDataByRange(sales, startDate, endDate, filters.businessId);
    const currentExpenses = filterDataByRange(expenses, startDate, endDate, filters.businessId);
    const prevSales = filterDataByRange(sales, prevPeriodStart, prevPeriodEnd, filters.businessId);
    const prevExpenses = filterDataByRange(expenses, prevPeriodStart, prevPeriodEnd, filters.businessId);

    const calculateTotals = (sItems: DailySale[], eItems: MonthlyExpense[]) => {
      const rev = sItems.reduce((acc, curr) => acc + Number(curr.salesAmount), 0);
      const gp = sItems.reduce((acc, curr) => acc + Number(curr.profitAmount), 0);
      const ex = eItems.reduce((acc, curr) => acc + Number(curr.amount), 0);
      return { rev, gp, ex, net: gp - ex };
    };

    const current = calculateTotals(currentSales, currentExpenses);
    const previous = calculateTotals(prevSales, prevExpenses);

    const getTrend = (curr: number, prev: number) => {
      if (prev === 0) return { value: 0, isUp: true };
      const change = ((curr - prev) / Math.abs(prev)) * 100;
      return { value: Math.abs(Number(change.toFixed(1))), isUp: change >= 0 };
    };

    // Global Stats
    const totalRevenue = current.rev;
    const totalGrossProfit = current.gp;
    const totalExpenses = current.ex;
    const netProfit = current.net;
    
    const expenseRatio = totalRevenue > 0 ? (totalExpenses / totalRevenue) * 100 : 0;

    const businessRanking = businesses.map(biz => {
      const bizSales = currentSales.filter(s => s.businessId === biz.id);
      const bizExpenses = currentExpenses.filter(e => e.businessId === biz.id);
      const rev = bizSales.reduce((sum, s) => sum + Number(s.salesAmount), 0);
      const gp = bizSales.reduce((sum, s) => sum + Number(s.profitAmount), 0);
      const ex = bizExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
      return {
        id: biz.id,
        name: biz.name,
        revenue: convert(rev),
        profit: convert(gp - ex),
        margin: rev > 0 ? (gp / rev) * 100 : 0,
        efficiency: rev > 0 ? (ex / rev) * 100 : 0
      };
    }).sort((a, b) => b.profit - a.profit);

    // Daywise Sale Aggregation
    const salesByDate: Record<string, number> = {};
    currentSales.forEach(s => {
      salesByDate[s.date] = (salesByDate[s.date] || 0) + Number(s.salesAmount);
    });

    const daywiseData = Object.entries(salesByDate)
      .map(([date, amount]) => ({
        dateLabel: date.split('-').slice(1).join('/'),
        fullDate: date,
        amount: convert(amount)
      }))
      .sort((a, b) => a.fullDate.localeCompare(b.fullDate));

    return { 
      totalRevenue: convert(totalRevenue), 
      totalGrossProfit: convert(totalGrossProfit), 
      totalExpenses: convert(totalExpenses), 
      netProfit: convert(netProfit),
      trends: {
        revenue: getTrend(current.rev, previous.rev),
        grossProfit: getTrend(current.gp, previous.gp),
        netProfit: getTrend(current.net, previous.net),
        expenses: getTrend(current.ex, previous.ex)
      },
      expenseRatio,
      bestUnit: businessRanking[0] || null,
      businessRanking,
      daywiseData
    };
  }, [filters, sales, expenses, businesses, currency, exchangeRate]);

  if (loading) return <div className="h-[60vh] flex flex-col items-center justify-center text-slate-400"><Loader2 className="animate-spin mb-4" size={40} /><p className="font-bold uppercase tracking-widest text-[10px]">Synchronizing Performance Matrix</p></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex-1 w-full">
          <FilterPanel 
            filters={filters} 
            setFilters={setFilters} 
            currency={currency}
            setCurrency={setCurrency}
            exchangeRate={exchangeRate}
            isFetchingRate={isFetchingRate}
            onRefreshRate={fetchExchangeRate}
          />
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          label="Total Revenue" 
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
          trend={metrics.trends.grossProfit}
        />
        <StatCard 
          label="Net Income" 
          value={formatCurrency(metrics.netProfit, currency)} 
          icon={Zap} 
          color="teal" 
          trend={metrics.trends.netProfit}
        />
        <StatCard 
          label="Operational Costs" 
          value={formatCurrency(metrics.totalExpenses, currency)} 
          icon={ArrowDownCircle} 
          color="rose" 
          trend={metrics.trends.expenses}
        />
      </div>

      {/* Secondary Efficiency KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 hover:border-teal-100 transition-colors">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
            <Target size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Expense Ratio</p>
            <div className="flex items-baseline gap-2">
              <h4 className="text-xl font-bold text-slate-800">{metrics.expenseRatio.toFixed(1)}%</h4>
              <span className="text-[10px] text-slate-400 font-medium">of revenue</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 hover:border-teal-100 transition-colors">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
            <Trophy size={24} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Top Performer</p>
            <h4 className="text-xl font-bold text-slate-800 truncate">{metrics.bestUnit?.name || 'N/A'}</h4>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 hover:border-teal-100 transition-colors">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Growth Index</p>
            <div className="flex items-baseline gap-2">
              <h4 className={`text-xl font-bold ${metrics.trends.netProfit.isUp ? 'text-emerald-600' : 'text-rose-600'}`}>
                {metrics.trends.netProfit.isUp ? '+' : '-'}{metrics.trends.netProfit.value}%
              </h4>
              <span className="text-[10px] text-slate-400 font-bold uppercase">Dynamic</span>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Visualization Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <Calendar size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 leading-none">Daywise Sales Tracking</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase mt-1">Aggregated Revenue Stream</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
               <div className="flex items-center gap-1.5">
                 <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm" />
                 <span className="text-[10px] font-bold text-slate-500 uppercase">Revenue</span>
               </div>
            </div>
          </div>
          <div className="h-[350px]">
            {metrics.daywiseData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.daywiseData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="dateLabel" fontSize={10} axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                  <YAxis fontSize={10} axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [formatCurrency(value, currency), 'Revenue']}
                  />
                  <Bar dataKey="amount" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={Math.max(10, 40 - metrics.daywiseData.length)} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <Calendar size={40} className="opacity-10 mb-2" />
                <p className="text-xs font-bold uppercase tracking-widest">No Sales Found</p>
                <p className="text-[10px] mt-1">Refine your date range filters</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <LayoutGrid size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 leading-none">Unit Standings</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase mt-1">Profitability Leaderboard</p>
            </div>
          </div>
          <div className="space-y-4">
            {metrics.businessRanking.slice(0, 5).map((biz, idx) => (
              <div key={biz.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-indigo-200 transition-all group">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-[10px] font-black shadow-sm ${
                      idx === 0 ? 'bg-amber-100 text-amber-700' : 'bg-white text-slate-500'
                    }`}>
                      #{idx + 1}
                    </span>
                    <h4 className="text-sm font-bold text-slate-800 truncate max-w-[110px]">{biz.name}</h4>
                  </div>
                  <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                    {formatCurrency(biz.profit, currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex-1 bg-slate-200 h-1.5 rounded-full overflow-hidden mr-3">
                    <div 
                      className="bg-indigo-500 h-full rounded-full transition-all duration-700" 
                      style={{ width: `${Math.min(100, (biz.profit / (metrics.bestUnit?.profit || 1)) * 100)}%` }} 
                    />
                  </div>
                  <span className="text-[10px] font-black text-slate-400 shrink-0">{biz.margin.toFixed(0)}% Margin</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};