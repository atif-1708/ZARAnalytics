
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Edit3, TrendingUp, Loader2, Lock, AlertCircle, Calculator, Info } from 'lucide-react';
import { storage } from '../services/mockStorage';
import { useAuth } from '../context/AuthContext';
import { DailySale, UserRole, Business, Filters } from '../types';
import { formatCurrency, formatDate, getLocalISOString } from '../utils/formatters';
import { FilterPanel } from '../components/FilterPanel';

export const Sales: React.FC = () => {
  const { user, isSuspended } = useAuth();
  
  // ORG_ADMIN has visibility but NOT entry/edit access
  const isAdminVisibility = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.ORG_ADMIN;
  
  // These roles can actually MODIFY data, UNLESS the org is suspended
  const canModify = (user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.STAFF) && !isSuspended;
  
  const isStaff = user?.role === UserRole.STAFF;
  const isScoped = !isAdminVisibility && (user?.assignedBusinessIds?.length || 0) > 0;
  
  const [sales, setSales] = useState<DailySale[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<DailySale | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [currency, setCurrency] = useState<'ZAR' | 'PKR'>('ZAR');
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [isFetchingRate, setIsFetchingRate] = useState(false);

  const [filters, setFilters] = useState<Filters>({
    businessId: 'all',
    dateRange: { start: '', end: '' },
    selectedMonth: '',
    timeframe: 'this_month'
  });

  const fetchExchangeRate = async () => {
    setIsFetchingRate(true);
    try {
      const response = await fetch('https://open.er-api.com/v6/latest/ZAR');
      const data = await response.json();
      if (data?.rates?.PKR) setExchangeRate(data.rates.PKR);
    } catch (err) {
      setExchangeRate(15.5); 
    } finally {
      setIsFetchingRate(false);
    }
  };
  
  const [formData, setFormData] = useState({
    businessId: '', 
    date: getLocalISOString().split('T')[0], // Use local date, not UTC
    salesAmount: 0, 
    profitPercentage: 0
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [sData, bData] = await Promise.all([storage.getSales(), storage.getBusinesses()]);
      setSales(sData);
      setBusinesses(bData);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { 
    loadData(); 
    fetchExchangeRate();
  }, [user]);

  useEffect(() => {
    if (businesses.length > 0 && !formData.businessId) {
      const initialBiz = isScoped 
        ? businesses.find(b => user?.assignedBusinessIds?.includes(b.id)) 
        : businesses[0];
      
      if (initialBiz) {
        setFormData(prev => ({ ...prev, businessId: initialBiz.id }));
      }
    }
  }, [businesses, isScoped, user]);

  const convert = (val: number) => currency === 'PKR' ? val * exchangeRate : val;

  const aggregatedDailySales = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (filters.dateRange.start || filters.dateRange.end) {
      startDate = filters.dateRange.start ? new Date(filters.dateRange.start) : new Date(2000, 0, 1);
      endDate = filters.dateRange.end ? new Date(filters.dateRange.end) : endOfToday;
      endDate.setHours(23, 59, 59, 999);
    } else {
      switch (filters.timeframe) {
        case 'today':
          startDate = new Date(); startDate.setHours(0,0,0,0);
          endDate = endOfToday;
          break;
        case 'yesterday':
          startDate = new Date(); startDate.setDate(now.getDate() - 1); startDate.setHours(0,0,0,0);
          endDate = new Date(); endDate.setDate(now.getDate() - 1); endDate.setHours(23,59,59,999);
          break;
        case 'this_month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = endOfToday;
          break;
        case 'select_month':
          if (filters.selectedMonth) {
            const [y, m] = filters.selectedMonth.split('-').map(Number);
            startDate = new Date(y, m - 1, 1);
            endDate = new Date(y, m, 0, 23, 59, 59, 999);
          } else {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = endOfToday;
          }
          break;
        case 'lifetime':
        default:
          endDate = endOfToday;
          startDate = new Date(2000, 0, 1);
          break;
      }
    }

    // Step 1: Group and Aggregate
    const groups: Record<string, DailySale & { isComputed: boolean; txCount: number }> = {};

    sales.forEach(s => {
      const itemDate = new Date(s.date);
      // FIX: Convert UTC timestamp to LOCAL Date String before grouping
      const d = new Date(s.date);
      const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      
      const inRange = itemDate >= startDate && itemDate <= endDate;
      const userHasAccess = isAdminVisibility || user?.assignedBusinessIds?.includes(s.businessId);
      const matchesBiz = filters.businessId === 'all' || s.businessId === filters.businessId;

      if (inRange && userHasAccess && matchesBiz) {
        const groupKey = `${dayKey}_${s.businessId}`;
        const hasItems = s.items && s.items.length > 0;

        if (!groups[groupKey]) {
          groups[groupKey] = {
            ...s,
            date: dayKey, // Normalize to day
            salesAmount: 0,
            profitAmount: 0,
            profitPercentage: 0,
            isComputed: false, // Will determine below
            txCount: 0
          };
        }

        groups[groupKey].salesAmount += Number(s.salesAmount);
        groups[groupKey].profitAmount += Number(s.profitAmount);
        groups[groupKey].txCount += 1;
        if (hasItems) groups[groupKey].isComputed = true;
      }
    });

    // Step 2: Finalize metrics and sort
    return Object.values(groups)
      .map(g => ({
        ...g,
        profitPercentage: g.salesAmount > 0 ? Number(((g.profitAmount / g.salesAmount) * 100).toFixed(1)) : 0
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [sales, filters, user, isAdminVisibility]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canModify) return; 
    if (isSaving) return;

    setSaveError(null);
    setIsSaving(true);

    try {
      if (!formData.businessId) throw new Error("Please select a business unit first.");
      
      const selectedBiz = businesses.find(b => b.id === formData.businessId);
      if (!selectedBiz) throw new Error("The selected business unit could not be found.");

      const salesVal = Number(formData.salesAmount);
      const profitPct = Number(formData.profitPercentage);
      
      if (isNaN(salesVal) || salesVal <= 0) throw new Error("Please enter a valid sales amount.");
      if (isNaN(profitPct) || profitPct < 0 || profitPct > 100) throw new Error("Profit percentage must be between 0 and 100.");

      const profitAmount = salesVal * (profitPct / 100);
      
      // Fix: Construct proper ISO date combining selected date and CURRENT system time
      const now = new Date();
      const [y, m, d] = formData.date.split('-').map(Number);
      // Create date object (Month is 0-indexed in JS)
      const entryDate = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds());
      const isoTimestamp = entryDate.toISOString();

      const payload = {
        ...(editingSale || {}),
        businessId: formData.businessId,
        date: isoTimestamp,
        salesAmount: salesVal,
        profitPercentage: profitPct,
        profitAmount: profitAmount,
        orgId: selectedBiz.orgId
      };

      await storage.saveSale(payload);

      if (!editingSale) {
        try {
          await storage.saveReminder({
            businessId: formData.businessId,
            businessName: selectedBiz.name,
            date: isoTimestamp,
            sentBy: user?.id || '',
            sentByUserName: user?.name || 'Staff Member',
            status: 'pending',
            type: 'system_alert',
            orgId: selectedBiz.orgId
          });
        } catch (alertErr) {
          console.warn("Minor: Sale saved but system notification failed.", alertErr);
        }
      }

      await loadData();
      setIsModalOpen(false);
    } catch (err: any) {
      console.error("Sale transaction failed:", err);
      setSaveError(err.message || "Operation failed. Check organizational permissions.");
    } finally {
      setIsSaving(false);
    }
  };

  const openAddModal = () => {
    if (!canModify) return;
    setEditingSale(null);
    setSaveError(null);
    
    const initialBiz = isScoped 
      ? businesses.find(b => user?.assignedBusinessIds?.includes(b.id)) 
      : businesses[0];

    setFormData({
      businessId: initialBiz?.id || '',
      date: getLocalISOString().split('T')[0], // Use local date
      salesAmount: 0,
      profitPercentage: 0
    });
    setIsModalOpen(true);
  };

  const openEditModal = (sale: any) => {
    if (!canModify || sale.isComputed) return;
    setEditingSale(sale);
    setSaveError(null);
    
    // When editing, convert ISO date back to local date YYYY-MM-DD for the input
    const d = new Date(sale.date);
    const localYMD = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    
    setFormData({
      businessId: sale.businessId,
      date: localYMD,
      salesAmount: sale.salesAmount,
      profitPercentage: sale.profitPercentage
    });
    setIsModalOpen(true);
  };

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-teal-600" size={40} /></div>;

  const entryBusinesses = businesses.filter(b => isAdminVisibility || user?.assignedBusinessIds?.includes(b.id));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="text-left">
          <h2 className="text-2xl font-bold text-slate-800">Daily Revenue Summary</h2>
          <p className="text-slate-500">Aggregated daily totals across all operational units</p>
        </div>
        {canModify ? (
          <button 
            onClick={openAddModal}
            className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-xl font-bold shadow-lg hover:bg-teal-700 transition-all"
          >
            <Plus size={20} /> New Adjustment Entry
          </button>
        ) : isSuspended && (
          <div className="bg-slate-100 text-slate-400 px-4 py-2 rounded-xl font-bold flex items-center gap-2 cursor-not-allowed">
            <Lock size={16} /> Sales Locked
          </div>
        )}
      </div>

      <div className="no-print">
        <FilterPanel 
          filters={filters} 
          setFilters={setFilters} 
          currency={currency}
          setCurrency={setCurrency}
          exchangeRate={exchangeRate}
          isFetchingRate={isFetchingRate}
          onRefreshRate={fetchExchangeRate}
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Date</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Business Unit</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Context</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Day Revenue ({currency})</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Day Profit ({currency})</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {aggregatedDailySales.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-400 italic text-sm">No sales records found for this period.</td></tr>
            ) : (
              aggregatedDailySales.map((s: any, idx: number) => {
                const b = businesses.find(bx => bx.id === s.businessId);
                const canEditThis = canModify && !s.isComputed && (user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN || (isStaff && user?.assignedBusinessIds?.includes(s.businessId)));
                
                return (
                  <tr key={`${s.date}_${s.businessId}_${idx}`} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <span className="text-xs font-black text-slate-500 uppercase">{formatDate(s.date)}</span>
                    </td>
                    <td className="px-6 py-4 text-left">
                      <div className="text-sm font-black text-slate-800 leading-tight">
                        {b ? b.name : 'Unknown Unit'}
                      </div>
                      {b && (
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                          {b.location}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${
                        s.isComputed ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-slate-50 text-slate-500 border-slate-100'
                      }`}>
                        {s.isComputed ? (
                          <>
                            <Calculator size={10} /> 
                            <span>Sum of {s.txCount} Trans</span>
                          </>
                        ) : (
                          <span>Adjustment</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-black text-blue-600">{formatCurrency(convert(s.salesAmount), currency)}</td>
                    <td className="px-6 py-4 text-sm text-right font-black text-emerald-600">{formatCurrency(convert(s.profitAmount), currency)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1">
                        {canEditThis ? (
                          <>
                            <button 
                              onClick={() => openEditModal(s)} 
                              className="p-2 text-slate-300 hover:text-blue-600 transition-colors"
                            >
                              <Edit3 size={16} />
                            </button>
                            <button 
                              onClick={async () => { if(window.confirm('Delete this adjustment record?')) { await storage.deleteSale(s.id); loadData(); } }} 
                              className="p-2 text-slate-300 hover:text-rose-600 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        ) : s.isComputed ? (
                          <div className="flex justify-end pr-3" title="Computed totals are read-only. See Transaction Log for details.">
                            <Info size={14} className="text-slate-300" />
                          </div>
                        ) : (
                          <div className="flex justify-end pr-3">
                            <Lock size={14} className="text-slate-300" />
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !isSaving && setIsModalOpen(false)} />
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-10 relative shadow-2xl text-left">
            <h3 className="text-2xl font-black mb-6 flex items-center gap-3 text-slate-900 tracking-tight">
              <TrendingUp className="text-teal-600" size={28} />
              {editingSale ? 'Update Record' : 'Manual Entry'}
            </h3>
            
            {saveError && (
              <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-xs font-bold flex items-center gap-2">
                <AlertCircle size={16} /> {saveError}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-5">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 ml-1 tracking-widest">Business Unit</label>
                <select 
                  required
                  disabled={isSaving} 
                  value={formData.businessId} 
                  onChange={e=>setFormData({...formData, businessId: e.target.value})} 
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-black"
                >
                  <option value="">Select Unit</option>
                  {entryBusinesses.map(b => <option key={b.id} value={b.id}>{b.name} ({b.location})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 ml-1 tracking-widest">Entry Date</label>
                  <input 
                    type="date" 
                    required
                    disabled={isSaving}
                    value={formData.date} 
                    onChange={e=>setFormData({...formData, date: e.target.value})} 
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 ml-1 tracking-widest">Revenue (ZAR)</label>
                  <input 
                    type="number" 
                    required
                    min="0"
                    step="0.01" 
                    disabled={isSaving}
                    value={formData.salesAmount} 
                    onChange={e=>setFormData({...formData, salesAmount: parseFloat(e.target.value) || 0})} 
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black" 
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 ml-1 tracking-widest">Profit Margin (%)</label>
                <input 
                  type="number" 
                  required
                  min="0"
                  max="100"
                  step="0.1" 
                  disabled={isSaving}
                  value={formData.profitPercentage} 
                  onChange={e=>setFormData({...formData, profitPercentage: parseFloat(e.target.value) || 0})} 
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black" 
                />
              </div>
              <button 
                disabled={isSaving} 
                type="submit" 
                className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] hover:bg-slate-800 transition-all shadow-xl mt-4 disabled:opacity-50"
              >
                {isSaving ? 'Processing...' : editingSale ? 'Confirm Update' : 'Authorize & Save'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
