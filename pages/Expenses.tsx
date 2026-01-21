
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Edit3, AlertCircle, Receipt, Loader2, Lock } from 'lucide-react';
import { storage } from '../services/mockStorage';
import { useAuth } from '../context/AuthContext';
import { MonthlyExpense, UserRole, Business, Filters } from '../types';
import { formatCurrency, formatMonth } from '../utils/formatters';
import { FilterPanel } from '../components/FilterPanel';

export const Expenses: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === UserRole.ADMIN;
  const isStaff = user?.role === UserRole.STAFF;
  const isViewOnly = user?.role === UserRole.VIEW_ONLY;
  const isScoped = !isAdmin && (user?.assignedBusinessIds?.length || 0) > 0;
  
  const [expenses, setExpenses] = useState<MonthlyExpense[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<MonthlyExpense | null>(null);

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
    businessId: '', month: new Date().toISOString().slice(0, 7),
    amount: 0, description: ''
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [eData, bData] = await Promise.all([storage.getExpenses(), storage.getBusinesses()]);
      setExpenses(eData);
      setBusinesses(bData);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { 
    loadData(); 
    fetchExchangeRate();
  }, [user]);

  const convert = (val: number) => currency === 'PKR' ? val * exchangeRate : val;

  const filteredExpenses = useMemo(() => {
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

    return expenses.filter(item => {
      const itemDate = new Date(item.month + '-01');
      const inRange = itemDate >= startDate && itemDate <= endDate;
      const userHasAccess = isAdmin || user?.assignedBusinessIds?.includes(item.businessId);
      if (!userHasAccess) return false;
      const matchesBiz = filters.businessId === 'all' || item.businessId === filters.businessId;
      return inRange && matchesBiz;
    });
  }, [expenses, filters, user, isAdmin]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewOnly || isAdmin) return; // Admin restricted from data entry
    const isNew = !editingExpense;
    if (isNew && !isStaff) return;
    
    await storage.saveExpense({ 
      ...(editingExpense || {}), 
      ...formData
    });
    await loadData();
    setIsModalOpen(false);
  };

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-rose-600" size={40} /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="text-left">
          <h2 className="text-2xl font-bold text-slate-800">Operational Costs</h2>
          <p className="text-slate-500">{isScoped ? 'Fixed costs for your assigned shops' : 'Global expense ledger'}</p>
        </div>
        {/* Only Staff can record expenses */}
        {isStaff && (
          <button 
            onClick={() => { setEditingExpense(null); setFormData({ businessId: (businesses.find(b => user?.assignedBusinessIds?.includes(b.id))?.id || businesses[0]?.id || ''), month: new Date().toISOString().slice(0, 7), amount: 0, description: '' }); setIsModalOpen(true); }} 
            className="bg-rose-600 text-white px-4 py-2 rounded-xl font-bold shadow-lg flex items-center gap-2 hover:bg-rose-700 transition-all"
          >
            <Plus size={20} /> Record Expense
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
              <th className="px-6 py-4 text-xs font-black uppercase text-slate-400">Month</th>
              <th className="px-6 py-4 text-xs font-black uppercase text-slate-400">Business</th>
              <th className="px-6 py-4 text-xs font-black uppercase text-slate-400 text-right">Amount ({currency})</th>
              <th className="px-6 py-4 text-xs font-black uppercase text-slate-400 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredExpenses.length === 0 ? (
               <tr><td colSpan={4} className="px-6 py-10 text-center text-slate-400 italic text-sm">No expenses found for the current period and filters.</td></tr>
            ) : (
              filteredExpenses.map(ex => (
                <tr key={ex.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 text-sm font-bold">{formatMonth(ex.month)}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{businesses.find(b => b.id === ex.businessId)?.name}</td>
                  <td className="px-6 py-4 text-sm text-right font-bold text-rose-600">{formatCurrency(convert(ex.amount), currency)}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1">
                      {/* Action restriction: ONLY isStaff can edit or delete their assigned shops. ADMIN is restricted. */}
                      {!isViewOnly && !isAdmin && isStaff && user?.assignedBusinessIds?.includes(ex.businessId) ? (
                        <>
                          <button 
                            onClick={() => { setEditingExpense(ex); setFormData({ ...ex }); setIsModalOpen(true); }} 
                            className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                            title="Edit Expense"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button 
                            onClick={async () => { if(window.confirm('Delete this expense?')) { await storage.deleteExpense(ex.id); loadData(); } }} 
                            className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                            title="Delete Expense"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      ) : (
                        <div className="flex justify-end pr-3" title="Tier restricted access">
                          <Lock size={14} className="text-slate-300" />
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="bg-white rounded-2xl w-full max-w-md p-8 relative shadow-2xl">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-800">
              <Receipt className="text-rose-600" size={24} />
              {editingExpense ? 'Update' : 'New'} Operational Expense
            </h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1 text-left">Business Unit</label>
                <select 
                  value={formData.businessId} 
                  onChange={e=>setFormData({...formData, businessId:e.target.value})} 
                  className="w-full p-3 border bg-slate-50 border-slate-200 rounded-xl outline-none text-sm font-bold"
                >
                  {businesses.filter(b => user?.assignedBusinessIds?.includes(b.id)).map(b => <option key={b.id} value={b.id}>{b.name} ({b.location})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1 text-left">Billing Month</label>
                  <input 
                    type="month" 
                    value={formData.month} 
                    onChange={e=>setFormData({...formData, month:e.target.value})} 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1 text-left">Amount (ZAR)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={formData.amount} 
                    onChange={e=>setFormData({...formData, amount:parseFloat(e.target.value)})} 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold" 
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1 text-left">Expense Description</label>
                <textarea 
                  rows={3} 
                  placeholder="e.g. Electricity, Rent, Staff Wages..."
                  value={formData.description} 
                  onChange={e=>setFormData({...formData, description:e.target.value})} 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" 
                />
              </div>
              <button 
                type="submit" 
                className="w-full py-4 bg-rose-600 text-white rounded-xl font-black uppercase text-xs tracking-widest hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/20 mt-4"
              >
                {editingExpense ? 'Save Changes' : 'Record Monthly Expense'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
