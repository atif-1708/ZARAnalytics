import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, TrendingUp, Briefcase, Loader2, 
  ArrowDownCircle, DollarSign, Download
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

    return { fSales, fExpenses, totalSales, totalProfit, totalExpenses, netProfit };
  }, [filters, sales, expenses]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <Loader2 size={32} className="animate-spin mb-3" />
        <p className="text-sm font-medium">Loading report data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <div>
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
        <FilterPanel filters={filters} setFilters={setFilters} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl w-fit mb-4">
            <DollarSign size={20} />
          </div>
          <p className="text-sm font-medium text-slate-500">Gross Revenue</p>
          <h3 className="text-xl font-bold text-slate-900">{formatZAR(reportData.totalSales)}</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="p-3 bg-teal-50 text-teal-600 rounded-xl w-fit mb-4">
            <TrendingUp size={20} />
          </div>
          <p className="text-sm font-medium text-slate-500">Gross Profit</p>
          <h3 className="text-xl font-bold text-teal-600">{formatZAR(reportData.totalProfit)}</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl w-fit mb-4">
            <ArrowDownCircle size={20} />
          </div>
          <p className="text-sm font-medium text-slate-500">Total Expenses</p>
          <h3 className="text-xl font-bold text-rose-600">{formatZAR(reportData.totalExpenses)}</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl w-fit mb-4">
            <Briefcase size={20} />
          </div>
          <p className="text-sm font-medium text-slate-500">Net Position</p>
          <h3 className={`text-xl font-bold ${reportData.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {formatZAR(reportData.netProfit)}
          </h3>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
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
                <th className="px-6 py-4 text-right">Revenue (ZAR)</th>
                <th className="px-6 py-4 text-right">Profit (ZAR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reportData.fSales.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-slate-400 italic text-sm">No records match the current filters.</td>
                </tr>
              ) : (
                reportData.fSales.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-800">
                      {businesses.find(b => b.id === s.businessId)?.name || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">{formatDate(s.date)}</td>
                    <td className="px-6 py-4 text-right text-sm font-medium">{formatZAR(s.salesAmount)}</td>
                    <td className="px-6 py-4 text-right text-sm font-bold text-teal-600">{formatZAR(s.profitAmount)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {reportData.fSales.length > 0 && (
              <tfoot className="bg-slate-50 font-black">
                <tr>
                  <td colSpan={2} className="px-6 py-4 text-xs uppercase tracking-wider text-slate-500">Consolidated Totals</td>
                  <td className="px-6 py-4 text-right text-slate-900 border-t-2 border-slate-200">{formatZAR(reportData.totalSales)}</td>
                  <td className="px-6 py-4 text-right text-teal-700 border-t-2 border-slate-200">{formatZAR(reportData.totalProfit)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};