
import React, { useState, useEffect } from 'react';
import { CreditCard, CheckCircle2, AlertTriangle, Calendar, Zap, ShieldCheck, Loader2, Send, Layers, Building2, Clock, ChevronRight, TrendingUp, Store, Info } from 'lucide-react';
import { storage } from '../services/mockStorage';
import { useAuth } from '../context/AuthContext';
import { Organization, SubscriptionTier, Reminder } from '../types';
import { formatDate } from '../utils/formatters';

const COMMON_FEATURES = [
  'Comprehensive Financial Reporting',
  'Daily Sales & Profit Tracking',
  'Expense Management Ledger',
  'Staff & Regional Access Control',
  'Audit Compliance Monitoring',
  'Priority Technical Support'
];

const TIER_DETAILS: Record<SubscriptionTier, any> = {
  starter: { 
    id: 'starter',
    name: 'Starter', 
    price: 300, 
    limit: '1 Business Unit', 
    features: COMMON_FEATURES,
    color: 'border-blue-200 bg-blue-50 text-blue-600',
    iconColor: 'bg-blue-100 text-blue-600'
  },
  growth: { 
    id: 'growth',
    name: 'Growth', 
    price: 550, 
    limit: '2 Business Units', 
    features: COMMON_FEATURES,
    color: 'border-amber-200 bg-amber-50 text-amber-600',
    iconColor: 'bg-amber-100 text-amber-600'
  },
  enterprise: { 
    id: 'enterprise',
    name: 'Enterprise', 
    price: 1500, 
    limit: 'Unlimited Units', 
    features: COMMON_FEATURES,
    color: 'border-indigo-200 bg-indigo-50 text-indigo-600',
    iconColor: 'bg-indigo-100 text-indigo-600'
  }
};

export const Billing: React.FC = () => {
  const { user, selectedOrgId } = useAuth();
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [requestSent, setRequestSent] = useState<string | null>(null);
  const [existingReminders, setExistingReminders] = useState<Reminder[]>([]);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const targetOrgId = isSuperAdmin ? selectedOrgId : user?.orgId;

  const loadOrgData = async () => {
    if (!targetOrgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [orgs, reminders] = await Promise.all([
        storage.getOrganizations(),
        storage.getReminders()
      ]);
      const current = orgs.find(o => o.id === targetOrgId);
      setOrg(current || null);
      
      const pending = reminders.filter(r => 
        r.orgId === targetOrgId && 
        r.type === 'system_alert' && 
        r.status === 'pending'
      );
      setExistingReminders(pending);
      if (pending.length > 0) setRequestSent('general');

    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrgData();
  }, [targetOrgId]);

  const handleRequestTierAction = async (requestedTier: SubscriptionTier) => {
    if (!org || isProcessing || (requestSent && requestedTier === requestSent)) return;
    setIsProcessing(requestedTier);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const isUpgrade = requestedTier !== org.tier;
      const actionLabel = isUpgrade ? `UPGRADE to ${requestedTier.toUpperCase()}` : 'RENEWAL';

      await storage.saveReminder({
        businessId: 'ORG_LEVEL',
        businessName: `${org.name} (${actionLabel})`,
        date: new Date().toISOString().split('T')[0],
        sentBy: user?.id || '',
        sentByUserName: user?.name || 'Account Admin',
        status: 'pending',
        type: 'system_alert',
        orgId: org.id
      });
      
      setRequestSent(requestedTier);
    } catch (err) {
      alert("Request failed. Please contact support@zarlytics.com");
    } finally {
      setIsProcessing(null);
    }
  };

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-teal-600" size={40} /></div>;

  if (!org) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-200">
        <Building2 size={48} className="text-slate-200 mb-4" />
        <h3 className="text-xl font-bold text-slate-800">No Organization Context</h3>
        <p className="text-slate-500">Please select an organization to manage billing.</p>
      </div>
    );
  }

  const isExpired = new Date(org.subscriptionEndDate) < new Date();

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20 text-left">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">Plan & Payment</h2>
          <p className="text-slate-500 font-medium text-lg">Select the optimal infrastructure for your business scale</p>
        </div>
        <div className={`px-5 py-2.5 rounded-2xl border flex items-center gap-3 shadow-sm ${isExpired ? 'bg-rose-50 border-rose-100 text-rose-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>
          {isExpired ? <AlertTriangle size={18} /> : <ShieldCheck size={18} />}
          <span className="text-xs font-black uppercase tracking-widest">
            {isExpired ? 'Subscription Expired' : 'Active Service'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {isExpired && (
          <div className="p-6 bg-rose-600 text-white rounded-[2.5rem] flex flex-col md:flex-row items-center gap-6 shadow-xl shadow-rose-500/20 border-l-8 border-rose-800 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="w-16 h-16 bg-white/20 rounded-3xl flex items-center justify-center shrink-0">
              <AlertTriangle size={32} className="animate-pulse" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <p className="font-black text-xl leading-tight uppercase tracking-tight">Access Restricted</p>
              <p className="text-rose-100 text-sm font-medium mt-1">Your subscription expired on {formatDate(org.subscriptionEndDate)}. Please request a renewal below to restore full data entry and management capabilities.</p>
            </div>
          </div>
        )}

        {requestSent && (
          <div className="p-6 bg-indigo-600 text-white rounded-[2.5rem] flex flex-col md:flex-row items-center gap-6 shadow-xl shadow-indigo-500/20 border-l-8 border-indigo-800 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="w-16 h-16 bg-white/20 rounded-3xl flex items-center justify-center shrink-0">
              <Clock size={32} className="animate-pulse" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <p className="font-black text-xl leading-tight uppercase tracking-tight">Request Processing</p>
              <p className="text-indigo-100 text-sm font-medium mt-1">Platform administrators have been notified. Your account status will update once the manual authorization is complete.</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-4">
        {(Object.keys(TIER_DETAILS) as SubscriptionTier[]).map((tierKey) => {
          const t = TIER_DETAILS[tierKey];
          const isCurrent = org.tier === tierKey;
          const isHigher = (tierKey === 'enterprise' && org.tier !== 'enterprise') || (tierKey === 'growth' && org.tier === 'starter');
          const isRequested = requestSent === tierKey;
          
          return (
            <div 
              key={tierKey} 
              className={`flex flex-col bg-white rounded-[3rem] border-2 p-10 transition-all duration-300 relative overflow-hidden ${
                isCurrent 
                  ? 'border-teal-500 shadow-2xl shadow-teal-500/10' 
                  : 'border-slate-100 shadow-sm hover:border-slate-300'
              }`}
            >
              {isCurrent && (
                <div className="absolute top-6 right-6 px-3 py-1 bg-teal-500 text-white text-[9px] font-black uppercase tracking-widest rounded-lg shadow-lg">
                  Current Tier
                </div>
              )}
              
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-8 ${t.iconColor}`}>
                {tierKey === 'starter' ? <Layers size={28} /> : tierKey === 'growth' ? <TrendingUp size={28} /> : <Zap size={28} />}
              </div>

              <h3 className="text-3xl font-black text-slate-900 tracking-tighter mb-1">{t.name}</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-2xl font-black text-slate-800">R{t.price}</span>
                <span className="text-xs font-bold text-slate-400 uppercase">/ month</span>
              </div>

              <div className="space-y-4 mb-10 flex-1">
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 mb-2">
                   <Store size={16} className="text-teal-600" />
                   <span className="text-xs font-black text-slate-800">{t.limit}</span>
                </div>
                {t.features.map((f: string, idx: number) => (
                  <div key={idx} className="flex items-start gap-3 px-1">
                    <CheckCircle2 size={16} className="text-teal-500 shrink-0 mt-0.5" />
                    <span className="text-xs font-bold text-slate-500 leading-tight">{f}</span>
                  </div>
                ))}
              </div>

              <button 
                onClick={() => handleRequestTierAction(tierKey)}
                disabled={!!isProcessing || isRequested || (isCurrent && !isExpired)}
                className={`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-3 shadow-lg ${
                  isCurrent 
                    ? (isExpired 
                        ? (isRequested ? 'bg-indigo-100 text-indigo-600' : 'bg-rose-600 text-white hover:bg-rose-700')
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none')
                    : (isRequested 
                        ? 'bg-indigo-100 text-indigo-600'
                        : (isHigher 
                            ? 'bg-slate-900 text-white hover:bg-teal-600' 
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'))
                }`}
              >
                {isProcessing === tierKey ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : isRequested ? (
                  <>
                    <Clock size={16} />
                    <span>Requested</span>
                  </>
                ) : isCurrent ? (
                  isExpired ? 'Request Renewal' : 'Tier Active'
                ) : (
                  isHigher ? 'Request Upgrade' : 'Request Downgrade'
                )}
              </button>
            </div>
          );
        })}
      </div>

      <div className="bg-slate-900 p-12 rounded-[4rem] text-white flex flex-col md:flex-row items-center justify-between gap-10 shadow-2xl relative overflow-hidden group">
         <div className="absolute top-0 right-0 p-12 opacity-5 group-hover:scale-110 transition-transform pointer-events-none">
           <Building2 size={240} />
         </div>
         <div className="relative z-10 space-y-4 max-w-xl">
           <div className="flex items-center gap-2 text-teal-400">
             <Info size={18} />
             <span className="text-[10px] font-black uppercase tracking-widest">Enterprise Feature</span>
           </div>
           <h3 className="text-3xl font-black tracking-tighter">Custom Enterprise Solutions</h3>
           <p className="text-slate-400 text-sm font-medium leading-relaxed">
             Need more than unlimited shops? Our enterprise architecture supports massive-scale multi-tenancy with dedicated cloud resources, custom API endpoints, and high-availability nodes.
           </p>
         </div>
         <button className="relative z-10 px-10 py-5 bg-teal-500 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-teal-400 transition-all shadow-xl shadow-teal-500/20">
           Contact Sales
         </button>
      </div>
    </div>
  );
};
