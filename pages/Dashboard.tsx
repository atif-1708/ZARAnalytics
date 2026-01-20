import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Briefcase, 
  ArrowDownCircle, 
  LineChart as LineChartIcon,
  Loader2,
  BarChart3,
  Trophy,
  Medal,
  Target,
  Zap,
  LayoutGrid,
  ArrowUpRight,
  RefreshCw,
  Coins
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell
} from 'recharts';
import { StatCard } from '../components/StatCard';
import { FilterPanel } from '../components/FilterPanel';
import { Filters, DailySale, MonthlyExpense, Business } from '../types';
import { storage } from '../services/mockStorage';
import { formatCurrency, formatZAR, formatPKR } from '../utils/formatters';

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
    timeframe: 'lifetime'
  });

  const fetchExchangeRate = async () => {
    setIsFetchingRate(true);
    try {
      // Fetching live ZAR to PKR rate from a reliable free public API
      const response = await fetch('https://open.er-api.com/v6/latest/ZAR');
      const data = await response.json();
      if (data && data.rates && data.rates.PKR) {
        setExchangeRate(data.rates.PKR);
      }
    } catch (err) {
      console.error("Currency API Error:", err);
      // Fallback rate if API fails
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
      console.error("Failed to load dashboard data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    fetchExchangeRate();
  }, []);

  const convert = (val: number) => currency === 'PKR' ? val * exchangeRate : val;

  const dashboardMetrics = useMemo(() => {
    let fSales = sales;
    let fExpenses = expenses;

    // Apply Filters
    if (filters.businessId !== 'all') {
      fSales = fSales.filter(s => s.businessId === filters.businessId);
      fExpenses = fExpenses.filter(e => e.businessId === filters.businessId);
    }

    if (filters.dateRange.start) fSales = fSales.filter(s => s.date >= filters.dateRange.start);
    if (filters.dateRange.end) fSales = fSales.filter(s => s.date <= filters.dateRange.end);

    // Totals
    const rawTotalSales = fSales.reduce((acc, curr) => acc + Number(curr.salesAmount), 0);
    const rawTotalProfit = fSales.reduce((acc, curr) => acc + Number(curr.profitAmount), 0);
    const rawTotalExpenses = fExpenses.reduce((acc, curr) => acc + Number(curr.amount), 0);
    const rawNetProfit = rawTotalProfit - rawTotalExpenses;

    // Convert values
    const totalSales = convert(rawTotalSales);
    const totalProfit = convert(rawTotalProfit);
    const totalExpenses = convert(rawTotalExpenses);
    const netProfit = convert(rawNetProfit);

    // Chart Data
    const sortedSales = [...fSales].sort((a, b) => a.date.localeCompare(b.date)).slice(-15);
    const dailyMetricsChart = sortedSales.map(s => ({ 
      name: s.date.split('-').slice(1).join('/'),
      profit: convert(s.profitAmount),
      sales: convert(s.salesAmount) 
    }));

    // Ranking Logic (When All Businesses is selected)
    const businessRanking = businesses.map(biz => {
      const bizSales = sales.filter(s => s.businessId === biz.id);
      let filteredBizSales = bizSales;
      if (filters.dateRange.start) filteredBizSales = filteredBizSales.filter(s => s.date >= filters.dateRange.start);
      if (filters.dateRange.end) filteredBizSales = filteredBizSales.filter(s => s.date <= filters.dateRange.end);

      const totalBizSales = filteredBizSales.reduce((sum, s) => sum + Number(s.salesAmount), 0);
      const totalBizProfit = filteredBizSales.reduce((sum, s) => sum + Number(s.profitAmount), 0);
      const margin = totalBizSales > 0 ? (totalBizProfit / totalBizSales) * 100 : 0;
      
      return {
        id: biz.id,
        name: biz.name,
        location: biz.location,
        totalSales: convert(totalBizSales),
        totalProfit: convert(totalBizProfit),
        margin: margin,
        count: filteredBizSales.length
      };
    }).sort((a, b) => b.totalSales - a.totalSales);

    const topByRevenue = businessRanking[0] || null;
    const topByMargin = [...businessRanking].sort((a, b) => b.margin - a.margin)[0] || null;

    return { 
      totalSales, 
      totalProfit, 
      totalExpenses, 
      netProfit, 
      dailyMetricsChart, 
      businessRanking,
      topByRevenue,
      topByMargin
    };
  }, [filters, sales, expenses, businesses, currency, exchangeRate]);

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="animate-spin mb-4" size={40} />
        <p className="font-medium text-lg">Aggregating Business Intelligence...</p>
      </div>
    );
  }

  const COLORS = ['#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex-1 w-full">
          <FilterPanel filters={filters} setFilters={setFilters} />
        </div>
        
        {/* Currency Switcher */}
        <div className="flex items-center bg-white p-1 rounded-2xl border border-slate-200 shadow-sm self-stretch md:self-auto no-print">
          <button 
            onClick={() => setCurrency('ZAR')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${currency === 'ZAR' ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/20' : 'text-slate-400 hover:text-slate-600'}`}
          >
            ZAR (R)
          </button>
          <button 
            onClick={() => {
              if (exchangeRate === 1) fetchExchangeRate();
              setCurrency('PKR');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${currency === 'PKR' ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/20' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Coins size={14} />
            PKR (₨)
          </button>
          {currency === 'PKR' && (
            <button 
              onClick={fetchExchangeRate}
              className={`p-2 text-slate-400 hover:text-teal-600 transition-transform ${isFetchingRate ? 'animate-spin' : ''}`}
              title={`1 ZAR = ${exchangeRate.toFixed(2)} PKR (Refresh)`}
            >
              <RefreshCw size={14} />
            </button>
          )}
        </div>
      </div>

      {currency === 'PKR' && (
        <div className="bg-teal-50 border border-teal-100 p-3 rounded-xl flex items-center justify-between no-print">
          <div className="flex items-center gap-2 text-teal-800 text-[10px] font-bold uppercase tracking-widest">
            <Coins size={14} className="text-teal-600" />
            Live Conversion Active
          </div>
          <div className="text-[10px] text-teal-600 font-black">
            1 ZAR = ₨ {exchangeRate.toFixed(4)} PKR
          </div>
        </div>
      )}

      {/* High-Level Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Total Revenue" value={formatCurrency(dashboardMetrics.totalSales, currency)} icon={DollarSign} color="emerald" />
        <StatCard label="Gross Profit" value={formatCurrency(dashboardMetrics.totalProfit, currency)} icon={TrendingUp} color="teal" />
        <StatCard label="Business Expenses" value={formatCurrency(dashboardMetrics.totalExpenses, currency)} icon={ArrowDownCircle} color="rose" />
        <StatCard label="Net Income" value={formatCurrency(dashboardMetrics.netProfit, currency)} icon={Briefcase} color="blue" />
      </div>

      {/* Comparison Highlights (All Businesses View) */}
      {filters.businessId === 'all' && dashboardMetrics.businessRanking.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative group">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <Trophy size={24} />
              </div>
              <div className="text-right">
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-500 bg-amber-50 px-2 py-1 rounded-full">Revenue Leader</span>
              </div>
            </div>
            <h4 className="text-xl font-black text-slate-800 mb-1">{dashboardMetrics.topByRevenue?.name}</h4>
            <div className="flex items-center gap-2 text-2xl font-black text-emerald-600">
              {formatCurrency(dashboardMetrics.topByRevenue?.totalSales || 0, currency)}
              <ArrowUpRight size={20} />
            </div>
            <p className="text-xs text-slate-400 mt-2 font-medium">Ranked #1 by total volume across {dashboardMetrics.topByRevenue?.count} records</p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative group">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <Zap size={24} />
              </div>
              <div className="text-right">
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-500 bg-blue-50 px-2 py-1 rounded-full">Efficiency Leader</span>
              </div>
            </div>
            <h4 className="text-xl font-black text-slate-800 mb-1">{dashboardMetrics.topByMargin?.name}</h4>
            <div className="flex items-center gap-2 text-2xl font-black text-blue-600">
              {dashboardMetrics.topByMargin?.margin.toFixed(1)}%
              <Target size={20} />
            </div>
            <p className="text-xs text-slate-400 mt-2 font-medium">Highest average profit margin per unit of revenue</p>
          </div>
        </div>
      )}

      {/* Data Visualization Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Business-Wise Comparison (Top to Low) */}
        {filters.businessId === 'all' ? (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-6 text-slate-800">
              <LayoutGrid size={20} className="text-indigo-600" />
              <h3 className="font-bold">Revenue Comparison ({currency})</h3>
            </div>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={dashboardMetrics.businessRanking} 
                  layout="vertical" 
                  margin={{ left: 20, right: 30 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    type="number" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(v) => currency === 'ZAR' ? `R${v/1000}k` : `₨${(v/1000).toFixed(0)}k`} 
                  />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false} 
                    width={80} 
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    formatter={(v: number) => [formatCurrency(v, currency), 'Total Revenue']} 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} 
                  />
                  <Bar dataKey="totalSales" radius={[0, 4, 4, 0]} barSize={20}>
                    {dashboardMetrics.businessRanking.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-6 text-slate-800">
              <BarChart3 size={20} className="text-emerald-600" />
              <h3 className="font-bold">Daily Revenue Trends ({currency})</h3>
            </div>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashboardMetrics.dailyMetricsChart}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => currency === 'ZAR' ? `R${v/1000}k` : `₨${(v/1000).toFixed(0)}k`} />
                  <Tooltip 
                    cursor={{ fill: 'transparent' }}
                    formatter={(v: number) => [formatCurrency(v, currency), 'Daily Revenue']} 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} 
                  />
                  <Bar 
                    dataKey="sales" 
                    fill="#10b981" 
                    radius={[4, 4, 0, 0]} 
                    barSize={24} 
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Profit Performance Analysis */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-6 text-slate-800">
            <LineChartIcon size={20} className="text-teal-600" />
            <h3 className="font-bold">Profit Velocity ({currency})</h3>
          </div>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dashboardMetrics.dailyMetricsChart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => currency === 'ZAR' ? `R${v/1000}k` : `₨${(v/1000).toFixed(0)}k`} />
                <Tooltip 
                  formatter={(v: number) => [formatCurrency(v, currency), 'Gross Profit']} 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} 
                />
                <Line 
                  type="monotone" 
                  dataKey="profit" 
                  stroke="#0d9488" 
                  strokeWidth={4} 
                  dot={{ r: 4, fill: '#0d9488', strokeWidth: 2, stroke: '#fff' }} 
                  activeDot={{ r: 6, strokeWidth: 0 }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Detailed Performance Leaderboard */}
      {filters.businessId === 'all' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-800">
              <Trophy size={22} className="text-amber-500" />
              <h3 className="font-bold">Strategic Performance Leaderboard</h3>
            </div>
            <span className="px-3 py-1 bg-slate-100 text-[10px] font-black text-slate-500 rounded-full uppercase tracking-tighter">Ranking by Revenue</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  <th className="px-6 py-4">Rank</th>
                  <th className="px-6 py-4">Business Unit</th>
                  <th className="px-6 py-4 text-right">Records</th>
                  <th className="px-6 py-4 text-right">Revenue ({currency})</th>
                  <th className="px-6 py-4 text-right">Gross Profit ({currency})</th>
                  <th className="px-6 py-4">Efficiency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dashboardMetrics.businessRanking.map((biz, index) => (
                  <tr key={biz.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className={`flex items-center justify-center w-8 h-8 rounded-lg font-bold text-sm ${
                        index === 0 ? 'bg-amber-100 text-amber-700' : 
                        index === 1 ? 'bg-slate-100 text-slate-600' :
                        index === 2 ? 'bg-orange-50 text-orange-700' :
                        'bg-slate-50 text-slate-400'
                      }`}>
                        {index === 0 ? <Medal size={16} /> : index + 1}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-bold text-slate-900">{biz.name}</p>
                        <p className="text-xs text-slate-400">{biz.location}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-slate-600">{biz.count}</td>
                    <td className="px-6 py-4 text-right font-bold text-slate-900">{formatCurrency(biz.totalSales, currency)}</td>
                    <td className="px-6 py-4 text-right font-bold text-emerald-600">{formatCurrency(biz.totalProfit, currency)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-24 bg-slate-100 h-2 rounded-full overflow-hidden shrink-0">
                          <div 
                            className={`h-full rounded-full transition-all duration-1000 ${
                              biz.margin > 25 ? 'bg-emerald-500' : biz.margin > 15 ? 'bg-teal-500' : 'bg-amber-500'
                            }`}
                            style={{ width: `${Math.min(100, biz.margin * 3)}%` }} // Scaling for visual clarity
                          />
                        </div>
                        <span className="text-xs font-black text-slate-700">{biz.margin.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 bg-slate-50/50 text-center border-t border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2">
              <Zap size={10} /> Dynamic ranking based on aggregate performance metrics
            </p>
          </div>
        </div>
      )}
    </div>
  );
};