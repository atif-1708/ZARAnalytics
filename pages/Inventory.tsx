
import React, { useState, useEffect, useRef } from 'react';
import { 
  Package, 
  Plus, 
  Trash2, 
  Edit3, 
  Search, 
  Loader2, 
  AlertCircle, 
  CheckCircle,
  FileSpreadsheet,
  X,
  PlusCircle,
  History,
  Info,
  Store,
  FileDown,
  Terminal,
  Copy,
  Database,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCcw,
  User,
  Clock,
  LayoutList
} from 'lucide-react';
import { storage } from '../services/mockStorage';
import { useAuth } from '../context/AuthContext';
import { Product, Business, UserRole, StockMovement } from '../types';
import { formatZAR, formatDate } from '../utils/formatters';

const MISSING_SCHEMA_SQL = `-- 1. Create Products Table
CREATE TABLE IF NOT EXISTS products (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sku text,
  name text NOT NULL,
  description text,
  cost_price numeric DEFAULT 0,
  sale_price numeric DEFAULT 0,
  current_stock int DEFAULT 0,
  category text,
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- 2. Create Stock Movements Ledger (The "Record" Table)
CREATE TABLE IF NOT EXISTS stock_movements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  quantity int NOT NULL,
  type text NOT NULL, -- 'arrival', 'sale', 'adjustment', 'damaged'
  reason text,
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_name text,
  created_at timestamptz DEFAULT now()
);

-- 3. Update Sales for POS
ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS items jsonb DEFAULT '[]';`;

export const Inventory: React.FC = () => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>('');
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSchemaNoticeOpen, setIsSchemaNoticeOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  
  // Context States
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);

  // Form States
  const [formData, setFormData] = useState({
    sku: '', name: '', description: '', costPrice: 0, salePrice: 0, currentStock: 0, category: ''
  });
  const [adjustData, setAdjustData] = useState({
    quantity: 1, reason: '', type: 'arrival' as StockMovement['type']
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const bData = await storage.getBusinesses();
      const filteredBiz = bData.filter(b => 
        user?.role === UserRole.SUPER_ADMIN || 
        user?.role === UserRole.ORG_ADMIN || 
        user?.role === UserRole.ADMIN ||
        user?.assignedBusinessIds?.includes(b.id)
      );
      setBusinesses(filteredBiz);
      if (filteredBiz.length > 0) setSelectedBusinessId(filteredBiz[0].id);
    } catch(e) { console.error(e); } finally { setIsLoading(false); }
  };

  const loadProducts = async () => {
    if (!selectedBusinessId) return;
    try {
      const pData = await storage.getProducts(selectedBusinessId);
      setProducts(pData);
      setIsSchemaNoticeOpen(false);
    } catch (e: any) { 
      if (e.message?.includes('SCHEMA_MISSING')) setIsSchemaNoticeOpen(true);
    }
  };

  useEffect(() => { loadData(); }, [user]);
  useEffect(() => { loadProducts(); }, [selectedBusinessId]);

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBusinessId || isSaving) return;
    setIsSaving(true);
    try {
      const biz = businesses.find(b => b.id === selectedBusinessId);
      await storage.saveProduct({ ...formData, id: editingProduct?.id, businessId: selectedBusinessId, orgId: biz?.orgId });
      await loadProducts();
      setIsModalOpen(false);
    } catch (err: any) { setError(err.message); } finally { setIsSaving(false); }
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct || isSaving) return;
    setIsSaving(true);
    try {
      // If subtracting, we negate the quantity
      const qty = adjustData.type === 'arrival' ? Math.abs(adjustData.quantity) : -Math.abs(adjustData.quantity);
      await storage.recordStockAdjustment(adjustingProduct.id, qty, adjustData.type, adjustData.reason);
      await loadProducts();
      setIsAdjustModalOpen(false);
    } catch (err: any) { alert(err.message); } finally { setIsSaving(false); }
  };

  const openHistory = async (product: Product) => {
    setHistoryProduct(product);
    setIsHistoryModalOpen(true);
    try {
      const data = await storage.getStockMovements(product.id);
      setMovements(data);
    } catch(e) { console.error(e); }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const copySql = () => {
    navigator.clipboard.writeText(MISSING_SCHEMA_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-teal-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-left">
          <h2 className="text-2xl font-bold text-slate-800">Inventory & Stock Ledger</h2>
          <p className="text-slate-500">Track levels, record arrivals, and audit movements</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button onClick={() => setIsImportModalOpen(true)} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-600 px-5 py-2.5 rounded-xl font-bold hover:bg-slate-50 transition-all">
            <FileSpreadsheet size={18} /> Import CSV
          </button>
          <button onClick={() => { setEditingProduct(null); setFormData({ sku: '', name: '', description: '', costPrice: 0, salePrice: 0, currentStock: 0, category: '' }); setIsModalOpen(true); }} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-teal-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg hover:bg-teal-700 transition-all">
            <PlusCircle size={18} /> New Product
          </button>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col md:flex-row items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 min-w-[200px] w-full md:w-auto">
          <Store size={14} className="text-slate-400" />
          <select value={selectedBusinessId} onChange={e => setSelectedBusinessId(e.target.value)} className="bg-transparent text-xs font-black text-slate-700 outline-none cursor-pointer w-full">
            {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input type="text" placeholder="Filter inventory..." className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl outline-none text-sm font-medium" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">SKU</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Name</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Price</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Stock Level</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Manage Stock</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs text-slate-400">{p.sku || '---'}</td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-black text-slate-800 leading-tight">{p.name}</div>
                    <div className="text-[10px] text-slate-400 truncate max-w-[200px]">{p.description}</div>
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-black text-teal-600">{formatZAR(p.salePrice)}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black ${p.currentStock < 10 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      {p.currentStock} in stock
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                       <button onClick={() => { setAdjustingProduct(p); setAdjustData({ quantity: 1, reason: 'Supplier Delivery', type: 'arrival' }); setIsAdjustModalOpen(true); }} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all">
                         <RefreshCcw size={12} /> Adjust
                       </button>
                       <button onClick={() => openHistory(p)} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors" title="View Audit Ledger">
                         <History size={16} />
                       </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => { setEditingProduct(p); setFormData({ ...p }); setIsModalOpen(true); }} className="p-2 text-slate-300 hover:text-teal-600"><Edit3 size={16} /></button>
                      <button onClick={async () => { if(window.confirm('Delete?')) { await storage.deleteProduct(p.id); loadProducts(); } }} className="p-2 text-slate-300 hover:text-rose-600"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjustment Modal */}
      {isAdjustModalOpen && adjustingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsAdjustModalOpen(false)} />
          <form onSubmit={handleAdjustStock} className="bg-white rounded-[2.5rem] w-full max-w-md p-10 relative shadow-2xl space-y-6 text-left">
            <h3 className="text-xl font-black tracking-tight">Record Stock Update</h3>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest -mt-4">Target: {adjustingProduct.name}</p>
            
            <div className="grid grid-cols-2 gap-2">
               <button type="button" onClick={() => setAdjustData({...adjustData, type: 'arrival'})} className={`py-4 rounded-2xl border-2 font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 transition-all ${adjustData.type === 'arrival' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-100 text-slate-400'}`}>
                 <ArrowUpRight size={14}/> Stock Arrival
               </button>
               <button type="button" onClick={() => setAdjustData({...adjustData, type: 'damaged'})} className={`py-4 rounded-2xl border-2 font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 transition-all ${adjustData.type === 'damaged' ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-slate-100 text-slate-400'}`}>
                 <ArrowDownRight size={14}/> Shrinkage
               </button>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Quantity ({adjustData.type === 'arrival' ? '+' : '-'})</label>
              <input type="number" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" value={adjustData.quantity} onChange={e=>setAdjustData({...adjustData, quantity: parseInt(e.target.value) || 0})} />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Internal Reference / Reason</label>
              <input required placeholder="e.g. Supplier Invoice #1029" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" value={adjustData.reason} onChange={e=>setAdjustData({...adjustData, reason: e.target.value})} />
            </div>

            <button disabled={isSaving} type="submit" className="w-full py-4 bg-teal-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl">
              {isSaving ? <Loader2 className="animate-spin mx-auto"/> : 'Log Movement'}
            </button>
          </form>
        </div>
      )}

      {/* History Modal */}
      {isHistoryModalOpen && historyProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsHistoryModalOpen(false)} />
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl p-10 relative shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between mb-6">
               <div className="text-left">
                 <h3 className="text-xl font-black tracking-tight">Movement Ledger</h3>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Audit trail for {historyProduct.name}</p>
               </div>
               <button onClick={() => setIsHistoryModalOpen(false)} className="p-2 text-slate-300 hover:text-slate-900"><X size={24}/></button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-3">
              {movements.map(m => (
                <div key={m.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between group">
                  <div className="flex items-center gap-4 text-left">
                    <div className={`p-2 rounded-lg ${m.quantity > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                      {m.quantity > 0 ? <ArrowUpRight size={18}/> : <ArrowDownRight size={18}/>}
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-800 leading-tight">{m.reason || 'No details provided'}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase tracking-tight"><Clock size={10}/> {formatDate(m.createdAt)}</span>
                        <span className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase tracking-tight"><User size={10}/> {m.userName}</span>
                      </div>
                    </div>
                  </div>
                  <div className={`text-sm font-black ${m.quantity > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                  </div>
                </div>
              ))}
              {movements.length === 0 && (
                <div className="py-20 text-center text-slate-300">
                  <LayoutList size={40} className="mx-auto mb-3 opacity-10" />
                  <p className="text-[10px] font-black uppercase tracking-widest">No movements recorded yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Schema Helper (Updated with stock_movements) */}
      {isSchemaNoticeOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={() => setIsSchemaNoticeOpen(false)} />
          <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] w-full max-w-2xl p-10 relative shadow-2xl space-y-6 text-left">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-rose-600 text-white rounded-2xl shadow-lg"><Terminal size={24} /></div>
              <div>
                 <h3 className="text-xl font-black text-white uppercase tracking-tight">Stock System Migration</h3>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Update required for stock ledger</p>
              </div>
            </div>
            <p className="text-sm text-slate-400">Copy and run this SQL in your Supabase Dashboard to enable the **Stock Movement Ledger** and **Recording** features.</p>
            <div className="relative">
               <pre className="bg-slate-950 p-6 rounded-2xl border border-white/5 text-[11px] font-mono text-indigo-300 overflow-x-auto max-h-[250px]">{MISSING_SCHEMA_SQL}</pre>
               <button onClick={copySql} className="absolute top-4 right-4 bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest">{copied ? 'Copied' : 'Copy SQL'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Standard Product Form (Modal) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <form onSubmit={handleSaveProduct} className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 relative shadow-2xl space-y-5 overflow-y-auto max-h-[90vh] text-left">
            <h3 className="text-2xl font-black tracking-tight">{editingProduct ? 'Edit' : 'Create'} Product</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">SKU</label><input required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" value={formData.sku} onChange={e=>setFormData({...formData, sku: e.target.value})} /></div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Category</label><input className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" value={formData.category} onChange={e=>setFormData({...formData, category: e.target.value})} /></div>
            </div>
            <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Name</label><input required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} /></div>
            <div className="grid grid-cols-3 gap-4">
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Cost</label><input type="number" step="0.01" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" value={formData.costPrice} onChange={e=>setFormData({...formData, costPrice: parseFloat(e.target.value) || 0})} /></div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Price</label><input type="number" step="0.01" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-teal-600" value={formData.salePrice} onChange={e=>setFormData({...formData, salePrice: parseFloat(e.target.value) || 0})} /></div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Stock</label><input type="number" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" value={formData.currentStock} onChange={e=>setFormData({...formData, currentStock: parseInt(e.target.value) || 0})} /></div>
            </div>
            <button disabled={isSaving} type="submit" className="w-full py-4 bg-teal-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl">{isSaving ? <Loader2 className="animate-spin mx-auto"/> : 'Save Product'}</button>
          </form>
        </div>
      )}
    </div>
  );
};
