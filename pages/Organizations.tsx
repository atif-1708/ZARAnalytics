
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Briefcase, Calendar, CheckCircle2, XCircle, UserPlus, Loader2, ShieldCheck, Mail, Key, Zap, Layers, AlertCircle, Copy, Check, Database, LayoutDashboard } from 'lucide-react';
import { storage } from '../services/mockStorage';
import { Organization, UserRole, SubscriptionTier } from '../types';
import { formatDate } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';

const TIER_CONFIG = {
  starter: { label: 'Starter', price: 300, limit: 1, color: 'text-blue-600 bg-blue-50 border-blue-100' },
  growth: { label: 'Growth', price: 550, limit: 2, color: 'text-amber-600 bg-amber-50 border-amber-100' },
  enterprise: { label: 'Enterprise', price: 1500, limit: Infinity, color: 'text-indigo-600 bg-indigo-50 border-indigo-100' }
};

export const Organizations: React.FC = () => {
  const { setSelectedOrgId } = useAuth();
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isOwnerModalOpen, setIsOwnerModalOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [formData, setFormData] = useState<{
    id?: string;
    name: string;
    subscriptionEndDate: string;
    isActive: boolean;
    tier: SubscriptionTier;
  }>({
    name: '',
    subscriptionEndDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
    isActive: true,
    tier: 'starter'
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
    setError(null);
    try {
      await storage.saveOrganization(formData);
      await loadOrgs();
      setIsModalOpen(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopySql = () => {
    const sql = "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS tier text DEFAULT 'starter';";
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrg) return;
    setIsSaving(true);
    setError(null);
    try {
      await storage.createNewUser({
        ...ownerData,
        role: UserRole.ORG_ADMIN,
        orgId: selectedOrg.id
      });
      alert(`Success: ${ownerData.name} is now the Admin for ${selectedOrg.name}`);
      setIsOwnerModalOpen(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-indigo-600" size={40} /></div>;

  const isMigrationError = error?.includes('SCHEMA_MIGRATION_REQUIRED');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="text-left">
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Client Organizations</h2>
          <p className="text-slate-500">System operator view of paying business owners</p>
        </div>
        <button onClick={() => { setError(null); setFormData({ name: '', subscriptionEndDate: new Date().toISOString().split('T')[0], isActive: true, tier: 'starter' }); setIsModalOpen(true); }} className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold">
          <Plus size={20} /> Register Client
        </button>
      </div>

      {isMigrationError && (
        <div className="bg-rose-50 border-2 border-rose-200 rounded-[2.5rem] p-8 animate-in fade-in slide-in-from-top-4 duration-500 shadow-xl shadow-rose-100/50">
          <div className="flex flex-col lg:flex-row items-center gap-8">
            <div className="w-16 h-16 bg-rose-500 text-white rounded-[1.5rem] flex items-center justify-center shadow-lg shadow-rose-200 shrink-0">
              <Database size={32} />
            </div>
            <div className="text-left flex-1">
              <h3 className="text-xl font-black text-rose-900 mb-2 tracking-tight">Database Schema Update Required</h3>
              <p className="text-rose-700 text-sm font-medium leading-relaxed max-w-2xl mb-6">
                The new Subscription Tier system requires a database column that doesn't exist yet. 
                Please run the following command in your <span className="font-bold">Supabase SQL Editor</span> to sync your database:
              </p>
              
              <div className="bg-slate-900 rounded-2xl p-4 flex items-center justify-between group">
                <code className="text-emerald-400 font-mono text-xs overflow-x-auto whitespace-nowrap scrollbar-hide">
                  ALTER TABLE organizations ADD COLUMN IF NOT EXISTS tier text DEFAULT 'starter';
                </code>
                <button 
                  onClick={handleCopySql}
                  className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-all border border-white/5 ml-4"
                >
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  {copied ? 'Copied' : 'Copy SQL'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {orgs.map((org) => (
          <div key={org.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col justify-between group hover:border-indigo-400 transition-all text-left">
            <div>
              <div className="flex justify-between items-start mb-6">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl"><Briefcase size={24} /></div>
                <div className="flex flex-col gap-1 items-end">
                   <div className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${org.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                    {org.isActive ? 'Active' : 'Expired'}
                  </div>
                  <div className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border ${TIER_CONFIG[org.tier || 'starter']?.color}`}>
                    {TIER_CONFIG[org.tier || 'starter']?.label}
                  </div>
                </div>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-1">{org.name}</h3>
              <div className="flex items-center gap-2 text-slate-500 text-xs mb-2">
                <Calendar size={14} />
                <span>Expires: {formatDate(org.subscriptionEndDate)}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase mb-6">
                <Layers size={12} />
                <span>Limit: {TIER_CONFIG[org.tier || 'starter']?.limit === Infinity ? 'Unlimited' : `${TIER_CONFIG[org.tier || 'starter']?.limit} Shop(s)`}</span>
              </div>
            </div>
            <div className="space-y-2">
              <button 
                onClick={() => {
                  setSelectedOrgId(org.id);
                  navigate('/dashboard');
                }} 
                className="w-full py-3 bg-emerald-50 text-emerald-600 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
              >
                <LayoutDashboard size={16} /> Go To Dashboard
              </button>
              <button 
                onClick={() => { setError(null); setSelectedOrg(org); setIsOwnerModalOpen(true); }} 
                className="w-full py-3 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-indigo-600 hover:text-white transition-all"
              >
                <UserPlus size={16} /> Manage Owner
              </button>
              <button 
                onClick={() => { setError(null); setFormData({ ...org }); setIsModalOpen(true); }}
                className="w-full py-3 border border-slate-100 text-slate-400 rounded-xl font-bold text-xs hover:bg-slate-50 transition-all"
              >
                Update Subscription
              </button>
            </div>
          </div>
        ))}
        {orgs.length === 0 && (
          <div className="col-span-full py-20 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2.5rem]">
             <Briefcase size={48} className="mx-auto mb-4 text-slate-200" />
             <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No organizations configured</p>
          </div>
        )}
      </div>

      {/* Register/Update Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <form onSubmit={handleSaveOrg} className="bg-white rounded-[2rem] w-full max-w-md p-8 relative shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold flex items-center gap-2 text-left"><ShieldCheck className="text-indigo-600"/> Client Settings</h3>
            
            {error && !isMigrationError && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-[10px] font-black uppercase tracking-widest flex items-start gap-3">
                <AlertCircle size={16} className="shrink-0 mt-0.5" /> 
                <div className="text-left">
                  <p className="mb-2">System Error Detected</p>
                  <p className="text-[9px] lowercase font-medium opacity-80">{error}</p>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1 text-left">Organization Name</label>
              <input required value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1 text-left">Subscription Tier</label>
              <div className="grid grid-cols-1 gap-2">
                {Object.entries(TIER_CONFIG).map(([key, cfg]) => (
                  <label key={key} className={`flex items-center justify-between p-3 border rounded-xl cursor-pointer transition-all ${formData.tier === key ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="flex items-center gap-3">
                      <input 
                        type="radio" 
                        name="tier" 
                        checked={formData.tier === key} 
                        onChange={() => setFormData({...formData, tier: key as SubscriptionTier})}
                        className="w-4 h-4 text-indigo-600"
                      />
                      <div className="text-left">
                        <p className="text-sm font-black text-slate-800">{cfg.label}</p>
                        <p className="text-[10px] font-bold text-slate-400">R{cfg.price}/mo • Limit: {cfg.limit === Infinity ? 'Unlimited' : `${cfg.limit} Shop`}</p>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1 text-left">Contract Expiry</label>
              <input type="date" required value={formData.subscriptionEndDate} onChange={e=>setFormData({...formData, subscriptionEndDate: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" />
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
               <input type="checkbox" checked={formData.isActive} onChange={e=>setFormData({...formData, isActive: e.target.checked})} className="w-5 h-5 rounded" />
               <span className="text-sm font-bold text-slate-700">Account Active & Authorized</span>
            </div>
            <button disabled={isSaving} type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black uppercase text-xs tracking-widest mt-4 shadow-lg shadow-indigo-600/20">
              {isSaving ? 'Processing...' : 'Save Configuration'}
            </button>
          </form>
        </div>
      )}

      {/* Owner Provisioning Modal */}
      {isOwnerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsOwnerModalOpen(false)} />
          <form onSubmit={handleCreateOwner} className="bg-white rounded-[2rem] w-full max-w-md p-8 relative shadow-2xl space-y-4">
            <h3 className="text-xl font-bold flex items-center gap-2 text-left"><UserPlus className="text-indigo-600"/> Provision Owner for {selectedOrg?.name}</h3>
            
            {error && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-[10px] font-black uppercase tracking-widest flex items-center gap-3">
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1 text-left">Owner Full Name</label>
              <input required value={ownerData.name} onChange={e=>setOwnerData({...ownerData, name: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1 text-left">Primary Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input type="email" required value={ownerData.email} onChange={e=>setOwnerData({...ownerData, email: e.target.value})} className="w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1 text-left">Initial Password</label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input type="password" required value={ownerData.password} onChange={e=>setOwnerData({...ownerData, password: e.target.value})} className="w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" />
              </div>
            </div>
            <button disabled={isSaving} type="submit" className="w-full py-4 bg-slate-900 text-white rounded-xl font-black uppercase text-xs tracking-widest mt-4">Authorize Owner Account</button>
          </form>
        </div>
      )}
    </div>
  );
};
