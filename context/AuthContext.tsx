
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

// Helper to scrub problematic storage keys internally
const clearLocalAuth = () => {
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
  const [initStatus, setInitStatus] = useState("Verifying session...");
  
  const profileFetchInProgress = useRef(false);
  const initializationStarted = useRef(false);

  // Helper for requests with timeout to prevent "infinite hangs"
  const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs)
      )
    ]);
  };

  const fetchAndSetProfile = async (sbUser: any, token: string) => {
    if (profileFetchInProgress.current) return;
    profileFetchInProgress.current = true;
    setInitStatus("Syncing business credentials...");

    try {
      // Use a timeout to ensure we don't hang if the database is unresponsive
      // Fix: Added type assertion to bypass property access error on inferred '{}' type from Promise.race
      const { data: profile, error } = (await withTimeout(
        supabase.from('profiles').select('*').eq('id', sbUser.id).single(),
        5000 // 5 second timeout
      )) as any;

      if (error) {
        // Handle case where auth user exists but profile record is missing (first run)
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
        throw new Error("Profile synchronization failed.");
      } else if (profile) {
        setAuth({
          user: { id: profile.id, name: profile.name, email: sbUser.email, role: profile.role as UserRole },
          token,
          isAuthenticated: true
        });
      }
    } catch (err) {
      console.warn("Auth Recovery: Profile fetch failed or timed out. Clearing session to fix state.", err);
      // If we can't get the profile, the auth session is effectively useless
      // Reset state to force the user back to a clean login screen
      clearLocalAuth();
      setAuth({ user: null, token: null, isAuthenticated: false });
    } finally {
      profileFetchInProgress.current = false;
      setIsInitializing(false);
    }
  };

  const initializeAuth = async () => {
    if (initializationStarted.current) return;
    initializationStarted.current = true;

    try {
      // Fix: Added type assertion to bypass property access error on inferred '{}' type from Promise.race
      const { data: { session }, error } = (await withTimeout(supabase.auth.getSession(), 3000)) as any;
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
      clearLocalAuth();
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 transition-all duration-500">
        <div className="relative mb-10">
          <div className="w-20 h-20 border-[3px] border-slate-200 border-t-teal-600 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center font-black text-teal-600 tracking-tighter text-sm">ZAR</div>
        </div>
        
        <div className="text-center space-y-3">
          <p className="text-slate-900 font-extrabold text-xl tracking-tight animate-pulse">{initStatus}</p>
          <p className="text-slate-400 text-xs max-w-[240px] mx-auto leading-relaxed">
            Finalizing secure encrypted bridge...
          </p>
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
