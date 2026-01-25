
import { createClient } from '@supabase/supabase-js';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';
import { Business, DailySale, MonthlyExpense, User, UserRole, Reminder, Organization, Product, StockMovement, SaleItem } from '../types';
import { getLocalISOString } from '../utils/formatters';

const mapToDb = (obj: any) => {
  if (!obj) return null;
  const mapped: any = {};
  for (const key in obj) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    const value = obj[key];
    if (typeof value === 'string' && value.trim() === '' && (snakeKey.endsWith('_id') || snakeKey === 'id')) {
      continue; 
    }
    mapped[snakeKey] = value;
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
  if (!session) return { orgId: null, role: null, userId: null, userName: null };
  
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
  const ghostOrgId = localStorage.getItem('zarlytics_ghost_org_id');
  
  const role = (profile?.role as UserRole) || UserRole.VIEW_ONLY;
  const userOrgId = profile?.org_id;

  if (role === UserRole.SUPER_ADMIN) {
    return { orgId: ghostOrgId || null, role: UserRole.SUPER_ADMIN, userId: session.user.id, userName: profile?.name || session.user.email };
  }
  
  return { orgId: userOrgId || null, role, userId: session.user.id, userName: profile?.name || session.user.email };
};

export const storage = {
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
        throw new Error("SCHEMA_MIGRATION_REQUIRED: The 'tier' column is missing from your 'organizations' table.");
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

  getProducts: async (businessId?: string): Promise<Product[]> => {
    try {
      const { orgId, role } = await getFilter();
      let query = supabase.from('products').select('*').order('sku');
      if (businessId) query = query.eq('business_id', businessId);
      else if (role !== UserRole.SUPER_ADMIN || orgId) query = query.eq('org_id', orgId);
      
      const { data, error } = await query;
      if (error) {
        if (error.code === '42P01') throw new Error("SCHEMA_MISSING");
        throw error;
      }
      return (data || []).map(mapFromDb).filter(Boolean);
    } catch (err: any) {
      if (err.message?.includes('SCHEMA_MISSING')) throw err;
      console.error("Storage Error (Products):", err);
      return [];
    }
  },

  saveProduct: async (product: Partial<Product>) => {
    const { orgId: contextOrgId } = await getFilter();
    const finalOrgId = product.orgId || contextOrgId;
    
    const productWithGracefulName = {
      ...product,
      name: product.sku || 'Unnamed Item'
    };

    const payload = mapToDb({ ...productWithGracefulName, org_id: finalOrgId });
    const operation = payload.id ? supabase.from('products').upsert(payload) : supabase.from('products').insert(payload);
    const { data, error } = await operation.select().single();
    if (error) throw new Error(error.message);
    return mapFromDb(data);
  },

  deleteProduct: async (id: string) => {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  bulkUpsertProducts: async (products: Partial<Product>[]) => {
    const { orgId: contextOrgId } = await getFilter();
    const payloads = products.map(p => {
      const data = { ...p, name: p.sku || 'Unnamed Item', org_id: p.orgId || contextOrgId };
      return mapToDb(data);
    });
    const { data, error } = await supabase.from('products').upsert(payloads).select();
    if (error) throw new Error(error.message);
    return (data || []).map(mapFromDb);
  },

  getStockMovements: async (productId?: string): Promise<StockMovement[]> => {
    try {
      const { orgId } = await getFilter();
      let query = supabase.from('stock_movements').select('*').order('created_at', { ascending: false });
      if (productId) query = query.eq('product_id', productId);
      else if (orgId) query = query.eq('org_id', orgId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(mapFromDb).filter(Boolean);
    } catch (err) {
      console.error("Storage Error (Movements):", err);
      return [];
    }
  },

  recordStockAdjustment: async (productId: string, quantity: number, type: StockMovement['type'], reason: string) => {
    const { orgId, userName } = await getFilter();
    const { data: product, error: pError } = await supabase.from('products').select('*').eq('id', productId).single();
    if (pError || !product) throw new Error("Product not found.");

    const movementPayload = mapToDb({
      productId,
      quantity,
      type,
      reason,
      businessId: product.business_id,
      orgId: product.org_id,
      userName: userName || 'System'
    });
    
    const { error: mError } = await supabase.from('stock_movements').insert(movementPayload);
    if (mError) throw new Error("Failed to log movement: " + mError.message);

    const newStock = Math.max(0, (product.current_stock || 0) + quantity);
    const { error: uError } = await supabase.from('products').update({ current_stock: newStock }).eq('id', productId);
    if (uError) throw new Error("Failed to update stock: " + uError.message);
    
    return true;
  },

  saveSale: async (sale: Partial<DailySale>) => {
    const { orgId: contextOrgId, userName } = await getFilter();
    const finalOrgId = sale.orgId || contextOrgId;
    
    if (sale.items && sale.items.length > 0) {
      for (const item of sale.items) {
        try {
          const movementPayload = mapToDb({
            productId: item.productId,
            quantity: -item.quantity,
            type: 'sale',
            reason: `Sale Transaction (SKU: ${item.sku})`,
            businessId: sale.businessId,
            orgId: finalOrgId,
            userName: userName || 'POS Terminal'
          });
          await supabase.from('stock_movements').insert(movementPayload);

          const { data: prod } = await supabase.from('products').select('current_stock').eq('id', item.productId).single();
          if (prod) {
            const newStock = Math.max(0, prod.current_stock - item.quantity);
            await supabase.from('products').update({ current_stock: newStock }).eq('id', item.productId);
          }
        } catch(e) {
          console.warn("Stock sync failed:", item.productId, e);
        }
      }
    }

    const payload = mapToDb({ ...sale, org_id: finalOrgId });
    if (payload.user_id) delete payload.user_id;
    
    // TIME FIX: Use standard ISO String which includes 'Z'.
    // This allows Postgres `timestamptz` to correctly identify it as UTC and convert it to server time properly.
    // If the DB column is DATE, this will be truncated to YYYY-MM-DD.
    // If the DB column is TEXT, this will save the full UTC string.
    if (!payload.date || payload.date.length <= 10) {
      payload.date = new Date().toISOString(); 
    }
    
    const operation = payload.id ? supabase.from('sales').upsert(payload) : supabase.from('sales').insert(payload);
    const { data, error } = await operation.select().single();
    if (error) throw new Error(error.message);
    return mapFromDb(data);
  },

  processRefund: async (saleId: string, refundItems?: { sku: string, quantity: number, price: number, productId: string }[]) => {
    const { userName, orgId: contextOrgId } = await getFilter();
    
    const { data: originalDb, error: fetchError } = await supabase.from('sales').select('*').eq('id', saleId).single();
    if (fetchError || !originalDb) throw new Error("Original transaction not found.");
    
    const original = mapFromDb(originalDb);
    if (original.isRefunded) throw new Error("Transaction has already been fully refunded.");

    const itemsToProcess = refundItems && refundItems.length > 0 ? refundItems : [];
    if (itemsToProcess.length === 0) throw new Error("No items found to refund.");

    const refundRequestMap = new Map(itemsToProcess.map(i => [i.productId, i.quantity]));

    let totalRefundAmount = 0;
    let totalRefundProfit = 0; 
    const updatedItems = (original.items || []).map((item: SaleItem) => {
        const requestedRefundQty = refundRequestMap.get(item.productId);
        
        if (requestedRefundQty) {
            const previouslyRefunded = item.refundedQuantity || 0;
            const remainingQty = item.quantity - previouslyRefunded;

            if (requestedRefundQty > remainingQty) {
                throw new Error(`Invalid Refund: ${item.sku} has ${remainingQty} left. You requested ${requestedRefundQty}.`);
            }

            // DISCOUNT FIX: Calculate effective price paid per unit
            // If item has a discount, subtract it from the total line price before calculating unit price
            const lineItemTotal = item.priceAtSale * item.quantity;
            const lineItemPaid = lineItemTotal - (item.discount || 0);
            const effectiveUnitPrice = item.quantity > 0 ? lineItemPaid / item.quantity : 0;

            totalRefundAmount += effectiveUnitPrice * requestedRefundQty;
            
            return { ...item, refundedQuantity: previouslyRefunded + requestedRefundQty };
        }
        return item;
    });

    for (const item of itemsToProcess) {
      try {
        const movementPayload = mapToDb({
          productId: item.productId,
          quantity: item.quantity, 
          type: 'return',
          reason: `Refund for Trans #${saleId.substring(0,8)} (SKU: ${item.sku})`,
          businessId: original.businessId,
          orgId: original.orgId || contextOrgId,
          userName: userName || 'System Refund'
        });
        await supabase.from('stock_movements').insert(movementPayload);

        const { data: prod } = await supabase.from('products').select('current_stock').eq('id', item.productId).single();
        if (prod) {
          const newStock = (prod.current_stock || 0) + item.quantity;
          await supabase.from('products').update({ current_stock: newStock }).eq('id', item.productId);
        }
      } catch(e) {
        console.error("Refund stock sync failed for item:", item.sku, e);
      }
    }

    const margin = original.salesAmount > 0 ? (original.profitAmount / original.salesAmount) : 0;
    totalRefundProfit = totalRefundAmount * margin;

    const isFullyRefundedNow = updatedItems.every((item: SaleItem) => (item.refundedQuantity || 0) >= item.quantity);
    
    try {
        const { error: fullUpdateError } = await supabase.from('sales').update({ 
            items: updatedItems, 
            is_refunded: isFullyRefundedNow 
        }).eq('id', saleId);

        if (fullUpdateError) {
            if (fullUpdateError.message.includes('is_refunded')) {
                const { error: fallbackError } = await supabase.from('sales').update({ 
                    items: updatedItems 
                }).eq('id', saleId);
                if (fallbackError) throw fallbackError;
            } else {
                throw fullUpdateError;
            }
        }
    } catch (e: any) {
        throw new Error(`Failed to update transaction record: ${e.message}`);
    }

    const finalOrgId = original.orgId || contextOrgId;
    if (!finalOrgId) throw new Error("Organization ID missing. Cannot process refund adjustment.");

    const refundEntry = {
      businessId: original.businessId,
      date: new Date().toISOString(), // Use standard UTC ISO string for robust Timezone handling
      salesAmount: -Math.abs(totalRefundAmount),
      profitAmount: -Math.abs(totalRefundProfit),
      profitPercentage: 0, 
      paymentMethod: original.paymentMethod,
      items: [], 
      orgId: finalOrgId
    };

    const payload = mapToDb(refundEntry);
    const { error: insertError } = await supabase.from('sales').insert(payload);
    
    if (insertError) {
      console.error("Refund Adjustment Insert Failed:", insertError);
      throw new Error(`Failed to record financial adjustment: ${insertError.message}`);
    }

    return true;
  },

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

  deleteSale: async (id: string) => {
    const { error } = await supabase.from('sales').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

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
    const { orgId: contextOrgId } = await getFilter();
    const finalOrgId = reminder.orgId || contextOrgId;
    const payload = mapToDb({ ...reminder, org_id: finalOrgId });
    const operation = payload.id ? supabase.from('reminders').upsert(payload) : supabase.from('reminders').insert(payload);
    const { data, error } = await operation.select();
    if (error) throw error;
    return mapFromDb(data ? data[0] : null);
  },

  deleteReminder: async (id: string) => {
    const { error } = await supabase.from('reminders').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

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
  
  createNewUser: async (userData: any) => {
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
