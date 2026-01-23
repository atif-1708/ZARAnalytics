
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Briefcase, Calendar, CheckCircle2, XCircle, UserPlus, Loader2, ShieldCheck, Mail, Key, Zap, Layers, AlertCircle, Copy, Check, Database, LayoutDashboard, Power, PowerOff, AlertTriangle } from 'lucide-react';
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
  const { user, setSelectedOrgId } = useAuth();
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isOwnerModalOpen, setIsOwnerModalOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const savedOrg = await storage.saveOrganization(formData);
      
      if (savedOrg) {
        // Attribution logic: We attribute this payment to the MONTH of the Expiry Date in the label,
        // but the audit ledger uses the 'date' field to show when the transaction actually happened.
        const serviceMonth = formData.subscriptionEndDate.slice(0, 7);
        const actionTag = formData.id ? 'UPDATE' : 'PROVISION';
        
        // Use full ISO string to ensure precise sorting and deduplication in the audit ledger
        await storage.saveReminder({
          orgId: savedOrg.id,
          businessId: undefined,
          businessName: `${savedOrg.name} [${savedOrg.tier.toUpperCase()}] (${actionTag} | FOR: ${serviceMonth})`,
          date: new Date().toISOString(), 
          sentBy: user?.id || 'SYSTEM',
          sentByUserName: user?.name || 'System Operator',
          status: 'read',
          type: 'system_alert'
        });
      }

      await loadOrgs();
      setIsModalOpen(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (org: Organization) => {
    if (isSaving) return;
    const confirmMsg = org.isActive 
      ? `Are you sure you want to DEACTIVATE ${org.name}? This will block all access for their users.` 
      : `Re-activate ${org.name}?`;
      
    if (!window.confirm(confirmMsg)) return;

    setIsSaving(true);
    try {
      await storage.saveOrganization({ ...org, isActive: !org.isActive });
      await loadOrgs();
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
        <button onClick={() => { setError(null); setFormData({ name: '', subscriptionEndDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0], isActive: true, tier: 'starter' }); setIsModalOpen(true); }} className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg hover:bg-slate-800 transition-all">
          <Plus size={20} /> Register Client
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {orgs.map((org) => {
          const isExpired = new Date(org.subscriptionEndDate) < new Date();
          const canEnter = org.isActive && !isExpired;
          
          return (
            <div key={org.id} className={`bg-white p-8 rounded-[2.5rem] border shadow-sm flex flex-col justify-between group transition-all text-left ${canEnter ? 'hover:border-indigo-400 border-slate-200' : 'border-rose-200 grayscale-[0.5]'}`}>
              <div>
                <div className="flex justify-between items-start mb-6">
                  <div className={`p-3 rounded-xl ${canEnter ? 'bg-indigo-50 text-indigo-600' : 'bg-rose-50 text-rose-600'}`}>
                    <Briefcase size={24} />
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    <div className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${
                      isExpired ? 'bg-rose-600 text-white' : 
                      org.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                    }`}>
                      {isExpired ? 'EXPIRED' : org.isActive ? 'Active' : 'Disabled'}
                    </div>
                    <div className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border ${TIER_CONFIG[org.tier || 'starter']?.color}`}>
                      {TIER_CONFIG[org.tier || 'starter']?.label}
                    </div>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-1">{org.name}</h3>
                <div className="flex items-center gap-2 text-xs mb-2 font-bold">
                   <Calendar size={14} className={isExpired ? 'text-rose-500' : 'text-slate-400'} />
                   <span className={isExpired ? 'text-rose-600' : 'text-slate-500'}>
                     {isExpired ? 'Expired on:' : 'Expires:'} {formatDate(org.subscriptionEndDate)}
                   </span>
                </div>
                <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase mb-6">
                  <Layers size={12} />
                  <span>Limit: {TIER_CONFIG[org.tier || 'starter']?.limit === Infinity ? 'Unlimited' : `${TIER_CONFIG[org.tier || 'starter']?.limit} Shop(s)`}</span>
                </div>
              </div>
              
              {!canEnter && (
                <div className="mb-4 p-3 bg-rose-50 rounded-xl border border-rose-100 flex items-center gap-3 text-rose-600 text-[10px] font-bold">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>Suspended or expired access. Restoring requires subscription update.</span>
                </div>
              )}

              <div className="space-y-2">
                <button 
                  disabled={!canEnter}
                  onClick={() => {
                    setSelectedOrgId(org.id);
                    navigate('/dashboard');
                  }} 
                  className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm ${
                    canEnter 
                      ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white' 
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-50 shadow-none'
                  }`}
                >
                  <LayoutDashboard size={16} /> Go To Dashboard
                </button>
                <button 
                  onClick={() => { setError(null); setFormData({ ...org }); setIsModalOpen(true); }}
                  className="w-full py-3 border border-slate-100 text-slate-400 rounded-xl font-bold text-xs hover:bg-slate-50 hover:text-slate-600 transition-all"
                >
                  Modify Subscription
                </button>
                <button 
                  disabled={isSaving}
                  onClick={() => handleToggleActive(org)} 
                  className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all border ${
                    org.isActive 
                      ? 'border-rose-100 text-rose-600 hover:bg-rose-50' 
                      : 'border-emerald-100 text-emerald-600 hover:bg-emerald-50'
                  }`}
                >
                  {isSaving ? <Loader2 className="animate-spin" size={14}/> : (org.isActive ? <PowerOff size={14} /> : <Power size={14} />)}
                  {org.isActive ? 'Deactivate Access' : 'Restore Access'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <form onSubmit={handleSaveOrg} className="bg-white rounded-[2rem] w-full max-w-md p-8 relative shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto text-left">
            <h3 className="text-xl font-bold flex items-center gap-2 text-slate-800 tracking-tight">
              <ShieldCheck className="text-indigo-600"/> Provisioning Authorization
            </h3>
            
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Organization Name</label>
              <input required value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-indigo-500/20" />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Target Tier</label>
              <div className="grid grid-cols-1 gap-2">
                {Object.entries(TIER_CONFIG).map(([key, cfg]) => (
                  <label key={key} className={`flex items-center justify-between p-3 border rounded-xl cursor-pointer transition-all ${formData.tier === key ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-100 hover:border-slate-200'}`}>
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
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">New Expiry Date</label>
              <input type="date" required value={formData.subscriptionEndDate} onChange={e=>setFormData({...formData, subscriptionEndDate: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-indigo-500/20" />
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
               <input type="checkbox" checked={formData.isActive} onChange={e=>setFormData({...formData, isActive: e.target.checked})} className="w-5 h-5 rounded text-indigo-600" />
               <span className="text-sm font-bold text-slate-700">Grant Operational Authorization</span>
            </div>
            
            <button disabled={isSaving} type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black uppercase text-xs tracking-widest mt-4 shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
              {isSaving ? <><Loader2 className="animate-spin" size={16}/> Synchronizing...</> : 'Save Configuration'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
