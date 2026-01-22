
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  STAFF = 'STAFF',
  VIEW_ONLY = 'VIEW_ONLY',
  ORG_ADMIN = 'ORG_ADMIN'
}

export type SubscriptionTier = 'starter' | 'growth' | 'enterprise';

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

export interface DailySale {
  id: string;
  businessId: string;
  date: string;
  salesAmount: number;
  profitPercentage: number;
  profitAmount: number;
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
