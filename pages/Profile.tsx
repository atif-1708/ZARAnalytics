
import React, { useState } from 'react';
import { User, Shield, Lock, Save, CheckCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { storage } from '../services/mockStorage';
import { supabase } from '../services/supabase';

export const Profile: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    password: '',
    confirmPassword: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    if (formData.password && formData.password !== formData.confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    setIsSaving(true);
    try {
      // 1. Update Profile in DB
      await storage.saveProfile({
        id: user?.id,
        name: formData.name,
        email: formData.email
      });

      // 2. Update Auth Password if provided
      if (formData.password) {
        const { error } = await supabase.auth.updateUser({ password: formData.password });
        if (error) throw error;
      }

      await refreshProfile();
      setIsSuccess(true);
      setTimeout(() => setIsSuccess(false), 3000);
      setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
    } catch (err: any) {
      alert("Failed to update profile: " + err.message);
    } finally {
      setIsSaving(false);
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
              <input 
                type="text"
                required
                disabled={isSaving}
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email Address</label>
              <input 
                type="email"
                required
                disabled={true} // Email is locked to Auth ID
                value={formData.email}
                className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-400 outline-none cursor-not-allowed"
              />
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
                  disabled={isSaving}
                  placeholder="Leave blank to keep current"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Confirm New Password</label>
                <input 
                  type="password"
                  disabled={isSaving}
                  placeholder="Repeat new password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none disabled:opacity-50"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-6">
            <p className="text-xs text-slate-400 max-w-xs italic leading-relaxed">
              Updating your profile will sync across all ZARlytics business units.
            </p>
            <button 
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg min-w-[160px] justify-center"
            >
              {isSaving ? <Loader2 className="animate-spin" size={20} /> : (isSuccess ? <CheckCircle size={20} className="text-emerald-400" /> : <Save size={20} />)}
              <span>{isSuccess ? 'Changes Saved' : 'Update Profile'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
