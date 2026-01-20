import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, Download, TrendingUp, ArrowDownCircle, Briefcase, 
  Calendar, Loader2, AlertCircle, Sparkles, ShieldCheck, 
  Landmark, FileCheck, ClipboardList, Quote
} from 'lucide-react';
import { storage } from '../services/mockStorage';
import { FilterPanel } from '../components/FilterPanel';
import { Filters, Business, DailySale, MonthlyExpense } from '../types';
import { formatZAR, formatDate, formatMonth } from '../utils/formatters';
import { GoogleGenAI } from "@google/genai";

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
  const [isGeneratingAnalysis, setIsGeneratingAnalysis] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);

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

  const generateAIAnalysis = async () => {
    if (isGeneratingAnalysis) return;
    setIsGeneratingAnalysis(true);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const businessName = filters.businessId === 'all' 
        ? 'All Business Units (Consolidated)' 
        : businesses.find(b => b.id === filters.businessId)?.name || 'Business Unit';

      const prompt = `Act as a Professional Business Auditor. Generate a formal, high-level written financial summary for: ${businessName}.
      
      FINANCIAL SNAPSHOT:
      - Period: ${filters.dateRange.start || 'Beginning'} to ${filters.dateRange.end || 'Current'}
      - Revenue: ${formatZAR(reportData.totalSales)}
      - Gross Profit: ${formatZAR(reportData.totalProfit)}
      - Operating Costs: ${formatZAR(reportData.totalExpenses)}
      - Final Net Profit: ${formatZAR(reportData.netProfit)}
      - Performance Margin: ${reportData.avgMargin.toFixed(2)}%
      
      INSTRUCTIONS:
      Write a professional executive summary consisting of 3 concise paragraphs:
      1. PERFORMANCE OVERVIEW: High-level narrative of the revenue vs expenses.
      2. OPERATIONAL INSIGHT: A deep-dive into the ${reportData.avgMargin.toFixed(1)}% efficiency.
      3. STRATEGIC OUTLOOK: Recommendation to improve the current net income of ${formatZAR(reportData.netProfit)}.
      
      Maintain a formal, corporate tone. Use paragraphs, not bullet points.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
      });

      setAiAnalysis(response.text || "Analysis could not be generated at this time.");
    } catch (err) {
      console.error("AI Error:", err);
      setAiAnalysis("Strategic analysis synthesis failed. Please verify connectivity.");
    } finally {
      setIsGeneratingAnalysis(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-slate-400">
        <Loader2 size={40} className="animate-spin mb-4" />
        <p>Generating report datasets...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header & Actions */}
      <div className="flex justify-between items-center no-print">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Professional Reporting Suite</h2>
          <p className="text-slate-500 text-sm">Generate and export formal business statements</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={generateAIAnalysis}
            disabled={isGeneratingAnalysis}
            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 font-bold text-sm"
          >
            {isGeneratingAnalysis ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            {aiAnalysis ? 'Regenerate Analysis' : 'Write AI Summary'}
          </button>
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10 font-bold text-sm"
          >
            <Download size={18} />
            Export Professional PDF
          </button>
        </div>
      </div>

      <div className="no-print">
        <FilterPanel filters={filters} setFilters={setFilters} />
      </div>

      {/* PRINTABLE DOCUMENT CONTAINER */}
      <div className="max-w-4xl mx-auto bg-white shadow-2xl md:rounded-[2rem] border border-slate-200 p-8 md:p-16 print:p-0 print:shadow-none print:border-none print-document">
        
        {/* Document Header / Letterhead */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b-4 border-slate-900 pb-10 mb-10">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center text-xl font-black text-white">ZL</div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Management Report</h1>
                <p className="text-slate-400 text-[9px] font-black tracking-[0.3em] uppercase mt-1">Financial Operations Audit</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              <span className="flex items-center gap-1"><Landmark size={12}/> Business Integrity</span>
              <span className="flex items-center gap-1"><FileCheck size={12}/> Verified Data</span>
            </div>
          </div>
          <div className="text-left md:text-right">
            <p className="text-xs font-black text-slate-900 uppercase tracking-widest mb-1">Date Issued</p>
            <p className="text-sm font-bold text-slate-600">{new Date().toLocaleDateString('en-ZA', { dateStyle: 'long' })}</p>
            <p className="text-[10px] text-slate-300 font-mono mt-1">#REF-{new Date().getTime().toString().slice(-10)}</p>
          </div>
        </div>

        {/* Executive Summary (Gemini Powered) */}
        <section className="mb-12">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2">
            <ClipboardList size={16} className="text-indigo-600" />
            Section I: Executive Narrative
          </h3>
          
          {aiAnalysis ? (
            <div className="relative">
              <Quote size={40} className="absolute -left-6 -top-4 text-slate-100 opacity-50" />
              <div className="prose prose-slate max-w-none italic text-slate-700 leading-relaxed text-sm bg-slate-50 p-8 rounded-2xl border border-slate-100 whitespace-pre-wrap">
                {aiAnalysis}
              </div>
            </div>
          ) : (
            <div className="no-print p-12 border-2 border-dashed border-slate-200 rounded-3xl text-center">
              <Sparkles size={32} className="mx-auto text-slate-200 mb-4" />
              <p className="text-slate-400 font-medium text-sm">Click "Write AI Summary" above to generate professional commentary for this data view.</p>
            </div>
          )}
        </section>

        {/* Financial Ledger Schedules */}
        <section className="space-y-8">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2">
            <TrendingUp size={16} className="text-teal-600" />
            Section II: Financial Performance Schedules
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            <div className="p-5 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Gross Revenue</p>
              <p className="text-lg font-bold text-slate-900">{formatZAR(reportData.totalSales)}</p>
            </div>
            <div className="p-5 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Gross Profits</p>
              <p className="text-lg font-bold text-teal-600">{formatZAR(reportData.totalProfit)}</p>
            </div>
            <div className="p-5 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Op. Overhead</p>
              <p className="text-lg font-bold text-rose-600">{formatZAR(reportData.totalExpenses)}</p>
            </div>
            <div className="p-5 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Net Position</p>
              <p className={`text-lg font-bold ${reportData.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatZAR(reportData.netProfit)}</p>
            </div>
          </div>

          <div className="page-break"></div>

          {/* Sales Schedule */}
          <div className="space-y-4">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Schedule A: Daily Revenue Transactions</h4>
            <div className="overflow-hidden border border-slate-100 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-white uppercase tracking-widest text-[9px]">
                  <tr>
                    <th className="px-6 py-4">Transaction Date</th>
                    <th className="px-6 py-4">Business Unit</th>
                    <th className="px-6 py-4 text-right">Volume (ZAR)</th>
                    <th className="px-6 py-4 text-right">Profit Contribution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportData.fSales.map(s => (
                    <tr key={s.id}>
                      <td className="px-6 py-3 font-medium text-slate-500">{formatDate(s.date)}</td>
                      <td className="px-6 py-3 text-slate-900 font-bold">
                        {businesses.find(b => b.id === s.businessId)?.name}
                      </td>
                      <td className="px-6 py-3 text-right font-medium">{formatZAR(s.salesAmount)}</td>
                      <td className="px-6 py-3 text-right font-black text-teal-600">{formatZAR(s.profitAmount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 font-black">
                  <tr>
                    <td colSpan={2} className="px-6 py-4 uppercase text-[9px]">Aggregate Totals</td>
                    <td className="px-6 py-4 text-right border-t-2 border-slate-900">{formatZAR(reportData.totalSales)}</td>
                    <td className="px-6 py-4 text-right border-t-2 border-slate-900 text-teal-700">{formatZAR(reportData.totalProfit)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Expense Schedule */}
          <div className="space-y-4 pt-10">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Schedule B: Operational Expenditure</h4>
            <div className="overflow-hidden border border-slate-100 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-500 uppercase tracking-widest text-[9px]">
                  <tr>
                    <th className="px-6 py-4">Accounting Period</th>
                    <th className="px-6 py-4">Business Entity</th>
                    <th className="px-6 py-4">Item Description</th>
                    <th className="px-6 py-4 text-right">Amount (ZAR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportData.fExpenses.map(e => (
                    <tr key={e.id}>
                      <td className="px-6 py-3 font-medium text-slate-500">{formatMonth(e.month)}</td>
                      <td className="px-6 py-3 text-slate-900 font-bold uppercase">
                        {businesses.find(b => b.id === e.businessId)?.name}
                      </td>
                      <td className="px-6 py-3 text-slate-400 italic">{e.description}</td>
                      <td className="px-6 py-3 text-right font-black text-rose-600">{formatZAR(e.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 font-black">
                  <tr>
                    <td colSpan={3} className="px-6 py-4 uppercase text-[9px]">Total OpEx Expenditure</td>
                    <td className="px-6 py-4 text-right border-t-2 border-slate-900 text-rose-700">{formatZAR(reportData.totalExpenses)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </section>

        {/* Auditor Verification Section */}
        <div className="pt-24 mt-24 border-t-2 border-slate-100 flex justify-center gap-20">
          <div className="text-center space-y-3">
            <div className="w-48 h-px bg-slate-300 mx-auto"></div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Management Approval</p>
          </div>
          <div className="text-center space-y-3">
            <div className="w-48 h-px bg-slate-300 mx-auto"></div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Internal Compliance Audit</p>
          </div>
        </div>
      </div>
    </div>
  );
};