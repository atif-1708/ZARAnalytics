
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
  Boxes,
  Hash,
  Upload,
  FileText
} from 'lucide-react';
import { storage } from '../services/mockStorage';
import { useAuth } from '../context/AuthContext';
import { Product, Business, UserRole, StockMovement } from '../types';
import { formatZAR, formatDate } from '../utils/formatters';

export const MISSING_SCHEMA_SQL = `-- 1. FIX COLUMN TYPES FOR ACCURATE TIMEKEEPING
ALTER TABLE sales ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE sales ALTER COLUMN date TYPE timestamptz USING date::timestamptz;
ALTER TABLE stock_movements ALTER COLUMN created_at TYPE timestamptz USING created_at::timestamptz;

-- 2. UPDATE EXISTING PRODUCTS TABLE
ALTER TABLE products ALTER COLUMN name DROP NOT NULL;
ALTER TABLE products DROP COLUMN IF EXISTS category;

-- 3. ENSURE COLUMNS EXIST
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS is_refunded boolean DEFAULT false;

-- 4. CREATE STOCK MOVEMENTS LEDGER IF MISSING
CREATE TABLE IF NOT EXISTS stock_movements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  quantity int NOT NULL,
  type text NOT NULL,
  reason text,
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_name text,
  created_at timestamptz DEFAULT now()
);

-- 5. ENABLE RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

-- 6. POLICIES
DROP POLICY IF EXISTS "Allow all for authenticated" ON products;
CREATE POLICY "Allow all for authenticated" ON products FOR ALL TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow all for authenticated movements" ON stock_movements;
CREATE POLICY "Allow all for authenticated movements" ON stock_movements FOR ALL TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow all for authenticated sales" ON sales;
CREATE POLICY "Allow all for authenticated sales" ON sales FOR ALL TO authenticated USING (true);`;

export const Inventory: React.FC = () => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>('');
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSchemaNoticeOpen, setIsSchemaNoticeOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);

  const [formData, setFormData] = useState({
    sku: '', description: '', costPrice: 0, salePrice: 0, currentStock: 0
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
      if (filteredBiz.length > 0 && !selectedBusinessId) setSelectedBusinessId(filteredBiz[0].id);
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
      if (err.message?.includes('relation') || err.code === '42P01' || err.message?.includes('violates not-null')) setIsSchemaNoticeOpen(true);
      else alert(err.message); 
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
      if (err.message?.includes('stock_movements') || err.code === '42P01') setIsSchemaNoticeOpen(true);
      else alert("Action failed: " + err.message);
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
    }
  };

  const triggerFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedBusinessId) return;

    setIsSaving(true);
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/);
        if (lines.length < 2) throw new Error("CSV file is empty or missing headers.");

        const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
        const expected = ['sku', 'description', 'costprice', 'saleprice', 'currentstock'];
        
        const missing = expected.filter(exp => !headers.includes(exp));
        if (missing.length > 0) {
          throw new Error(`Missing columns: ${missing.join(', ')}`);
        }

        const biz = businesses.find(b => b.id === selectedBusinessId);
        const importedProducts: Partial<Product>[] = [];

        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          const values = lines[i].split(',').map(v => v.trim());
          const p: any = {
            businessId: selectedBusinessId,
            orgId: biz?.orgId
          };

          headers.forEach((header, index) => {
            if (header === 'sku') p.sku = values[index];
            if (header === 'description') p.description = values[index];
            if (header === 'costprice') p.costPrice = parseFloat(values[index]) || 0;
            if (header === 'saleprice') p.salePrice = parseFloat(values[index]) || 0;
            if (header === 'currentstock') p.currentStock = parseInt(values[index]) || 0;
          });

          if (p.sku) importedProducts.push(p);
        }

        if (importedProducts.length > 0) {
          await storage.bulkUpsertProducts(importedProducts);
          await loadProducts();
          setIsImportModalOpen(false);
          alert(`Successfully imported ${importedProducts.length} items.`);
        }
      } catch (err: any) {
        if (err.message?.includes('violates not-null')) setIsSchemaNoticeOpen(true);
        else alert("Import Error: " + err.message);
      } finally {
        setIsSaving(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsText(file);
  };

  const filteredProducts = products.filter(p => 
    p.sku.toLowerCase().includes(search.toLowerCase()) ||
    p.description.toLowerCase().includes(search.toLowerCase())
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
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Stock Inventory Ledger</h2>
          <p className="text-slate-500">Record item arrivals, manage stock levels, and audit SKU movements</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button 
            onClick={() => setIsImportModalOpen(true)} 
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-600 px-5 py-2.5 rounded-xl font-bold hover:bg-slate-50 transition-all"
          >
            <FileSpreadsheet size={18} /> Bulk CSV
          </button>
          <button onClick={() => { setEditingProduct(null); setFormData({ sku: '', description: '', costPrice: 0, salePrice: 0, currentStock: 0 }); setIsModalOpen(true); }} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg hover:bg-slate-800 transition-all">
            <PlusCircle size={18} /> New SKU
          </button>
        </div>
      </div>

      {isSchemaNoticeOpen && (
        <div className="p-8 bg-rose-50 border border-rose-100 rounded-[2rem] flex flex-col md:flex-row items-center gap-8 animate-in slide-in-from-top-4 text-left">
           <div className="w-16 h-16 bg-rose-600 text-white rounded-3xl flex items-center justify-center shrink-0 shadow-lg shadow-rose-200">
             <Database size={32} />
           </div>
           <div className="flex-1 space-y-2">
              <h4 className="text-lg font-black text-rose-800 uppercase tracking-tight">System Update Required</h4>
              <p className="text-sm text-rose-600 font-medium leading-relaxed">
                We've detected an issue with your database structure (likely the Date format is preventing accurate time tracking). Please run this updated SQL script in your Supabase SQL Editor to fix the timestamp columns.
              </p>
           </div>
           <div className="flex flex-col gap-2">
             <button onClick={copySql} className="bg-white text-rose-600 border border-rose-200 px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-rose-50 transition-colors">
                {copied ? 'Copied to Clipboard' : 'Copy Repair Script'}
             </button>
             <button onClick={() => setIsSchemaNoticeOpen(false)} className="text-rose-400 text-[10px] font-bold uppercase tracking-widest hover:underline">
               Dismiss Notice
             </button>
           </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 min-w-[200px] w-full md:w-auto">
          <Store size={14} className="text-slate-400" />
          <select value={selectedBusinessId} onChange={e => setSelectedBusinessId(e.target.value)} className="bg-transparent text-xs font-black text-slate-700 outline-none cursor-pointer w-full">
            {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input type="text" placeholder="Search SKU or Description..." className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl outline-none text-sm font-medium" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">SKU / BARCODE</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">ITEM DESCRIPTION</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">COST PRICE</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">UNIT PRICE</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">CURRENT STOCK</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">MANAGEMENT</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                       <Hash size={14} className="text-slate-300" />
                       <span className="font-mono text-sm font-black text-slate-800">{p.sku}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-slate-600 max-w-xs truncate">{p.description || 'No description provided'}</p>
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-slate-500">{formatZAR(p.costPrice)}</td>
                  <td className="px-6 py-4 text-right text-sm font-black text-teal-600">{formatZAR(p.salePrice)}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black border ${p.currentStock < 10 ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                      {p.currentStock} Units
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                       <button onClick={() => { setAdjustingProduct(p); setAdjustData({ quantity: 1, reason: 'Stock Arrival', type: 'arrival' }); setIsAdjustModalOpen(true); }} className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-xl text-[10px] font-black uppercase shadow-md hover:bg-teal-700 transition-all">
                         <ArrowUpRight size={14} /> Update
                       </button>
                       <button onClick={() => openHistory(p)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors" title="View Movement Ledger">
                         <History size={18} />
                       </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => { setEditingProduct(p); setFormData({ ...p }); setIsModalOpen(true); }} className="p-2 text-slate-300 hover:text-teal-600 transition-colors"><Edit3 size={16} /></button>
                      <button onClick={async () => { if(window.confirm('Delete this item?')) { await storage.deleteProduct(p.id); loadProducts(); } }} className="p-2 text-slate-300 hover:text-rose-600 transition-colors"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                   <td colSpan={7} className="py-20 text-center text-slate-400 italic text-sm">
                      <Package size={40} className="mx-auto mb-3 opacity-10" />
                      No items found in this business unit.
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CSV Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !isSaving && setIsImportModalOpen(false)} />
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 relative shadow-2xl space-y-6 text-left border border-slate-100">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center shadow-inner">
                 <FileSpreadsheet size={28} />
              </div>
              <div>
                <h3 className="text-2xl font-black tracking-tight text-slate-900">Bulk SKU Import</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Upload inventory via CSV file</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4">
               <div className="flex items-start gap-3">
                  <Info size={16} className="text-teal-600 shrink-0 mt-1" />
                  <p className="text-xs font-bold text-slate-600 leading-relaxed">
                    Your CSV must include these exact headers:
                    <code className="block mt-2 bg-white p-2 border border-slate-200 rounded-lg text-teal-700 font-mono">
                      sku, description, costPrice, salePrice, currentStock
                    </code>
                  </p>
               </div>
            </div>

            <div className="flex flex-col gap-4">
               <input 
                 type="file" 
                 ref={fileInputRef} 
                 className="hidden" 
                 accept=".csv" 
                 onChange={handleFileUpload} 
               />
               <button 
                 disabled={isSaving}
                 onClick={triggerFilePicker}
                 className="w-full py-10 border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center gap-4 hover:border-teal-500 hover:bg-teal-50 transition-all group"
               >
                 {isSaving ? (
                    <Loader2 className="animate-spin text-teal-600" size={32} />
                 ) : (
                    <>
                      <div className="w-12 h-12 bg-white border border-slate-100 rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                        <Upload size={20} className="text-slate-400 group-hover:text-teal-600" />
                      </div>
                      <div className="text-center">
                         <p className="text-sm font-black text-slate-700">Click to upload CSV</p>
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Max file size 5MB</p>
                      </div>
                    </>
                 )}
               </button>
            </div>

            <div className="flex justify-between items-center pt-4">
               <button onClick={() => setIsImportModalOpen(false)} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600">Cancel</button>
               <a 
                 href={`data:text/csv;charset=utf-8,${encodeURIComponent('sku,description,costPrice,salePrice,currentStock\nPRD-001,Example Item Description,100,250,50')}`}
                 download="template.csv"
                 className="flex items-center gap-2 text-[10px] font-black text-teal-600 uppercase tracking-widest hover:text-teal-700"
               >
                 <FileText size={14}/> Download Template
               </a>
            </div>
          </div>
        </div>
      )}

      {/* Adjustment Modal */}
      {isAdjustModalOpen && adjustingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsAdjustModalOpen(false)} />
          <form onSubmit={handleAdjustStock} className="bg-white rounded-[2.5rem] w-full max-w-md p-10 relative shadow-2xl space-y-6 text-left border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center shadow-inner"><Boxes size={24} /></div>
              <div>
                <h3 className="text-xl font-black tracking-tight text-slate-900 leading-none">Stock Movement</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">SKU: {adjustingProduct.sku}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
               <button type="button" onClick={() => setAdjustData({...adjustData, type: 'arrival'})} className={`py-4 rounded-2xl border-2 font-black uppercase text-[10px] tracking-widest flex flex-col items-center justify-center gap-2 transition-all ${adjustData.type === 'arrival' ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-slate-100 text-slate-400'}`}>
                 <ArrowUpRight size={20}/> Arrival
               </button>
               <button type="button" onClick={() => setAdjustData({...adjustData, type: 'damaged'})} className={`py-4 rounded-2xl border-2 font-black uppercase text-[10px] tracking-widest flex flex-col items-center justify-center gap-2 transition-all ${adjustData.type === 'damaged' ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-slate-100 text-slate-400'}`}>
                 <ArrowDownRight size={20}/> Shrinkage
               </button>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Quantity</label>
              <input type="number" required min="1" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-lg outline-none" value={adjustData.quantity} onChange={e=>setAdjustData({...adjustData, quantity: parseInt(e.target.value) || 0})} />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Update Reason</label>
              <input required placeholder="e.g. Supplier Invoice #1029" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" value={adjustData.reason} onChange={e=>setAdjustData({...adjustData, reason: e.target.value})} />
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
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl p-10 relative shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between mb-8">
               <div className="text-left flex items-center gap-4">
                 <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><History size={24}/></div>
                 <div>
                   <h3 className="text-xl font-black tracking-tight text-slate-900 leading-none">Movement Ledger</h3>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Audit trail for SKU: {historyProduct.sku}</p>
                 </div>
               </div>
               <button onClick={() => setIsHistoryModalOpen(false)} className="p-2 text-slate-300 hover:text-slate-900 transition-colors"><X size={24}/></button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
              {movements.map(m => (
                <div key={m.id} className="p-5 bg-slate-50 border border-slate-100 rounded-3xl flex items-center justify-between group">
                  <div className="flex items-center gap-5 text-left">
                    <div className={`p-3 rounded-2xl ${m.quantity > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                      {m.quantity > 0 ? <ArrowUpRight size={20}/> : <ArrowDownRight size={20}/>}
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-800 leading-tight">{m.reason || 'Manual Adjustment'}</p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
                        <span className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-tight"><Clock size={12}/> {formatDate(m.createdAt)}</span>
                        <span className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-tight"><User size={12}/> {m.userName}</span>
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
                  <p className="text-[10px] font-black uppercase tracking-widest">No history recorded</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Product Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <form onSubmit={handleSaveProduct} className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 relative shadow-2xl space-y-5 overflow-y-auto max-h-[90vh] text-left">
            <h3 className="text-2xl font-black tracking-tight text-slate-900">{editingProduct ? 'Edit' : 'Create'} Stock Item</h3>
            
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block ml-1">SKU / Unique Identifier</label>
              <input required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-indigo-500/20" value={formData.sku} onChange={e=>setFormData({...formData, sku: e.target.value})} />
            </div>
            
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block ml-1">Technical Description</label>
              <textarea rows={3} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-indigo-500/20" value={formData.description} onChange={e=>setFormData({...formData, description: e.target.value})} />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Cost</label><input type="number" step="0.01" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" value={formData.costPrice} onChange={e=>setFormData({...formData, costPrice: parseFloat(e.target.value) || 0})} /></div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Price</label><input type="number" step="0.01" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-teal-600" value={formData.salePrice} onChange={e=>setFormData({...formData, salePrice: parseFloat(e.target.value) || 0})} /></div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Stock</label><input type="number" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" value={formData.currentStock} onChange={e=>setFormData({...formData, currentStock: parseInt(e.target.value) || 0})} /></div>
            </div>
            <button disabled={isSaving} type="submit" className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl">
              {isSaving ? <Loader2 className="animate-spin mx-auto"/> : 'Save Product Record'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
