
import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Briefcase, 
  ArrowDownCircle, 
  LineChart as LineChartIcon,
  BarChart as BarChartIcon,
  PieChart as PieChartIcon,
  Loader2
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';
import { StatCard } from '../components/StatCard';
import { FilterPanel } from '../components/FilterPanel';
import { Filters, DailySale, MonthlyExpense } from '../types';
import { storage } from '../services/mockStorage';
import { formatZAR } from '../utils/formatters';

const COLORS = ['#0d9488', '#0ea5e9', '#f59e0b', '#f43f5e', '#8b5cf6'];

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

    const dailyProfitChart = fSales
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-15)
      .map(s => ({ name: s.date, profit: s.profitAmount }));

    const expenseDistribution = fExpenses.reduce((acc: any[], curr) => {
      const existing = acc.find(a => a.name === curr.description);
      if (existing) existing.value += Number(curr.amount);
      else acc.push({ name: curr.description || 'General', value: Number(curr.amount) });
      return acc;
    }, []);

    return { totalSales, totalProfit, totalExpenses, netProfit, dailyProfitChart, expenseDistribution };
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
        <StatCard label="Total Revenue" value={filteredData.totalSales} icon={DollarSign} color="blue" />
        <StatCard label="Gross Profit" value={filteredData.totalProfit} icon={TrendingUp} color="teal" />
        <StatCard label="Total Expenses" value={filteredData.totalExpenses} icon={ArrowDownCircle} color="rose" />
        <StatCard label="Net Profit" value={filteredData.netProfit} icon={Briefcase} color="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-6 text-slate-800">
            <LineChartIcon size={20} className="text-teal-600" />
            <h3 className="font-bold">Profit Velocity</h3>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filteredData.dailyProfitChart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `R${v/1000}k`} />
                <Tooltip formatter={(v: number) => [formatZAR(v), 'Profit']} contentStyle={{ borderRadius: '12px', border: 'none' }} />
                <Line type="monotone" dataKey="profit" stroke="#0d9488" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-6 text-slate-800">
            <PieChartIcon size={20} className="text-teal-600" />
            <h3 className="font-bold">Expense Concentration</h3>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={filteredData.expenseDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                  {filteredData.expenseDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatZAR(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
