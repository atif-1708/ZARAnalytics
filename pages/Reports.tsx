
import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, TrendingUp, Briefcase, Loader2, 
  ArrowDownCircle, DollarSign, Download, Store,
  ArrowUpRight, ArrowDownRight, Package, Trophy, BarChart2, ShoppingBag, Info
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell 
} from 'recharts';
import { storage } from '../services/mockStorage';
import { FilterPanel } from '../components/FilterPanel';
import { Filters, Business, DailySale, MonthlyExpense, UserRole, SaleItem } from '../types';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/formatters';

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
  const [activeTab, setActiveTab] = useState<'financials' | 'products'>('financials');
  const [currency, setCurrency] = useState<'ZAR' | 'PKR'>('ZAR');
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [isFetchingRate, setIsFetchingRate] = useState(false);
  
  const isAdminVisibility = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.ORG_ADMIN;
  const isNoAssignment = !isAdminVisibility && (user?.assignedBusinessIds?.length || 0) === 0;

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
  }, [user]);

  const convert = (val: number) => currency === 'PKR' ? val * exchangeRate : val;

  // Helper to get robust local date key YYYY-MM-DD
  const getLocalDateKey = (dateInput: string) => {
    if (!dateInput) return 'Invalid';
    if (dateInput.length === 10 && !dateInput.includes('T')) return dateInput;
    const d = new Date(dateInput);
    const isMidnightUTC = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
    if (isMidnightUTC) return dateInput.split('T')[0];
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // Centralized Date Range Logic
  const dateLimits = useMemo(() => {
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
    return { startDate, endDate, prevStartDate, prevEndDate };
  }, [filters]);

  const reportData = useMemo(() => {
    const calculateStats = (start: Date, end: Date) => {
      const fSales = sales.filter(item => {
        const itemDate = new Date(item.date);
        const inRange = itemDate >= start && itemDate <= end;
        const userHasAccess = isAdminVisibility || user?.assignedBusinessIds?.includes(item.businessId);
        const matchesBiz = filters.businessId === 'all' || item.businessId === filters.businessId;
        return inRange && userHasAccess && matchesBiz;
      });

      const aggregatedSales = Object.values(fSales.reduce((acc, sale) => {
        const dateKey = getLocalDateKey(sale.date);
        const key = `${sale.businessId}_${dateKey}`;
        if (!acc[key]) {
          acc[key] = { id: key, businessId: sale.businessId, date: dateKey, salesAmount: 0, profitAmount: 0, transactionCount: 0 };
        }
        acc[key].salesAmount += Number(sale.salesAmount);
        acc[key].profitAmount += Number(sale.profitAmount);
        acc[key].transactionCount += 1;
        return acc;
      }, {} as Record<string, any>)).sort((a: any, b: any) => b.date.localeCompare(a.date));

      const fExpenses = expenses.filter(item => {
        const dateStr = item.month.length === 7 ? item.month + '-01' : item.month;
        const itemDate = new Date(dateStr);
        const inRange = itemDate >= start && itemDate <= end;
        const userHasAccess = isAdminVisibility || user?.assignedBusinessIds?.includes(item.businessId);
        const matchesBiz = filters.businessId === 'all' || item.businessId === filters.businessId;
        return inRange && userHasAccess && matchesBiz;
      });

      const rawSales = fSales.reduce((acc, curr) => acc + Number(curr.salesAmount), 0);
      const rawProfit = fSales.reduce((acc, curr) => acc + Number(curr.profitAmount), 0);
      const rawExpenses = fExpenses.reduce((acc, curr) => acc + Number(curr.amount), 0);
      const rawNet = rawProfit - rawExpenses;

      return { aggregatedSales, fExpenses, rawSales, rawProfit, rawExpenses, rawNet };
    };

    const current = calculateStats(dateLimits.startDate, dateLimits.endDate);
    const previous = calculateStats(dateLimits.prevStartDate, dateLimits.prevEndDate);

    const calcTrend = (curr: number, prev: number) => {
      if (prev <= 0) return undefined;
      const diff = ((curr - prev) / prev) * 100;
      return { value: Math.abs(Math.round(diff)), isUp: diff >= 0 };
    };

    const avgMargin = current.rawSales > 0 ? (current.rawProfit / current.rawSales) * 100 : 0;

    return { 
      aggregatedSales: current.aggregatedSales,
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
  }, [filters, sales, expenses, currency, exchangeRate, user, isAdminVisibility, dateLimits]);

  // ITEM-WISE SUMMARY CALCULATION
  const productMetrics = useMemo(() => {
    const relevantSales = sales.filter(s => {
      const d = new Date(s.date);
      const inRange = d >= dateLimits.startDate && d <= dateLimits.endDate;
      const userHasAccess = isAdminVisibility || user?.assignedBusinessIds?.includes(s.businessId);
      const matchesBiz = filters.businessId === 'all' || s.businessId === filters.businessId;
      return inRange && userHasAccess && matchesBiz;
    });

    const productMap = new Map<string, {
      id: string;
      sku: string;
      name: string;
      quantity: number;
      revenue: number;
      profit: number;
    }>();

    relevantSales.forEach(sale => {
      if (sale.items && sale.items.length > 0) {
        sale.items.forEach(item => {
           const key = item.productId || item.sku;
           
           if (!productMap.has(key)) {
             productMap.set(key, {
               id: item.productId,
               sku: item.sku,
               name: item.description || 'Unknown Item',
               quantity: 0,
               revenue: 0,
               profit: 0
             });
           }
           
           const entry = productMap.get(key)!;
           const qty = item.quantity - (item.refundedQuantity || 0);
           
           if (qty !== 0) {
             const itemRev = item.priceAtSale * qty;
             const itemCost = item.costAtSale * qty;
             const netRev = itemRev - (item.discount || 0);
             
             entry.quantity += qty;
             entry.revenue += netRev;
             entry.profit += (netRev - itemCost);
           }
        });
      }
    });

    const allProducts = Array.from(productMap.values());
    
    // Champions
    const byVolume = [...allProducts].sort((a,b) => b.quantity - a.quantity)[0];
    const byRevenue = [...allProducts].sort((a,b) => b.revenue - a.revenue)[0];
    const byProfit = [...allProducts].sort((a,b) => b.profit - a.profit)[0];

    const sortedList = [...allProducts].sort((a,b) => b.revenue - a.revenue);

    return {
      byVolume,
      byRevenue,
      byProfit,
      sortedList,
      top5: sortedList.slice(0, 5).map(p => ({
        name: p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name,
        revenue: convert(p.revenue),
        profit: convert(p.profit)
      }))
    };
  }, [sales, dateLimits, filters, user, isAdminVisibility, currency, exchangeRate]);

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
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="text-left">
          <h2 className="text-2xl font-bold text-slate-800">Business Intelligence</h2>
          <p className="text-slate-500 text-sm">Performance analytics and financial reporting</p>
        </div>
        <div className="flex items-center gap-3">
           <div className="flex bg-slate-100 p-1 rounded-xl">
             <button 
               onClick={() => setActiveTab('financials')}
               className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'financials' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
             >
               Financials
             </button>
             <button 
               onClick={() => setActiveTab('products')}
               className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'products' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
             >
               Product Performance
             </button>
           </div>
           <button 
             onClick={() => window.print()}
             className="no-print hidden md:flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl hover:bg-slate-800 transition-all text-xs font-bold uppercase tracking-widest"
           >
             <Download size={14} />
             Export
           </button>
        </div>
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

      {activeTab === 'financials' ? (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
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
                  {reportData.aggregatedSales.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-slate-400 italic text-sm">No records match the current filters.</td>
                    </tr>
                  ) : (
                    <>
                      {reportData.aggregatedSales.map((s: any) => {
                        const b = businesses.find(bx => bx.id === s.businessId);
                        const [y, m, d] = s.date.split('-');
                        const dateObj = new Date(Number(y), Number(m)-1, Number(d));
                        const displayDate = dateObj.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
                        const profitPct = s.salesAmount > 0 ? (s.profitAmount / s.salesAmount) * 100 : 0;

                        return (
                          <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="text-sm font-black text-slate-800 leading-tight">
                                {b ? b.name : 'Unknown'}
                              </div>
                              {b && (
                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                                  {b.location}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-500 font-medium">{displayDate}</td>
                            <td className="px-6 py-4 text-center">
                              <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-[10px] font-black">
                                {profitPct.toFixed(2)}%
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right text-sm font-medium">{formatCurrency(convert(s.salesAmount), currency)}</td>
                            <td className="px-6 py-4 text-right text-sm font-bold text-teal-600">{formatCurrency(convert(s.profitAmount), currency)}</td>
                          </tr>
                        );
                      })}
                      <tr className="bg-slate-900 text-white font-bold">
                        <td className="px-6 py-4 text-xs uppercase tracking-widest font-black" colSpan={2}>Report Totals</td>
                        <td className="px-6 py-4 text-center text-[10px] uppercase font-black">Avg: {reportData.avgMargin.toFixed(2)}%</td>
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
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
           {/* Product Champions */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform"><Package size={80}/></div>
                 <div className="relative z-10 text-left">
                    <div className="flex items-center gap-2 mb-4">
                       <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Package size={20}/></div>
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Volume Leader</span>
                    </div>
                    {productMetrics.byVolume ? (
                       <>
                          <h3 className="text-lg font-black text-slate-800 truncate" title={productMetrics.byVolume.name}>{productMetrics.byVolume.name}</h3>
                          <p className="text-3xl font-black text-blue-600 mt-1">{productMetrics.byVolume.quantity} <span className="text-xs text-slate-400 font-bold uppercase">Units</span></p>
                          <p className="text-xs font-bold text-slate-400 mt-1">SKU: {productMetrics.byVolume.sku}</p>
                       </>
                    ) : (
                       <p className="text-slate-400 text-xs italic">No data available</p>
                    )}
                 </div>
              </div>

              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform"><Trophy size={80}/></div>
                 <div className="relative z-10 text-left">
                    <div className="flex items-center gap-2 mb-4">
                       <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><Trophy size={20}/></div>
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Revenue Star</span>
                    </div>
                    {productMetrics.byRevenue ? (
                       <>
                          <h3 className="text-lg font-black text-slate-800 truncate" title={productMetrics.byRevenue.name}>{productMetrics.byRevenue.name}</h3>
                          <p className="text-3xl font-black text-indigo-600 mt-1">{formatCurrency(convert(productMetrics.byRevenue.revenue), currency)}</p>
                          <p className="text-xs font-bold text-slate-400 mt-1">Total Sales Value</p>
                       </>
                    ) : (
                       <p className="text-slate-400 text-xs italic">No data available</p>
                    )}
                 </div>
              </div>

              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform"><TrendingUp size={80}/></div>
                 <div className="relative z-10 text-left">
                    <div className="flex items-center gap-2 mb-4">
                       <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><TrendingUp size={20}/></div>
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Profit Driver</span>
                    </div>
                    {productMetrics.byProfit ? (
                       <>
                          <h3 className="text-lg font-black text-slate-800 truncate" title={productMetrics.byProfit.name}>{productMetrics.byProfit.name}</h3>
                          <p className="text-3xl font-black text-emerald-600 mt-1">{formatCurrency(convert(productMetrics.byProfit.profit), currency)}</p>
                          <p className="text-xs font-bold text-slate-400 mt-1">Net Contribution</p>
                       </>
                    ) : (
                       <p className="text-slate-400 text-xs italic">No data available</p>
                    )}
                 </div>
              </div>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Top 5 Chart */}
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col">
                 <div className="flex items-center gap-2 mb-6">
                    <div className="p-2 bg-slate-100 text-slate-600 rounded-lg"><BarChart2 size={20}/></div>
                    <h3 className="font-bold text-slate-800">Top 5 by Revenue</h3>
                 </div>
                 <div className="flex-1 min-h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={productMetrics.top5} layout="vertical" margin={{ left: 0, right: 30 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                          <XAxis type="number" hide />
                          <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} axisLine={false} tickLine={false} />
                          <RechartsTooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} itemStyle={{ fontSize: '11px', fontWeight: 700 }} />
                          <Bar dataKey="revenue" fill="#4f46e5" radius={[0, 4, 4, 0]} barSize={20}>
                             {productMetrics.top5.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={['#4f46e5', '#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe'][index % 5]} />
                             ))}
                          </Bar>
                       </BarChart>
                    </ResponsiveContainer>
                 </div>
              </div>

              {/* Detailed Table */}
              <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                 <div className="p-6 border-b border-slate-100 bg-slate-50/50 text-left flex items-center gap-2">
                    <ShoppingBag size={18} className="text-slate-400" />
                    <h3 className="font-bold text-slate-800">Itemized Performance Ledger</h3>
                 </div>
                 <div className="flex-1 overflow-auto max-h-[500px]">
                    <table className="w-full text-left">
                       <thead className="bg-slate-50 text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100 sticky top-0 z-10">
                          <tr>
                             <th className="px-6 py-4 text-center">Rank</th>
                             <th className="px-6 py-4">Item</th>
                             <th className="px-6 py-4 text-center">Qty Sold</th>
                             <th className="px-6 py-4 text-right">Revenue</th>
                             <th className="px-6 py-4 text-right">Profit</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50">
                          {productMetrics.sortedList.length === 0 ? (
                             <tr><td colSpan={5} className="py-20 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">No item sales recorded</td></tr>
                          ) : (
                             productMetrics.sortedList.map((p, idx) => (
                                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                                   <td className="px-6 py-4 text-center">
                                      <span className={`inline-flex w-6 h-6 items-center justify-center rounded-lg text-[10px] font-black ${idx < 3 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                                         {idx + 1}
                                      </span>
                                   </td>
                                   <td className="px-6 py-4">
                                      <p className="text-xs font-black text-slate-800">{p.name}</p>
                                      <p className="text-[10px] font-bold text-slate-400 font-mono">{p.sku}</p>
                                   </td>
                                   <td className="px-6 py-4 text-center text-xs font-bold text-slate-600">{p.quantity}</td>
                                   <td className="px-6 py-4 text-right text-xs font-black text-indigo-600">{formatCurrency(convert(p.revenue), currency)}</td>
                                   <td className="px-6 py-4 text-right text-xs font-black text-emerald-600">{formatCurrency(convert(p.profit), currency)}</td>
                                </tr>
                             ))
                          )}
                       </tbody>
                    </table>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
