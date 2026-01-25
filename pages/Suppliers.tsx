
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
  Truck,
  Database,
  Wallet,
  TrendingUp,
  PackageCheck,
  X,
  FileText,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Clock
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { storage } from '../services/mockStorage';
import { Supplier, UserRole, PurchaseOrder } from '../types';
import { useAuth } from '../context/AuthContext';
import { formatZAR, formatDate } from '../utils/formatters';

export const Suppliers: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'directory'>('overview');
  
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Chart Toggle State
  const [chartView, setChartView] = useState<'daily' | 'monthly'>('monthly');
  
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
      if (e.message?.includes('SCHEMA_MISSING') || e.code === '42P01' || e.message?.includes('Could not find the table') || e.message?.includes('relation "suppliers" does not exist')) {
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
    const now = new Date();
    const currentMonthPrefix = now.toISOString().slice(0, 7); // YYYY-MM
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthPrefix = lastMonthDate.toISOString().slice(0, 7);

    const totalSpend = purchaseOrders.reduce((sum, po) => sum + Number(po.totalAmount), 0);
    const totalPos = purchaseOrders.length;
    
    // Monthly metrics
    const thisMonthSpend = purchaseOrders
      .filter(po => po.date.startsWith(currentMonthPrefix))
      .reduce((sum, po) => sum + Number(po.totalAmount), 0);

    const lastMonthSpend = purchaseOrders
      .filter(po => po.date.startsWith(lastMonthPrefix))
      .reduce((sum, po) => sum + Number(po.totalAmount), 0);

    const trend = lastMonthSpend > 0 
      ? ((thisMonthSpend - lastMonthSpend) / lastMonthSpend) * 100 
      : 0;

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

    // Recent Arrivals (Last 5)
    const recentArrivals = [...purchaseOrders]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5)
      .map(po => ({
        ...po,
        supplierName: suppliers.find(s => s.id === po.supplierId)?.name || po.supplierName || 'Unknown'
      }));

    // Chart Data Generation
    let chartData = [];
    if (chartView === 'monthly') {
      // Last 12 Months
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const yyyymm = d.toISOString().slice(0, 7);
        const label = d.toLocaleDateString('en-ZA', { month: 'short', year: '2-digit' });
        
        const total = purchaseOrders
          .filter(po => po.date.startsWith(yyyymm))
          .reduce((sum, po) => sum + Number(po.totalAmount), 0);
          
        chartData.push({ name: label, value: total });
      }
    } else {
      // Last 30 Days
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const yyyymmdd = d.toISOString().slice(0, 10);
        const label = d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
        
        const total = purchaseOrders
          .filter(po => po.date.startsWith(yyyymmdd))
          .reduce((sum, po) => sum + Number(po.totalAmount), 0);
          
        chartData.push({ name: label, value: total });
      }
    }

    return { 
      totalSpend, 
      totalPos, 
      topSuppliers, 
      supplierSpend, 
      thisMonthSpend,
      trend,
      recentArrivals,
      chartData
    };
  }, [suppliers, purchaseOrders, chartView]);

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
-- 1. Suppliers Table
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

-- 2. Purchase Orders Table
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

-- 3. Security Policies
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
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Vendor Management</h2>
          <p className="text-slate-500">Manage supplier directory and purchasing history</p>
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
               <Plus size={14} /> New Vendor
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
              <h4 className="text-lg font-black text-amber-800 uppercase tracking-tight">Database Setup Required</h4>
              <p className="text-sm text-amber-700 font-medium leading-relaxed">
                The 'suppliers' table is missing. Run this SQL script in your Supabase SQL Editor to enable the Vendor Management module.
              </p>
           </div>
           <div className="flex flex-col gap-2">
             <button onClick={copySql} className="bg-white text-amber-600 border border-amber-200 px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-amber-50 transition-colors">
                {copied ? 'Copied' : 'Copy SQL Script'}
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
           {/* Row 1: High Level KPIs */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex items-center gap-6">
                 <div className="w-16 h-16 bg-teal-50 text-teal-600 rounded-3xl flex items-center justify-center">
                    <Wallet size={32} />
                 </div>
                 <div className="text-left">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Lifetime Spend</p>
                    <h3 className="text-2xl font-black text-slate-900">{formatZAR(dashboardStats.totalSpend)}</h3>
                 </div>
              </div>
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex items-center gap-6">
                 <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center">
                    <BarChart3 size={32} />
                 </div>
                 <div className="text-left">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">This Month</p>
                    <div className="flex items-center gap-2">
                       <h3 className="text-2xl font-black text-slate-900">{formatZAR(dashboardStats.thisMonthSpend)}</h3>
                       {dashboardStats.trend !== 0 && (
                         <div className={`px-2 py-0.5 rounded-full text-[9px] font-black flex items-center gap-0.5 ${dashboardStats.trend > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                            {dashboardStats.trend > 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                            {Math.abs(dashboardStats.trend).toFixed(0)}%
                         </div>
                       )}
                    </div>
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

           {/* Row 2: Charts & Top List */}
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left: Procurement Chart */}
              <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-8 flex flex-col">
                 <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                       <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><TrendingUp size={20} /></div>
                       <h3 className="text-lg font-black text-slate-800">Procurement Trends</h3>
                    </div>
                    <div className="flex bg-slate-50 p-1 rounded-xl">
                       <button onClick={() => setChartView('daily')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${chartView === 'daily' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Daily</button>
                       <button onClick={() => setChartView('monthly')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${chartView === 'monthly' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Monthly</button>
                    </div>
                 </div>
                 <div className="flex-1 min-h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={dashboardStats.chartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontWeight: 700 }} dy={10} />
                          <YAxis fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontWeight: 700 }} tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(0)}k` : val} />
                          <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', padding: '12px' }} labelStyle={{ fontWeight: 900, color: '#0f172a', marginBottom: '4px' }} itemStyle={{ fontSize: '12px', fontWeight: 600, color: '#4f46e5' }} formatter={(value: number) => [formatZAR(value), 'Spend']} />
                          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                             {dashboardStats.chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.value > 0 ? '#6366f1' : '#e2e8f0'} />
                             ))}
                          </Bar>
                       </BarChart>
                    </ResponsiveContainer>
                 </div>
              </div>

              {/* Right: Top Suppliers */}
              <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-8 flex flex-col">
                 <h3 className="text-lg font-black text-slate-800 mb-6 text-left">Top Partners</h3>
                 <div className="space-y-4 overflow-y-auto flex-1 pr-1">
                    {dashboardStats.topSuppliers.length === 0 ? (
                       <div className="text-center py-10 text-slate-400 italic text-xs uppercase tracking-widest">No data available</div>
                    ) : (
                       dashboardStats.topSuppliers.slice(0, 5).map((s, idx) => (
                          <div key={s.id} className="relative">
                             <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                                <span>{idx + 1}. {s.name}</span>
                                <span>{formatZAR(s.amount)}</span>
                             </div>
                             <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                <div 
                                  className="h-full bg-teal-500 rounded-full" 
                                  style={{ width: `${(s.amount / dashboardStats.totalSpend) * 100}%` }} 
                                />
                             </div>
                          </div>
                       ))
                    )}
                 </div>
              </div>
           </div>

           {/* Row 3: Recent Arrivals Table */}
           <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 text-left flex items-center gap-3">
                 <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><PackageCheck size={20} /></div>
                 <h3 className="text-lg font-black text-slate-800">Recent Stock Arrivals</h3>
              </div>
              <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                       <tr>
                          <th className="px-6 py-4">Date</th>
                          <th className="px-6 py-4">Ref #</th>
                          <th className="px-6 py-4">Supplier</th>
                          <th className="px-6 py-4 text-center">Items</th>
                          <th className="px-6 py-4 text-right">Total Value</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                       {dashboardStats.recentArrivals.length === 0 ? (
                          <tr><td colSpan={5} className="py-10 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">No recent stock arrivals</td></tr>
                       ) : (
                          dashboardStats.recentArrivals.map(po => (
                             <tr key={po.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4">
                                   <div className="flex items-center gap-2 text-slate-600 font-bold text-xs">
                                      <Clock size={12} className="text-slate-400" />
                                      {formatDate(po.date)}
                                   </div>
                                </td>
                                <td className="px-6 py-4"><span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded">{po.invoiceNumber}</span></td>
                                <td className="px-6 py-4 text-sm font-bold text-slate-700">{po.supplierName}</td>
                                <td className="px-6 py-4 text-center text-xs font-bold text-slate-500">{po.items?.length || 0}</td>
                                <td className="px-6 py-4 text-right text-sm font-black text-teal-600">{formatZAR(po.totalAmount)}</td>
                             </tr>
                          ))
                       )}
                    </tbody>
                 </table>
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
                    {s.contactPerson && <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mt-1">{s.contactPerson}</p>}
                  </div>
                  
                  <div className="bg-slate-50 p-3 rounded-xl relative z-10">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Lifetime Spend</p>
                     <p className="text-lg font-black text-slate-800">{formatZAR(lifetimeSpend)}</p>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-50 relative z-10">
                    {s.phone ? (
                      <div className="flex items-center gap-2 text-slate-600 text-sm">
                        <Phone size={14} className="text-slate-300" /> {s.phone}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-slate-300 text-sm italic"><Phone size={14} /> No phone</div>
                    )}
                    
                    {s.email ? (
                      <div className="flex items-center gap-2 text-slate-600 text-sm">
                        <Mail size={14} className="text-slate-300" /> {s.email}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-slate-300 text-sm italic"><Mail size={14} /> No email</div>
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

      {/* Unified Add/Edit Modal - SIMPLIFIED */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !isSaving && setIsModalOpen(false)} />
          <form onSubmit={handleSave} className="bg-white rounded-[2.5rem] w-full max-w-sm p-8 relative shadow-2xl space-y-6 text-left">
            <div className="flex items-center justify-between mb-2">
               <h3 className="text-xl font-black tracking-tight text-slate-900">{editingSupplier ? 'Edit Vendor' : 'New Vendor'}</h3>
               <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            
            {/* Primary Field - Company Name */}
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block ml-1">Company Name <span className="text-rose-500">*</span></label>
              <input required autoFocus className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all text-sm" value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} placeholder="e.g. Acme Wholesalers" />
            </div>

            {/* Optional Fields - Compact */}
            <div className="space-y-3 pt-2">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Additional Details (Optional)</p>
               
               <div className="grid grid-cols-2 gap-3">
                  <input className="w-full px-3 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-teal-500 transition-all" value={formData.contactPerson} onChange={e=>setFormData({...formData, contactPerson: e.target.value})} placeholder="Contact Person" />
                  <input className="w-full px-3 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-teal-500 transition-all" value={formData.phone} onChange={e=>setFormData({...formData, phone: e.target.value})} placeholder="Phone Number" />
               </div>
               
               <input className="w-full px-3 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-teal-500 transition-all" value={formData.email} onChange={e=>setFormData({...formData, email: e.target.value})} placeholder="Email Address" type="email" />
               
               <input className="w-full px-3 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-teal-500 transition-all" value={formData.taxId} onChange={e=>setFormData({...formData, taxId: e.target.value})} placeholder="VAT / Tax ID" />
            </div>

            <button disabled={isSaving} type="submit" className="w-full py-3.5 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl mt-2 hover:bg-slate-800 transition-all">
              {isSaving ? <Loader2 className="animate-spin mx-auto"/> : (editingSupplier ? 'Save Changes' : 'Create Vendor')}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
