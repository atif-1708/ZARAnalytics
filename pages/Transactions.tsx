
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ClipboardList, 
  Search, 
  Loader2, 
  Store, 
  Clock, 
  User, 
  Banknote, 
  Globe, 
  Eye, 
  X,
  Hash,
  Filter,
  ShoppingCart,
  Calendar,
  RotateCcw,
  AlertTriangle,
  CheckSquare,
  Square,
  Minus,
  Plus,
  ArrowLeftRight,
  Database,
  Percent,
  Receipt,
  Printer
} from 'lucide-react';
import { storage } from '../services/mockStorage';
import { useAuth } from '../context/AuthContext';
import { DailySale, Business, UserRole, PaymentMethod } from '../types';
import { formatDate, formatZAR } from '../utils/formatters';
import { MISSING_SCHEMA_SQL } from './Inventory';
import { PdfService } from '../services/pdf';

export const Transactions: React.FC = () => {
  const { user } = useAuth();
  const [sales, setSales] = useState<DailySale[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefunding, setIsRefunding] = useState(false);
  const [showSchemaAlert, setShowSchemaAlert] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Filters
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'sale' | 'refund'>('all'); // New Type Filter
  const [viewingSale, setViewingSale] = useState<DailySale | null>(null);

  // Refund State
  const [selectedItems, setSelectedItems] = useState<Record<number, boolean>>({});
  const [refundQuantities, setRefundQuantities] = useState<Record<number, number>>({});

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [sData, bData] = await Promise.all([
        storage.getSales(),
        storage.getBusinesses()
      ]);

      const filteredBiz = bData.filter(b => 
        user?.role === UserRole.SUPER_ADMIN || 
        user?.role === UserRole.ORG_ADMIN || 
        user?.role === UserRole.ADMIN ||
        user?.assignedBusinessIds?.includes(b.id)
      );

      setBusinesses(filteredBiz);
      const relevantSales = sData.filter(s => (s.items && s.items.length > 0) || s.salesAmount < 0);
      setSales(relevantSales);

      const recent = relevantSales.slice(0, 5);
      const isMissingTime = recent.some(s => {
         const dateIsMidnight = s.date.endsWith('T00:00:00.000Z') || s.date.endsWith('T00:00:00') || s.date.length === 10;
         return dateIsMidnight && !s.createdAt;
      });
      
      if (isMissingTime) setShowSchemaAlert(true);

    } finally { 
      setIsLoading(false); 
    }
  };

  useEffect(() => { loadData(); }, [user]);

  useEffect(() => {
    if (viewingSale) {
      setSelectedItems({});
      setRefundQuantities({});
    }
  }, [viewingSale]);

  const toggleItemSelection = (index: number, maxQty: number) => {
    if (maxQty <= 0) return;
    setSelectedItems(prev => {
      const newState = { ...prev, [index]: !prev[index] };
      if (newState[index]) {
        setRefundQuantities(q => ({ ...q, [index]: maxQty }));
      } else {
        setRefundQuantities(q => {
          const next = { ...q };
          delete next[index];
          return next;
        });
      }
      return newState;
    });
  };

  const updateRefundQty = (index: number, delta: number, max: number) => {
    setRefundQuantities(prev => {
      const current = prev[index] || 1;
      const next = Math.min(Math.max(1, current + delta), max);
      return { ...prev, [index]: next };
    });
  };

  const calculateTotalRefund = () => {
    if (!viewingSale || !viewingSale.items) return 0;
    return viewingSale.items.reduce((total, item, idx) => {
      if (selectedItems[idx]) {
        const qty = refundQuantities[idx] || (item.quantity - (item.refundedQuantity || 0));
        const lineItemTotal = item.priceAtSale * item.quantity;
        const lineItemPaid = lineItemTotal - (item.discount || 0);
        const effectivePrice = item.quantity > 0 ? lineItemPaid / item.quantity : 0;
        return total + (effectivePrice * qty);
      }
      return total;
    }, 0);
  };

  const handleRefund = async () => {
    if (!viewingSale || isRefunding) return;
    
    const itemsToRefund = viewingSale.items?.map((item, idx) => {
      if (selectedItems[idx]) {
        const remainingQty = item.quantity - (item.refundedQuantity || 0);
        const requestQty = refundQuantities[idx] || remainingQty;
        return {
          sku: item.sku,
          quantity: requestQty,
          price: item.priceAtSale,
          productId: item.productId
        };
      }
      return null;
    }).filter(Boolean) as { sku: string, quantity: number, price: number, productId: string }[];

    if (!itemsToRefund || itemsToRefund.length === 0) {
      alert("Please select at least one item to refund.");
      return;
    }

    const totalRefund = calculateTotalRefund();
    if (!window.confirm(`Confirm Refund of ${formatZAR(totalRefund)}?`)) return;

    setIsRefunding(true);
    try {
      await storage.processRefund(viewingSale.id, itemsToRefund);
      const freshSales = await storage.getSales();
      setSales(freshSales.filter(s => (s.items && s.items.length > 0) || s.salesAmount < 0));
      setViewingSale(null);
      alert("Refund processed successfully.");
    } catch (e: any) {
      alert("Refund Failed: " + e.message);
    } finally {
      setIsRefunding(false);
    }
  };

  const getEffectiveDate = (sale: DailySale) => {
    if (sale.createdAt) return new Date(sale.createdAt);
    return new Date(sale.date);
  };

  const filteredTransactions = useMemo(() => {
    const result = sales.filter(s => {
      const bizMatch = selectedBusinessId === 'all' || s.businessId === selectedBusinessId;
      const methodMatch = methodFilter === 'all' || s.paymentMethod === methodFilter;
      
      // Type Filter Logic
      let typeMatch = true;
      if (typeFilter === 'refund') {
        typeMatch = s.isRefunded === true || s.salesAmount < 0;
      } else if (typeFilter === 'sale') {
        typeMatch = !s.isRefunded && s.salesAmount >= 0;
      }

      const d = getEffectiveDate(s);
      const transDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dateMatch = !dateFilter || transDate === dateFilter;
      
      const bizName = businesses.find(b => b.id === s.businessId)?.name.toLowerCase() || '';
      const searchTerm = search.toLowerCase();
      const basicSearchMatch = !search || bizName.includes(searchTerm) || s.id.toLowerCase().includes(searchTerm);
      const itemSearchMatch = !search || (s.items?.some(item => item.sku.toLowerCase().includes(searchTerm) || (item.description && item.description.toLowerCase().includes(searchTerm))) ?? false);

      return bizMatch && methodMatch && dateMatch && typeMatch && (basicSearchMatch || itemSearchMatch);
    });

    return result.sort((a, b) => getEffectiveDate(b).getTime() - getEffectiveDate(a).getTime());
  }, [sales, businesses, selectedBusinessId, search, dateFilter, methodFilter, typeFilter]);

  const getTimeString = (sale: DailySale) => {
    const d = getEffectiveDate(sale);
    return d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
  };

  const copySql = () => {
    navigator.clipboard.writeText(MISSING_SCHEMA_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportPdf = () => {
    const businessName = selectedBusinessId === 'all'
      ? 'Consolidated Register'
      : (businesses.find(b => b.id === selectedBusinessId)?.name || 'ZARlytics');

    const doc = PdfService.createDoc('Sales Register', `Generated: ${new Date().toLocaleDateString()}`, user?.name, businessName);
    
    // Add Filter Summary
    doc.setFontSize(9);
    doc.setTextColor(100);
    const dateText = dateFilter ? `Date: ${dateFilter}` : 'Date: All';
    const bizText = selectedBusinessId !== 'all' ? `Business: ${businesses.find(b => b.id === selectedBusinessId)?.name}` : 'Business: All';
    doc.text(`${bizText} | ${dateText}`, 14, 55);

    const data = filteredTransactions.map(s => {
      const biz = businesses.find(b => b.id === s.businessId);
      const effectiveDate = getEffectiveDate(s);
      return [
        s.id.substring(0, 8),
        `${effectiveDate.toLocaleDateString()} ${effectiveDate.toLocaleTimeString()}`,
        biz ? biz.name : 'Unknown',
        s.paymentMethod || '-',
        s.isRefunded || s.salesAmount < 0 ? 'REFUND' : 'SALE',
        formatZAR(s.salesAmount)
      ];
    });

    PdfService.generateTable(doc, ['ID', 'Date/Time', 'Unit', 'Method', 'Type', 'Amount'], data, 65);
    PdfService.save(doc, 'sales_register');
  };

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-teal-600" size={40} /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div className="text-left">
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Granular Transaction Log</h2>
          <p className="text-slate-500">Itemized audit of every digital checkout processed via POS</p>
        </div>
        <button onClick={handleExportPdf} className="flex items-center justify-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl font-bold shadow-lg hover:bg-slate-800 transition-all text-xs uppercase tracking-widest">
           <Printer size={16} /> Export Register
        </button>
      </div>

      {showSchemaAlert && (
        <div className="p-8 bg-rose-50 border border-rose-100 rounded-[2rem] flex flex-col md:flex-row items-center gap-8 animate-in slide-in-from-top-4 text-left">
           <div className="w-16 h-16 bg-rose-600 text-white rounded-3xl flex items-center justify-center shrink-0 shadow-lg shadow-rose-200">
             <Database size={32} />
           </div>
           <div className="flex-1 space-y-2">
              <h4 className="text-lg font-black text-rose-800 uppercase tracking-tight">Database Update Required</h4>
              <p className="text-sm text-rose-600 font-medium leading-relaxed">
                Your database transaction table (sales) is missing critical timestamp columns. New transactions will not show accurate times until this is fixed. Run this script in the Supabase SQL Editor.
              </p>
           </div>
           <div className="flex flex-col gap-2">
             <button onClick={copySql} className="bg-white text-rose-600 border border-rose-200 px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-rose-50 transition-colors">
                {copied ? 'Copied to Clipboard' : 'Copy Repair Script'}
             </button>
             <button onClick={() => setShowSchemaAlert(false)} className="text-rose-400 text-[10px] font-bold uppercase tracking-widest hover:underline">
               Dismiss
             </button>
           </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
          <Store size={14} className="text-slate-400" />
          <select 
            value={selectedBusinessId} 
            onChange={e => setSelectedBusinessId(e.target.value)} 
            className="bg-transparent text-[11px] font-black text-slate-700 outline-none cursor-pointer w-full uppercase tracking-widest"
          >
            <option value="all">All Businesses</option>
            {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        
        <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
          <Receipt size={14} className="text-slate-400" />
          <select 
            value={typeFilter} 
            onChange={e => setTypeFilter(e.target.value as any)} 
            className="bg-transparent text-[11px] font-black text-slate-700 outline-none cursor-pointer w-full uppercase tracking-widest"
          >
            <option value="all">All Types</option>
            <option value="sale">Sales</option>
            <option value="refund">Refunds</option>
          </select>
        </div>

        <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
          <Filter size={14} className="text-slate-400" />
          <select 
            value={methodFilter} 
            onChange={e => setMethodFilter(e.target.value)} 
            className="bg-transparent text-[11px] font-black text-slate-700 outline-none cursor-pointer w-full uppercase tracking-widest"
          >
            <option value="all">All Methods</option>
            <option value={PaymentMethod.CASH}>Cash in Hand</option>
            <option value={PaymentMethod.CARD}>Online / Bank</option>
          </select>
        </div>
        <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
          <Calendar size={14} className="text-slate-400" />
          <input 
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="bg-transparent text-[11px] font-black text-slate-700 outline-none cursor-pointer w-full uppercase tracking-widest"
          />
        </div>
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text" 
            placeholder="Search Trans ID, SKU, or Product Name..." 
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl outline-none text-sm font-medium" 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Trans ID</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Date & Time</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Business Unit</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Method</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Type</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Revenue</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.map(s => {
                const biz = businesses.find(b => b.id === s.businessId);
                const isCash = s.paymentMethod === PaymentMethod.CASH;
                const isRefund = s.isRefunded || s.salesAmount < 0;
                const displayTime = getTimeString(s);
                const effectiveDate = getEffectiveDate(s);
                
                return (
                  <tr key={s.id} className={`hover:bg-slate-50/50 transition-colors ${isRefund ? 'bg-rose-50/10' : ''}`}>
                    <td className="px-6 py-4">
                       <span className={`font-mono text-[10px] font-black ${s.isRefunded ? 'text-rose-500 line-through' : 'text-slate-400'}`}>#{s.id.substring(0, 8)}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-slate-700">{formatDate(effectiveDate.toISOString())}</span>
                        <div className="flex items-center gap-1 text-slate-400">
                          <Clock size={10} />
                          <span className="text-[10px] font-bold">{displayTime}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       <span className="text-xs font-black text-slate-700">{biz?.name || 'Unknown Shop'}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                        isCash ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-blue-50 text-blue-700 border-blue-100'
                      }`}>
                        {isCash ? <Banknote size={12} /> : <Globe size={12} />}
                        {isCash ? 'Cash' : 'Card'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-1 rounded-md text-[10px] font-black border ${
                        isRefund
                          ? 'bg-rose-50 text-rose-600 border-rose-100' 
                          : 'bg-teal-50 text-teal-600 border-teal-100'
                      }`}>
                        {isRefund ? 'REFUND' : 'SALE'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`text-sm font-black ${isRefund ? 'text-rose-600' : 'text-teal-600'}`}>
                        {formatZAR(s.salesAmount)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => setViewingSale(s)}
                        className="p-2 text-slate-300 hover:text-teal-600 transition-colors"
                      >
                        <Eye size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-24 text-center text-slate-300 italic">
                    <ShoppingCart size={48} className="mx-auto mb-4 opacity-5" />
                    <p className="text-[10px] font-black uppercase tracking-widest">No matching transactions found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Detail Modal */}
      {viewingSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !isRefunding && setViewingSale(null)} />
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 relative shadow-2xl space-y-6 text-left border border-slate-100">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-teal-50 text-teal-600 rounded-2xl"><ClipboardList size={24} /></div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 leading-none">Receipt Review</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Trans: {viewingSale.id.substring(0, 12)}</p>
                  </div>
                </div>
                <button disabled={isRefunding} onClick={() => setViewingSale(null)} className="p-2 text-slate-300 hover:text-slate-900 transition-colors"><X size={24}/></button>
             </div>

             {viewingSale.isRefunded && (
                <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex items-center gap-3 text-rose-600 animate-in zoom-in">
                   <AlertTriangle size={20} />
                   <div>
                      <p className="text-xs font-black uppercase tracking-tight">Transaction Refunded</p>
                      <p className="text-[10px] font-bold opacity-80">Stock has been restored and revenue reversed.</p>
                   </div>
                </div>
             )}

             <div className={`bg-slate-50 border border-slate-100 rounded-2xl p-6 space-y-2 ${viewingSale.isRefunded ? 'opacity-50 grayscale pointer-events-none' : ''}`}>
                {!viewingSale.isRefunded && viewingSale.salesAmount > 0 && (
                  <div className="flex items-center gap-2 mb-3 bg-rose-50 p-2 rounded-lg text-rose-600">
                    <CheckSquare size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Select items below to process partial refund</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-3 mb-2">
                   <span>Item Description</span>
                   <div className="flex gap-8">
                      <span>Qty</span>
                      <span className="w-16 text-right">Paid</span>
                   </div>
                </div>
                {viewingSale.items?.map((item, idx) => {
                  const refundedCount = item.refundedQuantity || 0;
                  const remainingQty = item.quantity - refundedCount;
                  const isFullyRefunded = remainingQty <= 0;
                  const itemTotal = item.priceAtSale * item.quantity;
                  const itemDiscount = item.discount || 0;
                  const itemPaid = itemTotal - itemDiscount;

                  return (
                    <div key={idx} className={`flex items-center py-2 group ${isFullyRefunded ? 'opacity-50' : ''}`}>
                      {!viewingSale.isRefunded && viewingSale.salesAmount > 0 && (
                        <button 
                          disabled={isFullyRefunded}
                          onClick={() => toggleItemSelection(idx, remainingQty)}
                          className={`mr-3 transition-colors ${selectedItems[idx] ? 'text-rose-500' : 'text-slate-300 hover:text-rose-300'} ${isFullyRefunded ? 'cursor-not-allowed' : ''}`}
                        >
                          {isFullyRefunded ? <Minus size={18} className="text-slate-200"/> : (selectedItems[idx] ? <CheckSquare size={18} /> : <Square size={18} />)}
                        </button>
                      )}

                      <div className="flex flex-col min-w-0 pr-4 flex-1">
                        <div className="flex items-center gap-2">
                          <Hash size={12} className="text-slate-300" />
                          <span className={`text-sm font-black ${isFullyRefunded ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{item.sku}</span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 truncate">{item.description}</span>
                        {itemDiscount > 0 && <span className="text-[9px] font-black text-indigo-500 uppercase tracking-tight mt-0.5">Discount: -{formatZAR(itemDiscount)}</span>}
                      </div>
                      
                      <div className="flex items-center gap-6 shrink-0">
                        {selectedItems[idx] && !viewingSale.isRefunded ? (
                          <div className="flex items-center bg-white border border-rose-200 rounded-lg">
                             <button onClick={() => updateRefundQty(idx, -1, remainingQty)} className="p-1 text-slate-400 hover:text-rose-600"><Minus size={10} /></button>
                             <span className="w-6 text-center text-xs font-bold text-rose-600">{refundQuantities[idx] || remainingQty}</span>
                             <button onClick={() => updateRefundQty(idx, 1, remainingQty)} className="p-1 text-slate-400 hover:text-rose-600"><Plus size={10} /></button>
                          </div>
                        ) : (
                          <span className="text-sm font-bold text-slate-500 w-8 text-center">{item.quantity}</span>
                        )}
                        <div className="flex flex-col items-end w-16">
                           <span className="text-sm font-black text-teal-600">{formatZAR(itemPaid)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                <div className="pt-4 mt-2 border-t border-slate-200 flex justify-between items-center">
                   <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Transaction Value</span>
                   </div>
                   <span className="text-2xl font-black text-slate-900">{formatZAR(viewingSale.salesAmount)}</span>
                </div>
             </div>

             {!viewingSale.isRefunded && viewingSale.salesAmount > 0 && (
                <button 
                  onClick={handleRefund}
                  disabled={isRefunding || Object.keys(selectedItems).filter(k => selectedItems[parseInt(k)]).length === 0}
                  className={`w-full py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all border flex items-center justify-center gap-2 ${
                    Object.keys(selectedItems).length > 0
                      ? 'bg-rose-600 text-white hover:bg-rose-700 border-rose-600 shadow-xl shadow-rose-200' 
                      : 'bg-slate-100 text-slate-400 border-slate-200'
                  }`}
                >
                  {isRefunding ? <Loader2 className="animate-spin" size={16} /> : <><RotateCcw size={16} /> {Object.keys(selectedItems).length > 0 ? `Refund Selected (${formatZAR(calculateTotalRefund())})` : 'Select Items to Refund'}</>}
                </button>
             )}
          </div>
        </div>
      )}
    </div>
  );
};
