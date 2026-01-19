
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit3, Store, MapPin, AlertCircle, Loader2 } from 'lucide-react';
import { storage } from '../services/mockStorage';
import { useAuth } from '../context/AuthContext';
import { Business, UserRole } from '../types';
import { formatDate } from '../utils/formatters';

export const Businesses: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === UserRole.ADMIN;
  
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState<Business | null>(null);
  
  const [formData, setFormData] = useState({ name: '', location: '' });

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await storage.getBusinesses();
      setBusinesses(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    const payload = editingBusiness ? { ...editingBusiness, ...formData } : formData;
    await storage.saveBusiness(payload);
    await loadData();
    setIsModalOpen(false);
    setEditingBusiness(null);
    setFormData({ name: '', location: '' });
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin || !window.confirm("Delete this business unit?")) return;
    await storage.deleteBusiness(id);
    await loadData();
  };

  const openEdit = (business: Business) => {
    if (!isAdmin) return;
    setEditingBusiness(business);
    setFormData({ name: business.name, location: business.location });
    setIsModalOpen(true);
  };

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-teal-600" size={40} /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Business Units</h2>
          <p className="text-slate-500">Global location management</p>
        </div>
        {isAdmin && (
          <button onClick={() => { setEditingBusiness(null); setFormData({name:'', location:''}); setIsModalOpen(true); }} className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition-all">
            <Plus size={20} />
            <span>Add Business</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {businesses.map((business) => (
          <div key={business.id} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 group hover:border-teal-400 transition-all">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-teal-50 text-teal-600 rounded-xl group-hover:bg-teal-600 group-hover:text-white transition-all"><Store size={24} /></div>
              {isAdmin && (
                <div className="flex gap-1">
                  <button onClick={() => openEdit(business)} className="p-2 text-slate-400 hover:text-blue-600 transition-colors"><Edit3 size={18} /></button>
                  <button onClick={() => handleDelete(business.id)} className="p-2 text-slate-400 hover:text-rose-600 transition-colors"><Trash2 size={18} /></button>
                </div>
              )}
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">{business.name}</h3>
            <div className="flex items-center gap-2 text-slate-500 text-sm mb-4"><MapPin size={14} /><span>{business.location}</span></div>
            <div className="pt-4 border-t border-slate-50 text-xs text-slate-400 font-medium">Created: {formatDate(business.createdAt)}</div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <form onSubmit={handleSave} className="bg-white rounded-2xl w-full max-w-md p-8 relative shadow-2xl space-y-4">
            <h3 className="text-xl font-bold mb-2">{editingBusiness ? 'Edit' : 'Register'} Business</h3>
            <div><label className="text-sm font-bold text-slate-700">Name</label><input required className="w-full p-2 bg-slate-50 border rounded-lg" value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} /></div>
            <div><label className="text-sm font-bold text-slate-700">Location</label><input required className="w-full p-2 bg-slate-50 border rounded-lg" value={formData.location} onChange={e=>setFormData({...formData, location: e.target.value})} /></div>
            <div className="flex gap-3 pt-4"><button type="button" onClick={()=>setIsModalOpen(false)} className="flex-1 p-2 border rounded-lg">Cancel</button><button type="submit" className="flex-1 p-2 bg-teal-600 text-white rounded-lg font-bold">Save</button></div>
          </form>
        </div>
      )}
    </div>
  );
};
