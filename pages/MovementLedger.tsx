
import React, { useState, useEffect, useMemo } from 'react';
import { 
  History, 
  Search, 
  Loader2, 
  Store, 
  ArrowUpRight, 
  ArrowDownRight, 
  Clock, 
  User, 
  Hash, 
  Filter,
  Package,
  Boxes,
  LayoutList
} from 'lucide-react';
import { storage } from '../services/mockStorage';
import { useAuth } from '../context/AuthContext';
import { StockMovement, Business, Product, UserRole } from '../types';
import { formatDate } from '../utils/formatters';

export const MovementLedger: React.FC = () => {
  const { user } = useAuth();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filters
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [bData, mData, pData] = await Promise.all([
        storage.getBusinesses(),
        storage.getStockMovements(),
        storage.getProducts()
      ]);

      const filteredBiz = bData.filter(b => 
        user?.role === UserRole.SUPER_ADMIN || 
        user?.role === UserRole.ORG_ADMIN || 
        user?.role === UserRole.ADMIN ||
        user?.assignedBusinessIds?.includes(b.id)
      );

      setBusinesses(filteredBiz);
      setMovements(mData);
      setProducts(pData);
    } catch(e) { 
      console.error(e); 
    } finally { 
      setIsLoading(false); 
    }
  };

  useEffect(() => { loadData(); }, [user]);

  const filteredMovements = useMemo(() => {
    return movements.filter(m => {
      const bizMatch = selectedBusinessId === 'all' || m.businessId === selectedBusinessId;
      const typeMatch = typeFilter === 'all' || m.type === typeFilter;
      
      const product = products.find(p => p.id === m.productId);
      const sku = product?.sku?.toLowerCase() || '';
      const desc = product?.description?.toLowerCase() || '';
      const reason = m.reason?.toLowerCase() || '';
      
      const searchMatch = !search || 
        sku.includes(search.toLowerCase()) || 
        desc.includes(search.toLowerCase()) ||
        reason.includes(search.toLowerCase());

      return bizMatch && typeMatch && searchMatch;
    });
  }, [movements, products, selectedBusinessId, search, typeFilter]);

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-teal-600" size={40} /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-left">
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Stock Movement Ledger</h2>
          <p className="text-slate-500">Full audit trail of arrivals, sales, and manual inventory adjustments</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
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
            value={typeFilter} 
            onChange={e => setTypeFilter(e.target.value)} 
            className="bg-transparent text-[11px] font-black text-slate-700 outline-none cursor-pointer w-full uppercase tracking-widest"
          >
            <option value="all">All Types</option>
            <option value="arrival">Arrivals</option>
            <option value="sale">Sales</option>
            <option value="adjustment">Adjustments</option>
            <option value="damaged">Shrinkage / Damage</option>
          </select>
        </div>

        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text" 
            placeholder="Search SKU, Description or Reason..." 
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
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Timestamp</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Business Unit</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">SKU / Item</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Type</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Qty</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Operator & Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMovements.map(m => {
                const product = products.find(p => p.id === m.productId);
                const biz = businesses.find(b => b.id === m.businessId);
                
                return (
                  <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-500">
                        <Clock size={12} />
                        <span className="text-xs font-bold whitespace-nowrap">{formatDate(m.createdAt)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       <span className="text-xs font-black text-slate-700">{biz?.name || 'Unknown'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                           <Hash size={12} className="text-slate-300" />
                           <span className="font-mono text-xs font-black text-indigo-600">{product?.sku || 'UNKNOWN'}</span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 truncate max-w-[150px]">{product?.description}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                        m.type === 'arrival' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                        m.type === 'sale' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                        m.type === 'damaged' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                        'bg-slate-50 text-slate-700 border-slate-100'
                      }`}>
                        {m.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`text-sm font-black ${m.quantity > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 text-xs font-black text-slate-800">
                           <User size={12} className="text-slate-400" />
                           {m.userName || 'System'}
                        </div>
                        <span className="text-[10px] font-medium text-slate-500 italic">"{m.reason || 'Manual Adjustment'}"</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredMovements.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-24 text-center">
                    <div className="max-w-xs mx-auto space-y-4">
                      <div className="w-16 h-16 bg-slate-50 text-slate-200 rounded-[2rem] flex items-center justify-center mx-auto">
                        <LayoutList size={32} />
                      </div>
                      <p className="text-sm font-bold text-slate-400 uppercase tracking-widest italic">No movement records found</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
