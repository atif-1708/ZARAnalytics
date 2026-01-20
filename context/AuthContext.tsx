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
  
  const initHandled = useRef(false);

  const fetchProfile = async (sbUser: any, token: string) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sbUser.id)
        .single();

      if (error) {
        // Fallback for missing profile
        setAuth({
          user: { id: sbUser.id, name: sbUser.email?.split('@')[0] || 'User', email: sbUser.email, role: UserRole.USER },
          token,
          isAuthenticated: true
        });
      } else {
        setAuth({
          user: { id: profile.id, name: profile.name, email: sbUser.email, role: profile.role as UserRole },
          token,
          isAuthenticated: true
        });
      }
    } catch (err) {
      console.error("Profile fetch error:", err);
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    if (initHandled.current) return;
    initHandled.current = true;

    // Absolute timeout to prevent infinite loader
    const safetyTimeout = setTimeout(() => {
      setIsInitializing(false);
    }, 10000);

    const checkAuth = async () => {
      if (!isConfigured()) {
        setIsInitializing(false);
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await fetchProfile(session.user, session.access_token);
        } else {
          setIsInitializing(false);
        }
      } catch (err) {
        console.error("Auth check failed:", err);
        setIsInitializing(false);
      } finally {
        clearTimeout(safetyTimeout);
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        await fetchProfile(session.user, session.access_token);
      } else if (event === 'SIGNED_OUT') {
        setAuth({ user: null, token: null, isAuthenticated: false });
        setIsInitializing(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) return { success: false, error: error.message };
    if (data.session) {
      await fetchProfile(data.user, data.session.access_token);
      return { success: true };
    }
    return { success: false, error: "Auth failed." };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setAuth({ user: null, token: null, isAuthenticated: false });
    window.location.reload();
  };

  const refreshProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) await fetchProfile(session.user, session.access_token);
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white p-6">
        <div className="w-10 h-10 border-2 border-slate-100 border-t-teal-600 rounded-full animate-spin mb-4"></div>
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Initialising ZARlytics...</p>
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