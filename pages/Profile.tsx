
import React, { useState } from 'react';
import { User, Shield, Lock, Save, CheckCircle, Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { storage } from '../services/mockStorage';
import { supabase } from '../services/supabase';

export const Profile: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    password: '',
    confirmPassword: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setErrorMessage(null);

    // Basic Validation
    if (formData.password) {
      if (formData.password.length < 6) {
        setErrorMessage("Password must be at least 6 characters long.");
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setErrorMessage("Passwords do not match.");
        return;
      }
    }

    setIsSaving(true);
    try {
      // 1. Update Auth Password first (more likely to fail due to security rules)
      if (formData.password) {
        const { error: authError } = await supabase.auth.updateUser({ 
          password: formData.password 
        });
        
        if (authError) {
          throw new Error(`Security Update Failed: ${authError.message}`);
        }
      }

      // 2. Update Profile Display Name in DB
      await storage.saveProfile({
        id: user?.id,
        name: formData.name
      });

      // 3. Sync and show success
      await refreshProfile();
      setIsSuccess(true);
      setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
      setTimeout(() => setIsSuccess(false), 3000);
      
    } catch (err: any) {
      console.error("Profile update error:", err);
      setErrorMessage(err.message || "An unexpected error occurred while updating your profile.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white rounded-3xl p-10 shadow-sm border border-slate-200">
        <div className="flex items-center gap-8 mb-10">
          <div className="w-24 h-24 bg-slate-900 text-white rounded-full flex items-center justify-center text-4xl font-bold shadow-2xl shrink-0">
            {user?.name.charAt(0)}
          </div>
          <div className="overflow-hidden">
            <h2 className="text-3xl font-extrabold text-slate-800 truncate">{user?.name}</h2>
            <div className="flex items-center gap-2 text-slate-500 mt-1">
              <Shield size={18} className="text-teal-600" />
              <span className="text-sm font-bold uppercase tracking-widest">{user?.role} Access</span>
            </div>
            <p className="text-slate-400 text-xs mt-1 truncate">{user?.email}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {errorMessage && (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-sm font-medium flex items-start gap-3 animate-shake">
              <AlertTriangle className="shrink-0 mt-0.5" size={18} />
              <p>{errorMessage}</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Full Identity Name</label>
            <input 
              type="text"
              required
              disabled={isSaving}
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-500 outline-none transition-all text-lg font-medium"
              placeholder="Display Name"
            />
          </div>

          <div className="pt-8 border-t border-slate-100">
            <h3 className="text-xl font-extrabold text-slate-800 mb-6 flex items-center gap-2">
              <Lock size={22} className="text-teal-600" />
              Account Security
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">New Password</label>
                <input 
                  type="password"
                  disabled={isSaving}
                  autoComplete="new-password"
                  placeholder="Leave blank to keep"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Confirm New Password</label>
                <input 
                  type="password"
                  disabled={isSaving}
                  autoComplete="new-password"
                  placeholder="Repeat new password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-8 gap-6">
            <p className="text-[10px] text-slate-400 max-w-[200px] font-medium leading-relaxed">
              * Note: Updating your password will require you to use the new credentials at your next sign-in.
            </p>
            <button 
              type="submit"
              disabled={isSaving}
              className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-bold transition-all shadow-xl min-w-[200px] justify-center ${
                isSuccess ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white hover:bg-slate-800'
              }`}
            >
              {isSaving ? (
                <>
                  <Loader2 className="animate-spin" size={22} />
                  <span>Syncing...</span>
                </>
              ) : isSuccess ? (
                <>
                  <CheckCircle size={22} />
                  <span>Profile Updated</span>
                </>
              ) : (
                <>
                  <Save size={22} />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
