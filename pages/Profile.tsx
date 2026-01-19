
import React, { useState, useEffect } from 'react';
import { User, Shield, Lock, Save, CheckCircle, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { storage } from '../services/mockStorage';
import { supabase } from '../services/supabase';

export const Profile: React.FC = () => {
  const { user } = useAuth();
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    password: '',
    confirmPassword: ''
  });

  // Sync local form with user context only once on load or when user explicitly changes
  useEffect(() => {
    if (user && !formData.name) {
      setFormData(prev => ({ ...prev, name: user.name }));
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    
    setErrorMessage(null);
    setStatusMessage(null);

    // 1. Client-side Validation
    if (formData.password) {
      if (formData.password.length < 6) {
        setErrorMessage("Security rule: Password must be at least 6 characters.");
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setErrorMessage("Verification mismatch: Passwords do not match.");
        return;
      }
    }

    setIsSaving(true);
    try {
      // 2. Update Display Name first (Database operation)
      setStatusMessage("Synchronizing profile name...");
      await storage.saveProfile({
        id: user?.id,
        name: formData.name
      });

      // 3. Update Password if provided (Auth operation)
      if (formData.password) {
        setStatusMessage("Updating security credentials...");
        
        // Ensure session is still valid before attempting password change
        const { data: { user: freshUser }, error: sessionError } = await supabase.auth.getUser();
        if (sessionError || !freshUser) {
          throw new Error("Session expired. Please sign out and sign back in to change your password.");
        }

        const { error: authError } = await supabase.auth.updateUser({ 
          password: formData.password 
        });
        
        if (authError) {
          throw new Error(`Auth Error: ${authError.message}`);
        }
      }

      // 4. Finalize
      setStatusMessage(null);
      setIsSuccess(true);
      setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
      
      // We don't call refreshProfile here because the global listener 
      // in AuthContext will trigger on USER_UPDATED automatically.
      
      setTimeout(() => setIsSuccess(false), 4000);
      
    } catch (err: any) {
      console.error("Update sequence failed:", err);
      setErrorMessage(err.message || "A network or session error prevented the update.");
      setStatusMessage(null);
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
              <span className="text-sm font-bold uppercase tracking-widest">{user?.role} Tier Account</span>
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

          {statusMessage && (
            <div className="p-4 bg-teal-50 border border-teal-100 rounded-2xl text-teal-700 text-sm font-medium flex items-center gap-3">
              <RefreshCw className="shrink-0 animate-spin" size={18} />
              <p>{statusMessage}</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Account Display Name</label>
            <input 
              type="text"
              required
              disabled={isSaving}
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-500 outline-none transition-all text-lg font-medium"
              placeholder="e.g. John Doe"
            />
          </div>

          <div className="pt-8 border-t border-slate-100">
            <h3 className="text-xl font-extrabold text-slate-800 mb-6 flex items-center gap-2">
              <Lock size={22} className="text-teal-600" />
              Update Security
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">New Password</label>
                <input 
                  type="password"
                  disabled={isSaving}
                  autoComplete="new-password"
                  placeholder="Min 6 characters"
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
            <div className="flex flex-col gap-1">
              <p className="text-[10px] text-slate-400 max-w-[200px] font-bold leading-tight uppercase tracking-tighter">
                * Security Protocol
              </p>
              <p className="text-[10px] text-slate-400 max-w-[200px] leading-relaxed">
                Updates will be reflected across all linked devices immediately.
              </p>
            </div>
            <button 
              type="submit"
              disabled={isSaving}
              className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-bold transition-all shadow-xl min-w-[220px] justify-center ${
                isSuccess ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white hover:bg-slate-800'
              }`}
            >
              {isSaving ? (
                <>
                  <Loader2 className="animate-spin" size={22} />
                  <span>Processing...</span>
                </>
              ) : isSuccess ? (
                <>
                  <CheckCircle size={22} />
                  <span>Update Successful</span>
                </>
              ) : (
                <>
                  <Save size={22} />
                  <span>Apply Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
