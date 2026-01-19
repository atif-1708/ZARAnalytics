
import React, { useState, useEffect } from 'react';
import { UserPlus, Shield, Mail, Trash2, Edit } from 'lucide-react';
import { storage } from '../services/mockStorage';
import { User, UserRole } from '../types';
import { useAuth } from '../context/AuthContext';

export const UsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: 'password123',
    role: UserRole.USER
  });

  const loadUsers = async () => {
    // Fix: Await async storage call
    try {
      const data = await storage.getUsers();
      setUsers(data);
    } catch (err) {
      console.error("Failed to fetch users", err);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    let updatedUsersList: User[];
    
    if (editingUser) {
      updatedUsersList = users.map(u => 
        u.id === editingUser.id ? { ...editingUser, ...formData } : u
      );
    } else {
      const newUser: User = {
        id: 'usr_' + Date.now() + Math.random().toString(36).substring(2, 5),
        ...formData
      };
      updatedUsersList = [...users, newUser];
    }
    
    // Fix: Await async save operation
    await storage.saveUsers(updatedUsersList);
    setUsers(updatedUsersList);
    setIsModalOpen(false);
    setEditingUser(null);
  };

  const handleDelete = async (id: string) => {
    if (id === currentUser?.id) return alert("You cannot delete your own account.");
    
    // Fix: Use current state instead of sync storage call
    if (users.length <= 1) return alert("System must have at least one user.");
    
    if (!window.confirm("Permanently remove this user's access?")) return;
    
    const updatedUsersList = users.filter(u => u.id !== id);
    await storage.saveUsers(updatedUsersList);
    setUsers(updatedUsersList);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">User Management</h2>
          <p className="text-slate-500">Control system access and assign roles</p>
        </div>
        <button 
          onClick={() => {
            setEditingUser(null);
            setFormData({ name: '', email: '', password: 'password123', role: UserRole.USER });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors shadow-lg"
        >
          <UserPlus size={20} />
          <span>Invite User</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.map((u) => (
          <div key={u.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative group transition-all hover:border-teal-300">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-500 text-lg">
                {u.name.charAt(0)}
              </div>
              <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${u.role === UserRole.ADMIN ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                {u.role}
              </span>
            </div>
            <h3 className="font-bold text-slate-800 truncate">{u.name}</h3>
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-4">
              <Mail size={14} />
              <span className="truncate">{u.email}</span>
            </div>
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Shield size={12} />
                <span>Secure Access</span>
              </div>
              <div className="flex gap-1">
                <button 
                  onClick={() => {
                    setEditingUser(u);
                    setFormData({ name: u.name, email: u.email, password: u.password || 'password123', role: u.role });
                    setIsModalOpen(true);
                  }}
                  className="p-2 text-slate-400 hover:text-blue-600 transition-colors hover:bg-blue-50 rounded"
                >
                  <Edit size={16} />
                </button>
                <button 
                  onClick={() => handleDelete(u.id)}
                  className="p-2 text-slate-400 hover:text-rose-600 transition-colors hover:bg-rose-50 rounded"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="bg-white rounded-2xl w-full max-w-md p-8 relative shadow-2xl">
            <h3 className="text-xl font-bold mb-6">{editingUser ? 'Update' : 'New'} Account</h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <input 
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                <input 
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Access Password</label>
                <input 
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Authority Role</label>
                <select 
                  required
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value as UserRole})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                >
                  <option value={UserRole.USER}>Standard User (Read-Only)</option>
                  <option value={UserRole.ADMIN}>Administrator (Full Access)</option>
                </select>
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg font-bold hover:bg-teal-700 transition-all shadow-lg">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
