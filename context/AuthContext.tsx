
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [auth, setAuth] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false
  });
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const profileFetchInProgress = useRef(false);
  const initializationStarted = useRef(false);

  const fetchAndSetProfile = async (sbUser: any, token: string) => {
    // Prevent concurrent profile fetches which can lead to race conditions
    if (profileFetchInProgress.current) return;
    profileFetchInProgress.current = true;

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sbUser.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Check if database is empty for initial admin setup
          const { count } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true });

          if (count === 0) {
            const newProfile = { 
              id: sbUser.id, 
              name: sbUser.email?.split('@')[0] || 'Admin', 
              role: UserRole.ADMIN 
            };
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
        
        // If profile fetch fails but auth exists, something is wrong with the data layer.
        // Revert to unauthenticated to allow user to re-login and fix the state.
        setAuth({ user: null, token: null, isAuthenticated: false });
      } else if (profile) {
        setAuth({
          user: { id: profile.id, name: profile.name, email: sbUser.email, role: profile.role as UserRole },
          token,
          isAuthenticated: true
        });
      }
    } catch (err) {
      console.error("Auth initialization error:", err);
      setInitError("Critical connection failure during profile sync.");
    } finally {
      profileFetchInProgress.current = false;
      setIsInitializing(false);
    }
  };

  const initializeAuth = async () => {
    if (initializationStarted.current) return;
    initializationStarted.current = true;

    try {
      // 1. Proactively get existing session instead of waiting for event listener
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        throw error;
      }

      if (session) {
        await fetchAndSetProfile(session.user, session.access_token);
      } else {
        setIsInitializing(false);
      }
    } catch (err) {
      console.error("Session fetch failed:", err);
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    if (!isConfigured()) {
      setIsInitializing(false);
      return;
    }

    // Safety watchdog: Max 8 seconds for total initialization
    const timer = setTimeout(() => {
      if (isInitializing) {
        setInitError("Network timeout: The session is stuck in the loading state.");
      }
    }, 8000);

    initializeAuth();

    // 2. Setup listener for *subsequent* changes (like logout from another tab)
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
      clearTimeout(timer);
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
    } catch (e) {
      console.warn("Sign out failed:", e);
    } finally {
      // Manually scrub all Supabase related keys to prevent "cache-hanging"
      Object.keys(localStorage).forEach(key => {
        if (key.includes('supabase.auth.token') || key.includes('sb-')) {
          localStorage.removeItem(key);
        }
      });
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
        <div className="relative">
          <div className="w-16 h-16 border-[3px] border-emerald-100 border-t-emerald-600 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center font-bold text-emerald-600 text-xs">ZL</div>
        </div>
        
        <p className="mt-8 text-slate-800 font-bold text-lg animate-pulse tracking-tight">Authenticating...</p>
        <p className="mt-2 text-slate-400 text-xs text-center max-w-xs">Establishing secure bridge to business database clusters.</p>
        
        {initError && (
          <div className="mt-12 p-8 bg-white border border-slate-200 rounded-[2rem] shadow-2xl shadow-slate-200/50 max-w-sm text-center animate-shake">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
            </div>
            <p className="text-slate-800 font-bold mb-2">{initError}</p>
            <p className="text-slate-400 text-xs mb-8 leading-relaxed">Browser local storage may contain a stale or corrupt session token. Resetting will clear your local app cache.</p>
            <button 
              onClick={logout}
              className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl hover:bg-black transition-all shadow-xl shadow-slate-900/20 active:scale-95"
            >
              Clear Session & Force Reload
            </button>
          </div>
        )}
      </div>
    );
  }

  if (!isConfigured()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-6">
        <div className="max-w-md w-full bg-slate-800 p-10 rounded-3xl border border-slate-700 shadow-2xl text-center">
           <h1 className="text-white text-2xl font-bold mb-4">Environment Failure</h1>
           <p className="text-slate-400 leading-relaxed">The application could not detect the required environment variables. Ensure SUPABASE_URL and SUPABASE_ANON_KEY are correctly defined.</p>
        </div>
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
