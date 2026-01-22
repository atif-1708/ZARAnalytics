
import React, { useState, useEffect, useRef } from 'react';
import { UserPlus, Shield, Mail, Edit, Loader2, Plus, Key, Trash2, Image as ImageIcon, Upload, AlertCircle, Store, Check, CheckSquare, Square, Building2 } from 'lucide-react';
import { storage } from '../services/mockStorage';
import { User, UserRole, Business, Organization } from '../types';
import { useAuth } from '../context/AuthContext';

export const UsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
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
      setUsers(uData);
      setBusinesses(bData);
      setOrganizations(oData);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [isSuperAdmin]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setError(null);
    setIsSaving(true);
    try {
      // If adding a super admin, orgId must be null for global access
      const finalOrgId = formData.role === UserRole.SUPER_ADMIN ? undefined : (formData.orgId || undefined);

      if (editingUser) {
        await storage.saveProfile({ 
          id: editingUser.id, 
          name: formData.name, 
          role: formData.role, 
          assignedBusinessIds: (formData.role === UserRole.ADMIN || formData.role === UserRole.SUPER_ADMIN) ? [] : formData.assignedBusinessIds, 
          avatarUrl: formData.avatarUrl,
          orgId: finalOrgId
        });
      } else {
        await storage.createNewUser({ 
          name: formData.name, 
          email: formData.email, 
          role: formData.role, 
          assignedBusinessIds: (formData.role === UserRole.ADMIN || formData.role === UserRole.SUPER_ADMIN) ? [] : formData.assignedBusinessIds, 
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
          <h2 className="text-2xl font-bold text-slate-800">Team Access Control</h2>
          <p className="text-slate-500">Manage {isSuperAdmin ? 'platform-wide' : 'organization'} team members and permissions</p>
        </div>
        <button 
          onClick={() => { 
            setError(null); 
            setEditingUser(null); 
            setFormData({ 
              name: '', 
              email: '', 
              role: UserRole.STAFF, 
              assignedBusinessIds: [], 
              avatarUrl: '', 
              password: '',
              orgId: currentUser?.orgId || ''
            }); 
            setIsModalOpen(true); 
          }} 
          className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg"
        >
          <Plus size={20} /> Add New Member
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.map((u) => {
          const assignedCount = u.assignedBusinessIds?.length || 0;
          const firstAssigned = assignedCount === 1 ? businesses.find(b => b.id === u.assignedBusinessIds?.[0]) : null;
          const orgName = organizations.find(o => o.id === u.orgId)?.name;
          
          return (
            <div key={u.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 group hover:border-teal-400 transition-all text-left flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between mb-4">
                  {u.avatarUrl ? (
                    <img src={u.avatarUrl} alt={u.name} className="w-12 h-12 rounded-full object-cover ring-2 ring-slate-100" />
                  ) : (
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg uppercase ${u.role === UserRole.SUPER_ADMIN ? 'bg-indigo-900 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      {u.name.charAt(0)}
                    </div>
                  )}
                  <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider ${
                    u.role === UserRole.SUPER_ADMIN ? 'bg-indigo-600 text-white' : 
                    u.role === UserRole.ADMIN ? 'bg-indigo-100 text-indigo-700' : 
                    u.role === UserRole.STAFF ? 'bg-teal-100 text-teal-700' : 
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {u.role?.replace('_', ' ')}
                  </span>
                </div>
                <h3 className="font-bold text-slate-800 truncate mb-1">{u.name}</h3>
                
                {isSuperAdmin && u.role !== UserRole.SUPER_ADMIN && (
                  <div className="flex items-center gap-1.5 mb-2">
                    <Building2 size={12} className="text-slate-400" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {orgName || 'No Organization'}
                    </span>
                  </div>
                )}

                <div className="flex items-start gap-2 text-teal-600 font-bold mb-4">
                  <Store size={14} className="mt-0.5 shrink-0" />
                  <div className="overflow-hidden">
                      {u.role === UserRole.SUPER_ADMIN || u.role === UserRole.ADMIN ? (
                        <span className="text-xs">Full Global Access</span>
                      ) : assignedCount === 0 ? (
                        <span className="text-xs text-slate-400">No shops assigned</span>
                      ) : firstAssigned ? (
                        <>
                          <div className="text-xs truncate">{firstAssigned.name}</div>
                          <div className="text-[10px] text-teal-500 uppercase tracking-tight">{firstAssigned.location}</div>
                        </>
                      ) : (
                        <span className="text-xs">{assignedCount} assigned shops</span>
                      )}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                  <Shield size={10} />
                  <span>{u.id === currentUser?.id ? 'Your Profile' : 'Access Level Control'}</span>
                </div>
                <div className="flex gap-1">
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
                    className="p-2 text-slate-400 hover:text-teal-600 transition-colors"
                  >
                    <Edit size={16} />
                  </button>
                  {u.id !== currentUser?.id && (
                    <button 
                      onClick={async () => { if(window.confirm('Delete user access?')) { await storage.deleteUser(u.id); loadData(); } }} 
                      className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => !isSaving && setIsModalOpen(false)} />
          <div className="bg-white rounded-3xl w-full max-w-md p-8 relative shadow-2xl overflow-y-auto max-h-[90vh]">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-800">
              <UserPlus size={20} className="text-teal-600"/>
              {editingUser ? 'Update User' : 'Provision User Account'}
            </h3>
            {error && <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs font-bold flex items-center gap-3"><AlertCircle size={16} />{error}</div>}
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1 text-left">Display Name</label>
                <input required disabled={isSaving} value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
              </div>
              {!editingUser && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1 text-left">Email Address</label>
                    <input type="email" required disabled={isSaving} value={formData.email} onChange={e=>setFormData({...formData, email: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1 text-left">Initial Password</label>
                    <div className="relative">
                      <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input type="password" required disabled={isSaving} value={formData.password} onChange={e=>setFormData({...formData, password: e.target.value})} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" />
                    </div>
                  </div>
                </>
              )}
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1 text-left">Access Role</label>
                <select 
                  required 
                  value={formData.role} 
                  onChange={e=>setFormData({...formData, role: e.target.value as UserRole})} 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                >
                  <option value={UserRole.STAFF}>Shop Staff</option>
                  <option value={UserRole.VIEW_ONLY}>Observer (View Only)</option>
                  <option value={UserRole.ADMIN}>Organization Manager</option>
                  {isSuperAdmin && <option value={UserRole.SUPER_ADMIN}>Global Super Admin (Root)</option>}
                </select>
              </div>

              {isSuperAdmin && formData.role !== UserRole.SUPER_ADMIN && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1 text-left">Assigned Organization</label>
                  <select 
                    required 
                    value={formData.orgId} 
                    onChange={e=>setFormData({...formData, orgId: e.target.value})} 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                  >
                    <option value="">Select Organization</option>
                    {organizations.map(org => (
                      <option key={org.id} value={org.id}>{org.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {(formData.role !== UserRole.ADMIN && formData.role !== UserRole.SUPER_ADMIN) && (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1 text-left">Assign Shop Units</label>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-40 overflow-y-auto space-y-2">
                        {businesses.filter(b => !formData.orgId || b.orgId === formData.orgId).map(b => (
                            <div 
                                key={b.id} 
                                onClick={() => toggleBusinessSelection(b.id)}
                                className="flex items-center justify-between p-2 hover:bg-white rounded-lg cursor-pointer transition-colors"
                            >
                                <span className="text-xs font-medium text-slate-700">{b.name} ({b.location})</span>
                                {formData.assignedBusinessIds.includes(b.id) ? (
                                    <CheckSquare size={16} className="text-teal-600" />
                                ) : (
                                    <Square size={16} className="text-slate-300" />
                                )}
                            </div>
                        ))}
                    </div>
                  </div>
              )}

              <button 
                disabled={isSaving} 
                type="submit" 
                className={`w-full py-3 text-white rounded-xl font-bold shadow-lg mt-4 transition-all ${
                  formData.role === UserRole.SUPER_ADMIN ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-teal-600 hover:bg-teal-700'
                }`}
              >
                {isSaving ? 'Synchronizing...' : editingUser ? 'Update User Profile' : 'Confirm User Creation'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
