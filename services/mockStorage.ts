
import { createClient } from '@supabase/supabase-js';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';
import { Business, DailySale, MonthlyExpense, User, UserRole, Reminder, Organization, Product } from '../types';

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
  // --- Organizations ---
  getOrganizations: async (): Promise<Organization[]> => {
    try {
      const { data, error } = await supabase.from('organizations').select('*').order('name');
      if (error) {
        if (error.code === '42703' || error.message?.includes('tier')) {
          const { data: fallbackData, error: fallbackError } = await supabase.from('organizations').select('id, name, subscription_end_date, is_active, created_at').order('name');
          if (fallbackError) throw fallbackError;
          return (fallbackData || []).map(item => {
            const mapped = mapFromDb(item);
            mapped.tier = 'starter';
            return mapped;
          }).filter(Boolean);
        }
        throw error;
      }
      return (data || []).map(item => {
        const mapped = mapFromDb(item);
        if (!mapped.tier) mapped.tier = 'starter';
        return mapped;
      }).filter(Boolean);
    } catch (err) {
      console.error("Storage Error (Organizations):", err);
      return [];
    }
  },
  
  saveOrganization: async (org: Partial<Organization>) => {
    const payload = mapToDb(org);
    try {
      const operation = payload.id ? supabase.from('organizations').upsert(payload) : supabase.from('organizations').insert(payload);
      const { data, error } = await operation.select().single();
      if (error) throw error;
      return mapFromDb(data);
    } catch (err: any) {
      console.error("Save Organization Error:", err);
      if (err.message?.includes('tier') || err.code === 'PGRST204' || err.code === '42703' || err.code === '23502') {
        throw new Error("SCHEMA_MIGRATION_REQUIRED: The 'tier' column is missing from your 'organizations' table. Please run this SQL in your Supabase Editor: ALTER TABLE organizations ADD COLUMN IF NOT EXISTS tier text DEFAULT 'starter';");
      }
      throw new Error(err.message || "Failed to save organization.");
    }
  },

  deleteOrganization: async (id: string) => {
    try {
      await supabase.from('sales').delete().eq('org_id', id);
      await supabase.from('expenses').delete().eq('org_id', id);
      await supabase.from('reminders').delete().eq('org_id', id);
      await supabase.from('businesses').delete().eq('org_id', id);
      const { error: profileError } = await supabase.from('profiles').update({ org_id: null }).eq('org_id', id);
      if (profileError) throw profileError;
      const { error } = await supabase.from('organizations').delete().eq('id', id);
      if (error) throw error;
    } catch (err: any) {
      console.error("Critical Cleanup Error during Org Deletion:", err);
      throw new Error(err.message || "Failed to delete organization cleanly.");
    }
  },

  // --- Businesses ---
  getBusinesses: async (): Promise<Business[]> => {
    try {
      const { orgId, role } = await getFilter();
      let query = supabase.from('businesses').select('*').order('name');
      if (role !== UserRole.SUPER_ADMIN || orgId) query = query.eq('org_id', orgId);
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

  // --- Products / Inventory ---
  getProducts: async (businessId?: string): Promise<Product[]> => {
    try {
      const { orgId, role } = await getFilter();
      let query = supabase.from('products').select('*').order('name');
      if (businessId) query = query.eq('business_id', businessId);
      else if (role !== UserRole.SUPER_ADMIN || orgId) query = query.eq('org_id', orgId);
      
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(mapFromDb).filter(Boolean);
    } catch (err) {
      console.error("Storage Error (Products):", err);
      return [];
    }
  },

  saveProduct: async (product: Partial<Product>) => {
    const { orgId: contextOrgId } = await getFilter();
    const finalOrgId = product.orgId || contextOrgId;
    if (!finalOrgId) throw new Error("Organization context is required for products.");

    const payload = mapToDb({ ...product, org_id: finalOrgId });
    const operation = payload.id ? supabase.from('products').upsert(payload) : supabase.from('products').insert(payload);
    const { data, error } = await operation.select().single();
    if (error) {
      if (error.code === '42P01') throw new Error("SCHEMA_ERROR: 'products' table does not exist. Please create it in Supabase.");
      throw new Error(error.message);
    }
    return mapFromDb(data);
  },

  deleteProduct: async (id: string) => {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  bulkUpsertProducts: async (products: Partial<Product>[]) => {
    const { orgId: contextOrgId } = await getFilter();
    const payloads = products.map(p => mapToDb({ ...p, org_id: p.orgId || contextOrgId }));
    const { data, error } = await supabase.from('products').upsert(payloads).select();
    if (error) throw new Error(error.message);
    return (data || []).map(mapFromDb);
  },

  // --- Sales ---
  getSales: async (): Promise<DailySale[]> => {
    try {
      const { orgId, role } = await getFilter();
      let query = supabase.from('sales').select('*').order('date', { ascending: false });
      if (role !== UserRole.SUPER_ADMIN || orgId) query = query.eq('org_id', orgId);
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
    const finalOrgId = sale.orgId || contextOrgId;
    if (!finalOrgId) throw new Error("A valid Organization Context is required to record sales.");

    // Handle stock deduction if items are present
    if (sale.items && sale.items.length > 0) {
      for (const item of sale.items) {
        // Fetch current stock
        const { data: product, error: pError } = await supabase.from('products').select('current_stock').eq('id', item.productId).single();
        if (!pError && product) {
          const newStock = Math.max(0, product.current_stock - item.quantity);
          await supabase.from('products').update({ current_stock: newStock }).eq('id', item.productId);
        }
      }
    }

    const payload = mapToDb({ ...sale, org_id: finalOrgId });
    if (payload.user_id) delete payload.user_id;
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

  // --- Expenses ---
  getExpenses: async (): Promise<MonthlyExpense[]> => {
    try {
      const { orgId, role } = await getFilter();
      let query = supabase.from('expenses').select('*').order('month', { ascending: false });
      if (role !== UserRole.SUPER_ADMIN || orgId) query = query.eq('org_id', orgId);
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
    const payload = mapToDb({ ...expense, org_id: finalOrgId });
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

  // --- Reminders ---
  getReminders: async (): Promise<Reminder[]> => {
    try {
      const { orgId, role } = await getFilter();
      let query = supabase.from('reminders').select('*').order('created_at', { ascending: false });
      if (role !== UserRole.SUPER_ADMIN || orgId) query = query.eq('org_id', orgId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(mapFromDb).filter(Boolean);
    } catch (err) {
      console.error("Storage Error (Reminders):", err);
      return [];
    }
  },

  saveReminder: async (reminder: Partial<Reminder>) => {
    let finalOrgId = reminder.orgId;
    if (!finalOrgId) {
       const filter = await getFilter();
       finalOrgId = filter.orgId;
    }
    if (!finalOrgId) throw new Error("Organization context could not be determined for this alert.");
    const payload = mapToDb({ ...reminder, orgId: finalOrgId });
    try {
      const operation = payload.id ? supabase.from('reminders').upsert(payload) : supabase.from('reminders').insert(payload);
      const { data, error, status } = await operation.select();
      if (error) {
        if (error.code === 'PGRST116' && (status === 201 || status === 200)) return reminder as Reminder; 
        throw error;
      }
      return mapFromDb(data ? data[0] : null);
    } catch (err: any) {
      console.error("Detailed Save Reminder Error:", err);
      const msg = err.message || "";
      if (msg.includes('org_id') || msg.includes('business_name') || msg.includes('sent_by_user_name')) {
        throw new Error("DATABASE_MISMATCH: Your 'reminders' table is missing required columns.");
      }
      throw new Error(err.message || "A network or permission error occurred.");
    }
  },

  deleteReminder: async (id: string) => {
    const { error } = await supabase.from('reminders').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  // --- Users / Profiles ---
  getUsers: async (): Promise<User[]> => {
    try {
      const { orgId, role } = await getFilter();
      let query = supabase.from('profiles').select('*').order('name');
      if (role !== UserRole.SUPER_ADMIN || orgId) query = query.eq('org_id', orgId);
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
