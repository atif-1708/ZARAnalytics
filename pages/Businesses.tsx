
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Edit3, Store, MapPin, AlertCircle, Loader2, Building2, Zap, ArrowUpCircle } from 'lucide-react';
import { storage } from '../services/mockStorage';
import { useAuth } from '../context/AuthContext';
import { Business, UserRole, Organization, SubscriptionTier } from '../types';
import { formatDate } from '../utils/formatters';

const TIER_LIMITS: Record<SubscriptionTier, number> = {
  starter: 1,
  growth: 2,
  enterprise: Infinity
};

export const Businesses: React.FC = () => {
  const { user, selectedOrgId } = useAuth();
  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;
  const canManage = user?.role === UserRole.ADMIN || user?.role === UserRole.ORG_ADMIN || isSuperAdmin;
  
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState<Business | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({ 
    name: '', 
    location: '', 
    orgId: '' 
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [bData, oData] = await Promise.all([
        storage.getBusinesses(),
        storage.getOrganizations()
      ]);
      setBusinesses(bData);
      setOrganizations(oData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Check if current user is at their tier limit
  const tierInfo = useMemo(() => {
    const orgId = isSuperAdmin ? selectedOrgId : user?.orgId;
    if (!orgId) return null;
    
    const org = organizations.find(o => o.id === orgId);
    if (!org) return null;

    const limit = TIER_LIMITS[org.tier] || 0;
    const currentCount = businesses.filter(b => b.orgId === orgId).length;
    
    return {
      tier: org.tier,
      limit,
      currentCount,
      isAtLimit: currentCount >= limit
    };
  }, [businesses, organizations, user, selectedOrgId, isSuperAdmin]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage || isSaving) return;
    
    setError(null);
    setIsSaving(true);

    try {
      const finalOrgId = isSuperAdmin 
        ? (selectedOrgId || formData.orgId) 
        : (user?.orgId || formData.orgId);

      if (!finalOrgId) {
        throw new Error("An organization must be assigned to this business.");
      }

      // Enforce limit only when adding new business
      if (!editingBusiness) {
        const org = organizations.find(o => o.id === finalOrgId);
        if (org) {
          const limit = TIER_LIMITS[org.tier] || 0;
          const currentCount = businesses.filter(b => b.orgId === finalOrgId).length;
          if (currentCount >= limit) {
            throw new Error(`Limit reached: Your ${org.tier.toUpperCase()} plan only supports ${limit} shop(s). Please contact support to upgrade.`);
          }
        }
      }

      const payload = { 
        ...(editingBusiness || {}), 
        name: formData.name, 
        location: formData.location, 
        orgId: finalOrgId 
      };

      await storage.saveBusiness(payload);
      await loadData();
      setIsModalOpen(false);
      setEditingBusiness(null);
    } catch (err: any) {
      setError(err.message || "Failed to save business unit.");
    } finally {
      setIsSaving(false);
    }
  };

  const openAdd = () => {
    if (tierInfo?.isAtLimit && !isSuperAdmin) {
      setError(`You have reached the limit of ${tierInfo.limit} shop(s) for your plan.`);
    } else {
      setError(null);
    }
    setEditingBusiness(null);
    setFormData({ 
      name: '', 
      location: '', 
      orgId: selectedOrgId || '' 
    });
    setIsModalOpen(true);
  };

  const openEdit = (business: Business) => {
    if (!canManage) return;
    setError(null);
    setEditingBusiness(business);
    setFormData({ 
      name: business.name, 
      location: business.location, 
      orgId: business.orgId || '' 
    });
    setIsModalOpen(true);
  };

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-indigo-600" size={40} /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="text-left">
          <h2 className="text-2xl font-bold text-slate-800">Business Units</h2>
          <p className="text-slate-500">Manage shop locations and service points</p>
        </div>
        {canManage && (
          <div className="flex items-center gap-4">
            {tierInfo && !isSuperAdmin && (
              <div className={`hidden md:flex flex-col items-end px-4 py-1.5 border rounded-2xl ${tierInfo.isAtLimit ? 'bg-rose-50 border-rose-100' : 'bg-indigo-50 border-indigo-100'}`}>
                <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Plan Capacity</p>
                <p className={`text-xs font-black ${tierInfo.isAtLimit ? 'text-rose-600' : 'text-indigo-600'}`}>
                  {tierInfo.currentCount} / {tierInfo.limit === Infinity ? '∞' : tierInfo.limit}
                </p>
              </div>
            )}
            <button 
              onClick={openAdd} 
              disabled={tierInfo?.isAtLimit && !isSuperAdmin}
              className={`flex items-center gap-2 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${isSuperAdmin && !selectedOrgId ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-teal-600 hover:bg-teal-700'}`}
            >
              <Plus size={20} />
              <span>Register New Shop</span>
            </button>
          </div>
        )}
      </div>

      {tierInfo?.isAtLimit && !isSuperAdmin && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center justify-between animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3 text-amber-800">
            <Zap size={20} className="text-amber-500" />
            <div>
              <p className="text-sm font-black uppercase tracking-tight">Tier Limit Reached</p>
              <p className="text-xs font-medium">You've hit the maximum shops for the {tierInfo.tier} plan. Upgrade to unlock more capacity.</p>
            </div>
          </div>
          <button className="bg-amber-500 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-amber-600 transition-colors flex items-center gap-2">
            <ArrowUpCircle size={14} /> Upgrade Plan
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {businesses.map((business) => {
          const orgName = organizations.find(o => o.id === business.orgId)?.name;
          return (
            <div key={business.id} className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200 group hover:border-indigo-400 transition-all text-left flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-6">
                  <div className={`p-4 rounded-2xl border transition-all ${isSuperAdmin ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 'bg-teal-50 border-teal-100 text-teal-600'}`}>
                    <Store size={24} />
                  </div>
                  {canManage && (
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(business)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><Edit3 size={18} /></button>
                      <button 
                        onClick={async () => { if(window.confirm('Delete this unit?')) { await storage.deleteBusiness(business.id); loadData(); } }} 
                        className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  )}
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-1">{business.name}</h3>
                <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">
                  <MapPin size={14} className="text-slate-300" />
                  <span>{business.location}</span>
                </div>
                
                {isSuperAdmin && (
                  <div className="mt-4 pt-4 border-t border-slate-50 flex items-center gap-2">
                    <Building2 size={12} className="text-slate-300" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                      Org: {orgName || 'Platform Shared'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {businesses.length === 0 && (
          <div className="col-span-full py-20 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2.5rem]">
             <Store size={48} className="mx-auto mb-4 text-slate-200" />
             <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No business units found</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !isSaving && setIsModalOpen(false)} />
          <form onSubmit={handleSave} className="bg-white rounded-[2.5rem] w-full max-w-md p-10 relative shadow-2xl space-y-5">
            <h3 className="text-2xl font-black mb-2 text-left tracking-tight">
              {editingBusiness ? 'Modify' : 'Provision'} Shop Unit
            </h3>
            
            {error && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-[10px] font-black uppercase tracking-widest flex items-center gap-3">
                <AlertCircle size={16} /> {error}
              </div>
            )}

            {!editingBusiness && tierInfo?.isAtLimit && !isSuperAdmin ? (
              <div className="text-center py-6">
                <p className="text-sm font-bold text-slate-600 mb-4">You have reached your shop limit. Upgrade your subscription to add more locations.</p>
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <div className="text-left">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 block">Trading Name</label>
                  <input 
                    required 
                    disabled={isSaving}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-bold" 
                    value={formData.name} 
                    onChange={e=>setFormData({...formData, name: e.target.value})} 
                    placeholder="e.g. Waterfront Branch"
                  />
                </div>

                <div className="text-left">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 block">Physical Location</label>
                  <input 
                    required 
                    disabled={isSaving}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-bold" 
                    value={formData.location} 
                    onChange={e=>setFormData({...formData, location: e.target.value})} 
                    placeholder="e.g. Cape Town, WC"
                  />
                </div>

                {isSuperAdmin && !selectedOrgId && (
                  <div className="text-left">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 block">Assigned Organization</label>
                    <select 
                      required
                      disabled={isSaving}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold"
                      value={formData.orgId}
                      onChange={e=>setFormData({...formData, orgId: e.target.value})}
                    >
                      <option value="">Select Tenant Organization</option>
                      {organizations.map(o => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex gap-3 pt-6">
                  <button 
                    type="button" 
                    disabled={isSaving}
                    onClick={()=>setIsModalOpen(false)} 
                    className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-100 transition-all"
                  >
                    Discard
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSaving}
                    className={`flex-1 py-4 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl transition-all ${isSuperAdmin ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200' : 'bg-teal-600 hover:bg-teal-700 shadow-teal-200'}`}
                  >
                    {isSaving ? 'Processing...' : 'Confirm Details'}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      )}
    </div>
  );
};
