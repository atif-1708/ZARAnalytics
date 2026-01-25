
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  STAFF = 'STAFF',
  VIEW_ONLY = 'VIEW_ONLY',
  ORG_ADMIN = 'ORG_ADMIN'
}

export type SubscriptionTier = 'starter' | 'growth' | 'enterprise';

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  assignedBusinessIds?: string[];
  avatarUrl?: string;
  password?: string;
  orgId?: string;
}

export interface Organization {
  id: string;
  name: string;
  subscriptionEndDate: string;
  isActive: boolean;
  tier: SubscriptionTier;
  createdAt: string;
}

export interface Business {
  id: string;
  name: string;
  location: string;
  createdAt: string;
  orgId?: string;
}

export interface Product {
  id: string;
  sku: string;
  barcode?: string;
  description: string;
  costPrice: number;
  salePrice: number;
  currentStock: number;
  businessId: string;
  orgId?: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  taxId?: string;
  orgId: string;
  createdAt: string;
}

export interface PurchaseOrderItem {
  productId: string;
  sku: string;
  barcode?: string;
  description: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  supplierName: string;
  invoiceNumber: string;
  date: string;
  totalAmount: number;
  status: 'received';
  items: PurchaseOrderItem[];
  businessId: string;
  orgId: string;
  createdAt: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  quantity: number;
  type: 'arrival' | 'sale' | 'adjustment' | 'return' | 'damaged';
  reason: string;
  createdAt: string;
  businessId: string;
  orgId?: string;
  userName?: string;
}

export interface SaleItem {
  productId: string;
  sku: string;
  description?: string;
  quantity: number;
  priceAtSale: number;
  costAtSale: number;
  discount?: number;
  refundedQuantity?: number;
}

export interface DailySale {
  id: string;
  businessId: string;
  date: string;
  salesAmount: number;
  profitPercentage: number;
  profitAmount: number;
  paymentMethod?: PaymentMethod;
  items?: SaleItem[];
  isRefunded?: boolean;
  createdAt: string;
  orgId?: string;
}

export interface MonthlyExpense {
  id: string;
  businessId: string;
  month: string;
  amount: number;
  description: string;
  createdAt: string;
  orgId?: string;
}

export interface Reminder {
  id: string;
  businessId: string;
  businessName: string;
  date: string;
  sentBy: string;
  sentByUserName: string;
  status: 'pending' | 'read';
  type: 'user_sent' | 'system_alert';
  createdAt: string;
  orgId?: string;
}

export interface Filters {
  businessId: string;
  dateRange: {
    start: string;
    end: string;
  };
  selectedMonth: string;
  timeframe: 'today' | 'yesterday' | 'this_month' | 'select_month' | 'custom_range' | 'lifetime';
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

export interface Notification {
  id: string;
  title: string;
  description: string;
  type: 'warning' | 'info' | 'success' | 'urgent';
  timestamp: string;
  link?: string;
  isRead: boolean;
  actionLabel?: string;
  businessId?: string;
}

export type CashMovementType = 'DROP' | 'PAYOUT' | 'FLOAT_ADD';

export interface CashShift {
  id: string;
  businessId: string;
  userId: string;
  userName: string;
  openedAt: string;
  closedAt?: string;
  openingFloat: number;
  closingCashCounted?: number;
  expectedCash?: number;
  variance?: number;
  status: 'OPEN' | 'CLOSED';
  notes?: string;
  orgId: string;
}

export interface CashMovement {
  id: string;
  shiftId: string;
  businessId: string;
  type: CashMovementType;
  amount: number;
  reason: string;
  createdAt: string;
  userId: string;
  orgId: string;
}
