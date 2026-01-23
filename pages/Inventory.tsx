
import React, { useState, useEffect, useRef } from 'react';
import { 
  Package, 
  Plus, 
  Upload, 
  Download, 
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
  // Added Store icon to fix "Cannot find name 'Store'" error on line 179
  Store
} from 'lucide-react';
import { storage } from '../services/mockStorage';
import { useAuth } from '../context/AuthContext';
import { Product, Business } from '../types';
import { formatZAR } from '../utils/formatters';

export const Inventory: React.FC = () => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>('');
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    description: '',
    costPrice: 0,
    salePrice: 0,
    currentStock: 0,
    category: ''
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const bData = await storage.getBusinesses();
      const filteredBiz = bData.filter(b => user?.role === 'SUPER_ADMIN' || user?.assignedBusinessIds?.includes(b.id));
      setBusinesses(filteredBiz);
      if (filteredBiz.length > 0) setSelectedBusinessId(filteredBiz[0].id);
    } finally {
      setIsLoading(false);
    }
  };

  const loadProducts = async () => {
    if (!selectedBusinessId) return;
    try {
      const pData = await storage.getProducts(selectedBusinessId);
      setProducts(pData);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadData(); }, [user]);
  useEffect(() => { loadProducts(); }, [selectedBusinessId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      const biz = businesses.find(b => b.id === selectedBusinessId);
      await storage.saveProduct({
        ...formData,
        id: editingProduct?.id,
        businessId: selectedBusinessId,
        orgId: biz?.orgId
      });
      await loadProducts();
      setIsModalOpen(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.sku.toLowerCase().includes(search.toLowerCase()) ||
    p.description.toLowerCase().includes(search.toLowerCase())
  );

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const rows = text.split('\n').filter(r => r.trim());
      const headers = rows[0].split(',').map(h => h.trim().toLowerCase());
      
      const importedProducts: Partial<Product>[] = [];
      const biz = businesses.find(b => b.id === selectedBusinessId);

      for (let i = 1; i < rows.length; i++) {
        const values = rows[i].split(',').map(v => v.trim());
        const prod: any = { businessId: selectedBusinessId, orgId: biz?.orgId };
        
        headers.forEach((h, idx) => {
          if (h === 'sku' || h === 'code') prod.sku = values[idx];
          else if (h === 'name') prod.name = values[idx];
          else if (h === 'description') prod.description = values[idx];
          else if (h === 'cost' || h === 'cost_price') prod.costPrice = parseFloat(values[idx]) || 0;
          else if (h === 'price' || h === 'sale_price') prod.salePrice = parseFloat(values[idx]) || 0;
          else if (h === 'stock' || h === 'quantity') prod.currentStock = parseInt(values[idx]) || 0;
          else if (h === 'category') prod.category = values[idx];
        });

        if (prod.name) importedProducts.push(prod);
      }

      if (importedProducts.length > 0) {
        setIsSaving(true);
        try {
          await storage.bulkUpsertProducts(importedProducts as Product[]);
          await loadProducts();
          setIsImportModalOpen(false);
          alert(`Successfully imported ${importedProducts.length} items.`);
        } catch (err: any) {
          alert("Import failed: " + err.message);
        } finally {
          setIsSaving(false);
        }
      }
    };
    reader.readAsText(file);
  };

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-left">
          <h2 className="text-2xl font-bold text-slate-800">Inventory Master</h2>
          <p className="text-slate-500">Manage catalog, stock levels, and procurement</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button 
            onClick={() => setIsImportModalOpen(true)}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-600 px-5 py-2.5 rounded-xl font-bold hover:bg-slate-50 transition-all"
          >
            <FileSpreadsheet size={18} /> Bulk Import
          </button>
          <button 
            onClick={() => {
              setEditingProduct(null);
              setFormData({ sku: '', name: '', description: '', costPrice: 0, salePrice: 0, currentStock: 0, category: '' });
              setIsModalOpen(true);
            }}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-teal-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg hover:bg-teal-700 transition-all"
          >
            <PlusCircle size={18} /> New Product
          </button>
        </div>
      </div>

      {/* Stats / Controls Bar */}
      <div className="flex flex-col md:flex-row items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 min-w-[200px]">
          <Store size={14} className="text-slate-400" />
          <select 
            value={selectedBusinessId} 
            onChange={e => setSelectedBusinessId(e.target.value)}
            className="bg-transparent text-xs font-black text-slate-700 outline-none cursor-pointer w-full"
          >
            {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text" 
            placeholder="Search by SKU, Name or Description..." 
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl outline-none text-sm font-medium"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-6 px-4">
           <div className="text-center">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total Items</p>
              <p className="text-sm font-black text-slate-800">{products.length}</p>
           </div>
           <div className="text-center">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Low Stock</p>
              <p className="text-sm font-black text-rose-600">{products.filter(p => p.currentStock < 10).length}</p>
           </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">SKU/Code</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Product Details</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Category</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Cost (ZAR)</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Price (ZAR)</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Stock</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs text-slate-500">{p.sku || 'N/A'}</td>
                  <td className="px-6 py-4 max-w-xs">
                    <div className="text-sm font-black text-slate-800 leading-tight">{p.name}</div>
                    <div className="text-[10px] text-slate-400 truncate" title={p.description}>{p.description}</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-[9px] font-black uppercase tracking-tight">{p.category || 'Standard'}</span>
                  </td>
                  <td className="px-6 py-4 text-right text-xs font-medium text-slate-400">{formatZAR(p.costPrice)}</td>
                  <td className="px-6 py-4 text-right text-sm font-black text-teal-600">{formatZAR(p.salePrice)}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black ${
                      p.currentStock <= 0 ? 'bg-rose-100 text-rose-600' : 
                      p.currentStock < 10 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                    }`}>
                      {p.currentStock}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => { setEditingProduct(p); setFormData({ ...p }); setIsModalOpen(true); }}
                        className="p-2 text-slate-300 hover:text-indigo-600 transition-colors"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button 
                        onClick={async () => { if(window.confirm('Delete this product?')) { await storage.deleteProduct(p.id); loadProducts(); } }}
                        className="p-2 text-slate-300 hover:text-rose-600 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-slate-400 italic text-sm">No products in inventory.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals: Product Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !isSaving && setIsModalOpen(false)} />
          <form onSubmit={handleSave} className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 relative shadow-2xl space-y-5 overflow-y-auto max-h-[90vh]">
            <h3 className="text-2xl font-black mb-2 text-left tracking-tight">
              {editingProduct ? 'Edit' : 'Create'} Product Record
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="text-left">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 block">SKU / Internal Code</label>
                <input required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none" value={formData.sku} onChange={e=>setFormData({...formData, sku: e.target.value})} />
              </div>
              <div className="text-left">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 block">Category</label>
                <input className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none" placeholder="e.g. Snacks" value={formData.category} onChange={e=>setFormData({...formData, category: e.target.value})} />
              </div>
            </div>

            <div className="text-left">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 block">Product Name</label>
              <input required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none" value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} />
            </div>

            <div className="text-left">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 block">Rich Description (For Search)</label>
              <textarea rows={2} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none" value={formData.description} onChange={e=>setFormData({...formData, description: e.target.value})} />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="text-left">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 block">Cost Price</label>
                <input type="number" step="0.01" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none" value={formData.costPrice} onChange={e=>setFormData({...formData, costPrice: parseFloat(e.target.value) || 0})} />
              </div>
              <div className="text-left">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 block">Sale Price</label>
                <input type="number" step="0.01" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none text-teal-600" value={formData.salePrice} onChange={e=>setFormData({...formData, salePrice: parseFloat(e.target.value) || 0})} />
              </div>
              <div className="text-left">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 block">Initial Stock</label>
                <input type="number" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none" value={formData.currentStock} onChange={e=>setFormData({...formData, currentStock: parseInt(e.target.value) || 0})} />
              </div>
            </div>

            <div className="flex gap-3 pt-6">
              <button type="button" onClick={()=>setIsModalOpen(false)} className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-2xl font-black uppercase text-[10px] tracking-widest">Discard</button>
              <button type="submit" disabled={isSaving} className="flex-1 py-4 bg-teal-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl">
                {isSaving ? <Loader2 className="animate-spin mx-auto" /> : 'Confirm Entry'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CSV Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !isSaving && setIsImportModalOpen(false)} />
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-10 relative shadow-2xl text-center">
             <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <FileSpreadsheet size={40} />
             </div>
             <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Bulk CSV Import</h3>
             <p className="text-sm text-slate-500 font-medium mb-8 leading-relaxed">
               Select a spreadsheet to ingest products. Ensure headers include:<br/>
               <span className="font-bold">Code, Name, Description, Cost, Price, Stock, Category</span>
             </p>

             <div className="space-y-4">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-3 px-6 py-8 border-2 border-dashed border-slate-200 rounded-3xl hover:border-indigo-400 hover:bg-indigo-50 transition-all group"
                >
                   <Upload size={24} className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
                   <div className="text-left">
                      <p className="text-sm font-black text-slate-800">Choose File</p>
                      <p className="text-[10px] font-medium text-slate-400">CSV formatted documents only</p>
                   </div>
                </button>
                <input type="file" ref={fileInputRef} onChange={handleCSVImport} className="hidden" accept=".csv" />
             </div>

             <div className="mt-8 p-4 bg-amber-50 rounded-2xl text-left flex items-start gap-3">
                <Info size={16} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[10px] font-bold text-amber-800 uppercase tracking-tight">
                  Note: Uploading a CSV with existing SKU codes will update the current stock and pricing for those items.
                </p>
             </div>

             <button 
               onClick={() => setIsImportModalOpen(false)}
               className="mt-8 text-[10px] font-black text-slate-400 uppercase tracking-widest"
             >
               Cancel
             </button>
          </div>
        </div>
      )}
    </div>
  );
};
