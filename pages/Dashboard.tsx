import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Briefcase, 
  ArrowDownCircle, 
  LineChart as LineChartIcon,
  Loader2,
  LayoutGrid,
  Coins,
  RefreshCw
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar
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
    timeframe: 'lifetime'
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

  const dashboardMetrics = useMemo(() => {
    let fSales = sales;
    let fExpenses = expenses;

    if (filters.businessId !== 'all') {
      fSales = fSales.filter(s => s.businessId === filters.businessId);
      fExpenses = fExpenses.filter(e => e.businessId === filters.businessId);
    }

    if (filters.dateRange.start) fSales = fSales.filter(s => s.date >= filters.dateRange.start);
    if (filters.dateRange.end) fSales = fSales.filter(s => s.date <= filters.dateRange.end);

    const rawTotalSales = fSales.reduce((acc, curr) => acc + Number(curr.salesAmount), 0);
    const rawTotalProfit = fSales.reduce((acc, curr) => acc + Number(curr.profitAmount), 0);
    const rawTotalExpenses = fExpenses.reduce((acc, curr) => acc + Number(curr.amount), 0);
    
    const businessRanking = businesses.map(biz => {
      const bizSales = sales.filter(s => s.businessId === biz.id);
      const totalBizSales = bizSales.reduce((sum, s) => sum + Number(s.salesAmount), 0);
      return {
        id: biz.id,
        name: biz.name,
        totalSales: convert(totalBizSales)
      };
    }).sort((a, b) => b.totalSales - a.totalSales);

    return { 
      totalSales: convert(rawTotalSales), 
      totalProfit: convert(rawTotalProfit), 
      totalExpenses: convert(rawTotalExpenses), 
      netProfit: convert(rawTotalProfit - rawTotalExpenses),
      businessRanking,
      dailyMetricsChart: [...fSales].sort((a, b) => a.date.localeCompare(b.date)).slice(-15).map(s => ({
        name: s.date.split('-').slice(1).join('/'),
        profit: convert(s.profitAmount),
        sales: convert(s.salesAmount)
      }))
    };
  }, [filters, sales, expenses, businesses, currency, exchangeRate]);

  if (loading) return <div className="h-[60vh] flex flex-col items-center justify-center text-slate-400"><Loader2 className="animate-spin mb-4" size={40} /><p>Aggregating Business Intelligence...</p></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex-1 w-full"><FilterPanel filters={filters} setFilters={setFilters} /></div>
        <div className="flex items-center bg-white p-1 rounded-2xl border border-slate-200 shadow-sm no-print">
          <button onClick={() => setCurrency('ZAR')} className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${currency === 'ZAR' ? 'bg-teal-600 text-white shadow-lg' : 'text-slate-400'}`}>ZAR (R)</button>
          <button onClick={() => setCurrency('PKR')} className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${currency === 'PKR' ? 'bg-teal-600 text-white shadow-lg' : 'text-slate-400'}`}><Coins size={14} />PKR (₨)</button>
          {currency === 'PKR' && (
            <button onClick={fetchExchangeRate} className={`p-2 text-slate-400 hover:text-teal-600 ${isFetchingRate ? 'animate-spin' : ''}`}><RefreshCw size={14} /></button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Total Revenue" value={formatCurrency(dashboardMetrics.totalSales, currency)} icon={DollarSign} color="emerald" />
        <StatCard label="Gross Profit" value={formatCurrency(dashboardMetrics.totalProfit, currency)} icon={TrendingUp} color="teal" />
        <StatCard label="Business Expenses" value={formatCurrency(dashboardMetrics.totalExpenses, currency)} icon={ArrowDownCircle} color="rose" />
        <StatCard label="Net Income" value={formatCurrency(dashboardMetrics.netProfit, currency)} icon={Briefcase} color="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-6"><LayoutGrid size={20} className="text-indigo-600" /><h3 className="font-bold">Business Comparison</h3></div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dashboardMetrics.businessRanking} layout="vertical">
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" fontSize={10} width={80} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px' }} />
                <Bar dataKey="totalSales" fill="#0d9488" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-6"><LineChartIcon size={20} className="text-teal-600" /><h3 className="font-bold">Profit Velocity</h3></div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dashboardMetrics.dailyMetricsChart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '12px' }} />
                <Line type="monotone" dataKey="profit" stroke="#0d9488" strokeWidth={4} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};