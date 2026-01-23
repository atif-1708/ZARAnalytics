
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { User, AuthState, UserRole, Organization } from '../types';
import { supabase, isConfigured } from '../services/supabase';
import { ShieldAlert, Loader2 } from 'lucide-react';

interface AuthContextType extends AuthState {
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  isInitializing: boolean;
  selectedOrgId: string | null;
  setSelectedOrgId: (id: string | null) => void;
  isSuspended: boolean;
  suspendedOrgName: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const withTimeout = <T extends unknown>(promise: Promise<T> | any, timeoutMs: number, fallback: T): Promise<T> => {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs))
  ]);
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [auth, setAuth] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false
  });
  const [isInitializing, setIsInitializing] = useState(true);
  const [criticalError, setCriticalError] = useState<string | null>(null);
  const [selectedOrgId, setSelectedOrgIdState] = useState<string | null>(localStorage.getItem('zarlytics_ghost_org_id'));
  const [isSuspended, setIsSuspended] = useState(false);
  const [suspendedOrgName, setSuspendedOrgName] = useState<string | null>(null);
  const initHandled = useRef(false);

  const checkOrgSuspension = async (orgId: string | null, role?: UserRole) => {
    if (!orgId || role === UserRole.SUPER_ADMIN && !selectedOrgId) {
      setIsSuspended(false);
      setSuspendedOrgName(null);
      return;
    }

    try {
      const { data: org } = await supabase.from('organizations').select('name, is_active, subscription_end_date').eq('id', orgId).single();
      if (org) {
        const expired = new Date(org.subscription_end_date) < new Date();
        const suspended = !org.is_active || expired;
        setIsSuspended(suspended);
        setSuspendedOrgName(suspended ? org.name : null);
      }
    } catch (e) {
      console.error("Suspension check failed", e);
    }
  };

  const setSelectedOrgId = async (id: string | null) => {
    if (!id) {
      localStorage.removeItem('zarlytics_ghost_org_id');
      setSelectedOrgIdState(null);
      setIsSuspended(false);
      return;
    }
    localStorage.setItem('zarlytics_ghost_org_id', id);
    setSelectedOrgIdState(id);
    await checkOrgSuspension(id, auth.user?.role);
  };

  const performEmergencyReset = (reason: string) => {
    if (criticalError) return;
    console.error("Auth Recovery Check:", reason);
    if (typeof (window as any).performNuclearReset === 'function') {
      (window as any).performNuclearReset(reason);
    } else {
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    }
  };

  const fetchProfile = async (sbUser: any, token: string) => {
    try {
      const response = await withTimeout(
        supabase.from('profiles').select('*').eq('id', sbUser.id).single() as any,
        10000,
        { data: null, error: { message: 'Profile Fetch Timeout' } }
      ) as any;

      const { data: profile, error } = response;

      if (!profile && !error?.message?.includes('avatar_url')) {
        setCriticalError("ACCESS_REVOKED");
        setAuth({ user: null, token: null, isAuthenticated: false });
        setIsInitializing(false);
        return;
      }

      const role = (profile?.role as UserRole) || UserRole.VIEW_ONLY;
      const orgId = profile?.org_id || null;
      
      setAuth({
        user: { 
          id: sbUser.id, 
          name: profile?.name || sbUser.user_metadata?.full_name || 'Business User', 
          email: sbUser.email, 
          role,
          assignedBusinessIds: profile?.assigned_business_ids || [], 
          avatarUrl: profile?.avatar_url || null,
          orgId
        },
        token,
        isAuthenticated: true
      });

      // For normal users, check their own org. For Super Admins, check ghost org if selected.
      const targetOrg = role === UserRole.SUPER_ADMIN ? selectedOrgId : orgId;
      await checkOrgSuspension(targetOrg, role);
      
      setCriticalError(null);
    } catch (err) {
      console.error("Profile fetch sequence failed.", err);
      setAuth({
        user: { 
          id: sbUser.id, 
          name: sbUser.user_metadata?.full_name || 'Business User', 
          email: sbUser.email, 
          role: UserRole.VIEW_ONLY 
        },
        token,
        isAuthenticated: true
      });
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    if (initHandled.current) return;
    initHandled.current = true;

    const safetyTimeout = setTimeout(() => {
      if (isInitializing && !criticalError) {
        performEmergencyReset("Auth initialization hung.");
      }
    }, 20000);

    const checkAuth = async () => {
      if (!isConfigured()) {
        setIsInitializing(false);
        return;
      }

      try {
        const { data: { session } } = await withTimeout(
          supabase.auth.getSession() as any,
          8000,
          { data: { session: null }, error: null }
        ) as any;

        if (session && session.user) {
          await fetchProfile(session.user, session.access_token);
        } else {
          setIsInitializing(false);
        }
      } catch (err) {
        console.error("Auth session check failed:", err);
        setIsInitializing(false);
      } finally {
        clearTimeout(safetyTimeout);
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') && session) {
        await fetchProfile(session.user, session.access_token);
      } else if (event === 'SIGNED_OUT') {
        setAuth({ user: null, token: null, isAuthenticated: false });
        setCriticalError(null);
        setIsInitializing(false);
        setIsSuspended(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(safetyTimeout);
    };
  }, []);

  const login = async (email: string, pass: string) => {
    try {
      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password: pass }) as any,
        15000,
        { data: { user: null, session: null }, error: { message: 'Login connection timed out.' } }
      ) as any;

      if (error) return { success: false, error: error.message };
      
      if (data.session) {
        await fetchProfile(data.user, data.session.access_token);
        return { success: true };
      }
      return { success: false, error: "Authentication failed." };
    } catch (err: any) {
      return { success: false, error: err.message || "An unexpected error occurred." };
    }
  };

  const logout = async () => {
    try {
      localStorage.setItem('zarlytics_app_ready_signal', 'true');
      localStorage.removeItem('zarlytics_ghost_org_id');
      await withTimeout(supabase.auth.signOut(), 3000, null);
    } finally {
      setAuth({ user: null, token: null, isAuthenticated: false });
      setCriticalError(null);
      setIsSuspended(false);
      sessionStorage.clear();
      window.location.reload();
    }
  };

  const refreshProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) await fetchProfile(session.user, session.access_token);
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
        <div className="relative mb-6">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-teal-600 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center font-black text-[8px] text-teal-600 uppercase">ZAR</div>
        </div>
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">Syncing Business Core</p>
      </div>
    );
  }

  if (criticalError === "ACCESS_REVOKED") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white p-10 rounded-[2.5rem] shadow-2xl border border-rose-100 text-center space-y-6">
          <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mx-auto">
            <ShieldAlert size={40} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Access Revoked</h2>
            <p className="text-sm text-slate-500 font-medium leading-relaxed">
              Authenticated session detected, but no matching business profile was found in our database. 
            </p>
          </div>
          <button 
            onClick={logout}
            className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-sm hover:bg-rose-600 transition-all group"
          >
            Clear Session & Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ ...auth, login, logout, refreshProfile, isInitializing, selectedOrgId, setSelectedOrgId, isSuspended, suspendedOrgName }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
