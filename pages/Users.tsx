
import React, { useState, useEffect, useRef } from 'react';
// Added AlertCircle to the lucide-react imports to fix the error on line 208
import { UserPlus, Shield, Mail, Edit, Loader2, Plus, Key, Trash2, Image as ImageIcon, Upload, X, AlertCircle } from 'lucide-react';
import { storage } from '../services/mockStorage';
import { User, UserRole } from '../types';
import { useAuth } from '../context/AuthContext';

export const UsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: UserRole.USER,
    avatarUrl: '',
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
      setIsInitializing(false);
    }
  };

  const setIsInitializing = (val: boolean) => {
      // Helper for loadUsers logic
      setIsLoading(val);
  };

  useEffect(() => { loadUsers(); }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("Image too large. Please select a file smaller than 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, avatarUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setError(null);

    setIsSaving(true);
    try {
      if (editingUser) {
        await storage.saveProfile({
          id: editingUser.id,
          name: formData.name,
          role: formData.role,
          avatarUrl: formData.avatarUrl
        });
      } else {
        await storage.createNewUser({
          name: formData.name,
          email: formData.email,
          role: formData.role,
          password: formData.password || 'User123!' 
        });
      }
      
      await loadUsers();
      setIsModalOpen(false);
      setEditingUser(null);
    } catch (err: any) {
      console.error("Save failed:", err);
      if (err.message?.includes('avatar_url')) {
        setError("Database Error: 'profiles' table is missing 'avatar_url' column.");
      } else {
        setError(err.message || "An unexpected error occurred during save.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (id === currentUser?.id) {
      alert("Self-deletion restricted.");
      return;
    }
    if (!window.confirm("Delete user access permanently?")) return;

    setDeletingId(id);
    try {
      await storage.deleteUser(id);
      setUsers(prev => prev.filter(u => u.id !== id));
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const openAdd = () => {
    setError(null);
    setEditingUser(null);
    setFormData({ name: '', email: '', role: UserRole.USER, avatarUrl: '', password: '' });
    setIsModalOpen(true);
  };

  const openEdit = (u: User) => {
    setError(null);
    setEditingUser(u);
    setFormData({ name: u.name, email: u.email || '', role: u.role, avatarUrl: u.avatarUrl || '', password: '' });
    setIsModalOpen(true);
  };

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-slate-600" size={40} /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">User Management</h2>
          <p className="text-slate-500">Manage business unit access and database records</p>
        </div>
        <button 
          onClick={openAdd}
          className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10 font-bold"
        >
          <Plus size={20} />
          <span>Add New User</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.map((u) => (
          <div key={u.id} className={`bg-white p-6 rounded-2xl shadow-sm border border-slate-200 group hover:border-teal-400 transition-all ${deletingId === u.id ? 'opacity-50 grayscale pointer-events-none' : ''}`}>
            <div className="flex items-start justify-between mb-4">
              {u.avatarUrl ? (
                <img 
                  src={u.avatarUrl} 
                  alt={u.name} 
                  className="w-12 h-12 rounded-full object-cover ring-2 ring-slate-100 group-hover:ring-teal-100 transition-all" 
                  onError={(e) => (e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || 'U')}&background=0f172a&color=fff`)}
                />
              ) : (
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-500 text-lg uppercase group-hover:bg-teal-50 group-hover:text-teal-600 transition-colors">
                  {u.name.charAt(0)}
                </div>
              )}
              <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${u.role === UserRole.ADMIN ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                {u.role}
              </span>
            </div>
            <h3 className="font-bold text-slate-800 truncate mb-1">{u.name}</h3>
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-4">
              <Mail size={14} />
              <span className="truncate italic text-xs">{u.email || 'Cloud Platform User'}</span>
            </div>
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                <Shield size={10} />
                <span>{u.id === currentUser?.id ? 'Your Profile' : 'System Access'}</span>
              </div>
              <div className="flex gap-1">
                <button 
                  onClick={() => openEdit(u)}
                  className="p-2 text-slate-400 hover:text-teal-600 transition-colors hover:bg-teal-50 rounded-lg"
                  title="Edit User"
                >
                  <Edit size={16} />
                </button>
                {u.id !== currentUser?.id && (
                  <button 
                    onClick={() => handleDelete(u.id)}
                    className="p-2 text-slate-400 hover:text-rose-600 transition-colors hover:bg-rose-50 rounded-lg flex items-center justify-center"
                    title="Delete from Database"
                  >
                    {deletingId === u.id ? <Loader2 size={16} className="animate-spin text-rose-600" /> : <Trash2 size={16} />}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => !isSaving && setIsModalOpen(false)} />
          <div className="bg-white rounded-3xl w-full max-w-md p-8 relative shadow-2xl overflow-y-auto max-h-[90vh]">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-800">
              {editingUser ? <Edit size={20} className="text-teal-600"/> : <UserPlus size={20} className="text-teal-600"/>}
              {editingUser ? 'Update User' : 'Onboard User'}
            </h3>
            
            {error && (
              <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs font-bold flex items-center gap-3">
                <AlertCircle size={16} />
                {error}
              </div>
            )}
            
            <form onSubmit={handleSave} className="space-y-4">
              <div className="flex justify-center mb-6">
                <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  {formData.avatarUrl ? (
                    <img 
                      src={formData.avatarUrl} 
                      className="w-20 h-20 rounded-full object-cover border-4 border-slate-50 shadow-md" 
                      alt="Preview" 
                      onError={(e) => (e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name || 'U')}&background=0f172a&color=fff`)}
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 border-2 border-dashed border-slate-200">
                      <ImageIcon size={32} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-slate-900/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Upload size={20} className="text-white" />
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                  
                  {formData.avatarUrl && (
                    <button 
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setFormData({...formData, avatarUrl: ''}); }}
                      className="absolute -top-1 -right-1 bg-rose-500 text-white p-1 rounded-full shadow-lg"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Display Name</label>
                <input 
                  type="text"
                  required
                  disabled={isSaving}
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                  placeholder="e.g. John Doe"
                />
              </div>

              {!editingUser && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Work Email</label>
                    <input 
                      type="email"
                      required
                      disabled={isSaving}
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                      placeholder="user@company.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Initial Password</label>
                    <div className="relative">
                      <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input 
                        type="password" 
                        required
                        disabled={isSaving}
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Role Tier</label>
                <select 
                  required
                  disabled={isSaving}
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value as UserRole})}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none appearance-none font-medium"
                >
                  <option value={UserRole.USER}>Standard User</option>
                  <option value={UserRole.ADMIN}>Administrator</option>
                </select>
              </div>

              <div className="pt-6 flex gap-3">
                <button 
                  type="button" 
                  disabled={isSaving} 
                  onClick={() => setIsModalOpen(false)} 
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  Discard
                </button>
                <button 
                  type="submit" 
                  disabled={isSaving} 
                  className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-xl font-bold hover:bg-teal-700 transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  {isSaving ? <Loader2 className="animate-spin" size={18} /> : (editingUser ? 'Sync' : 'Onboard')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
