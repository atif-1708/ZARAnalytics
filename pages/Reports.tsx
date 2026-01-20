import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, Download, TrendingUp, ArrowDownCircle, Briefcase, 
  Calendar, Loader2, AlertCircle
} from 'lucide-react';
import { storage } from '../services/mockStorage';
import { FilterPanel } from '../components/FilterPanel';
import { Filters, Business, DailySale, MonthlyExpense } from '../types';
import { formatZAR, formatDate, formatMonth } from '../utils/formatters';

export const Reports: React.FC = () => {
  const [filters, setFilters] = useState<Filters>({
    businessId: 'all',
    dateRange: { start: '', end: '' },
    timeframe: 'lifetime'
  });

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [sales, setSales] = useState<DailySale[]>([]);
  const [expenses, setExpenses] = useState<MonthlyExpense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadReportData = async () => {
      setLoading(true);
      try {
        const [businessData, salesData, expensesData] = await Promise.all([
          storage.getBusinesses(),
          storage.getSales(),
          storage.getExpenses()
        ]);
        setBusinesses(businessData);
        setSales(salesData);
        setExpenses(expensesData);
      } catch (err) {
        console.error("Failed to fetch report data", err);
      } finally {
        setLoading(false);
      }
    };
    loadReportData();
  }, []);

  const reportData = useMemo(() => {
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
    const avgMargin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;

    return { fSales, fExpenses, totalSales, totalProfit, totalExpenses, netProfit, avgMargin };
  }, [filters, sales, expenses]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-slate-400">
        <Loader2 size={40} className="animate-spin mb-4" />
        <p>Generating report datasets...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Financial Reports</h2>
          <p className="text-slate-500 text-sm">Review performance metrics and data logs</p>
        </div>
        <button 
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <Download size={18} />
          <span>Export View</span>
        </button>
      </div>

      <FilterPanel filters={filters} setFilters={setFilters} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <p className="text-sm text-slate-500 mb-1">Total Sales</p>
          <h4 className="text-xl font-bold text-slate-900">{formatZAR(reportData.totalSales)}</h4>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <p className="text-sm text-slate-500 mb-1">Gross Profit</p>
          <h4 className="text-xl font-bold text-teal-600">{formatZAR(reportData.totalProfit)}</h4>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <p className="text-sm text-slate-500 mb-1">Expenses</p>
          <h4 className="text-xl font-bold text-rose-600">{formatZAR(reportData.totalExpenses)}</h4>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <p className="text-sm text-slate-500 mb-1">Net Income</p>
          <h4 className={`text-xl font-bold ${reportData.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {formatZAR(reportData.netProfit)}
          </h4>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <TrendingUp size={20} className="text-teal-600" />
          <h3 className="font-bold text-slate-800">Sales Log</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 font-bold text-slate-500">Date</th>
                <th className="px-6 py-3 font-bold text-slate-500">Business</th>
                <th className="px-6 py-3 text-right font-bold text-slate-500">Revenue</th>
                <th className="px-6 py-3 text-right font-bold text-slate-500">Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reportData.fSales.map(s => (
                <tr key={s.id}>
                  <td className="px-6 py-3 text-slate-500">{formatDate(s.date)}</td>
                  <td className="px-6 py-3 text-slate-900 font-medium">
                    {businesses.find(b => b.id === s.businessId)?.name}
                  </td>
                  <td className="px-6 py-3 text-right">{formatZAR(s.salesAmount)}</td>
                  <td className="px-6 py-3 text-right text-teal-600 font-bold">{formatZAR(s.profitAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <ArrowDownCircle size={20} className="text-rose-600" />
          <h3 className="font-bold text-slate-800">Expense Log</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 font-bold text-slate-500">Month</th>
                <th className="px-6 py-3 font-bold text-slate-500">Business</th>
                <th className="px-6 py-3 font-bold text-slate-500">Description</th>
                <th className="px-6 py-3 text-right font-bold text-slate-500">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reportData.fExpenses.map(e => (
                <tr key={e.id}>
                  <td className="px-6 py-3 text-slate-500">{formatMonth(e.month)}</td>
                  <td className="px-6 py-3 text-slate-900 font-medium">
                    {businesses.find(b => b.id === e.businessId)?.name}
                  </td>
                  <td className="px-6 py-3 text-slate-500 italic">{e.description}</td>
                  <td className="px-6 py-3 text-right text-rose-600 font-bold">{formatZAR(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};