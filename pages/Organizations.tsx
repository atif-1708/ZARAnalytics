
import React, { useState, useEffect } from 'react';
import { Plus, Briefcase, Calendar, CheckCircle2, XCircle, UserPlus, Loader2, ShieldCheck, Mail, Key } from 'lucide-react';
import { storage } from '../services/mockStorage';
import { Organization, UserRole } from '../types';
import { formatDate } from '../utils/formatters';

export const Organizations: React.FC = () => {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isOwnerModalOpen, setIsOwnerModalOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    subscriptionEndDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
    isActive: true
  });

  const [ownerData, setOwnerData] = useState({
    name: '',
    email: '',
    password: ''
  });

  const loadOrgs = async () => {
    setLoading(true);
    try {
      const data = await storage.getOrganizations();
      setOrgs(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadOrgs(); }, []);

  const handleSaveOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await storage.saveOrganization(formData);
      await loadOrgs();
      setIsModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrg) return;
    setIsSaving(true);
    try {
      await storage.createNewUser({
        ...ownerData,
        role: UserRole.ORG_ADMIN,
        orgId: selectedOrg.id
      });
      alert(`Success: ${ownerData.name} is now the Admin for ${selectedOrg.name}`);
      setIsOwnerModalOpen(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-indigo-600" size={40} /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="text-left">
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Client Organizations</h2>
          <p className="text-slate-500">System operator view of paying business owners</p>
        </div>
        <button onClick={() => { setFormData({ name: '', subscriptionEndDate: '', isActive: true }); setIsModalOpen(true); }} className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold">
          <Plus size={20} /> Register Client
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {orgs.map((org) => (
          <div key={org.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col justify-between group hover:border-indigo-400 transition-all text-left">
            <div>
              <div className="flex justify-between items-start mb-6">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl"><Briefcase size={24} /></div>
                <div className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${org.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                  {org.isActive ? 'Active' : 'Expired'}
                </div>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-1">{org.name}</h3>
              <div className="flex items-center gap-2 text-slate-500 text-xs mb-6">
                <Calendar size={14} />
                <span>Expires: {formatDate(org.subscriptionEndDate)}</span>
              </div>
            </div>
            <div className="space-y-2">
              <button 
                onClick={() => { setSelectedOrg(org); setIsOwnerModalOpen(true); }} 
                className="w-full py-3 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-indigo-600 hover:text-white transition-all"
              >
                <UserPlus size={16} /> Manage Owner
              </button>
              <button 
                onClick={() => { setFormData({ ...org }); setIsModalOpen(true); }}
                className="w-full py-3 border border-slate-100 text-slate-400 rounded-xl font-bold text-xs hover:bg-slate-50 transition-all"
              >
                Update Subscription
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Register/Update Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <form onSubmit={handleSaveOrg} className="bg-white rounded-[2rem] w-full max-w-md p-8 relative shadow-2xl space-y-4">
            <h3 className="text-xl font-bold flex items-center gap-2"><ShieldCheck className="text-indigo-600"/> Client Settings</h3>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1 text-left">Organization Name</label>
              <input required value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1 text-left">Contract Expiry (Offline Billing Cycle)</label>
              <input type="date" required value={formData.subscriptionEndDate} onChange={e=>setFormData({...formData, subscriptionEndDate: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl" />
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
               <input type="checkbox" checked={formData.isActive} onChange={e=>setFormData({...formData, isActive: e.target.checked})} className="w-5 h-5 rounded" />
               <span className="text-sm font-bold text-slate-700">Account Active & Authorized</span>
            </div>
            <button disabled={isSaving} type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black uppercase text-xs tracking-widest mt-4">Save Configuration</button>
          </form>
        </div>
      )}

      {/* Owner Provisioning Modal */}
      {isOwnerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsOwnerModalOpen(false)} />
          <form onSubmit={handleCreateOwner} className="bg-white rounded-[2rem] w-full max-w-md p-8 relative shadow-2xl space-y-4">
            <h3 className="text-xl font-bold flex items-center gap-2"><UserPlus className="text-indigo-600"/> Create Business Owner for {selectedOrg?.name}</h3>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1 text-left">Owner Full Name</label>
              <input required value={ownerData.name} onChange={e=>setOwnerData({...ownerData, name: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1 text-left">Primary Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input type="email" required value={ownerData.email} onChange={e=>setOwnerData({...ownerData, email: e.target.value})} className="w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1 text-left">Initial Password</label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input type="password" required value={ownerData.password} onChange={e=>setOwnerData({...ownerData, password: e.target.value})} className="w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl" />
              </div>
            </div>
            <button disabled={isSaving} type="submit" className="w-full py-4 bg-slate-900 text-white rounded-xl font-black uppercase text-xs tracking-widest mt-4">Authorize Owner Account</button>
          </form>
        </div>
      )}
    </div>
  );
};
