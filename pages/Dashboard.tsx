import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  ArrowDownCircle, 
  Loader2,
  LayoutGrid,
  Trophy,
  Target,
  Zap,
  Activity,
  Calendar,
  BarChart3,
  Layers
} from 'lucide-react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Legend
} from 'recharts';
import { StatCard } from '../components/StatCard';
import { FilterPanel } from '../components/FilterPanel';
import { Filters, DailySale, MonthlyExpense, Business } from '../types';
import { storage } from '../services/mockStorage';
import { formatCurrency } from '../utils/formatters';

const CHART_COLORS = [
  '#0d9488', // teal-600
  '#2563eb', // blue-600
  '#7c3aed', // violet-600
  '#db2777', // pink-600
  '#ea580c', // orange-600
  '#16a34a', // green-600
  '#4f46e5', // indigo-600
  '#e11d48', // rose-600
];

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
      console.error("Dashboard Data Load Error:", err);
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

    // 1. KPI Calculation Logic for current period
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
    
    // Previous Period for Trends
    const durationMs = endDate.getTime() - startDate.getTime();
    const prevPeriodEnd = new Date(startDate.getTime() - 1);
    const prevPeriodStart = new Date(prevPeriodEnd.getTime() - durationMs);
    const prevSales = filterDataByRange(sales, prevPeriodStart, prevPeriodEnd, filters.businessId);
    const prevExpenses = filterDataByRange(expenses, prevPeriodStart, prevPeriodEnd, filters.businessId);

    const calcTotals = (sItems: DailySale[], eItems: MonthlyExpense[]) => {
      const rev = sItems.reduce((acc, curr) => acc + Number(curr.salesAmount), 0);
      const gp = sItems.reduce((acc, curr) => acc + Number(curr.profitAmount), 0);
      const ex = eItems.reduce((acc, curr) => acc + Number(curr.amount), 0);
      return { rev, gp, ex, net: gp - ex };
    };

    const current = calcTotals(currentSales, currentExpenses);
    const previous = calcTotals(prevSales, prevExpenses);

    const getTrend = (curr: number, prev: number) => {
      if (prev === 0) return { value: 0, isUp: true };
      const change = ((curr - prev) / Math.abs(prev)) * 100;
      return { value: Math.abs(Number(change.toFixed(1))), isUp: change >= 0 };
    };

    // --- CONSOLIDATED MONTHLY COMPARISON DATA ---
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const daysInMonth = monthEnd.getDate();
    
    // Find all sales for current month
    const monthSales = sales.filter(s => {
      const d = new Date(s.date);
      return d >= monthStart && d <= monthEnd;
    });

    // Create unique data points for each day
    const comparisonData = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayLabel = `${day}/${now.getMonth() + 1}`;
      
      const dayPoint: any = { dayLabel, dateStr };
      
      businesses.forEach(biz => {
        const sale = monthSales.find(s => s.businessId === biz.id && s.date === dateStr);
        // Use business name as key, also store location for the legend if needed
        dayPoint[`${biz.name} (${biz.location})`] = sale ? convert(Number(sale.salesAmount)) : 0;
      });
      
      comparisonData.push(dayPoint);
    }

    const businessRanking = businesses.map(biz => {
      const bizSales = currentSales.filter(s => s.businessId === biz.id);
      const bizExpenses = currentExpenses.filter(e => e.businessId === biz.id);
      const rev = bizSales.reduce((sum, s) => sum + Number(s.salesAmount), 0);
      const gp = bizSales.reduce((sum, s) => sum + Number(s.profitAmount), 0);
      const ex = bizExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
      return {
        id: biz.id,
        name: biz.name,
        location: biz.location,
        revenue: convert(rev),
        profit: convert(gp - ex),
        margin: rev > 0 ? (gp / rev) * 100 : 0
      };
    }).sort((a, b) => b.profit - a.profit);

    return { 
      totalRevenue: convert(current.rev), 
      totalGrossProfit: convert(current.gp), 
      totalExpenses: convert(current.ex), 
      netProfit: convert(current.net),
      trends: {
        revenue: getTrend(current.rev, previous.rev),
        grossProfit: getTrend(current.gp, previous.gp),
        netProfit: getTrend(current.net, previous.net),
        expenses: getTrend(current.ex, previous.ex)
      },
      expenseRatio: current.rev > 0 ? (current.ex / current.rev) * 100 : 0,
      bestUnit: businessRanking[0] || null,
      businessRanking,
      comparisonData
    };
  }, [filters, sales, expenses, businesses, currency, exchangeRate]);

  if (loading) return (
    <div className="h-[60vh] flex flex-col items-center justify-center text-slate-400">
      <Loader2 className="animate-spin mb-4" size={40} />
      <p className="font-bold uppercase tracking-widest text-[10px]">Synchronizing Performance Hub</p>
    </div>
  );

  return (
    <div className="space-y-6 pb-20">
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

      {/* KPI Section */}
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
          trend={metrics.trends.grossProfit}
        />
        <StatCard 
          label="Net Position" 
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0"><Target size={24} /></div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Expense Ratio</p>
            <h4 className="text-xl font-bold text-slate-800">{metrics.expenseRatio.toFixed(1)}%</h4>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0"><Trophy size={24} /></div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Top Unit</p>
            <h4 className="text-xl font-bold text-slate-800 truncate">{metrics.bestUnit?.name || 'N/A'}</h4>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0"><Activity size={24} /></div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Health Index</p>
            <h4 className={`text-xl font-bold ${metrics.trends.netProfit.isUp ? 'text-emerald-600' : 'text-rose-600'}`}>Dynamic</h4>
          </div>
        </div>
      </div>

      {/* COMPARISON GRAPH SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-8 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-900 text-white rounded-lg">
                <Layers size={20} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Consolidated Monthly Performance</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Multi-Business Daywise Comparison</p>
              </div>
            </div>
            <div className="text-[10px] font-black text-slate-400 bg-slate-50 px-3 py-1.5 rounded-full uppercase">
              Current Month: {new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date())}
            </div>
          </div>

          <div className="p-8 flex-1">
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.comparisonData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="dayLabel" 
                    fontSize={10} 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#94a3b8'}}
                    interval={window.innerWidth < 640 ? 4 : 1}
                  />
                  <YAxis 
                    fontSize={10} 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#94a3b8'}}
                    tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(0)}k` : val}
                  />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontSize: '11px', fontWeight: 'bold' }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    wrapperStyle={{ paddingTop: '20px', fontSize: '10px', textTransform: 'uppercase', fontWeight: '900' }}
                    iconType="circle"
                  />
                  {businesses.map((biz, index) => (
                    <Bar 
                      key={biz.id}
                      dataKey={`${biz.name} (${biz.location})`}
                      stackId="a"
                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                      radius={[0, 0, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* STANDINGS SECTION (PRESERVED) */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <LayoutGrid size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 leading-none">Business Standings</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase mt-1 tracking-widest">Efficiency Ranking</p>
            </div>
          </div>
          <div className="space-y-4">
            {metrics.businessRanking.map((biz, idx) => (
              <div key={biz.id} className="p-5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-indigo-200 transition-all group relative overflow-hidden">
                {idx === 0 && (
                  <div className="absolute top-0 right-0 bg-amber-100 text-amber-600 px-3 py-1 rounded-bl-xl text-[8px] font-black uppercase tracking-widest">
                    Champion
                  </div>
                )}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shadow-sm ${
                      idx === 0 ? 'bg-amber-100 text-amber-700' : 'bg-white text-slate-500'
                    }`}>
                      #{idx + 1}
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 truncate max-w-[120px]">{biz.name}</h4>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">{biz.location}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black text-emerald-600 block">
                      {formatCurrency(biz.profit, currency)}
                    </span>
                    <span className="text-[9px] font-black text-slate-400 uppercase">Profit</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <span>Target Reached</span>
                    <span>{biz.margin.toFixed(0)}% Margin</span>
                  </div>
                  <div className="bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-indigo-500 h-full rounded-full transition-all duration-1000" 
                      style={{ width: `${Math.min(100, (biz.profit / (metrics.bestUnit?.profit || 1)) * 100)}%` }} 
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};