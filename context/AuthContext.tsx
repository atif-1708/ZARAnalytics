
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { User, AuthState, UserRole } from '../types';
import { supabase, isConfigured } from '../services/supabase';

interface AuthContextType extends AuthState {
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  isInitializing: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to scrub problematic storage keys without clearing user preferences
const clearAuthCache = () => {
  console.warn("ZARlytics: Purging potentially corrupted auth cache...");
  Object.keys(localStorage).forEach(key => {
    if (key.includes('supabase.auth.token') || key.startsWith('sb-')) {
      localStorage.removeItem(key);
    }
  });
  sessionStorage.clear();
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [auth, setAuth] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false
  });
  const [isInitializing, setIsInitializing] = useState(true);
  const [initStatus, setInitStatus] = useState("Verifying connection...");
  const [initError, setInitError] = useState<string | null>(null);
  
  const profileFetchInProgress = useRef(false);
  const initializationStarted = useRef(false);
  const watchdogTimer = useRef<number | null>(null);

  const fetchAndSetProfile = async (sbUser: any, token: string) => {
    if (profileFetchInProgress.current) return;
    profileFetchInProgress.current = true;
    setInitStatus("Synchronizing business profile...");

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sbUser.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
          if (count === 0) {
            const newProfile = { id: sbUser.id, name: sbUser.email?.split('@')[0] || 'Admin', role: UserRole.ADMIN };
            const { data: created } = await supabase.from('profiles').insert([newProfile]).select().single();
            if (created) {
              setAuth({
                user: { id: created.id, name: created.name, email: sbUser.email, role: created.role as UserRole },
                token,
                isAuthenticated: true
              });
              return;
            }
          }
        }
        setAuth({ user: null, token: null, isAuthenticated: false });
      } else if (profile) {
        setAuth({
          user: { id: profile.id, name: profile.name, email: sbUser.email, role: profile.role as UserRole },
          token,
          isAuthenticated: true
        });
      }
    } catch (err) {
      console.error("Auth sync failure:", err);
      // If we fail here, the cache might be bad
      setInitError("Database synchronization timed out.");
    } finally {
      profileFetchInProgress.current = false;
      setIsInitializing(false);
    }
  };

  const initializeAuth = async () => {
    if (initializationStarted.current) return;
    initializationStarted.current = true;

    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;

      if (session) {
        await fetchAndSetProfile(session.user, session.access_token);
      } else {
        setIsInitializing(false);
      }
    } catch (err) {
      console.error("Initialization error:", err);
      // Auto-clear on critical failure to prevent "loading loop"
      clearAuthCache();
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    if (!isConfigured()) {
      setIsInitializing(false);
      return;
    }

    // --- AUTOMATED WATCHDOG ---
    // If we've been loading for more than 6 seconds, we assume a hang.
    // We try to auto-heal by clearing storage and refreshing once.
    watchdogTimer.current = window.setTimeout(() => {
      if (isInitializing) {
        const hasRecovered = sessionStorage.getItem('zl_auto_recovered');
        if (!hasRecovered) {
          sessionStorage.setItem('zl_auto_recovered', 'true');
          setInitStatus("Detected stall. Auto-clearing cache and recovering...");
          clearAuthCache();
          window.location.reload();
        } else {
          setInitError("The system is struggling to connect. Please check your network or reset the session below.");
        }
      }
    }, 6000);

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session) await fetchAndSetProfile(session.user, session.access_token);
      } else if (event === 'SIGNED_OUT') {
        clearAuthCache();
        setAuth({ user: null, token: null, isAuthenticated: false });
        setIsInitializing(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      if (watchdogTimer.current) clearTimeout(watchdogTimer.current);
    };
  }, []);

  const login = async (email: string, pass: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) return { success: false, error: error.message };
      if (data.session) {
        await fetchAndSetProfile(data.user, data.session.access_token);
        return { success: true };
      }
      return { success: false, error: "Authentication failed." };
    } catch (err: any) {
      return { success: false, error: err?.message || "Connection error." };
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      clearAuthCache();
      setAuth({ user: null, token: null, isAuthenticated: false });
      window.location.reload(); 
    }
  };

  const refreshProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) await fetchAndSetProfile(session.user, session.access_token);
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 transition-opacity duration-500">
        <div className="relative mb-8">
          <div className="w-20 h-20 border-[4px] border-emerald-100 border-t-emerald-600 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center font-black text-emerald-600">ZL</div>
        </div>
        
        <div className="text-center space-y-2">
          <p className="text-slate-800 font-bold text-xl tracking-tight">{initStatus}</p>
          <p className="text-slate-400 text-sm max-w-xs mx-auto leading-relaxed">
            Please wait while we establish a secure, low-latency bridge to the South African business database.
          </p>
        </div>
        
        {initError && (
          <div className="mt-12 p-8 bg-white border border-slate-200 rounded-[2.5rem] shadow-2xl shadow-slate-200/50 max-w-sm text-center animate-shake ring-4 ring-rose-50">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <p className="text-slate-900 font-black text-lg mb-2">{initError}</p>
            <p className="text-slate-400 text-xs mb-8 leading-relaxed">Local storage contains a stale session that is blocking your access. This reset will completely clear the app's local memory.</p>
            <button 
              onClick={logout}
              className="w-full bg-rose-600 text-white font-bold py-4 rounded-2xl hover:bg-rose-700 transition-all shadow-xl shadow-rose-600/20 active:scale-95"
            >
              Forced Cache Purge & Reload
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ ...auth, login, logout, refreshProfile, isInitializing }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
