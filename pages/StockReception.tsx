
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Plus, 
  Trash2, 
  Loader2, 
  Store, 
  Truck, 
  Calendar, 
  FileText, 
  Save, 
  PackageCheck, 
  Barcode, 
  Hash, 
  CheckCircle, 
  AlertCircle, 
  ScanBarcode, 
  X, 
  Database, 
  History, 
  Eye, 
  Filter, 
  Clock 
} from 'lucide-react';
import { storage } from '../services/mockStorage';
import { useAuth } from '../context/AuthContext';
import { Product, Business, Supplier, UserRole, PurchaseOrderItem, PurchaseOrder } from '../types';
import { formatZAR, getLocalISOString, formatDate } from '../utils/formatters';

export const StockReception: React.FC = () => {
  const { user } = useAuth();
  
  // Navigation State
  const [activeTab, setActiveTab] = useState<'reception' | 'log'>('reception');

  // Data State
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseOrder[]>([]);
  
  // UI State
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [schemaError, setSchemaError] = useState(false);
  const [copied, setCopied] = useState(false);

  // Modal States
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isCreatingSupplier, setIsCreatingSupplier] = useState(false);
  const [viewingOrder, setViewingOrder] = useState<PurchaseOrder | null>(null);

  // Forms
  const [newSupplierData, setNewSupplierData] = useState({ name: '', contactPerson: '', phone: '' });
  const [header, setHeader] = useState({
    supplierId: '',
    businessId: '',
    invoiceNumber: '',
    date: getLocalISOString().split('T')[0]
  });
  const [basket, setBasket] = useState<PurchaseOrderItem[]>([]);
  const [searchFields, setSearchFields] = useState({ sku: '', description: '', barcode: '' });

  // Log Filters
  const [logSearch, setLogSearch] = useState('');
  const [logDate, setLogDate] = useState('');

  // Initial Load
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [sData, bData] = await Promise.all([
          storage.getSuppliers(),
          storage.getBusinesses()
        ]);
        
        const filteredBiz = bData.filter(b => 
          user?.role === UserRole.SUPER_ADMIN || 
          user?.role === UserRole.ORG_ADMIN || 
          user?.role === UserRole.ADMIN ||
          user?.assignedBusinessIds?.includes(b.id)
        );

        setSuppliers(sData);
        setBusinesses(filteredBiz);
        
        if (filteredBiz.length > 0 && !header.businessId) {
          setHeader(h => ({ ...h, businessId: filteredBiz[0].id }));
        }
        setSchemaError(false);
      } catch (e: any) {
        console.error("Init Error", e);
        if (e.message?.includes('Could not find the table') || e.code === '42P01') {
          setSchemaError(true);
        }
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [user]);

  // Load History when tab changes
  useEffect(() => {
    if (activeTab === 'log') {
      const fetchHistory = async () => {
        try {
          const history = await storage.getPurchaseOrders();
          setPurchaseHistory(history);
        } catch (e) {
          console.error("Failed to load history", e);
        }
      };
      fetchHistory();
    }
  }, [activeTab]);

  // Load Products when Business Changes (Reception Mode)
  useEffect(() => {
    if (header.businessId && activeTab === 'reception') {
      storage.getProducts(header.businessId).then(setProducts).catch(console.error);
    }
  }, [header.businessId, activeTab]);

  const filteredProducts = useMemo(() => {
    const { sku, barcode, description } = searchFields;
    if (!sku && !barcode && !description) return [];

    const lowerSku = sku.toLowerCase();
    const lowerDesc = description.toLowerCase();
    const lowerBar = barcode.toLowerCase();

    return products.filter(p => {
      const matchSku = !sku || p.sku.toLowerCase().includes(lowerSku);
      const matchDesc = !description || p.description.toLowerCase().includes(lowerDesc);
      const matchBar = !barcode || (p.barcode && p.barcode.toLowerCase().includes(lowerBar));
      return matchSku && matchDesc && matchBar;
    }).slice(0, 8);
  }, [products, searchFields]);

  const filteredHistory = useMemo(() => {
    return purchaseHistory.filter(po => {
      const searchLower = logSearch.toLowerCase();
      
      // Check Invoice Number, Supplier Name, OR any Product Description in the items list
      const matchesSearch = 
        !logSearch || 
        po.invoiceNumber.toLowerCase().includes(searchLower) || 
        po.supplierName.toLowerCase().includes(searchLower) ||
        po.items?.some(item => item.description.toLowerCase().includes(searchLower));
        
      const matchesDate = !logDate || po.date.startsWith(logDate);
      
      // Filter by user assignment
      const userHasAccess = 
        user?.role === UserRole.SUPER_ADMIN || 
        user?.role === UserRole.ORG_ADMIN || 
        user?.role === UserRole.ADMIN || 
        user?.assignedBusinessIds?.includes(po.businessId);

      return matchesSearch && matchesDate && userHasAccess;
    });
  }, [purchaseHistory, logSearch, logDate, user]);

  const addItem = (p: Product) => {
    setBasket(prev => {
      const existing = prev.find(i => i.productId === p.id);
      if (existing) {
        return prev.map(i => i.productId === p.id ? { ...i, quantity: i.quantity + 1, totalCost: (i.quantity + 1) * i.unitCost } : i);
      }
      return [...prev, {
        productId: p.id,
        sku: p.sku,
        description: p.description,
        quantity: 1,
        unitCost: p.costPrice,
        totalCost: p.costPrice
      }];
    });
    setSearchFields({ sku: '', description: '', barcode: '' });
  };

  const updateItem = (productId: string, field: keyof PurchaseOrderItem, value: number) => {
    setBasket(prev => prev.map(item => {
      if (item.productId === productId) {
        const updated = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unitCost') {
          updated.totalCost = updated.quantity * updated.unitCost;
        }
        return updated;
      }
      return item;
    }));
  };

  const removeItem = (productId: string) => {
    setBasket(prev => prev.filter(i => i.productId !== productId));
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreatingSupplier) return;
    setIsCreatingSupplier(true);
    try {
      const currentBiz = businesses.find(b => b.id === header.businessId);
      const saved = await storage.saveSupplier({ ...newSupplierData, orgId: currentBiz?.orgId });
      setSuppliers(prev => [...prev, saved]);
      setHeader(prev => ({ ...prev, supplierId: saved.id }));
      setIsSupplierModalOpen(false);
      setNewSupplierData({ name: '', contactPerson: '', phone: '' });
    } catch (e: any) {
      if (e.message?.includes('relation') || e.code === '42P01') {
        setSchemaError(true);
        setIsSupplierModalOpen(false);
      } else {
        alert("Failed: " + e.message);
      }
    } finally {
      setIsCreatingSupplier(false);
    }
  };

  const invoiceTotal = basket.reduce((sum, item) => sum + item.totalCost, 0);

  const handleSubmit = async () => {
    if (!header.supplierId || !header.businessId || !header.invoiceNumber || basket.length === 0) {
      alert("Please fill in all invoice details and add items.");
      return;
    }
    if (!window.confirm(`Process Stock Arrival?\n\nInvoice Total: ${formatZAR(invoiceTotal)}\nItems: ${basket.length}\n\nThis will update stock levels.`)) return;

    setIsProcessing(true);
    try {
      const supplierName = suppliers.find(s => s.id === header.supplierId)?.name || 'Unknown';
      await storage.savePurchaseOrder({
        ...header,
        supplierName,
        totalAmount: invoiceTotal,
        status: 'received',
        items: basket
      });
      setSuccessMsg("Invoice processed successfully!");
      setBasket([]);
      setHeader(prev => ({ ...prev, invoiceNumber: '' }));
      const updatedProducts = await storage.getProducts(header.businessId);
      setProducts(updatedProducts);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e: any) {
      if (e.message?.includes('relation') || e.code === '42P01') setSchemaError(true);
      else alert("Failed: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const MISSING_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  contact_person text,
  email text,
  phone text,
  tax_id text,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id uuid REFERENCES suppliers(id),
  supplier_name text,
  invoice_number text,
  date timestamptz,
  total_amount numeric,
  status text,
  items jsonb,
  business_id uuid REFERENCES businesses(id),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all authenticated" ON suppliers;
CREATE POLICY "Allow all authenticated" ON suppliers FOR ALL TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow all authenticated" ON purchase_orders;
CREATE POLICY "Allow all authenticated" ON purchase_orders FOR ALL TO authenticated USING (true);
NOTIFY pgrst, 'reload config';`;

  const copySql = () => {
    navigator.clipboard.writeText(MISSING_TABLE_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-teal-600" size={40} /></div>;

  return (
    <div className="flex flex-col gap-6 h-[calc(100vh-140px)]">
      
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end shrink-0 gap-4">
        <div className="text-left">
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Stock Reception</h2>
          <p className="text-slate-500">Manage incoming supplier invoices and inventory</p>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-xl">
           <button 
             onClick={() => setActiveTab('reception')}
             className={`px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'reception' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
           >
             New Reception
           </button>
           <button 
             onClick={() => setActiveTab('log')}
             className={`px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'log' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
           >
             Invoice Log
           </button>
        </div>
      </div>

      {schemaError && (
        <div className="p-8 bg-amber-50 border border-amber-100 rounded-[2rem] flex flex-col md:flex-row items-center gap-8 text-left shrink-0 animate-in slide-in-from-top-4">
           <div className="w-16 h-16 bg-amber-500 text-white rounded-3xl flex items-center justify-center shrink-0 shadow-lg shadow-amber-200">
             <Database size={32} />
           </div>
           <div className="flex-1 space-y-2">
              <h4 className="text-lg font-black text-amber-800 uppercase tracking-tight">Setup Required</h4>
              <p className="text-sm text-amber-700 font-medium leading-relaxed">
                The procurement tables are missing. Please run this SQL script in your Supabase SQL Editor.
              </p>
           </div>
           <div className="flex flex-col gap-2">
             <button onClick={copySql} className="bg-white text-amber-600 border border-amber-200 px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-amber-50 transition-colors">
                {copied ? 'Copied' : 'Copy Script'}
             </button>
             <button onClick={() => setSchemaError(false)} className="text-amber-400 text-[10px] font-bold uppercase tracking-widest hover:underline">Dismiss</button>
           </div>
        </div>
      )}

      {/* VIEW: NEW RECEPTION */}
      {activeTab === 'reception' && (
        <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0 animate-in fade-in slide-in-from-bottom-4">
          {/* LEFT: INVOICE CONFIGURATION */}
          <div className="w-full lg:w-[400px] flex flex-col gap-6 shrink-0 overflow-y-auto">
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-5 text-left">
               <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-teal-50 text-teal-600 rounded-lg"><FileText size={20} /></div>
                  <h3 className="font-bold text-slate-800">Invoice Header</h3>
               </div>

               <div>
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Receiving Business Unit</label>
                 <div className="relative">
                   <Store className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                   <select 
                     className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-sm focus:border-teal-500"
                     value={header.businessId}
                     onChange={e => setHeader({...header, businessId: e.target.value})}
                   >
                     {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                   </select>
                 </div>
               </div>

               <div>
                 <div className="flex justify-between items-center mb-1.5 ml-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Supplier</label>
                    <button 
                      onClick={() => setIsSupplierModalOpen(true)}
                      className="text-[10px] font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1 bg-teal-50 px-2 py-1 rounded-lg transition-colors"
                    >
                      <Plus size={10} /> Quick Add
                    </button>
                 </div>
                 <div className="relative">
                   <Truck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                   <select 
                     className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-sm focus:border-teal-500"
                     value={header.supplierId}
                     onChange={e => setHeader({...header, supplierId: e.target.value})}
                   >
                     <option value="">Select Supplier...</option>
                     {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                   </select>
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Ref #</label>
                   <input 
                     className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-sm focus:border-teal-500"
                     placeholder="e.g. INV-001"
                     value={header.invoiceNumber}
                     onChange={e => setHeader({...header, invoiceNumber: e.target.value})}
                   />
                 </div>
                 <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Date</label>
                   <input 
                     type="date"
                     className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-sm focus:border-teal-500"
                     value={header.date}
                     onChange={e => setHeader({...header, date: e.target.value})}
                   />
                 </div>
               </div>
            </div>

            <div className="bg-slate-900 rounded-[2rem] p-8 text-white shadow-xl mt-auto">
               <div className="flex justify-between items-end mb-6">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Invoice Total</p>
                    <h3 className="text-3xl font-black tracking-tight">{formatZAR(invoiceTotal)}</h3>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Items</p>
                    <p className="text-xl font-bold">{basket.length}</p>
                  </div>
               </div>
               <button 
                 disabled={isProcessing || basket.length === 0}
                 onClick={handleSubmit}
                 className="w-full py-4 bg-teal-500 hover:bg-teal-400 text-white rounded-xl font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-teal-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
               >
                 {isProcessing ? <Loader2 className="animate-spin" /> : <><PackageCheck size={18} /> Process Arrival</>}
               </button>
            </div>
          </div>

          {/* RIGHT: RECEPTION BASKET */}
          <div className="flex-1 flex flex-col bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 relative z-20">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input 
                      placeholder="SKU"
                      className="w-full pl-9 pr-3 py-3 bg-white border border-slate-200 rounded-xl outline-none font-bold text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-sm"
                      value={searchFields.sku}
                      onChange={e => setSearchFields(prev => ({...prev, sku: e.target.value}))}
                    />
                  </div>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input 
                      placeholder="Description"
                      className="w-full pl-9 pr-3 py-3 bg-white border border-slate-200 rounded-xl outline-none font-bold text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-sm"
                      value={searchFields.description}
                      onChange={e => setSearchFields(prev => ({...prev, description: e.target.value}))}
                    />
                  </div>
                  <div className="relative">
                    <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input 
                      autoFocus
                      placeholder="Scan Barcode"
                      className="w-full pl-9 pr-3 py-3 bg-white border border-slate-200 rounded-xl outline-none font-bold text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-sm"
                      value={searchFields.barcode}
                      onChange={e => setSearchFields(prev => ({...prev, barcode: e.target.value}))}
                    />
                  </div>
               </div>

               {(searchFields.sku || searchFields.description || searchFields.barcode) && (
                 <div className="absolute top-full left-0 right-0 mx-4 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden divide-y divide-slate-50 z-30 max-h-[400px] overflow-y-auto ring-4 ring-black/5">
                    {filteredProducts.length > 0 ? filteredProducts.map(p => (
                       <button 
                         key={p.id}
                         onClick={() => addItem(p)}
                         className="w-full px-6 py-3 text-left hover:bg-teal-50 flex items-center justify-between group transition-colors"
                       >
                         <div>
                           <p className="font-bold text-slate-800 text-sm">{p.description}</p>
                           <div className="flex items-center gap-3 text-xs text-slate-400 font-mono mt-0.5">
                              <span>{p.sku}</span>
                              {p.barcode && <span className="flex items-center gap-1"><Barcode size={12}/> {p.barcode}</span>}
                           </div>
                         </div>
                         <div className="text-right">
                           <p className="text-xs font-black text-teal-600">Stock: {p.currentStock}</p>
                           <p className="text-[10px] font-bold text-slate-400">Cost: {formatZAR(p.costPrice)}</p>
                         </div>
                       </button>
                     )) : (
                       <div className="p-8 text-center text-slate-400">
                          <p className="text-xs font-bold uppercase tracking-widest">No matching products found</p>
                       </div>
                     )}
                 </div>
               )}
            </div>

            <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400 sticky top-0">
               <div className="col-span-5">Item Description</div>
               <div className="col-span-2 text-center">Qty Received</div>
               <div className="col-span-2 text-right">Unit Cost</div>
               <div className="col-span-2 text-right">Total</div>
               <div className="col-span-1"></div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
               {successMsg && (
                 <div className="m-4 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-700 font-bold flex items-center gap-3 animate-in zoom-in">
                   <CheckCircle size={20} /> {successMsg}
                 </div>
               )}

               {basket.length === 0 && !successMsg && (
                 <div className="h-full flex flex-col items-center justify-center text-slate-300">
                   <PackageCheck size={48} className="mb-4 opacity-20" />
                   <p className="text-xs font-black uppercase tracking-widest">Basket Empty</p>
                 </div>
               )}

               <div className="space-y-2">
                 {basket.map(item => (
                   <div key={item.productId} className="grid grid-cols-12 gap-4 items-center px-4 py-3 bg-white border border-slate-100 rounded-xl hover:border-teal-200 transition-all shadow-sm group">
                      <div className="col-span-5">
                         <p className="font-bold text-slate-800 text-sm truncate">{item.description}</p>
                         <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                            <Hash size={10} /> {item.sku}
                         </div>
                      </div>
                      <div className="col-span-2">
                         <input 
                           type="number"
                           min="1"
                           className="w-full text-center bg-slate-50 border border-slate-200 rounded-lg py-1.5 text-sm font-bold outline-none focus:border-teal-500"
                           value={item.quantity}
                           onChange={e => updateItem(item.productId, 'quantity', parseInt(e.target.value) || 0)}
                         />
                      </div>
                      <div className="col-span-2">
                         <input 
                           type="number"
                           step="0.01"
                           className="w-full text-right bg-slate-50 border border-slate-200 rounded-lg py-1.5 text-sm font-bold outline-none focus:border-teal-500"
                           value={item.unitCost}
                           onChange={e => updateItem(item.productId, 'unitCost', parseFloat(e.target.value) || 0)}
                         />
                      </div>
                      <div className="col-span-2 text-right">
                         <span className="font-black text-slate-800 text-sm">{formatZAR(item.totalCost)}</span>
                      </div>
                      <div className="col-span-1 text-right">
                         <button onClick={() => removeItem(item.productId)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                           <Trash2 size={16} />
                         </button>
                      </div>
                   </div>
                 ))}
               </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: INVOICE LOG */}
      {activeTab === 'log' && (
        <div className="flex flex-col flex-1 min-h-0 bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4">
           {/* Log Toolbar */}
           <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row items-center gap-4">
              <div className="relative flex-1 w-full">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                 <input 
                   placeholder="Search Invoice #, Supplier or Product..." 
                   className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium"
                   value={logSearch}
                   onChange={e => setLogSearch(e.target.value)}
                 />
              </div>
              <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
                 <Filter size={14} className="text-slate-400" />
                 <input 
                   type="date" 
                   className="bg-transparent text-sm font-medium text-slate-600 outline-none"
                   value={logDate}
                   onChange={e => setLogDate(e.target.value)}
                 />
              </div>
           </div>

           {/* Log Table */}
           <div className="flex-1 overflow-auto">
              <table className="w-full text-left">
                 <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-widest sticky top-0">
                    <tr>
                       <th className="px-6 py-4">Date</th>
                       <th className="px-6 py-4">Invoice #</th>
                       <th className="px-6 py-4">Supplier</th>
                       <th className="px-6 py-4 text-center">Items</th>
                       <th className="px-6 py-4 text-right">Total Amount</th>
                       <th className="px-6 py-4 text-right">Action</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                    {filteredHistory.map(po => (
                       <tr key={po.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4">
                             <div className="flex items-center gap-2 text-slate-600 font-medium text-sm">
                                <Clock size={12} className="text-slate-400" />
                                {formatDate(po.date)}
                             </div>
                          </td>
                          <td className="px-6 py-4">
                             <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded">{po.invoiceNumber}</span>
                          </td>
                          <td className="px-6 py-4 text-sm font-bold text-slate-700">{po.supplierName}</td>
                          <td className="px-6 py-4 text-center text-sm font-medium text-slate-500">{po.items?.length || 0}</td>
                          <td className="px-6 py-4 text-right text-sm font-black text-teal-600">{formatZAR(po.totalAmount)}</td>
                          <td className="px-6 py-4 text-right">
                             <button onClick={() => setViewingOrder(po)} className="p-2 text-slate-300 hover:text-teal-600 transition-colors">
                                <Eye size={18} />
                             </button>
                          </td>
                       </tr>
                    ))}
                    {filteredHistory.length === 0 && (
                       <tr><td colSpan={6} className="py-20 text-center text-slate-400 italic text-sm">No invoice records found</td></tr>
                    )}
                 </tbody>
              </table>
           </div>
        </div>
      )}

      {/* QUICK ADD SUPPLIER MODAL */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !isCreatingSupplier && setIsSupplierModalOpen(false)} />
          <form onSubmit={handleCreateSupplier} className="bg-white rounded-[2.5rem] w-full max-w-sm p-8 relative shadow-2xl space-y-5 text-left">
            <div className="flex justify-between items-center">
               <h3 className="text-xl font-black tracking-tight text-slate-900">New Supplier</h3>
               <button type="button" onClick={() => setIsSupplierModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block ml-1">Company Name</label>
              <input required autoFocus className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-teal-500/20" value={newSupplierData.name} onChange={e=>setNewSupplierData({...newSupplierData, name: e.target.value})} placeholder="Supplier Name" />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block ml-1">Contact Person</label>
              <input className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-teal-500/20" value={newSupplierData.contactPerson} onChange={e=>setNewSupplierData({...newSupplierData, contactPerson: e.target.value})} placeholder="Optional" />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block ml-1">Phone</label>
              <input className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-teal-500/20" value={newSupplierData.phone} onChange={e=>setNewSupplierData({...newSupplierData, phone: e.target.value})} placeholder="Optional" />
            </div>

            <button disabled={isCreatingSupplier} type="submit" className="w-full py-3 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl mt-2">
              {isCreatingSupplier ? <Loader2 className="animate-spin mx-auto"/> : 'Create & Select'}
            </button>
          </form>
        </div>
      )}

      {/* VIEW ORDER DETAILS MODAL */}
      {viewingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setViewingOrder(null)} />
           <div className="bg-white rounded-[2.5rem] w-full max-w-2xl p-8 relative shadow-2xl flex flex-col max-h-[85vh]">
              <div className="flex justify-between items-start mb-6">
                 <div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">Invoice Details</h3>
                    <p className="text-sm font-medium text-slate-500 mt-1">Ref: <span className="font-mono font-bold text-slate-700">{viewingOrder.invoiceNumber}</span></p>
                 </div>
                 <button onClick={() => setViewingOrder(null)} className="p-2 text-slate-300 hover:text-slate-600"><X size={24}/></button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                 <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Supplier</p>
                    <p className="font-bold text-slate-800">{viewingOrder.supplierName}</p>
                 </div>
                 <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Date Processed</p>
                    <p className="font-bold text-slate-800">{formatDate(viewingOrder.date)}</p>
                 </div>
              </div>

              <div className="flex-1 overflow-auto border rounded-xl border-slate-100 mb-6">
                 <table className="w-full text-left">
                    <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest sticky top-0">
                       <tr>
                          <th className="px-4 py-3">Description</th>
                          <th className="px-4 py-3 text-center">Qty</th>
                          <th className="px-4 py-3 text-right">Unit Cost</th>
                          <th className="px-4 py-3 text-right">Total</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-sm">
                       {viewingOrder.items?.map((item, idx) => (
                          <tr key={idx}>
                             <td className="px-4 py-3 font-medium text-slate-700">
                                {item.description}
                                <div className="text-[10px] text-slate-400 font-mono">{item.sku}</div>
                             </td>
                             <td className="px-4 py-3 text-center font-bold text-slate-600">{item.quantity}</td>
                             <td className="px-4 py-3 text-right text-slate-500">{formatZAR(item.unitCost)}</td>
                             <td className="px-4 py-3 text-right font-bold text-slate-800">{formatZAR(item.totalCost)}</td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                 <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Invoice Value</span>
                 <span className="text-2xl font-black text-teal-600">{formatZAR(viewingOrder.totalAmount)}</span>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
