
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
  Clock,
  Filter,
  ArrowRight,
  Download,
  Building2,
  PieChart,
  Receipt
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  AreaChart,
  Area
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
  
  // Dashboard Filters - Defaults to "This Month" (Local Time)
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    // Calculate 1st day of current month in local time
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
    
    // Calculate today in local time
    const endStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    return { start: startStr, end: endStr };
  });
  
  // New: Supplier Dropdown Filter
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('all');

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
    // 1. First Filter: By Date
    let filteredPOs = purchaseOrders.filter(po => {
      const poDate = po.date.split('T')[0];
      return poDate >= dateRange.start && poDate <= dateRange.end;
    });

    // 2. Second Filter: By Specific Supplier (if selected)
    if (selectedSupplierId !== 'all') {
      filteredPOs = filteredPOs.filter(po => po.supplierId === selectedSupplierId);
    }

    const totalSpend = filteredPOs.reduce((sum, po) => sum + Number(po.totalAmount), 0);
    const totalPos = filteredPOs.length;
    const avgOrderValue = totalPos > 0 ? totalSpend / totalPos : 0;
    
    // 3. Spend by Supplier (Ranked High to Low) - For Leaderboard
    // Note: If a specific supplier is selected, this map will only contain 1 entry, effectively handling the "drill down"
    const supplierSpendMap = new Map<string, number>();
    
    // We iterate over the *Filtered* POs to build the chart/metrics
    filteredPOs.forEach(po => {
      const current = supplierSpendMap.get(po.supplierId) || 0;
      supplierSpendMap.set(po.supplierId, current + Number(po.totalAmount));
    });

    // For the leaderboard, if 'all' is selected, we want to show everyone in the date range.
    const rankedSuppliers = Array.from(supplierSpendMap.entries())
      .map(([id, amount]) => {
        const s = suppliers.find(sup => sup.id === id);
        return { id, name: s?.name || 'Unknown', amount, contact: s?.contactPerson };
      })
      .sort((a, b) => b.amount - a.amount);

    // 4. Chart Data (Daily Aggregation within range)
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const chartData = [];
    const isMonthlyView = diffDays > 32;

    if (isMonthlyView) {
       const monthMap = new Map<string, number>();
       filteredPOs.forEach(po => {
          const monthKey = po.date.slice(0, 7); // YYYY-MM
          const curr = monthMap.get(monthKey) || 0;
          monthMap.set(monthKey, curr + Number(po.totalAmount));
       });
       
       Array.from(monthMap.entries()).sort().forEach(([key, val]) => {
          const dateObj = new Date(key + '-01');
          chartData.push({
             name: dateObj.toLocaleDateString('en-ZA', { month: 'short', year: '2-digit' }),
             value: val,
             raw: key
          });
       });
    } else {
       const dayMap = new Map<string, number>();
       filteredPOs.forEach(po => {
          const dayKey = po.date.split('T')[0];
          const curr = dayMap.get(dayKey) || 0;
          dayMap.set(dayKey, curr + Number(po.totalAmount));
       });

       for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const iso = d.toISOString().split('T')[0];
          const label = d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
          chartData.push({
             name: label,
             value: dayMap.get(iso) || 0,
             raw: iso
          });
       }
    }

    // 5. Recent Arrivals Table
    const recentArrivals = [...filteredPOs]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20);

    return { 
      totalSpend, 
      totalPos, 
      avgOrderValue,
      rankedSuppliers, 
      recentArrivals,
      chartData,
      isMonthlyView,
      csvData: filteredPOs // For export
    };
  }, [suppliers, purchaseOrders, dateRange, selectedSupplierId]);

  const handleExport = () => {
    const headers = ['Date', 'Invoice Ref', 'Supplier', 'Item Count', 'Total Amount'];
    const rows = dashboardStats.csvData.map(po => [
      po.date.split('T')[0],
      po.invoiceNumber,
      po.supplierName,
      po.items?.length || 0,
      po.totalAmount
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `procurement_report_${dateRange.start}_to_${dateRange.end}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
NOTIFY pgrst, 'reload config';`;

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
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Vendor Intelligence</h2>
          <p className="text-slate-500">Procurement analytics, invoice history, and supplier directory</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex bg-slate-100 p-1 rounded-xl">
             <button 
               onClick={() => setActiveTab('overview')}
               className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'overview' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
             >
               Analytics
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
               <Plus size={14} /> Add Vendor
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
              <h4 className="text-lg font-black text-amber-800 uppercase tracking-tight">Setup Required</h4>
              <p className="text-sm text-amber-700 font-medium leading-relaxed">
                The 'suppliers' table is missing. Run this SQL script in your Supabase SQL Editor to enable the Vendor Management module.
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

      {/* VIEW: OVERVIEW DASHBOARD */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
           
           {/* Date Range & Supplier Filter Bar */}
           <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col xl:flex-row items-center gap-4">
              <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 w-full xl:w-auto">
                 <Truck size={16} className="text-slate-400" />
                 <select 
                   value={selectedSupplierId}
                   onChange={(e) => setSelectedSupplierId(e.target.value)}
                   className="bg-transparent text-sm font-bold text-slate-700 outline-none w-full xl:w-48 cursor-pointer"
                 >
                    <option value="all">All Suppliers</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                 </select>
              </div>

              <div className="w-px h-6 bg-slate-200 hidden xl:block" />

              <div className="flex items-center gap-2 text-slate-500 text-sm font-bold">
                 <Filter size={16} />
                 <span>Period:</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 flex-1 w-full xl:w-auto">
                 <input 
                   type="date" 
                   value={dateRange.start}
                   onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                   className="bg-transparent text-sm font-bold text-slate-700 outline-none w-full"
                 />
                 <ArrowRight size={14} className="text-slate-400" />
                 <input 
                   type="date" 
                   value={dateRange.end}
                   onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                   className="bg-transparent text-sm font-bold text-slate-700 outline-none w-full text-right"
                 />
              </div>
              
              <button 
                onClick={handleExport}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2 ml-auto"
              >
                <Download size={14} /> Report
              </button>
           </div>

           {/* Row 1: High Level KPIs */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex items-center gap-6">
                 <div className="w-16 h-16 bg-teal-50 text-teal-600 rounded-3xl flex items-center justify-center">
                    <Wallet size={32} />
                 </div>
                 <div className="text-left">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Total Spend</p>
                    <h3 className="text-2xl font-black text-slate-900">{formatZAR(dashboardStats.totalSpend)}</h3>
                 </div>
              </div>
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex items-center gap-6">
                 <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center">
                    <Receipt size={32} />
                 </div>
                 <div className="text-left">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Invoices Processed</p>
                    <h3 className="text-2xl font-black text-slate-900">{dashboardStats.totalPos}</h3>
                 </div>
              </div>
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex items-center gap-6">
                 <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center">
                    <PieChart size={32} />
                 </div>
                 <div className="text-left">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Avg. Order Value</p>
                    <h3 className="text-2xl font-black text-slate-900">{formatZAR(dashboardStats.avgOrderValue)}</h3>
                 </div>
              </div>
           </div>

           {/* Row 2: Charts & Analysis */}
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left: Procurement Chart */}
              <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-8 flex flex-col">
                 <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                       <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><TrendingUp size={20} /></div>
                       <div>
                          <h3 className="text-lg font-black text-slate-800">Procurement Trend</h3>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                             {dashboardStats.isMonthlyView ? 'Monthly Aggregation' : 'Daily Volume'}
                          </p>
                       </div>
                    </div>
                 </div>
                 <div className="flex-1 min-h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={dashboardStats.chartData}>
                          <defs>
                            <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontWeight: 700 }} dy={10} />
                          <YAxis fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontWeight: 700 }} tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(0)}k` : val} />
                          <Tooltip cursor={{ stroke: '#6366f1', strokeWidth: 1 }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', padding: '12px' }} labelStyle={{ fontWeight: 900, color: '#0f172a', marginBottom: '4px' }} itemStyle={{ fontSize: '12px', fontWeight: 600, color: '#4f46e5' }} formatter={(value: number) => [formatZAR(value), 'Spend']} />
                          <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorSpend)" />
                       </AreaChart>
                    </ResponsiveContainer>
                 </div>
              </div>

              {/* Right: Dynamic Context (Rankings OR Supplier Detail) */}
              <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-8 flex flex-col">
                 {selectedSupplierId === 'all' ? (
                   <>
                     <h3 className="text-lg font-black text-slate-800 mb-6 text-left">Top Partners (Vol)</h3>
                     <div className="space-y-4 overflow-y-auto flex-1 pr-1">
                        {dashboardStats.rankedSuppliers.length === 0 ? (
                           <div className="text-center py-10 text-slate-400 italic text-xs uppercase tracking-widest">No data for period</div>
                        ) : (
                           dashboardStats.rankedSuppliers.slice(0, 8).map((s, idx) => (
                              <div key={s.id} className="relative">
                                 <div className="flex justify-between items-center text-xs font-bold text-slate-700 mb-1.5">
                                    <div className="flex items-center gap-2">
                                       <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-500 flex items-center justify-center text-[9px] font-black">{idx + 1}</span>
                                       <span className="truncate max-w-[120px]">{s.name}</span>
                                    </div>
                                    <span className="font-black text-slate-900">{formatZAR(s.amount)}</span>
                                 </div>
                                 <div className="w-full bg-slate-50 rounded-full h-2 overflow-hidden">
                                    <div 
                                      className="h-full bg-teal-500 rounded-full" 
                                      style={{ width: `${(s.amount / (dashboardStats.totalSpend || 1)) * 100}%` }} 
                                    />
                                 </div>
                              </div>
                           ))
                        )}
                     </div>
                   </>
                 ) : (
                   <>
                     <div className="flex items-center gap-3 mb-6">
                       <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center"><Building2 size={24}/></div>
                       <div className="text-left overflow-hidden">
                         <h3 className="text-lg font-black text-slate-800 truncate">{dashboardStats.rankedSuppliers[0]?.name || 'Supplier'}</h3>
                         <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Vendor Profile</p>
                       </div>
                     </div>
                     <div className="space-y-4 text-left">
                        <div className="p-4 bg-slate-50 rounded-2xl">
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Spend this Period</p>
                           <p className="text-xl font-black text-slate-900">{formatZAR(dashboardStats.totalSpend)}</p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-2xl">
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Invoices</p>
                           <p className="text-xl font-black text-slate-900">{dashboardStats.totalPos}</p>
                        </div>
                        {dashboardStats.rankedSuppliers[0]?.contact && (
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 mt-2">
                             <Users size={14} className="text-teal-500"/>
                             Contact: {dashboardStats.rankedSuppliers[0].contact}
                          </div>
                        )}
                     </div>
                   </>
                 )}
              </div>
           </div>

           {/* Row 3: Recent Arrivals Table */}
           <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 text-left flex items-center gap-3">
                 <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><PackageCheck size={20} /></div>
                 <h3 className="text-lg font-black text-slate-800">Invoices Processed (Log)</h3>
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
                          <tr><td colSpan={5} className="py-10 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">No stock arrivals in this period</td></tr>
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
              // Note: Lifetime Spend is calculated from ALL POs, ignoring the date filter for Directory view
              const lifetimeSpend = purchaseOrders
                .filter(po => po.supplierId === s.id)
                .reduce((sum, po) => sum + Number(po.totalAmount), 0);

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
