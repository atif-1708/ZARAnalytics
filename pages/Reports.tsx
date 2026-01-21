
import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, TrendingUp, Briefcase, Loader2, 
  ArrowDownCircle, DollarSign, Download, Store,
  ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { storage } from '../services/mockStorage';
import { FilterPanel } from '../components/FilterPanel';
import { Filters, Business, DailySale, MonthlyExpense, UserRole } from '../types';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate } from '../utils/formatters';

const TrendBadge: React.FC<{ trend?: { value: number; isUp: boolean } }> = ({ trend }) => {
  if (!trend) return null;
  const colorClass = trend.isUp ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'text-rose-600 bg-rose-50 border-rose-100';
  return (
    <div className={`flex items-center gap-1 px-2 py-1 rounded-full border text-[9px] font-black uppercase tracking-tight ${colorClass}`}>
      {trend.isUp ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
      {trend.value}%
    </div>
  );
};

export const Reports: React.FC = () => {
  const { user } = useAuth();
  const [currency, setCurrency] = useState<'ZAR' | 'PKR'>('ZAR');
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [isFetchingRate, setIsFetchingRate] = useState(false);
  
  const isAdmin = user?.role === UserRole.ADMIN;
  const isNoAssignment = !isAdmin && (user?.assignedBusinessIds?.length || 0) === 0;

  const [filters, setFilters] = useState<Filters>({
    businessId: 'all',
    dateRange: { start: '', end: '' },
    selectedMonth: '',
    timeframe: 'this_month'
  });

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [sales, setSales] = useState<DailySale[]>([]);
  const [expenses, setExpenses] = useState<MonthlyExpense[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [b, s, e] = await Promise.all([
          storage.getBusinesses(),
          storage.getSales(),
          storage.getExpenses()
        ]);
        setBusinesses(b);
        setSales(s);
        setExpenses(e);
      } catch (err) {
        console.error("Report data load failed", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    fetchExchangeRate();
  }, []);

  const convert = (val: number) => currency === 'PKR' ? val * exchangeRate : val;

  const reportData = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthIndex = now.getMonth();
    
    let startDate: Date;
    let endDate: Date;
    let prevStartDate: Date;
    let prevEndDate: Date;

    const endOfToday = new Date(currentYear, currentMonthIndex, now.getDate(), 23, 59, 59, 999);

    if (filters.dateRange.start || filters.dateRange.end) {
      startDate = filters.dateRange.start ? new Date(filters.dateRange.start) : new Date(2000, 0, 1);
      endDate = filters.dateRange.end ? new Date(filters.dateRange.end) : endOfToday;
      endDate.setHours(23, 59, 59, 999);
      const duration = endDate.getTime() - startDate.getTime();
      prevStartDate = new Date(startDate.getTime() - duration);
      prevEndDate = new Date(startDate.getTime() - 1);
    } else {
      switch (filters.timeframe) {
        case 'today':
          startDate = new Date(); startDate.setHours(0, 0, 0, 0);
          endDate = endOfToday;
          prevStartDate = new Date(startDate); prevStartDate.setDate(startDate.getDate() - 1);
          prevEndDate = new Date(endDate); prevEndDate.setDate(endDate.getDate() - 1);
          break;
        case 'yesterday':
          startDate = new Date(); startDate.setDate(now.getDate() - 1); startDate.setHours(0, 0, 0, 0);
          endDate = new Date(); endDate.setDate(now.getDate() - 1); endDate.setHours(23, 59, 59, 999);
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
            const [year, month] = filters.selectedMonth.split('-').map(Number);
            startDate = new Date(year, month - 1, 1);
            endDate = new Date(year, month, 0, 23, 59, 59, 999);
            prevStartDate = new Date(year, month - 2, 1);
            prevEndDate = new Date(year, month - 1, 0, 23, 59, 59, 999);
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

    const calculateStats = (start: Date, end: Date) => {
      const fSales = sales.filter(item => {
        const itemDate = new Date(item.date);
        const inRange = itemDate >= start && itemDate <= end;
        const userHasAccess = isAdmin || user?.assignedBusinessIds?.includes(item.businessId);
        const matchesBiz = filters.businessId === 'all' || item.businessId === filters.businessId;
        return inRange && userHasAccess && matchesBiz;
      });

      const fExpenses = expenses.filter(item => {
        const itemDate = new Date(item.month + '-01');
        const inRange = itemDate >= start && itemDate <= end;
        const userHasAccess = isAdmin || user?.assignedBusinessIds?.includes(item.businessId);
        const matchesBiz = filters.businessId === 'all' || item.businessId === filters.businessId;
        return inRange && userHasAccess && matchesBiz;
      });

      const rawSales = fSales.reduce((acc, curr) => acc + Number(curr.salesAmount), 0);
      const rawProfit = fSales.reduce((acc, curr) => acc + Number(curr.profitAmount), 0);
      const rawExpenses = fExpenses.reduce((acc, curr) => acc + Number(curr.amount), 0);
      const rawNet = rawProfit - rawExpenses;

      return { fSales, fExpenses, rawSales, rawProfit, rawExpenses, rawNet };
    };

    const current = calculateStats(startDate, endDate);
    const previous = calculateStats(prevStartDate, prevEndDate);

    const calcTrend = (curr: number, prev: number) => {
      if (prev <= 0) return undefined;
      const diff = ((curr - prev) / prev) * 100;
      return {
        value: Math.abs(Math.round(diff)),
        isUp: diff >= 0
      };
    };

    const avgMargin = current.rawSales > 0 ? (current.rawProfit / current.rawSales) * 100 : 0;

    return { 
      fSales: current.fSales, 
      fExpenses: current.fExpenses, 
      totalSales: convert(current.rawSales), 
      totalProfit: convert(current.rawProfit), 
      totalExpenses: convert(current.rawExpenses), 
      netProfit: convert(current.rawNet),
      avgMargin,
      trends: {
        sales: calcTrend(current.rawSales, previous.rawSales),
        profit: calcTrend(current.rawProfit, previous.rawProfit),
        expenses: calcTrend(current.rawExpenses, previous.rawExpenses),
        net: calcTrend(current.rawNet, previous.rawNet)
      }
    };
  }, [filters, sales, expenses, currency, exchangeRate, user, isAdmin]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <Loader2 size={32} className="animate-spin mb-3" />
        <p className="text-sm font-medium">Loading report data...</p>
      </div>
    );
  }

  if (isNoAssignment) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center p-10 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200">
        <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-3xl flex items-center justify-center mb-6">
          <Store size={32} />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">Reports Locked</h3>
        <p className="text-slate-500 max-w-sm">Financial reports are generated based on your assigned locations.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <div className="text-left">
          <h2 className="text-2xl font-bold text-slate-800">Financial Reports</h2>
          <p className="text-slate-500 text-sm">Consolidated business performance data</p>
        </div>
        <button 
          onClick={() => window.print()}
          className="no-print flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl hover:bg-slate-800 transition-all text-sm font-bold"
        >
          <Download size={16} />
          Print View
        </button>
      </div>

      <div className="no-print">
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-left">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl w-fit"><DollarSign size={20} /></div>
            <TrendBadge trend={reportData.trends.sales} />
          </div>
          <p className="text-sm font-medium text-slate-500">Gross Revenue</p>
          <h3 className="text-xl font-bold text-slate-900">{formatCurrency(reportData.totalSales, currency)}</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-left">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-teal-50 text-teal-600 rounded-xl w-fit"><TrendingUp size={20} /></div>
            <TrendBadge trend={reportData.trends.profit} />
          </div>
          <p className="text-sm font-medium text-slate-500">Gross Profit</p>
          <h3 className="text-xl font-bold text-teal-600">{formatCurrency(reportData.totalProfit, currency)}</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-left">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl w-fit"><ArrowDownCircle size={20} /></div>
            <TrendBadge trend={reportData.trends.expenses} />
          </div>
          <p className="text-sm font-medium text-slate-500">Total Expenses</p>
          <h3 className="text-xl font-bold text-rose-600">{formatCurrency(reportData.totalExpenses, currency)}</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-left">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl w-fit"><Briefcase size={20} /></div>
            <TrendBadge trend={reportData.trends.net} />
          </div>
          <p className="text-sm font-medium text-slate-500">Net Position</p>
          <h3 className={`text-xl font-bold ${reportData.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {formatCurrency(reportData.netProfit, currency)}
          </h3>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 text-left">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <FileText size={18} className="text-slate-400" />
            Performance Schedule
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">
              <tr>
                <th className="px-6 py-4">Business Unit</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-center">Margin %</th>
                <th className="px-6 py-4 text-right">Revenue ({currency})</th>
                <th className="px-6 py-4 text-right">Profit ({currency})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reportData.fSales.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-400 italic text-sm">No records match the current filters.</td>
                </tr>
              ) : (
                <>
                  {reportData.fSales.map(s => (
                    <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-800">{businesses.find(b => b.id === s.businessId)?.name || 'Unknown'}</td>
                      <td className="px-6 py-4 text-sm text-slate-500">{formatDate(s.date)}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-[10px] font-black">
                          {s.profitPercentage}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium">{formatCurrency(convert(s.salesAmount), currency)}</td>
                      <td className="px-6 py-4 text-right text-sm font-bold text-teal-600">{formatCurrency(convert(s.profitAmount), currency)}</td>
                    </tr>
                  ))}
                  {/* Totals Row */}
                  <tr className="bg-slate-900 text-white font-bold">
                    <td className="px-6 py-4 text-xs uppercase tracking-widest font-black" colSpan={2}>Report Totals</td>
                    <td className="px-6 py-4 text-center text-[10px] uppercase font-black">Avg: {reportData.avgMargin.toFixed(1)}%</td>
                    <td className="px-6 py-4 text-right text-sm font-black">{formatCurrency(reportData.totalSales, currency)}</td>
                    <td className="px-6 py-4 text-right text-sm font-black text-teal-400">{formatCurrency(reportData.totalProfit, currency)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
