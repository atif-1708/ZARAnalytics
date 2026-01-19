
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit3, AlertCircle, TrendingUp } from 'lucide-react';
import { storage } from '../services/mockStorage';
import { useAuth } from '../context/AuthContext';
import { DailySale, UserRole, Business } from '../types';
import { formatZAR, formatDate } from '../utils/formatters';

export const Sales: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === UserRole.ADMIN;
  
  const [sales, setSales] = useState<DailySale[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<DailySale | null>(null);
  
  const [formData, setFormData] = useState({
    businessId: '',
    date: new Date().toISOString().split('T')[0],
    salesAmount: 0,
    profitPercentage: 0
  });

  const loadData = async () => {
    // Fix: Await async storage calls
    try {
      const [salesData, businessData] = await Promise.all([
        storage.getSales(),
        storage.getBusinesses()
      ]);
      setSales(salesData);
      setBusinesses(businessData);
    } catch (err) {
      console.error("Failed to load sales data", err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    if (!formData.businessId) {
      alert("Please select a business.");
      return;
    }

    const profitAmount = formData.salesAmount * (formData.profitPercentage / 100);
    let updatedSales: DailySale[];

    if (editingSale) {
      updatedSales = sales.map(s => 
        s.id === editingSale.id ? { ...editingSale, ...formData, profitAmount } : s
      );
    } else {
      const newSale: DailySale = {
        id: 'sale_' + Date.now() + Math.random().toString(36).substring(2, 5),
        ...formData,
        profitAmount,
        createdAt: new Date().toISOString()
      };
      updatedSales = [...sales, newSale];
    }

    // Fix: Await async save operation
    await storage.saveSales(updatedSales);
    setSales(updatedSales);
    setIsModalOpen(false);
    setEditingSale(null);
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    if (!window.confirm("Delete this sales entry permanently?")) return;
    
    // Fix: Use current state instead of sync storage call
    const updatedSales = sales.filter(s => s.id !== id);
    
    await storage.saveSales(updatedSales);
    setSales(updatedSales);
  };

  const openEdit = (sale: DailySale) => {
    if (!isAdmin) return;
    setEditingSale(sale);
    setFormData({
      businessId: sale.businessId,
      date: sale.date,
      salesAmount: sale.salesAmount,
      profitPercentage: sale.profitPercentage
    });
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Daily Sales Tracking</h2>
          <p className="text-slate-500">Record and manage revenue streams per location</p>
        </div>
        {isAdmin && (
          <button 
            onClick={() => {
              setEditingSale(null);
              setFormData({ 
                businessId: businesses[0]?.id || '', 
                date: new Date().toISOString().split('T')[0], 
                salesAmount: 0, 
                profitPercentage: 0 
              });
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors shadow-lg shadow-teal-600/20"
          >
            <Plus size={20} />
            <span>Add Sale Entry</span>
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Business</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Sales (ZAR)</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Profit %</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Profit (ZAR)</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sales.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">
                  <AlertCircle className="mx-auto mb-2 opacity-20" size={40} />
                  No sales data found.
                </td>
              </tr>
            ) : (
              [...sales].sort((a,b) => b.date.localeCompare(a.date)).map((sale) => (
                <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">{formatDate(sale.date)}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {businesses.find(b => b.id === sale.businessId)?.name || <span className="text-slate-300 italic text-xs">Deleted Business</span>}
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-blue-600 text-right">{formatZAR(sale.salesAmount)}</td>
                  <td className="px-6 py-4 text-sm text-center">
                    <span className="px-2 py-1 bg-teal-50 text-teal-700 rounded-md text-xs font-bold">
                      {sale.profitPercentage}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-emerald-600 text-right">{formatZAR(sale.profitAmount)}</td>
                  <td className="px-6 py-4 text-right">
                    {isAdmin && (
                      <div className="flex justify-end gap-1">
                        <button 
                          onClick={() => openEdit(sale)}
                          className="p-2 text-slate-400 hover:text-blue-600 transition-all rounded-lg hover:bg-blue-50"
                        >
                          <Edit3 size={18} />
                        </button>
                        <button 
                          onClick={() => handleDelete(sale.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 transition-all rounded-lg hover:bg-rose-50"
                        >
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
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="bg-white rounded-2xl w-full max-w-md p-8 relative shadow-2xl">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <TrendingUp className="text-teal-600" size={24} />
              {editingSale ? 'Edit' : 'New'} Sale Entry
            </h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Select Business</label>
                <select 
                  required
                  value={formData.businessId}
                  onChange={(e) => setFormData({...formData, businessId: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                >
                  <option value="">Select a location...</option>
                  {businesses.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Transaction Date</label>
                <input 
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Revenue (ZAR)</label>
                  <input 
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.salesAmount}
                    onChange={(e) => setFormData({...formData, salesAmount: parseFloat(e.target.value)})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none font-semibold text-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Profit Marg. %</label>
                  <input 
                    type="number"
                    required
                    min="0"
                    max="100"
                    step="0.1"
                    value={formData.profitPercentage}
                    onChange={(e) => setFormData({...formData, profitPercentage: parseFloat(e.target.value)})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none font-semibold text-emerald-600"
                  />
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg font-bold hover:bg-teal-700 transition-all shadow-lg shadow-teal-600/20">Record Entry</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
