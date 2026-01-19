
import React, { useState, useEffect } from 'react';
import { UserPlus, Shield, Mail, Edit, Loader2, Plus, Key } from 'lucide-react';
import { storage } from '../services/mockStorage';
import { User, UserRole } from '../types';
import { useAuth } from '../context/AuthContext';

export const UsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: UserRole.USER,
    password: ''
  });

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const data = await storage.getUsers();
      setUsers(data);
    } catch (err) {
      console.error("Failed to fetch users", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    setIsSaving(true);
    try {
      if (editingUser) {
        await storage.saveProfile({
          id: editingUser.id,
          name: formData.name,
          role: formData.role
        });
      } else {
        if (!formData.password) throw new Error("Password is required for new users.");
        await storage.createNewUser({
          name: formData.name,
          email: formData.email,
          role: formData.role,
          password: formData.password
        });
      }
      
      await loadUsers();
      setIsModalOpen(false);
      setEditingUser(null);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const openAdd = () => {
    setEditingUser(null);
    setFormData({ name: '', email: '', role: UserRole.USER, password: '' });
    setIsModalOpen(true);
  };

  const openEdit = (u: User) => {
    setEditingUser(u);
    setFormData({ name: u.name, email: u.email || '', role: u.role, password: '' });
    setIsModalOpen(true);
  };

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-slate-600" size={40} /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">User Management</h2>
          <p className="text-slate-500">Access control and account provisioning</p>
        </div>
        <button 
          onClick={openAdd}
          className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-all shadow-lg"
        >
          <Plus size={20} />
          <span>Add New User</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.map((u) => (
          <div key={u.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 group hover:border-teal-300 transition-all">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-500 text-lg uppercase">
                {u.name.charAt(0)}
              </div>
              <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${u.role === UserRole.ADMIN ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                {u.role}
              </span>
            </div>
            <h3 className="font-bold text-slate-800 truncate">{u.name}</h3>
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-4">
              <Mail size={14} />
              <span className="truncate italic text-xs">{u.email || 'Cloud Identity'}</span>
            </div>
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                <Shield size={10} />
                <span>{u.id === currentUser?.id ? 'Your Profile' : 'Remote Access'}</span>
              </div>
              <button 
                onClick={() => openEdit(u)}
                className="p-2 text-slate-400 hover:text-blue-600 transition-colors hover:bg-blue-50 rounded-lg"
              >
                <Edit size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !isSaving && setIsModalOpen(false)} />
          <div className="bg-white rounded-2xl w-full max-w-md p-8 relative shadow-2xl">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              {editingUser ? 'Update User Role' : 'Create New User'}
            </h3>
            
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label>
                <input 
                  type="text"
                  required
                  disabled={isSaving}
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>

              {!editingUser && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email Address</label>
                    <input 
                      type="email"
                      required
                      disabled={isSaving}
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Initial Password</label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <input 
                        type="password"
                        required
                        disabled={isSaving}
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Access Level</label>
                <select 
                  required
                  disabled={isSaving}
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value as UserRole})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none appearance-none"
                >
                  <option value={UserRole.USER}>Standard User (Read/Write)</option>
                  <option value={UserRole.ADMIN}>Administrator (Full Access)</option>
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" disabled={isSaving} onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 border rounded-lg">Cancel</button>
                <button type="submit" disabled={isSaving} className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg font-bold hover:bg-teal-700 flex items-center justify-center">
                  {isSaving ? <Loader2 className="animate-spin" size={18} /> : 'Process User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
