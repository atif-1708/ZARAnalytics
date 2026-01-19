
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit3, AlertCircle, Calendar, Receipt, Loader2 } from 'lucide-react';
import { storage } from '../services/mockStorage';
import { useAuth } from '../context/AuthContext';
import { MonthlyExpense, UserRole, Business } from '../types';
import { formatZAR, formatMonth } from '../utils/formatters';

export const Expenses: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === UserRole.ADMIN;
  
  const [expenses, setExpenses] = useState<MonthlyExpense[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<MonthlyExpense | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    businessId: '',
    month: new Date().toISOString().slice(0, 7),
    amount: 0,
    description: ''
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [expensesData, businessData] = await Promise.all([
        storage.getExpenses(),
        storage.getBusinesses()
      ]);
      setExpenses(expensesData);
      setBusinesses(businessData);
    } catch (err) {
      console.error("Failed to load expenses data", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || isSaving) return;

    if (!formData.businessId) {
      alert("Please select a business.");
      return;
    }

    setIsSaving(true);
    try {
      const expenseToSave = {
        ...(editingExpense || {}),
        ...formData
      };

      await storage.saveExpense(expenseToSave);
      await loadData();
      setIsModalOpen(false);
      setEditingExpense(null);
    } catch (err: any) {
      alert("Error saving expense: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    if (!window.confirm("Delete this expense record?")) return;
    
    try {
      await storage.deleteExpense(id);
      setExpenses(expenses.filter(ex => ex.id !== id));
    } catch (err: any) {
      alert("Error deleting record: " + err.message);
    }
  };

  const openEdit = (expense: MonthlyExpense) => {
    if (!isAdmin) return;
    setEditingExpense(expense);
    setFormData({
      businessId: expense.businessId,
      month: expense.month,
      amount: expense.amount,
      description: expense.description
    });
    setIsModalOpen(true);
  };

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-rose-600" size={40} /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Monthly Expenses</h2>
          <p className="text-slate-500">Track fixed and operational costs per unit</p>
        </div>
        {isAdmin && (
          <button 
            onClick={() => {
              setEditingExpense(null);
              setFormData({ 
                businessId: businesses[0]?.id || '', 
                month: new Date().toISOString().slice(0, 7), 
                amount: 0, 
                description: '' 
              });
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 bg-rose-600 text-white px-4 py-2 rounded-lg hover:bg-rose-700 transition-colors shadow-lg shadow-rose-600/20"
          >
            <Plus size={20} />
            <span>Record Expense</span>
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Month</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Business</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Description</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Amount (ZAR)</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {expenses.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                  <AlertCircle className="mx-auto mb-2 opacity-20" size={40} />
                  No expense records found.
                </td>
              </tr>
            ) : (
              [...expenses].map((expense) => (
                <tr key={expense.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4 text-sm font-medium text-slate-900 flex items-center gap-2">
                    <Calendar size={14} className="text-slate-400" />
                    {formatMonth(expense.month)}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {businesses.find(b => b.id === expense.businessId)?.name || <span className="text-slate-300 italic text-xs">Deleted Business</span>}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 italic max-w-xs truncate">
                    {expense.description || 'General expense'}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-rose-600 text-right">{formatZAR(expense.amount)}</td>
                  <td className="px-6 py-4 text-right">
                    {isAdmin && (
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(expense)} className="p-2 text-slate-400 hover:text-blue-600 transition-all rounded-lg hover:bg-blue-50">
                          <Edit3 size={18} />
                        </button>
                        <button onClick={() => handleDelete(expense.id)} className="p-2 text-slate-400 hover:text-rose-600 transition-all rounded-lg hover:bg-rose-50">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !isSaving && setIsModalOpen(false)} />
          <div className="bg-white rounded-2xl w-full max-w-md p-8 relative shadow-2xl">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-800">
              <Receipt className="text-rose-600" size={24} />
              {editingExpense ? 'Edit' : 'Record'} Expense
            </h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Business Unit</label>
                <select 
                  required
                  disabled={isSaving}
                  value={formData.businessId}
                  onChange={(e) => setFormData({...formData, businessId: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 outline-none disabled:opacity-50"
                >
                  <option value="">Select a location...</option>
                  {businesses.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Billing Month</label>
                <input 
                  type="month"
                  required
                  disabled={isSaving}
                  value={formData.month}
                  onChange={(e) => setFormData({...formData, month: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 outline-none disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Total Amount (ZAR)</label>
                <input 
                  type="number"
                  required
                  disabled={isSaving}
                  min="0"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: parseFloat(e.target.value) || 0})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 outline-none font-bold text-rose-600"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Description</label>
                <textarea 
                  rows={3}
                  disabled={isSaving}
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 outline-none disabled:opacity-50"
                  placeholder="Details of the expense..."
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" disabled={isSaving} onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg font-bold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
                <button type="submit" disabled={isSaving} className="flex-1 px-4 py-2 bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-700 transition-all shadow-lg flex items-center justify-center gap-2">
                  {isSaving ? <Loader2 className="animate-spin" size={18} /> : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
