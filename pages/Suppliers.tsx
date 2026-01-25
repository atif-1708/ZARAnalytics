
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Loader2, 
  Edit3, 
  Trash2, 
  Phone, 
  Mail, 
  FileText,
  Truck,
  Building2,
  Database,
  LayoutDashboard,
  Wallet,
  ArrowUpRight,
  TrendingUp,
  PackageCheck,
  X
} from 'lucide-react';
import { storage } from '../services/mockStorage';
import { Supplier, UserRole, PurchaseOrder } from '../types';
import { useAuth } from '../context/AuthContext';
import { formatZAR } from '../utils/formatters';

export const Suppliers: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'directory'>('overview');
  
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [schemaError, setSchemaError] = useState(false);
  const [copied, setCopied] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    taxId: ''
  });

  // Permissions
  const canManage = user?.role === UserRole.ADMIN || user?.role === UserRole.ORG_ADMIN || user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.STAFF;

  const loadData = async () => {
    setLoading(true);
    try {
      const [sData, pData] = await Promise.all([
        storage.getSuppliers(),
        storage.getPurchaseOrders()
      ]);
      setSuppliers(sData);
      setPurchaseOrders(pData);
      setSchemaError(false);
    } catch (e: any) {
      if (e.message?.includes('SCHEMA_MISSING') || e.code === '42P01' || e.message?.includes('Could not find the table')) {
        setSchemaError(true);
      } else {
        console.error(e);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [user]);

  const dashboardStats = useMemo(() => {
    const totalSpend = purchaseOrders.reduce((sum, po) => sum + Number(po.totalAmount), 0);
    const totalPos = purchaseOrders.length;
    
    // Spend by Supplier
    const supplierSpend = new Map<string, number>();
    purchaseOrders.forEach(po => {
      const current = supplierSpend.get(po.supplierId) || 0;
      supplierSpend.set(po.supplierId, current + Number(po.totalAmount));
    });

    const topSuppliers = Array.from(supplierSpend.entries())
      .map(([id, amount]) => {
        const s = suppliers.find(sup => sup.id === id);
        return { id, name: s?.name || 'Unknown', amount };
      })
      .sort((a, b) => b.amount - a.amount);

    return { totalSpend, totalPos, topSuppliers, supplierSpend };
  }, [suppliers, purchaseOrders]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    try {
      await storage.saveSupplier({ 
        ...formData, 
        id: editingSupplier?.id 
      });
      await loadData();
      setIsModalOpen(false);
      setEditingSupplier(null);
      setFormData({ name: '', contactPerson: '', email: '', phone: '', taxId: '' });
    } catch (e: any) {
      if (e.message?.includes('relation') || e.code === '42P01') {
        setSchemaError(true);
        setIsModalOpen(false);
      } else {
        alert("Error: " + e.message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this supplier?")) return;
    try {
      await storage.deleteSupplier(id);
      loadData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const openAdd = () => {
    setEditingSupplier(null);
    setFormData({ name: '', contactPerson: '', email: '', phone: '', taxId: '' });
    setIsModalOpen(true);
  };

  const openEdit = (s: Supplier) => {
    setEditingSupplier(s);
    setFormData({ 
      name: s.name, 
      contactPerson: s.contactPerson || '', 
      email: s.email || '', 
      phone: s.phone || '', 
      taxId: s.taxId || '' 
    });
    setIsModalOpen(true);
  };

  const filtered = suppliers.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    s.contactPerson?.toLowerCase().includes(search.toLowerCase())
  );

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

NOTIFY pgrst, 'reload config';
`;

  const copySql = () => {
    navigator.clipboard.writeText(MISSING_TABLE_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-teal-600" size={40} /></div>;

  return (
    <div className="space-y-8">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="text-left">
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Procurement Hub</h2>
          <p className="text-slate-500">Vendor management and purchasing analytics</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex bg-slate-100 p-1 rounded-xl">
             <button 
               onClick={() => setActiveTab('overview')}
               className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'overview' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
             >
               Overview
             </button>
             <button 
               onClick={() => setActiveTab('directory')}
               className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'directory' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
             >
               Directory
             </button>
          </div>
          
          {canManage && (
             <button 
               onClick={openAdd}
               className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 bg-slate-900 text-white shadow-lg hover:bg-slate-800"
             >
               <Plus size={14} /> Register Vendor
             </button>
           )}
        </div>
      </div>

      {schemaError && (
        <div className="p-8 bg-amber-50 border border-amber-100 rounded-[2rem] flex flex-col md:flex-row items-center gap-8 text-left animate-in slide-in-from-top-4">
           <div className="w-16 h-16 bg-amber-500 text-white rounded-3xl flex items-center justify-center shrink-0 shadow-lg shadow-amber-200">
             <Database size={32} />
           </div>
           <div className="flex-1 space-y-2">
              <h4 className="text-lg font-black text-amber-800 uppercase tracking-tight">Procurement Module Setup</h4>
              <p className="text-sm text-amber-700 font-medium leading-relaxed">
                To use the Supplier and Invoice features, your database needs new tables. Please run this script in your Supabase SQL Editor.
              </p>
           </div>
           <div className="flex flex-col gap-2">
             <button onClick={copySql} className="bg-white text-amber-600 border border-amber-200 px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-amber-50 transition-colors">
                {copied ? 'Copied to Clipboard' : 'Copy SQL Script'}
             </button>
             <button onClick={() => setSchemaError(false)} className="text-amber-400 text-[10px] font-bold uppercase tracking-widest hover:underline">
               Dismiss
             </button>
           </div>
        </div>
      )}

      {/* VIEW: OVERVIEW DASHBOARD */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
           {/* Stat Cards */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex items-center gap-6">
                 <div className="w-16 h-16 bg-teal-50 text-teal-600 rounded-3xl flex items-center justify-center">
                    <Wallet size={32} />
                 </div>
                 <div className="text-left">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Total Procurement</p>
                    <h3 className="text-2xl font-black text-slate-900">{formatZAR(dashboardStats.totalSpend)}</h3>
                 </div>
              </div>
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex items-center gap-6">
                 <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center">
                    <PackageCheck size={32} />
                 </div>
                 <div className="text-left">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Orders Processed</p>
                    <h3 className="text-2xl font-black text-slate-900">{dashboardStats.totalPos}</h3>
                 </div>
              </div>
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex items-center gap-6">
                 <div className="w-16 h-16 bg-slate-50 text-slate-600 rounded-3xl flex items-center justify-center">
                    <Truck size={32} />
                 </div>
                 <div className="text-left">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Active Vendors</p>
                    <h3 className="text-2xl font-black text-slate-900">{suppliers.length}</h3>
                 </div>
              </div>
           </div>

           {/* Top Suppliers List */}
           <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-8 text-left">
              <div className="flex items-center gap-3 mb-6">
                 <div className="p-2 bg-slate-100 rounded-lg text-slate-500"><TrendingUp size={20} /></div>
                 <h3 className="text-lg font-black text-slate-800">Top Suppliers by Volume</h3>
              </div>
              
              <div className="space-y-4">
                 {dashboardStats.topSuppliers.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 italic text-sm">No purchase data available yet.</div>
                 ) : (
                    dashboardStats.topSuppliers.slice(0, 5).map((s, idx) => (
                       <div key={s.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl group hover:bg-teal-50 transition-colors">
                          <div className="flex items-center gap-4">
                             <span className="w-8 h-8 flex items-center justify-center bg-white rounded-xl text-xs font-black text-slate-400 shadow-sm group-hover:text-teal-600">#{idx + 1}</span>
                             <span className="font-bold text-slate-700 group-hover:text-teal-800">{s.name}</span>
                          </div>
                          <span className="font-black text-slate-900 group-hover:text-teal-600">{formatZAR(s.amount)}</span>
                       </div>
                    ))
                 )}
              </div>
           </div>
        </div>
      )}

      {/* VIEW: DIRECTORY LIST */}
      {activeTab === 'directory' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input type="text" placeholder="Search suppliers..." className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl outline-none text-sm font-medium" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(s => {
              const lifetimeSpend = dashboardStats.supplierSpend.get(s.id) || 0;
              return (
                <div key={s.id} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col gap-4 group hover:border-teal-300 transition-all text-left relative overflow-hidden">
                  <div className="flex justify-between items-start relative z-10">
                    <div className="p-3 bg-teal-50 text-teal-600 rounded-2xl">
                      <Truck size={24} />
                    </div>
                    {canManage && (
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(s)} className="p-2 text-slate-300 hover:text-teal-600"><Edit3 size={16} /></button>
                        <button onClick={() => handleDelete(s.id)} className="p-2 text-slate-300 hover:text-rose-600"><Trash2 size={16} /></button>
                      </div>
                    )}
                  </div>
                  <div className="relative z-10">
                    <h3 className="text-lg font-black text-slate-900 leading-tight">{s.name}</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mt-1">{s.contactPerson || 'No Contact'}</p>
                  </div>
                  
                  <div className="bg-slate-50 p-3 rounded-xl relative z-10">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Lifetime Purchases</p>
                     <p className="text-lg font-black text-slate-800">{formatZAR(lifetimeSpend)}</p>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-50 relative z-10">
                    {s.phone && (
                      <div className="flex items-center gap-2 text-slate-600 text-sm">
                        <Phone size={14} className="text-slate-300" /> {s.phone}
                      </div>
                    )}
                    {s.email && (
                      <div className="flex items-center gap-2 text-slate-600 text-sm">
                        <Mail size={14} className="text-slate-300" /> {s.email}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="col-span-full py-20 text-center text-slate-400">
                <Users size={48} className="mx-auto mb-4 opacity-10" />
                <p className="text-xs font-black uppercase tracking-widest">No suppliers found</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Unified Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !isSaving && setIsModalOpen(false)} />
          <form onSubmit={handleSave} className="bg-white rounded-[2.5rem] w-full max-w-md p-10 relative shadow-2xl space-y-5 text-left">
            <div className="flex items-center justify-between mb-2">
               <h3 className="text-2xl font-black tracking-tight text-slate-900">{editingSupplier ? 'Edit Details' : 'New Vendor'}</h3>
               <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
            </div>
            
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block ml-1">Company Name</label>
              <input required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-teal-500/20" value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} placeholder="e.g. Acme Wholesalers" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block ml-1">Contact Person</label>
                <input className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-teal-500/20" value={formData.contactPerson} onChange={e=>setFormData({...formData, contactPerson: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block ml-1">VAT / Tax ID</label>
                <input className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-teal-500/20" value={formData.taxId} onChange={e=>setFormData({...formData, taxId: e.target.value})} />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block ml-1">Phone Number</label>
              <input className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-teal-500/20" value={formData.phone} onChange={e=>setFormData({...formData, phone: e.target.value})} />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block ml-1">Email Address</label>
              <input type="email" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-teal-500/20" value={formData.email} onChange={e=>setFormData({...formData, email: e.target.value})} />
            </div>

            <button disabled={isSaving} type="submit" className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl mt-2 hover:bg-teal-600 transition-all">
              {isSaving ? <Loader2 className="animate-spin mx-auto"/> : (editingSupplier ? 'Save Changes' : 'Create Vendor Profile')}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
