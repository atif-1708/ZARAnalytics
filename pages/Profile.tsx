
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
      // 1. Update Profile in DB (excluding email per schema cache fix)
      await storage.saveProfile({
        id: user?.id,
        name: formData.name
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
      alert("Update Notification: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white rounded-3xl p-10 shadow-sm border border-slate-200">
        <div className="flex items-center gap-8 mb-10">
          <div className="w-24 h-24 bg-slate-900 text-white rounded-full flex items-center justify-center text-4xl font-bold shadow-2xl">
            {user?.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-3xl font-extrabold text-slate-800">{user?.name}</h2>
            <div className="flex items-center gap-2 text-slate-500 mt-1">
              <Shield size={18} className="text-teal-600" />
              <span className="text-sm font-bold uppercase tracking-widest">{user?.role} Tier Account</span>
            </div>
            <p className="text-slate-400 text-xs mt-1">{user?.email}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Full Identity Name</label>
            <input 
              type="text"
              required
              disabled={isSaving}
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-500 outline-none transition-all text-lg font-medium"
            />
          </div>

          <div className="pt-8 border-t border-slate-100">
            <h3 className="text-xl font-extrabold text-slate-800 mb-6 flex items-center gap-2">
              <Lock size={22} className="text-teal-600" />
              Security Settings
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">New Password</label>
                <input 
                  type="password"
                  disabled={isSaving}
                  placeholder="Keep current (blank)"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Verify Password</label>
                <input 
                  type="password"
                  disabled={isSaving}
                  placeholder="Repeat new password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-8">
            <p className="text-[10px] text-slate-400 max-w-[200px] font-medium leading-relaxed">
              * Note: Profile synchronization updates all linked business units globally.
            </p>
            <button 
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-3 bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl min-w-[200px] justify-center"
            >
              {isSaving ? <Loader2 className="animate-spin" size={22} /> : (isSuccess ? <CheckCircle size={22} className="text-emerald-400" /> : <Save size={22} />)}
              <span>{isSuccess ? 'Profile Updated' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
