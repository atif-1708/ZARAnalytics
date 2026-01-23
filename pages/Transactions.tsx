
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
  ArrowLeftRight
} from 'lucide-react';
import { storage } from '../services/mockStorage';
import { useAuth } from '../context/AuthContext';
import { DailySale, Business, UserRole, PaymentMethod } from '../types';
import { formatDate, formatZAR } from '../utils/formatters';

export const Transactions: React.FC = () => {
  const { user } = useAuth();
  const [sales, setSales] = useState<DailySale[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefunding, setIsRefunding] = useState(false);
  
  // Filters
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('all');
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
      // Include standard sales (with items) AND financial adjustments (negative amounts, often with no items)
      setSales(sData.filter(s => (s.items && s.items.length > 0) || s.salesAmount < 0));
    } finally { 
      setIsLoading(false); 
    }
  };

  useEffect(() => { loadData(); }, [user]);

  // Reset refund state when opening a new receipt
  useEffect(() => {
    if (viewingSale) {
      setSelectedItems({});
      setRefundQuantities({});
    }
  }, [viewingSale]);

  const toggleItemSelection = (index: number, maxQty: number) => {
    if (maxQty <= 0) return; // Prevent selecting fully refunded items
    
    setSelectedItems(prev => {
      const newState = { ...prev, [index]: !prev[index] };
      if (newState[index]) {
        // If selecting, set default quantity to max remaining
        setRefundQuantities(q => ({ ...q, [index]: maxQty }));
      } else {
        // If deselecting, remove quantity
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
        return total + (item.priceAtSale * qty);
      }
      return total;
    }, 0);
  };

  const handleRefund = async () => {
    if (!viewingSale || isRefunding) return;
    
    // Construct refund payload
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
    const confirmMsg = `Confirm Refund of ${formatZAR(totalRefund)}?\n\n- ${itemsToRefund.length} item(s) will be returned to stock.\n- Financials will be adjusted.`;
    
    if (!window.confirm(confirmMsg)) return;

    setIsRefunding(true);
    try {
      await storage.processRefund(viewingSale.id, itemsToRefund);
      
      // Reload strictly from DB to get the new state (refundedQuantity updates AND new adjustment record)
      const freshSales = await storage.getSales();
      setSales(freshSales.filter(s => (s.items && s.items.length > 0) || s.salesAmount < 0));
      
      const updatedSale = freshSales.find(s => s.id === viewingSale.id);
      
      if (updatedSale) {
        if (updatedSale.isRefunded) {
           setViewingSale(prev => prev ? { ...prev, isRefunded: true } : null);
        } else {
           // Update the currently viewed sale with new item data (so badges update)
           setViewingSale(updatedSale);
           // Clear selection state for next action
           setSelectedItems({});
           setRefundQuantities({});
        }
      } else {
        setViewingSale(null);
      }
      
      alert("Refund processed successfully.");
    } catch (e: any) {
      alert("Refund Failed: " + e.message);
    } finally {
      setIsRefunding(false);
    }
  };

  const filteredTransactions = useMemo(() => {
    return sales.filter(s => {
      const bizMatch = selectedBusinessId === 'all' || s.businessId === selectedBusinessId;
      const methodMatch = methodFilter === 'all' || s.paymentMethod === methodFilter;
      const transDate = s.date.split('T')[0];
      const dateMatch = !dateFilter || transDate === dateFilter;
      const bizName = businesses.find(b => b.id === s.businessId)?.name.toLowerCase() || '';
      const searchTerm = search.toLowerCase();
      
      const basicSearchMatch = !search || 
        bizName.includes(searchTerm) || 
        s.id.toLowerCase().includes(searchTerm);

      const itemSearchMatch = !search || (s.items?.some(item => 
        item.sku.toLowerCase().includes(searchTerm) || 
        (item.description && item.description.toLowerCase().includes(searchTerm))
      ) ?? false);

      return bizMatch && methodMatch && dateMatch && (basicSearchMatch || itemSearchMatch);
    });
  }, [sales, businesses, selectedBusinessId, search, dateFilter, methodFilter]);

  const getTimeString = (dateStr: string) => {
    // Check for null, empty or short date string
    if (!dateStr || dateStr.length <= 10) return '--:--';
    
    const date = new Date(dateStr);
    
    // Check if it's midnight UTC (which shows as 5 AM in PKT/ZAR contexts), indicating a date-only record
    // If hours, minutes, and seconds are ALL 0 in UTC, it's likely a date-only timestamp.
    if (date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0) {
       return '--:--';
    }
    
    return date.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
  };

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-teal-600" size={40} /></div>;

  return (
    <div className="space-y-6">
      <div className="text-left">
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Granular Transaction Log</h2>
        <p className="text-slate-500">Itemized audit of every digital checkout processed via POS</p>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
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
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Revenue</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.map(s => {
                const biz = businesses.find(b => b.id === s.businessId);
                const isCash = s.paymentMethod === PaymentMethod.CASH;
                const isAdjustment = !s.items || s.items.length === 0;
                const displayTime = getTimeString(s.date);
                
                return (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                       <div className="flex flex-col gap-1">
                         <span className={`font-mono text-[10px] font-black ${s.isRefunded ? 'text-rose-500 line-through' : 'text-slate-400'}`}>#{s.id.substring(0, 8)}</span>
                         {s.isRefunded && <span className="text-[8px] font-black text-rose-600 uppercase bg-rose-50 px-1.5 py-0.5 rounded w-fit">Refunded</span>}
                       </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-slate-700">{formatDate(s.date)}</span>
                        <div className="flex items-center gap-1 text-slate-400">
                          <Clock size={10} />
                          <span className={`text-[10px] font-bold ${displayTime === '--:--' ? 'text-slate-300' : ''}`}>{displayTime}</span>
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
                        {isCash ? 'Cash in Hand' : 'Online / Bank'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`text-sm font-black ${isAdjustment ? 'text-rose-600' : (s.isRefunded ? 'text-slate-400 line-through decoration-rose-500' : 'text-teal-600')}`}>
                        {formatZAR(s.salesAmount)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {isAdjustment ? (
                        <div className="flex items-center justify-end gap-1.5 text-rose-500">
                           <ArrowLeftRight size={14} />
                           <span className="text-[9px] font-black uppercase tracking-widest">Refund Log</span>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setViewingSale(s)}
                          className="p-2 text-slate-300 hover:text-teal-600 transition-colors"
                        >
                          <Eye size={18} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-24 text-center text-slate-300 italic">
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
                {!viewingSale.isRefunded && (
                  <div className="flex items-center gap-2 mb-3 bg-rose-50 p-2 rounded-lg text-rose-600">
                    <CheckSquare size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Select items below to process partial refund</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-3 mb-2">
                   <span>Item Description</span>
                   <div className="flex gap-8">
                      <span>Qty</span>
                      <span className="w-16 text-right">Price</span>
                   </div>
                </div>
                {viewingSale.items?.map((item, idx) => {
                  const refundedCount = item.refundedQuantity || 0;
                  const remainingQty = item.quantity - refundedCount;
                  const isFullyRefunded = remainingQty <= 0;

                  return (
                    <div key={idx} className={`flex items-center py-2 group ${isFullyRefunded ? 'opacity-50' : ''}`}>
                      {/* Checkbox for partial refund selection */}
                      {!viewingSale.isRefunded && (
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
                        {refundedCount > 0 && (
                          <span className="text-[9px] font-black text-rose-500 uppercase tracking-tight mt-0.5">
                            Returned: {refundedCount}/{item.quantity}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-6 shrink-0">
                        {/* Quantity Logic: If selected, show adjuster, else static */}
                        {selectedItems[idx] && !viewingSale.isRefunded ? (
                          <div className="flex items-center bg-white border border-rose-200 rounded-lg">
                             <button 
                               onClick={() => updateRefundQty(idx, -1, remainingQty)}
                               className="p-1 text-slate-400 hover:text-rose-600"
                             >
                               <Minus size={10} />
                             </button>
                             <span className="w-6 text-center text-xs font-bold text-rose-600">{refundQuantities[idx] || remainingQty}</span>
                             <button 
                               onClick={() => updateRefundQty(idx, 1, remainingQty)}
                               className="p-1 text-slate-400 hover:text-rose-600"
                             >
                               <Plus size={10} />
                             </button>
                          </div>
                        ) : (
                          <span className="text-sm font-bold text-slate-500 w-8 text-center">{item.quantity}</span>
                        )}
                        
                        <span className="text-sm font-black text-teal-600 w-16 text-right">{formatZAR(item.priceAtSale * item.quantity)}</span>
                      </div>
                    </div>
                  );
                })}
                
                <div className="pt-4 mt-2 border-t border-slate-200 flex justify-between items-center">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Transaction Value</span>
                   <span className="text-2xl font-black text-slate-900">{formatZAR(viewingSale.salesAmount)}</span>
                </div>
             </div>

             <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-xl border border-slate-100">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Payment Method</span>
                   <span className="text-xs font-black text-slate-800 uppercase tracking-widest">
                     {viewingSale.paymentMethod === PaymentMethod.CASH ? 'Cash in Hand' : 'Online / Bank'}
                   </span>
                </div>
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-xl border border-slate-100">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Transaction Date</span>
                   <span className="text-xs font-black text-slate-800 uppercase tracking-widest">{formatDate(viewingSale.date)} {new Date(viewingSale.date).toLocaleTimeString()}</span>
                </div>
             </div>

             {/* Refund Action */}
             {!viewingSale.isRefunded && (
                <button 
                  onClick={handleRefund}
                  disabled={isRefunding || Object.keys(selectedItems).filter(k => selectedItems[parseInt(k)]).length === 0}
                  className={`w-full py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all border flex items-center justify-center gap-2 ${
                    Object.keys(selectedItems).length > 0
                      ? 'bg-rose-600 text-white hover:bg-rose-700 border-rose-600 shadow-xl shadow-rose-200' 
                      : 'bg-slate-100 text-slate-400 border-slate-200'
                  }`}
                >
                  {isRefunding ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <>
                      <RotateCcw size={16} /> 
                      {Object.keys(selectedItems).length > 0 
                        ? `Refund Selected (${formatZAR(calculateTotalRefund())})` 
                        : 'Select Items to Refund'}
                    </>
                  )}
                </button>
             )}
          </div>
        </div>
      )}
    </div>
  );
};
