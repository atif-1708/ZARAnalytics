
import React, { useState, useEffect, useMemo } from 'react';
import { FileText, Download, TrendingUp, ArrowDownCircle, Briefcase, Calendar } from 'lucide-react';
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

  // Use state to hold report data fetched asynchronously
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [sales, setSales] = useState<DailySale[]>([]);
  const [expenses, setExpenses] = useState<MonthlyExpense[]>([]);

  useEffect(() => {
    const loadReportData = async () => {
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
      }
    };
    loadReportData();
  }, []);

  const reportData = useMemo(() => {
    let filteredSales = sales;
    let filteredExpenses = expenses;

    if (filters.businessId !== 'all') {
      filteredSales = filteredSales.filter(s => s.businessId === filters.businessId);
      filteredExpenses = filteredExpenses.filter(e => e.businessId === filters.businessId);
    }

    if (filters.dateRange.start) {
      filteredSales = filteredSales.filter(s => s.date >= filters.dateRange.start);
    }
    if (filters.dateRange.end) {
      filteredSales = filteredSales.filter(s => s.date <= filters.dateRange.end);
    }

    const totalSales = filteredSales.reduce((acc, curr) => acc + Number(curr.salesAmount), 0);
    const totalProfit = filteredSales.reduce((acc, curr) => acc + Number(curr.profitAmount), 0);
    const totalExpenses = filteredExpenses.reduce((acc, curr) => acc + Number(curr.amount), 0);
    const netProfit = totalProfit - totalExpenses;

    return { filteredSales, filteredExpenses, totalSales, totalProfit, totalExpenses, netProfit };
  }, [filters, sales, expenses]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Business Performance Reports</h2>
          <p className="text-slate-500">Detailed financial breakdown and profit analysis</p>
        </div>
        <button 
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <Download size={18} />
          <span>Export PDF</span>
        </button>
      </div>

      <FilterPanel filters={filters} setFilters={setFilters} />

      {/* Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <p className="text-xs font-bold text-slate-400 uppercase mb-1">Revenue</p>
          <p className="text-xl font-bold text-slate-900">{formatZAR(reportData.totalSales)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <p className="text-xs font-bold text-slate-400 uppercase mb-1">Gross Profit</p>
          <p className="text-xl font-bold text-teal-600">{formatZAR(reportData.totalProfit)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <p className="text-xs font-bold text-slate-400 uppercase mb-1">Expenses</p>
          <p className="text-xl font-bold text-rose-600">{formatZAR(reportData.totalExpenses)}</p>
        </div>
        <div className={`p-4 rounded-xl border ${reportData.netProfit >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
          <p className="text-xs font-bold text-slate-400 uppercase mb-1">Net Income</p>
          <p className={`text-xl font-bold ${reportData.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {formatZAR(reportData.netProfit)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Sales Table */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <TrendingUp size={18} className="text-teal-600" />
            <h3 className="font-bold text-slate-800">Sales Detail</h3>
          </div>
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-sm">
              <thead className="bg-white sticky top-0 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3 font-semibold text-slate-500">Date</th>
                  <th className="px-4 py-3 font-semibold text-slate-500">Business</th>
                  <th className="px-4 py-3 font-semibold text-slate-500 text-right">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {reportData.filteredSales.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2 text-slate-600">{formatDate(s.date)}</td>
                    <td className="px-4 py-2 text-slate-900 font-medium">
                      {businesses.find(b => b.id === s.businessId)?.name}
                    </td>
                    <td className="px-4 py-2 text-right text-teal-600 font-bold">{formatZAR(s.profitAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Expenses Table */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <ArrowDownCircle size={18} className="text-rose-600" />
            <h3 className="font-bold text-slate-800">Expense Detail</h3>
          </div>
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-sm">
              <thead className="bg-white sticky top-0 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3 font-semibold text-slate-500">Month</th>
                  <th className="px-4 py-3 font-semibold text-slate-500">Category</th>
                  <th className="px-4 py-3 font-semibold text-slate-500 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {reportData.filteredExpenses.map(e => (
                  <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2 text-slate-600 font-medium">{formatMonth(e.month)}</td>
                    <td className="px-4 py-2 text-slate-500 italic">{e.description || 'Operating Cost'}</td>
                    <td className="px-4 py-2 text-right text-rose-600 font-bold">{formatZAR(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
