
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Edit3, TrendingUp, Loader2, Lock, AlertCircle } from 'lucide-react';
import { storage } from '../services/mockStorage';
import { useAuth } from '../context/AuthContext';
import { DailySale, UserRole, Business, Filters } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import { FilterPanel } from '../components/FilterPanel';

export const Sales: React.FC = () => {
  const { user } = useAuth();
  
  // ORG_ADMIN has visibility but NOT entry/edit access
  const isAdminVisibility = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.ORG_ADMIN;
  
  // These roles can actually MODIFY data
  const canModify = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.STAFF;
  
  const isStaff = user?.role === UserRole.STAFF;
  const isViewOnly = user?.role === UserRole.VIEW_ONLY || user?.role === UserRole.ORG_ADMIN;
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
    date: new Date().toISOString().split('T')[0],
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

  // Ensure formData.businessId is set to a valid assigned business when businesses are loaded
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

  const filteredSales = useMemo(() => {
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

    return sales.filter(item => {
      const itemDate = new Date(item.date);
      const inRange = itemDate >= startDate && itemDate <= endDate;
      const userHasAccess = isAdminVisibility || user?.assignedBusinessIds?.includes(item.businessId);
      if (!userHasAccess) return false;
      const matchesBiz = filters.businessId === 'all' || item.businessId === filters.businessId;
      return inRange && matchesBiz;
    });
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
      
      const payload = {
        ...(editingSale || {}),
        businessId: formData.businessId,
        date: formData.date,
        salesAmount: salesVal,
        profitPercentage: profitPct,
        profitAmount: profitAmount,
        orgId: selectedBiz.orgId
      };

      await storage.saveSale(payload);

      // System notification
      if (!editingSale) {
        try {
          await storage.saveReminder({
            businessId: formData.businessId,
            businessName: selectedBiz.name,
            date: formData.date,
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
    setEditingSale(null);
    setSaveError(null);
    
    const initialBiz = isScoped 
      ? businesses.find(b => user?.assignedBusinessIds?.includes(b.id)) 
      : businesses[0];

    setFormData({
      businessId: initialBiz?.id || '',
      date: new Date().toISOString().split('T')[0],
      salesAmount: 0,
      profitPercentage: 0
    });
    setIsModalOpen(true);
  };

  const openEditModal = (sale: DailySale) => {
    setEditingSale(sale);
    setSaveError(null);
    setFormData({
      businessId: sale.businessId,
      date: sale.date,
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
          <h2 className="text-2xl font-bold text-slate-800">Sales Records</h2>
          <p className="text-slate-500">{isScoped ? 'Operational data for your assigned shops' : 'Global revenue streams'}</p>
        </div>
        {canModify && (
          <button 
            onClick={openAddModal}
            className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-xl font-bold shadow-lg hover:bg-teal-700 transition-all"
          >
            <Plus size={20} /> Add Sale Entry
          </button>
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
              <th className="px-6 py-4 text-xs font-black uppercase text-slate-400">Date</th>
              <th className="px-6 py-4 text-xs font-black uppercase text-slate-400">Business Unit</th>
              <th className="px-6 py-4 text-xs font-black uppercase text-slate-400 text-right">Revenue ({currency})</th>
              <th className="px-6 py-4 text-xs font-black uppercase text-slate-400 text-right">Profit ({currency})</th>
              <th className="px-6 py-4 text-xs font-black uppercase text-slate-400 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredSales.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-400 italic text-sm">No sales records found for this period.</td></tr>
            ) : (
              filteredSales.map(s => {
                const b = businesses.find(bx => bx.id === s.businessId);
                const canEditThis = canModify && (user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN || (isStaff && user?.assignedBusinessIds?.includes(s.businessId)));
                
                return (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-bold">{formatDate(s.date)}</td>
                    <td className="px-6 py-4 text-left">
                      <div className="text-sm font-black text-slate-800 leading-tight">
                        {b ? b.name : 'Unknown Unit'}
                      </div>
                      {b && (
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                          {b.location}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-medium text-blue-600">{formatCurrency(convert(s.salesAmount), currency)}</td>
                    <td className="px-6 py-4 text-sm text-right font-bold text-emerald-600">{formatCurrency(convert(s.profitAmount), currency)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1">
                        {canEditThis ? (
                          <>
                            <button 
                              onClick={() => openEditModal(s)} 
                              className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                            >
                              <Edit3 size={16} />
                            </button>
                            <button 
                              onClick={async () => { if(window.confirm('Delete this record?')) { await storage.deleteSale(s.id); loadData(); } }} 
                              className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
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
          <div className="bg-white rounded-2xl w-full max-w-md p-8 relative shadow-2xl">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-800">
              <TrendingUp className="text-teal-600" size={24} />
              {editingSale ? 'Update Sales Entry' : 'Record New Daily Sale'}
            </h3>
            
            {saveError && (
              <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs font-bold flex items-center gap-2">
                <AlertCircle size={16} /> {saveError}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div className="text-left">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Business Unit</label>
                <select 
                  required
                  disabled={isSaving} 
                  value={formData.businessId} 
                  onChange={e=>setFormData({...formData, businessId: e.target.value})} 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-bold"
                >
                  <option value="">Select Unit</option>
                  {entryBusinesses.map(b => <option key={b.id} value={b.id}>{b.name} ({b.location})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4 text-left">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Entry Date</label>
                  <input 
                    type="date" 
                    required
                    disabled={isSaving}
                    value={formData.date} 
                    onChange={e=>setFormData({...formData, date: e.target.value})} 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Gross Revenue (ZAR)</label>
                  <input 
                    type="number" 
                    required
                    min="0"
                    step="0.01" 
                    disabled={isSaving}
                    value={formData.salesAmount} 
                    onChange={e=>setFormData({...formData, salesAmount: parseFloat(e.target.value) || 0})} 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold" 
                  />
                </div>
              </div>
              <div className="text-left">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Profit Percentage (%)</label>
                <input 
                  type="number" 
                  required
                  min="0"
                  max="100"
                  step="0.1" 
                  disabled={isSaving}
                  value={formData.profitPercentage} 
                  onChange={e=>setFormData({...formData, profitPercentage: parseFloat(e.target.value) || 0})} 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold" 
                />
              </div>
              <button 
                disabled={isSaving} 
                type="submit" 
                className="w-full py-4 bg-teal-600 text-white rounded-xl font-black uppercase text-xs tracking-widest hover:bg-teal-700 transition-all shadow-lg shadow-teal-600/20 disabled:opacity-50 mt-4"
              >
                {isSaving ? 'Processing Transaction...' : editingSale ? 'Confirm Update' : 'Authorize & Save Entry'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
