
import React, { useState, useEffect, useRef } from 'react';
import { UserPlus, Shield, Mail, Edit, Loader2, Plus, Key, Trash2, Image as ImageIcon, Upload, AlertCircle, Store, Check, CheckSquare, Square, Building2, UserCheck, Lock, Boxes } from 'lucide-react';
import { storage } from '../services/mockStorage';
import { User, UserRole, Business, Organization } from '../types';
import { useAuth } from '../context/AuthContext';

export const UsersPage: React.FC = () => {
  const { user: currentUser, isSuspended } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const isSuperAdmin = currentUser?.role === UserRole.SUPER_ADMIN;
  const isOrgAdmin = currentUser?.role === UserRole.ORG_ADMIN || currentUser?.role === UserRole.ADMIN;
  const canManage = !isSuspended;

  const [formData, setFormData] = useState<{
    name: string;
    email: string;
    role: UserRole;
    assignedBusinessIds: string[];
    avatarUrl: string;
    password?: string;
    orgId?: string;
  }>({
    name: '', email: '', role: UserRole.STAFF,
    assignedBusinessIds: [], avatarUrl: '', password: '', orgId: ''
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [uData, bData, oData] = await Promise.all([
        storage.getUsers(), 
        storage.getBusinesses(),
        isSuperAdmin ? storage.getOrganizations() : Promise.resolve([])
      ]);
      
      const filteredUsers = isSuperAdmin 
        ? uData.filter(u => u.role === UserRole.SUPER_ADMIN || u.role === UserRole.ORG_ADMIN || u.role === UserRole.ADMIN)
        : uData;

      setUsers(filteredUsers);
      setBusinesses(bData);
      setOrganizations(oData);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [isSuperAdmin]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage || isSaving) return;
    setError(null);
    setIsSaving(true);
    try {
      const finalOrgId = formData.role === UserRole.SUPER_ADMIN ? undefined : (formData.orgId || undefined);

      if (editingUser) {
        await storage.saveProfile({ 
          id: editingUser.id, 
          name: formData.name, 
          role: formData.role, 
          assignedBusinessIds: (formData.role === UserRole.SUPER_ADMIN || formData.role === UserRole.ORG_ADMIN) ? [] : formData.assignedBusinessIds, 
          avatarUrl: formData.avatarUrl,
          orgId: finalOrgId
        });
      } else {
        await storage.createNewUser({ 
          name: formData.name, 
          email: formData.email, 
          role: formData.role, 
          assignedBusinessIds: (formData.role === UserRole.SUPER_ADMIN || formData.role === UserRole.ORG_ADMIN) ? [] : formData.assignedBusinessIds, 
          password: formData.password || 'User123!',
          orgId: finalOrgId
        });
      }
      await loadData();
      setIsModalOpen(false);
    } catch (err: any) {
      setError(err.message || "Save failed.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleBusinessSelection = (id: string) => {
    if (!canManage) return;
    setFormData(prev => {
        const isSelected = prev.assignedBusinessIds.includes(id);
        if (isSelected) {
            return { ...prev, assignedBusinessIds: prev.assignedBusinessIds.filter(bid => bid !== id) };
        } else {
            return { ...prev, assignedBusinessIds: [...prev.assignedBusinessIds, id] };
        }
    });
  };

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-slate-600" size={40} /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="text-left">
          <h2 className={`text-2xl font-bold ${isSuperAdmin ? 'text-white' : 'text-slate-800'}`}>
            {isSuperAdmin ? 'Platform Authority & Access' : 'Team Access Control'}
          </h2>
          <p className="text-slate-500">
            {isSuperAdmin ? 'Managing Root Operators and Tenant Administrators' : 'Manage organization team members and permissions'}
          </p>
        </div>
        {canManage ? (
          <button 
            onClick={() => { 
              setError(null); 
              setEditingUser(null); 
              setFormData({ 
                name: '', 
                email: '', 
                role: isSuperAdmin ? UserRole.ORG_ADMIN : UserRole.STAFF, 
                assignedBusinessIds: [], 
                avatarUrl: '', 
                password: '',
                orgId: currentUser?.orgId || ''
              }); 
              setIsModalOpen(true); 
            }} 
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold shadow-lg transition-all ${isSuperAdmin ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-slate-900 text-white'}`}
          >
            <Plus size={20} /> Provision User
          </button>
        ) : isSuspended && (
           <div className="bg-slate-100 text-slate-400 px-4 py-2 rounded-xl font-bold flex items-center gap-2 cursor-not-allowed">
            <Lock size={16} /> Access Locked
          </div>
        )}
      </div>

      {isSuperAdmin && (
        <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-2xl flex items-center gap-3 text-indigo-400">
          <UserCheck size={20} />
          <p className="text-xs font-bold uppercase tracking-widest text-left">Global Filter Active: Showing only Platform and Tenant Administrators</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.map((u) => {
          const orgName = organizations.find(o => o.id === u.orgId)?.name;
          const assignedShops = businesses.filter(b => u.assignedBusinessIds?.includes(b.id));
          
          return (
            <div key={u.id} className={`${isSuperAdmin ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-200'} p-6 rounded-[2rem] shadow-sm border group hover:border-indigo-400 transition-all text-left flex flex-col justify-between`}>
              <div>
                <div className="flex items-start justify-between mb-4">
                  {u.avatarUrl ? (
                    <img src={u.avatarUrl} alt={u.name} className="w-12 h-12 rounded-full object-cover ring-2 ring-indigo-500/20" />
                  ) : (
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg uppercase ${u.role === UserRole.SUPER_ADMIN ? 'bg-indigo-900 text-white' : 'bg-slate-800 text-slate-300'}`}>
                      {u.name.charAt(0)}
                    </div>
                  )}
                  <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider ${
                    u.role === UserRole.SUPER_ADMIN ? 'bg-indigo-600 text-white' : 
                    u.role === UserRole.ORG_ADMIN ? 'bg-emerald-500 text-white' : 
                    'bg-slate-700 text-slate-300'
                  }`}>
                    {u.role?.replace('_', ' ')}
                  </span>
                </div>
                <h3 className={`font-bold ${isSuperAdmin ? 'text-white' : 'text-slate-800'} truncate mb-1`}>{u.name}</h3>
                
                {u.role !== UserRole.SUPER_ADMIN && (
                  <div className="flex items-center gap-1.5 mb-2">
                    <Building2 size={12} className="text-slate-500" />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      {orgName || 'Platform Shared'}
                    </span>
                  </div>
                )}

                {!isSuperAdmin && assignedShops.length > 0 && (
                   <div className="flex flex-wrap gap-1 mt-3">
                      {assignedShops.map(s => (
                        <span key={s.id} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[8px] font-black uppercase rounded border border-slate-200">
                          {s.name}
                        </span>
                      ))}
                   </div>
                )}

                <div className="flex items-start gap-2 text-indigo-400 font-bold mb-4 mt-2">
                  <Shield size={14} className="mt-0.5 shrink-0" />
                  <div className="overflow-hidden">
                      <span className="text-xs">{u.role === UserRole.SUPER_ADMIN ? 'Root Control' : (u.role === UserRole.ORG_ADMIN ? 'Organization Owner' : 'Shop Operator')}</span>
                  </div>
                </div>
              </div>

              <div className={`pt-4 border-t ${isSuperAdmin ? 'border-white/5' : 'border-slate-100'} flex items-center justify-between`}>
                <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest">
                  ID: {u.id.substring(0, 8)}...
                </div>
                <div className="flex gap-1">
                  {canManage ? (
                    <>
                      <button 
                        onClick={() => { 
                          setError(null); 
                          setEditingUser(u); 
                          setFormData({ 
                            name: u.name, 
                            email: u.email || '', 
                            role: u.role, 
                            assignedBusinessIds: u.assignedBusinessIds || [], 
                            avatarUrl: u.avatarUrl || '', 
                            password: '',
                            orgId: u.orgId || ''
                          }); 
                          setIsModalOpen(true); 
                        }} 
                        className="p-2 text-slate-400 hover:text-indigo-400 transition-colors"
                      >
                        <Edit size={16} />
                      </button>
                      {u.id !== currentUser?.id && (
                        <button 
                          onClick={async () => { if(window.confirm('Revoke access for this user?')) { await storage.deleteUser(u.id); loadData(); } }} 
                          className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="p-2 text-slate-300">
                      <Lock size={14} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => !isSaving && setIsModalOpen(false)} />
          <div className={`${isSuperAdmin ? 'bg-slate-900 text-white' : 'bg-white'} rounded-[2.5rem] w-full max-w-md p-10 relative shadow-2xl overflow-y-auto max-h-[90vh]`}>
            <h3 className="text-2xl font-black mb-6 flex items-center gap-2 text-left">
              <UserPlus size={24} className="text-indigo-500"/>
              {editingUser ? 'Update Profile' : 'Provision Account'}
            </h3>
            {error && <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-500 text-xs font-bold flex items-center gap-3"><AlertCircle size={16} />{error}</div>}
            <form onSubmit={handleSave} className="space-y-5 text-left">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 ml-1">Display Name</label>
                <input required disabled={isSaving} value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} className={`w-full px-4 py-3 rounded-xl outline-none font-bold border ${isSuperAdmin ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`} />
              </div>
              {!editingUser && (
                <>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 ml-1">Email Address</label>
                    <input type="email" required disabled={isSaving} value={formData.email} onChange={e=>setFormData({...formData, email: e.target.value})} className={`w-full px-4 py-3 rounded-xl outline-none font-bold border ${isSuperAdmin ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 ml-1">Initial Password</label>
                    <input type="password" required disabled={isSaving} value={formData.password} onChange={e=>setFormData({...formData, password: e.target.value})} className={`w-full px-4 py-3 rounded-xl outline-none font-bold border ${isSuperAdmin ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`} />
                  </div>
                </>
              )}
              
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 ml-1">Access Level</label>
                <select 
                  required 
                  value={formData.role} 
                  onChange={e=>setFormData({...formData, role: e.target.value as UserRole})} 
                  className={`w-full px-4 py-3 rounded-xl outline-none font-bold border ${isSuperAdmin ? 'bg-slate-800 border-white/10' : 'bg-slate-50 border-slate-200'}`}
                >
                  {isSuperAdmin ? (
                    <>
                      <option value={UserRole.ORG_ADMIN}>Tenant Admin (Full Context)</option>
                      <option value={UserRole.SUPER_ADMIN}>Global Kernel Operator</option>
                    </>
                  ) : (
                    <>
                      <option value={UserRole.STAFF}>Operational Staff</option>
                      <option value={UserRole.VIEW_ONLY}>Observer (Read-Only)</option>
                      <option value={UserRole.ADMIN}>Manager (Full Shop Control)</option>
                    </>
                  )}
                </select>
              </div>

              {isSuperAdmin && formData.role !== UserRole.SUPER_ADMIN && (
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 ml-1">Organization Association</label>
                  <select 
                    required 
                    value={formData.orgId} 
                    onChange={e=>setFormData({...formData, orgId: e.target.value})} 
                    className={`w-full px-4 py-3 rounded-xl outline-none font-bold border ${isSuperAdmin ? 'bg-slate-800 border-white/10' : 'bg-slate-50 border-slate-200'}`}
                  >
                    <option value="">Select Tenant Organization</option>
                    {organizations.map(org => (
                      <option key={org.id} value={org.id}>{org.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* SHOP ASSIGNMENTS FOR ORG ADMINS/ADMINS */}
              {(isOrgAdmin || isSuperAdmin) && (formData.role === UserRole.STAFF || formData.role === UserRole.VIEW_ONLY || formData.role === UserRole.ADMIN) && (
                <div className="pt-4 border-t border-slate-100">
                   <div className="flex items-center gap-2 mb-4">
                      <Boxes size={14} className="text-indigo-500" />
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Context Shop Assignments</label>
                   </div>
                   <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                      {businesses.length === 0 ? (
                        <p className="text-[10px] font-bold text-slate-400 italic">No shop units registered in this organization.</p>
                      ) : (
                        businesses.map(biz => (
                          <label key={biz.id} className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${formData.assignedBusinessIds.includes(biz.id) ? 'bg-teal-50 border-teal-200 shadow-sm' : 'bg-slate-50 border-slate-100 hover:border-slate-200'}`}>
                             <div className="flex items-center gap-3">
                                <input 
                                  type="checkbox" 
                                  checked={formData.assignedBusinessIds.includes(biz.id)}
                                  onChange={() => toggleBusinessSelection(biz.id)}
                                  className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
                                />
                                <div className="text-left">
                                   <p className="text-xs font-black text-slate-800 leading-tight">{biz.name}</p>
                                   <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{biz.location}</p>
                                </div>
                             </div>
                             {formData.assignedBusinessIds.includes(biz.id) && <Check size={14} className="text-teal-600" />}
                          </label>
                        ))
                      )}
                   </div>
                </div>
              )}

              <button 
                disabled={isSaving} 
                type="submit" 
                className={`w-full py-4 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl mt-4 transition-all ${
                  isSuperAdmin ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20' : 'bg-teal-600 hover:bg-teal-700 shadow-teal-600/20'
                }`}
              >
                {isSaving ? 'Synchronizing Node...' : editingUser ? 'Apply Updates' : 'Confirm Authorization'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
