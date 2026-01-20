
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
  console.warn("ZARlytics: Manual purge of auth cache initiated.");
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
  const [initStatus, setInitStatus] = useState("Establishing secure link...");
  const [initError, setInitError] = useState<string | null>(null);
  
  const profileFetchInProgress = useRef(false);
  const initializationStarted = useRef(false);
  const watchdogTimer = useRef<number | null>(null);

  const fetchAndSetProfile = async (sbUser: any, token: string) => {
    if (profileFetchInProgress.current) return;
    profileFetchInProgress.current = true;
    setInitStatus("Retrieving business credentials...");

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
      // We don't force a reload here anymore to avoid loops
      setInitStatus("Sync failed. Retrying...");
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
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    if (!isConfigured()) {
      setIsInitializing(false);
      return;
    }

    // Patient Watchdog: Only show the "Reset" option after 15 seconds.
    // We no longer automatically reload or clear cache.
    watchdogTimer.current = window.setTimeout(() => {
      if (isInitializing) {
        setInitError("The connection is unusually slow.");
      }
    }, 15000);

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session) await fetchAndSetProfile(session.user, session.access_token);
      } else if (event === 'SIGNED_OUT') {
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 transition-opacity duration-700">
        <div className="relative mb-10">
          <div className="w-24 h-24 border-[3px] border-slate-200 border-t-teal-600 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center font-black text-teal-600 tracking-tighter">ZAR</div>
        </div>
        
        <div className="text-center space-y-3">
          <p className="text-slate-900 font-extrabold text-2xl tracking-tight animate-pulse">{initStatus}</p>
          <p className="text-slate-400 text-sm max-w-[280px] mx-auto leading-relaxed font-medium">
            This may take a moment depending on your network conditions.
          </p>
        </div>
        
        {initError && (
          <div className="mt-12 p-8 bg-white border border-slate-200 rounded-[2.5rem] shadow-2xl shadow-slate-200/50 max-w-sm text-center animate-shake">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <p className="text-slate-900 font-black text-xl mb-3">Still loading?</p>
            <p className="text-slate-400 text-xs mb-8 leading-relaxed px-4">If the app is stuck, your browser cache might contain a conflicting session. You can try a hard reset below.</p>
            <button 
              onClick={logout}
              className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl hover:bg-black transition-all shadow-xl shadow-slate-900/20 active:scale-95 flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
              Purge Cache & Refresh
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
