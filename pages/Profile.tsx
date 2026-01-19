
import React, { useState } from 'react';
import { User, Shield, Lock, Save, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { storage } from '../services/mockStorage';

export const Profile: React.FC = () => {
  const { user, logout } = useAuth();
  const [isSuccess, setIsSuccess] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    password: '',
    confirmPassword: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    // Fix: Await async storage call
    const users = await storage.getUsers();
    const index = users.findIndex(u => u.id === user?.id);
    
    if (index !== -1) {
      const updatedUser = { 
        ...users[index], 
        name: formData.name, 
        email: formData.email 
      };
      
      if (formData.password) {
        updatedUser.password = formData.password;
      }
      
      users[index] = updatedUser;
      // Fix: Await async save operation
      await storage.saveUsers(users);
      
      setIsSuccess(true);
      setTimeout(() => setIsSuccess(false), 3000);
      
      // Update the local storage session
      const auth = JSON.parse(localStorage.getItem('zarlytics_auth') || '{}');
      if (auth.user) {
        auth.user = { ...auth.user, name: formData.name, email: formData.email };
        localStorage.setItem('zarlytics_auth', JSON.stringify(auth));
      }
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
        <div className="flex items-center gap-6 mb-8">
          <div className="w-20 h-20 bg-slate-900 text-white rounded-full flex items-center justify-center text-3xl font-bold">
            {user?.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">{user?.name}</h2>
            <div className="flex items-center gap-2 text-slate-500">
              <Shield size={16} className="text-teal-600" />
              <span className="text-sm font-medium uppercase tracking-wider">{user?.role} Account</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email Address</label>
              <div className="relative">
                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Lock size={18} className="text-teal-600" />
              Security & Password
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">New Password</label>
                <input 
                  type="password"
                  placeholder="Leave blank to keep current"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Confirm New Password</label>
                <input 
                  type="password"
                  placeholder="Repeat new password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-6">
            <p className="text-xs text-slate-400 max-w-xs italic">
              Updating your credentials will apply immediately to your next login session.
            </p>
            <button 
              type="submit"
              className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg"
            >
              {isSuccess ? <CheckCircle size={20} className="text-emerald-400" /> : <Save size={20} />}
              <span>{isSuccess ? 'Changes Saved' : 'Update Profile'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
