import { createClient } from '@supabase/supabase-js';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';
import { Business, DailySale, MonthlyExpense, User, UserRole, Reminder, Organization } from '../types';

const mapToDb = (obj: any) => {
  if (!obj) return null;
  const mapped: any = {};
  for (const key in obj) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    mapped[snakeKey] = obj[key];
  }
  return mapped;
};

const mapFromDb = (obj: any) => {
  if (!obj || typeof obj !== 'object') return null;
  const mapped: any = {};
  for (const key in obj) {
    const camelKey = key.replace(/([-_][a-z])/g, group =>
      group.toUpperCase().replace('-', '').replace('_', '')
    );
    mapped[camelKey] = obj[key];
  }
  return mapped;
};

// Helper to get active filtering criteria based on user and context
const getFilter = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { orgId: null, role: null, userId: null };
  
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
  const ghostOrgId = localStorage.getItem('zarlytics_ghost_org_id');
  
  const role = (profile?.role as UserRole) || UserRole.VIEW_ONLY;
  const userOrgId = profile?.org_id;

  if (role === UserRole.SUPER_ADMIN) {
    return { orgId: ghostOrgId || null, role: UserRole.SUPER_ADMIN, userId: session.user.id };
  }
  
  return { orgId: userOrgId || null, role, userId: session.user.id };
};

export const storage = {
  getOrganizations: async (): Promise<Organization[]> => {
    try {
      const { data, error } = await supabase.from('organizations').select('*').order('name');
      if (error) throw error;
      return (data || []).map(mapFromDb).filter(Boolean);
    } catch (err) {
      console.error("Storage Error (Organizations):", err);
      return [];
    }
  },
  
  saveOrganization: async (org: Partial<Organization>) => {
    const payload = mapToDb(org);
    const operation = payload.id ? supabase.from('organizations').upsert(payload) : supabase.from('organizations').insert(payload);
    const { data, error } = await operation.select().single();
    if (error) throw new Error(error.message);
    return mapFromDb(data);
  },

  getBusinesses: async (): Promise<Business[]> => {
    try {
      const { orgId, role } = await getFilter();
      let query = supabase.from('businesses').select('*').order('name');
      
      if (role !== UserRole.SUPER_ADMIN || orgId) {
        query = query.eq('org_id', orgId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(mapFromDb).filter(Boolean);
    } catch (err) {
      console.error("Storage Error (Businesses):", err);
      return [];
    }
  },

  saveBusiness: async (business: Partial<Business>) => {
    const { orgId: contextOrgId } = await getFilter();
    const finalOrgId = business.orgId || contextOrgId;
    
    if (!finalOrgId) throw new Error("Organization ID is required to save a business.");
    
    const payload = mapToDb({ ...business, org_id: finalOrgId });
    const operation = payload.id ? supabase.from('businesses').upsert(payload) : supabase.from('businesses').insert(payload);
    const { data, error } = await operation.select().single();
    if (error) throw new Error(error.message);
    return mapFromDb(data);
  },

  deleteBusiness: async (id: string) => {
    const { error } = await supabase.from('businesses').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  getSales: async (): Promise<DailySale[]> => {
    try {
      const { orgId, role } = await getFilter();
      let query = supabase.from('sales').select('*').order('date', { ascending: false });
      
      if (role !== UserRole.SUPER_ADMIN || orgId) {
        query = query.eq('org_id', orgId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(mapFromDb).filter(Boolean);
    } catch (err) {
      console.error("Storage Error (Sales):", err);
      return [];
    }
  },

  saveSale: async (sale: Partial<DailySale>) => {
    const { orgId: contextOrgId } = await getFilter();
    
    // We strictly use the orgId provided by the UI (from the business lookup) 
    // to ensure RLS compliance even if the user is a Super Admin in ghost mode.
    const finalOrgId = sale.orgId || contextOrgId;

    if (!finalOrgId) throw new Error("A valid Organization Context is required to record sales.");

    const payload = mapToDb({ 
      ...sale, 
      org_id: finalOrgId 
    });
    
    // Ensure we don't send userId if it's not in the schema
    if (payload.user_id) delete payload.user_id;
    
    // Clean ID if it's a temp placeholder
    if (payload.id && (payload.id.length < 5)) delete payload.id;
    
    const operation = payload.id ? supabase.from('sales').upsert(payload) : supabase.from('sales').insert(payload);
    const { data, error } = await operation.select().single();
    if (error) throw new Error(error.message);
    return mapFromDb(data);
  },

  deleteSale: async (id: string) => {
    const { error } = await supabase.from('sales').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  getExpenses: async (): Promise<MonthlyExpense[]> => {
    try {
      const { orgId, role } = await getFilter();
      let query = supabase.from('expenses').select('*').order('month', { ascending: false });
      
      if (role !== UserRole.SUPER_ADMIN || orgId) {
        query = query.eq('org_id', orgId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(mapFromDb).filter(Boolean);
    } catch (err) {
      console.error("Storage Error (Expenses):", err);
      return [];
    }
  },

  saveExpense: async (expense: Partial<MonthlyExpense>) => {
    const { orgId: contextOrgId } = await getFilter();
    const finalOrgId = expense.orgId || contextOrgId;

    if (!finalOrgId) throw new Error("Organization context is required for expenses.");

    const payload = mapToDb({ 
      ...expense, 
      org_id: finalOrgId
    });
    
    if (payload.user_id) delete payload.user_id;
    
    const operation = payload.id ? supabase.from('expenses').upsert(payload) : supabase.from('expenses').insert(payload);
    const { data, error } = await operation.select().single();
    if (error) throw new Error(error.message);
    return mapFromDb(data);
  },

  deleteExpense: async (id: string) => {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  getReminders: async (): Promise<Reminder[]> => {
    try {
      const { orgId, role } = await getFilter();
      let query = supabase.from('reminders').select('*').order('created_at', { ascending: false });
      
      if (role !== UserRole.SUPER_ADMIN || orgId) {
        query = query.eq('org_id', orgId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(mapFromDb).filter(Boolean);
    } catch (err) {
      console.error("Storage Error (Reminders):", err);
      return [];
    }
  },

  saveReminder: async (reminder: Partial<Reminder>) => {
    const { orgId: contextOrgId } = await getFilter();
    const finalOrgId = reminder.orgId || contextOrgId;
    
    if (!finalOrgId) throw new Error("Organization ID is required to save a reminder.");

    const payload = mapToDb({ ...reminder, org_id: finalOrgId });
    const operation = payload.id ? supabase.from('reminders').upsert(payload) : supabase.from('reminders').insert(payload);
    const { data, error } = await operation.select().single();
    if (error) throw new Error(error.message);
    return mapFromDb(data);
  },

  deleteReminder: async (id: string) => {
    const { error } = await supabase.from('reminders').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  getUsers: async (): Promise<User[]> => {
    try {
      const { orgId, role } = await getFilter();
      let query = supabase.from('profiles').select('*').order('name');
      
      if (role !== UserRole.SUPER_ADMIN || orgId) {
        query = query.eq('org_id', orgId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(mapFromDb).filter(Boolean);
    } catch (err) {
      console.error("Storage Error (Users):", err);
      return [];
    }
  },
  
  createNewUser: async (userData: { name: string, email: string, role: UserRole, assignedBusinessIds?: string[], password?: string, orgId?: string }) => {
    const backgroundSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { data: authData, error: authError } = await backgroundSupabase.auth.signUp({
      email: userData.email,
      password: userData.password || 'Temporary123!',
      options: { data: { full_name: userData.name } }
    });
    
    if (authError) throw new Error(authError.message);
    if (!authData.user) throw new Error("User creation failed.");
    
    const { orgId: contextOrgId } = await getFilter();
    const profilePayload = { 
      id: authData.user.id, 
      name: userData.name, 
      role: userData.role,
      assigned_business_ids: userData.assignedBusinessIds || [],
      org_id: userData.orgId || contextOrgId 
    };
    
    const { error: profileError } = await supabase.from('profiles').upsert(profilePayload);
    if (profileError) throw new Error(profileError.message);
    
    return authData.user;
  },

  saveProfile: async (profile: Partial<User>) => {
    const payload = mapToDb(profile);
    if (payload.email) delete payload.email;
    const { data, error } = await supabase.from('profiles').upsert(payload).select().single();
    if (error) throw new Error(error.message);
    return mapFromDb(data);
  },

  deleteUser: async (id: string) => {
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }
};