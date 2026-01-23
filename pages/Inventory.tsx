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
  Download,
  Terminal,
  Copy,
  Database,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCcw,
  User,
  Clock,
  LayoutList,
  Boxes
} from 'lucide-react';
import { storage } from '../services/mockStorage';
import { useAuth } from '../context/AuthContext';
import { Product, Business, UserRole, StockMovement } from '../types';
import { formatZAR, formatDate } from '../utils/formatters';

const MISSING_SCHEMA_SQL = `-- 1. CREATE PRODUCTS TABLE
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

-- 2. CREATE STOCK MOVEMENTS LEDGER (REQUIRED FOR UPDATES)
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

-- 3. ENABLE RLS (Row Level Security)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- 4. CREATE SIMPLE POLICIES (Allow all authenticated users for now)
CREATE POLICY "Allow all for authenticated" ON products FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated movements" ON stock_movements FOR ALL TO authenticated USING (true);`;

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
      if (filteredBiz.length > 0) {
        if (!selectedBusinessId) setSelectedBusinessId(filteredBiz[0].id);
      }
    } catch(e) { console.error(e); } finally { setIsLoading(false); }
  };

  const loadProducts = async () => {
    if (!selectedBusinessId) return;
    try {
      const pData = await storage.getProducts(selectedBusinessId);
      setProducts(pData);
      setIsSchemaNoticeOpen(false);
    } catch (e: any) { 
      if (e.message?.includes('SCHEMA_MISSING') || e.code === '42P01') setIsSchemaNoticeOpen(true);
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
    } catch (err: any) { 
      if (err.message?.includes('stock_movements') || err.message?.includes('products') || err.code === '42P01') {
        setIsSchemaNoticeOpen(true);
      } else {
        alert(err.message); 
      }
    } finally { setIsSaving(false); }
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct || isSaving) return;
    setIsSaving(true);
    try {
      const qty = adjustData.type === 'arrival' ? Math.abs(adjustData.quantity) : -Math.abs(adjustData.quantity);
      await storage.recordStockAdjustment(adjustingProduct.id, qty, adjustData.type, adjustData.reason);
      await loadProducts();
      setIsAdjustModalOpen(false);
    } catch (err: any) { 
      console.error("Adjustment Error:", err);
      // Auto-trigger schema notice if the ledger table is missing
      if (err.message?.includes('stock_movements') || err.message?.includes('relation') || err.code === '42P01') {
        setIsSchemaNoticeOpen(true);
      } else {
        alert("Action failed: " + err.message);
      }
    } finally { setIsSaving(false); }
  };

  const openHistory = async (product: Product) => {
    setHistoryProduct(product);
    setIsHistoryModalOpen(true);
    try {
      const data = await storage.getStockMovements(product.id);
      setMovements(data);
    } catch(e: any) { 
      if (e.message?.includes('stock_movements') || e.code === '42P01') setIsSchemaNoticeOpen(true);
      console.error(e); 
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.sku.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  );

  const copySql = () => {
    navigator.clipboard.writeText(MISSING_SCHEMA_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-teal-600" size={40} /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-left">
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Inventory & Stock Master</h2>
          <p className="text-slate-500">Update stock levels, record arrivals, and audit movements</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button onClick={() => setIsImportModalOpen(true)} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-600 px-5 py-2.5 rounded-xl font-bold hover:bg-slate-50 transition-all">
            <FileSpreadsheet size={18} /> Bulk CSV
          </button>
          <button onClick={() => { setEditingProduct(null); setFormData({ sku: '', name: '', description: '', costPrice: 0, salePrice: 0, currentStock: 0, category: '' }); setIsModalOpen(true); }} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg hover:bg-slate-800 transition-all">
            <PlusCircle size={18} /> Add Product
          </button>
        </div>
      </div>

      {isSchemaNoticeOpen && (
        <div className="p-8 bg-rose-50 border border-rose-100 rounded-[2rem] flex flex-col md:flex-row items-center gap-8 animate-in slide-in-from-top-4 text-left">
           <div className="w-16 h-16 bg-rose-600 text-white rounded-3xl flex items-center justify-center shrink-0 shadow-lg shadow-rose-200">
             <Database size={32} />
           </div>
           <div className="flex-1 space-y-2">
              <h4 className="text-lg font-black text-rose-800 uppercase tracking-tight">Stock Tables Required</h4>
              <p className="text-sm text-rose-600 font-medium leading-relaxed">
                The <span className="font-bold">stock_movements</span> table is missing. You cannot record stock arrivals or adjustments until this table is created. Click "Setup Database" below to fix this.
              </p>
           </div>
           <button 
              onClick={() => setIsSchemaNoticeOpen(true)}
              className="bg-rose-600 text-white px-6 py-3 rounded-xl font-bold text-xs shadow-lg hover:bg-rose-700 transition-colors uppercase tracking-widest"
           >
             Setup Database
           </button>
        </div>
      )}

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
          <input type="text" placeholder="Filter by name, SKU or category..." className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl outline-none text-sm font-medium" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">SKU/Code</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Product Details</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Selling Price</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Current Stock</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Stock Management</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs text-slate-400">{p.sku || '---'}</td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-black text-slate-800 leading-tight">{p.name}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{p.category || 'Uncategorized'}</div>
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-black text-slate-900">{formatZAR(p.salePrice)}</td>
                  <td className="px-6 py-4 text-center">
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black border ${p.currentStock < 10 ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                      <Boxes size={12} />
                      {p.currentStock} Units
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                       <button 
                         onClick={() => { setAdjustingProduct(p); setAdjustData({ quantity: 1, reason: 'Stock Arrival', type: 'arrival' }); setIsAdjustModalOpen(true); }} 
                         className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-xl text-[10px] font-black uppercase shadow-md hover:bg-teal-700 hover:scale-105 transition-all"
                       >
                         <ArrowUpRight size={14} /> Update Stock
                       </button>
                       <button onClick={() => openHistory(p)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors" title="View Movement Ledger">
                         <History size={18} />
                       </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => { setEditingProduct(p); setFormData({ ...p }); setIsModalOpen(true); }} className="p-2 text-slate-300 hover:text-teal-600 transition-colors"><Edit3 size={16} /></button>
                      <button onClick={async () => { if(window.confirm('Delete this product?')) { await storage.deleteProduct(p.id); loadProducts(); } }} className="p-2 text-slate-300 hover:text-rose-600 transition-colors"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                   <td colSpan={6} className="py-20 text-center text-slate-400 italic text-sm">
                      <Package size={40} className="mx-auto mb-3 opacity-10" />
                      No products found. Start by adding a product or importing via CSV.
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjustment Modal (RECORD OPTION) */}
      {isAdjustModalOpen && adjustingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsAdjustModalOpen(false)} />
          <form onSubmit={handleAdjustStock} className="bg-white rounded-[2.5rem] w-full max-w-md p-10 relative shadow-2xl space-y-6 text-left border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center shadow-inner">
                 <Boxes size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black tracking-tight text-slate-900 leading-none">Stock Movement Record</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Item: {adjustingProduct.name}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
               <button type="button" onClick={() => setAdjustData({...adjustData, type: 'arrival'})} className={`py-4 rounded-2xl border-2 font-black uppercase text-[10px] tracking-widest flex flex-col items-center justify-center gap-2 transition-all ${adjustData.type === 'arrival' ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' : 'border-slate-100 text-slate-400 bg-slate-50'}`}>
                 <ArrowUpRight size={20}/>
                 Stock Arrival
               </button>
               <button type="button" onClick={() => setAdjustData({...adjustData, type: 'damaged'})} className={`py-4 rounded-2xl border-2 font-black uppercase text-[10px] tracking-widest flex flex-col items-center justify-center gap-2 transition-all ${adjustData.type === 'damaged' ? 'border-rose-500 bg-rose-50 text-rose-700 shadow-md' : 'border-slate-100 text-slate-400 bg-slate-50'}`}>
                 <ArrowDownRight size={20}/>
                 Shrinkage / Damage
               </button>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Quantity ({adjustData.type === 'arrival' ? 'Incoming Units' : 'Lost Units'})</label>
              <input type="number" required min="1" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-lg outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 transition-all" value={adjustData.quantity} onChange={e=>setAdjustData({...adjustData, quantity: parseInt(e.target.value) || 0})} />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Update Reason / Reference</label>
              <input required placeholder="e.g. Received from Supplier X" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 transition-all" value={adjustData.reason} onChange={e=>setAdjustData({...adjustData, reason: e.target.value})} />
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setIsAdjustModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest">Discard</button>
              <button disabled={isSaving} type="submit" className="flex-[2] py-4 bg-teal-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-teal-600/20 hover:bg-teal-700 transition-all flex items-center justify-center gap-2">
                {isSaving ? <Loader2 className="animate-spin"/> : <><CheckCircle size={14}/> Save Record</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* History Modal */}
      {isHistoryModalOpen && historyProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsHistoryModalOpen(false)} />
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl p-10 relative shadow-2xl flex flex-col max-h-[85vh] border border-slate-100">
            <div className="flex items-center justify-between mb-8">
               <div className="text-left flex items-center gap-4">
                 <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><History size={24}/></div>
                 <div>
                   <h3 className="text-xl font-black tracking-tight text-slate-900 leading-none">Movement Ledger</h3>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Audit trail for {historyProduct.name}</p>
                 </div>
               </div>
               <button onClick={() => setIsHistoryModalOpen(false)} className="p-2 text-slate-300 hover:text-slate-900 transition-colors"><X size={24}/></button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
              {movements.map(m => (
                <div key={m.id} className="p-5 bg-slate-50 border border-slate-100 rounded-3xl flex items-center justify-between group hover:bg-white hover:shadow-md transition-all">
                  <div className="flex items-center gap-5 text-left">
                    <div className={`p-3 rounded-2xl ${m.quantity > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                      {m.quantity > 0 ? <ArrowUpRight size={20}/> : <ArrowDownRight size={20}/>}
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-800 leading-tight">{m.reason || 'Manual Adjustment'}</p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
                        <span className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-tight"><Clock size={12}/> {formatDate(m.createdAt)}</span>
                        <span className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-tight"><User size={12}/> {m.userName}</span>
                        <span className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[8px] font-black text-slate-400 uppercase">{m.type}</span>
                      </div>
                    </div>
                  </div>
                  <div className={`text-lg font-black ${m.quantity > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                  </div>
                </div>
              ))}
              {movements.length === 0 && (
                <div className="py-24 text-center text-slate-300">
                  <LayoutList size={56} className="mx-auto mb-4 opacity-5" />
                  <p className="text-[10px] font-black uppercase tracking-widest">No movement history found for this product</p>
                </div>
              )}
            </div>
            
            <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
               <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Movements: {movements.length}</div>
               <button className="flex items-center gap-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-700">
                 <Download size={14}/> Export Ledger
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Schema Helper Modal */}
      {isSchemaNoticeOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={() => setIsSchemaNoticeOpen(false)} />
          <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] w-full max-w-2xl p-10 relative shadow-2xl space-y-6 text-left">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-rose-600 text-white rounded-2xl shadow-lg"><Terminal size={24} /></div>
              <div>
                 <h3 className="text-xl font-black text-white uppercase tracking-tight">Database Migration Required</h3>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Stock Ledger System Setup</p>
              </div>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">To enable <b>Stock Updating</b> and the <b>Ledger History</b>, you must run the following SQL in your Supabase Dashboard. This creates the necessary tables to record arrivals and adjustments.</p>
            <div className="relative group">
               <pre className="bg-slate-950 p-6 rounded-2xl border border-white/5 text-[11px] font-mono text-indigo-300 overflow-x-auto max-h-[300px] leading-relaxed">
                 {MISSING_SCHEMA_SQL}
               </pre>
               <button 
                 onClick={copySql}
                 className="absolute top-4 right-4 flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-xl"
               >
                 {copied ? <><CheckCircle size={14} /> Copied</> : <><Copy size={14} /> Copy SQL</>}
               </button>
            </div>
            <div className="flex flex-col md:flex-row items-center justify-between pt-4 gap-4">
               <div className="flex items-center gap-3 text-slate-500">
                  <Info size={16} className="text-indigo-500" />
                  <p className="text-[10px] font-bold uppercase tracking-tight">Paste into Supabase SQL Editor and run.</p>
               </div>
               <button 
                  onClick={() => setIsSchemaNoticeOpen(false)}
                  className="w-full md:w-auto px-8 py-4 bg-white text-slate-900 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-50 transition-all"
               >
                 I've Run the SQL
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <form onSubmit={handleSaveProduct} className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 relative shadow-2xl space-y-5 overflow-y-auto max-h-[90vh] text-left">
            <h3 className="text-2xl font-black tracking-tight text-slate-900">{editingProduct ? 'Modify' : 'Create'} Catalog Item</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block ml-1">SKU / ID</label>
                <input required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-indigo-500/20" value={formData.sku} onChange={e=>setFormData({...formData, sku: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block ml-1">Category</label>
                <input className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-indigo-500/20" value={formData.category} onChange={e=>setFormData({...formData, category: e.target.value})} />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block ml-1">Product Name</label>
              <input required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-indigo-500/20" value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block ml-1">Description</label>
              <textarea rows={2} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-indigo-500/20" value={formData.description} onChange={e=>setFormData({...formData, description: e.target.value})} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Cost</label><input type="number" step="0.01" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" value={formData.costPrice} onChange={e=>setFormData({...formData, costPrice: parseFloat(e.target.value) || 0})} /></div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Price</label><input type="number" step="0.01" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-teal-600" value={formData.salePrice} onChange={e=>setFormData({...formData, salePrice: parseFloat(e.target.value) || 0})} /></div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Stock</label><input type="number" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" value={formData.currentStock} onChange={e=>setFormData({...formData, currentStock: parseInt(e.target.value) || 0})} /></div>
            </div>
            <button disabled={isSaving} type="submit" className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-slate-800 transition-all">
              {isSaving ? <Loader2 className="animate-spin mx-auto"/> : 'Save Catalog Entry'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};