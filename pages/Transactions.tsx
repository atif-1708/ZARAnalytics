
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
  AlertTriangle
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
      // Filter sales based on individual transaction items existence (POS checkouts)
      setSales(sData.filter(s => s.items && s.items.length > 0));
    } finally { 
      setIsLoading(false); 
    }
  };

  useEffect(() => { loadData(); }, [user]);

  const handleRefund = async () => {
    if (!viewingSale || isRefunding) return;
    
    const confirmMsg = `Process FULL REFUND for Transaction #${viewingSale.id.substring(0,8)}?\n\n- Stock will be restored.\n- A negative sales entry will be created for today.\n- This cannot be undone.`;
    if (!window.confirm(confirmMsg)) return;

    setIsRefunding(true);
    try {
      await storage.processRefund(viewingSale.id);
      await loadData(); // Refresh list to get updated status
      
      // Update local view state to show refunded status immediately
      setViewingSale(prev => prev ? { ...prev, isRefunded: true } : null);
      
      alert("Refund processed successfully.");
    } catch (e: any) {
      alert("Refund Failed: " + e.message);
    } finally {
      setIsRefunding(false);
    }
  };

  const filteredTransactions = useMemo(() => {
    return sales.filter(s => {
      // 1. Business Match
      const bizMatch = selectedBusinessId === 'all' || s.businessId === selectedBusinessId;
      
      // 2. Method Match
      const methodMatch = methodFilter === 'all' || s.paymentMethod === methodFilter;
      
      // 3. Date Match
      const transDate = s.date.split('T')[0];
      const dateMatch = !dateFilter || transDate === dateFilter;
      
      // 4. Advanced Search (Shop, Trans ID, or Product Details)
      const bizName = businesses.find(b => b.id === s.businessId)?.name.toLowerCase() || '';
      const searchTerm = search.toLowerCase();
      
      const basicSearchMatch = !search || 
        bizName.includes(searchTerm) || 
        s.id.toLowerCase().includes(searchTerm);

      // Search inside items (SKU or Description)
      const itemSearchMatch = !search || (s.items?.some(item => 
        item.sku.toLowerCase().includes(searchTerm) || 
        (item.description && item.description.toLowerCase().includes(searchTerm))
      ) ?? false);

      return bizMatch && methodMatch && dateMatch && (basicSearchMatch || itemSearchMatch);
    });
  }, [sales, businesses, selectedBusinessId, search, dateFilter, methodFilter]);

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-teal-600" size={40} /></div>;

  return (
    <div className="space-y-6">
      <div className="text-left">
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Granular Transaction Log</h2>
        <p className="text-slate-500">Itemized audit of every digital checkout processed via POS</p>
      </div>

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
                          <span className="text-[10px] font-bold">{new Date(s.date).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}</span>
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
                      <span className={`text-sm font-black ${s.isRefunded ? 'text-slate-400 line-through decoration-rose-500' : 'text-teal-600'}`}>
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

             <div className={`bg-slate-50 border border-slate-100 rounded-2xl p-6 space-y-4 ${viewingSale.isRefunded ? 'opacity-50 grayscale' : ''}`}>
                <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-3">
                   <span>Item Description</span>
                   <div className="flex gap-10">
                      <span>Qty</span>
                      <span className="w-20 text-right">Price</span>
                   </div>
                </div>
                {viewingSale.items?.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center">
                    <div className="flex flex-col min-w-0 pr-4">
                      <div className="flex items-center gap-2">
                        <Hash size={12} className="text-slate-300" />
                        <span className="text-sm font-black text-slate-800">{item.sku}</span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 truncate">{item.description}</span>
                    </div>
                    <div className="flex gap-10 shrink-0">
                      <span className="text-sm font-bold text-slate-500">{item.quantity}</span>
                      <span className="text-sm font-black text-teal-600 w-20 text-right">{formatZAR(item.priceAtSale * item.quantity)}</span>
                    </div>
                  </div>
                ))}
                <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Value</span>
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
                  disabled={isRefunding}
                  className="w-full py-4 bg-slate-900 text-rose-400 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-rose-950 transition-all border border-rose-900/30 flex items-center justify-center gap-2"
                >
                  {isRefunding ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <>
                      <RotateCcw size={16} /> Process Refund
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
