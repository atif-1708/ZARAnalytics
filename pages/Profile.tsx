
import React, { useState, useEffect, useRef } from 'react';
import { User, Shield, Lock, Save, CheckCircle, Loader2, AlertTriangle, RefreshCw, Camera, Image as ImageIcon, Upload, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { storage } from '../services/mockStorage';
import { supabase } from '../services/supabase';

export const Profile: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    avatarUrl: '',
    password: '',
    confirmPassword: ''
  });

  useEffect(() => {
    if (user && !formData.name) {
      setFormData(prev => ({ 
        ...prev, 
        name: user.name,
        avatarUrl: user.avatarUrl || ''
      }));
    }
  }, [user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setErrorMessage("Image too large. Please select a file smaller than 2MB.");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, avatarUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const removeAvatar = () => {
    setFormData(prev => ({ ...prev, avatarUrl: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const triggerFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    
    setErrorMessage(null);
    setStatusMessage(null);

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
      setStatusMessage("Synchronizing profile changes...");
      await storage.saveProfile({
        id: user?.id,
        name: formData.name,
        avatarUrl: formData.avatarUrl
      });

      if (formData.password) {
        setStatusMessage("Updating security credentials...");
        const { data: fresh, error: sessionError } = await supabase.auth.getUser();
        if (sessionError || !fresh.user) {
          throw new Error("Session expired. Please sign out and sign back in to change your password.");
        }

        const { error: authError } = await supabase.auth.updateUser({ 
          password: formData.password 
        });
        
        if (authError) {
          throw new Error(`Auth Error: ${authError.message}`);
        }
      }

      await refreshProfile();
      setStatusMessage(null);
      setIsSuccess(true);
      setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
      
      setTimeout(() => setIsSuccess(false), 4000);
      
    } catch (err: any) {
      console.error("Update sequence failed:", err);
      if (err.message?.includes('avatar_url')) {
        setErrorMessage("Database Schema Error: Your 'profiles' table is missing the 'avatar_url' column. Please contact your administrator to run the migration.");
      } else {
        setErrorMessage(err.message || "A network or session error prevented the update.");
      }
      setStatusMessage(null);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white rounded-3xl p-10 shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row items-center gap-8 mb-10">
          <div className="relative group shrink-0">
            <div className="cursor-pointer" onClick={triggerFilePicker}>
              {formData.avatarUrl ? (
                <img 
                  src={formData.avatarUrl} 
                  alt={user?.name} 
                  className="w-32 h-32 bg-slate-100 rounded-full object-cover shadow-2xl ring-4 ring-slate-50 border border-slate-200 transition-transform group-hover:scale-105 duration-300" 
                  onError={(e) => (e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'U')}&background=0f172a&color=fff`)}
                />
              ) : (
                <div className="w-32 h-32 bg-slate-900 text-white rounded-full flex items-center justify-center text-5xl font-bold shadow-2xl group-hover:scale-105 transition-transform duration-300">
                  {user?.name.charAt(0)}
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 bg-teal-500 text-white p-2 rounded-xl shadow-lg ring-4 ring-white group-hover:bg-teal-600 transition-colors">
                <Camera size={18} />
              </div>
            </div>
            
            {formData.avatarUrl && (
              <button 
                type="button"
                onClick={removeAvatar}
                className="absolute -top-1 -right-1 bg-rose-500 text-white p-1.5 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove Image"
              >
                <Trash2 size={14} />
              </button>
            )}
            
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleFileChange} 
            />
          </div>
          <div className="text-center sm:text-left overflow-hidden">
            <h2 className="text-3xl font-extrabold text-slate-800 truncate">{user?.name}</h2>
            <div className="flex items-center justify-center sm:justify-start gap-2 text-slate-500 mt-1">
              <Shield size={18} className="text-teal-600" />
              <span className="text-sm font-bold uppercase tracking-widest">{user?.role} Tier Account</span>
            </div>
            <p className="text-slate-400 text-xs mt-1 truncate italic">{user?.email}</p>
            <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-4">
              <button 
                onClick={triggerFilePicker}
                className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-teal-600 hover:text-teal-700 bg-teal-50 px-3 py-1.5 rounded-lg transition-colors border border-teal-100"
              >
                <Upload size={12} />
                Gallery
              </button>
              {formData.avatarUrl && (
                <button 
                  onClick={removeAvatar}
                  className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-700 bg-rose-50 px-3 py-1.5 rounded-lg transition-colors border border-rose-100"
                >
                  <Trash2 size={12} />
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {errorMessage && (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-sm font-medium flex items-start gap-3 animate-shake">
              <AlertTriangle className="shrink-0 mt-0.5" size={18} />
              <p className="leading-tight">{errorMessage}</p>
            </div>
          )}

          {statusMessage && (
            <div className="p-4 bg-teal-50 border border-teal-100 rounded-2xl text-teal-700 text-sm font-medium flex items-center gap-3">
              <RefreshCw className="shrink-0 animate-spin" size={18} />
              <p>{statusMessage}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Account Display Name</label>
              <input 
                type="text"
                required
                disabled={isSaving}
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-500 outline-none transition-all text-sm font-bold"
                placeholder="Full Name"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Profile Image URL (Alternative)</label>
              <div className="relative">
                <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="url"
                  disabled={isSaving}
                  value={formData.avatarUrl.startsWith('data:') ? '' : formData.avatarUrl}
                  onChange={(e) => setFormData({...formData, avatarUrl: e.target.value})}
                  className="w-full pl-11 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-500 outline-none transition-all text-sm font-medium"
                  placeholder="https://images.com/avatar.jpg"
                />
              </div>
            </div>
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
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none transition-all text-sm"
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
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none transition-all text-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between pt-8 gap-6">
            <div className="flex flex-col gap-1 text-center sm:text-left">
              <p className="text-[10px] text-slate-400 font-bold leading-tight uppercase tracking-tighter">
                * Security Protocol
              </p>
              <p className="text-[10px] text-slate-400 leading-relaxed">
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
