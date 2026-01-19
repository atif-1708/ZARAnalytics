
import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Briefcase, 
  ArrowDownCircle, 
  LineChart as LineChartIcon,
  Loader2,
  BarChart3
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar
} from 'recharts';
import { StatCard } from '../components/StatCard';
import { FilterPanel } from '../components/FilterPanel';
import { Filters, DailySale, MonthlyExpense } from '../types';
import { storage } from '../services/mockStorage';
import { formatZAR } from '../utils/formatters';

export const Dashboard: React.FC = () => {
  const [sales, setSales] = useState<DailySale[]>([]);
  const [expenses, setExpenses] = useState<MonthlyExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    businessId: 'all',
    dateRange: { start: '', end: '' },
    timeframe: 'lifetime'
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [s, e] = await Promise.all([storage.getSales(), storage.getExpenses()]);
      setSales(s);
      setExpenses(e);
    } catch (err) {
      console.error("Failed to load dashboard data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredData = useMemo(() => {
    let fSales = sales;
    let fExpenses = expenses;

    if (filters.businessId !== 'all') {
      fSales = fSales.filter(s => s.businessId === filters.businessId);
      fExpenses = fExpenses.filter(e => e.businessId === filters.businessId);
    }

    if (filters.dateRange.start) fSales = fSales.filter(s => s.date >= filters.dateRange.start);
    if (filters.dateRange.end) fSales = fSales.filter(s => s.date <= filters.dateRange.end);

    const totalSales = fSales.reduce((acc, curr) => acc + Number(curr.salesAmount), 0);
    const totalProfit = fSales.reduce((acc, curr) => acc + Number(curr.profitAmount), 0);
    const totalExpenses = fExpenses.reduce((acc, curr) => acc + Number(curr.amount), 0);
    const netProfit = totalProfit - totalExpenses;

    const sortedSales = [...fSales].sort((a, b) => a.date.localeCompare(b.date)).slice(-15);
    
    const dailyMetricsChart = sortedSales.map(s => ({ 
      name: s.date.split('-').slice(1).join('/'), // Simpler date format MM/DD
      profit: s.profitAmount,
      sales: s.salesAmount 
    }));

    return { totalSales, totalProfit, totalExpenses, netProfit, dailyMetricsChart };
  }, [filters, sales, expenses]);

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="animate-spin mb-4" size={40} />
        <p className="font-medium">Synthesizing Business Intelligence...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <FilterPanel filters={filters} setFilters={setFilters} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Total Revenue" value={filteredData.totalSales} icon={DollarSign} color="emerald" />
        <StatCard label="Gross Profit" value={filteredData.totalProfit} icon={TrendingUp} color="teal" />
        <StatCard label="Total Expenses" value={filteredData.totalExpenses} icon={ArrowDownCircle} color="rose" />
        <StatCard label="Net Profit" value={filteredData.netProfit} icon={Briefcase} color="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Volume Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-6 text-slate-800">
            <BarChart3 size={20} className="text-emerald-600" />
            <h3 className="font-bold">Sales Volume</h3>
          </div>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filteredData.dailyMetricsChart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `R${v/1000}k`} />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  formatter={(v: number) => [formatZAR(v), 'Revenue']} 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} 
                />
                <Bar 
                  dataKey="sales" 
                  fill="#10b981" 
                  radius={[4, 4, 0, 0]} 
                  barSize={24} 
                  activeBar={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Profit Velocity Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-6 text-slate-800">
            <LineChartIcon size={20} className="text-teal-600" />
            <h3 className="font-bold">Profit Velocity</h3>
          </div>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filteredData.dailyMetricsChart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `R${v/1000}k`} />
                <Tooltip 
                  formatter={(v: number) => [formatZAR(v), 'Profit']} 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} 
                />
                <Line type="monotone" dataKey="profit" stroke="#0d9488" strokeWidth={3} dot={{ r: 4, fill: '#0d9488' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
