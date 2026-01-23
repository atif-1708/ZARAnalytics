
import React, { useState, useEffect } from 'react';
import { CreditCard, CheckCircle2, AlertTriangle, Calendar, Zap, ShieldCheck, Loader2, Send, Layers, Building2, Clock } from 'lucide-react';
import { storage } from '../services/mockStorage';
import { useAuth } from '../context/AuthContext';
import { Organization, SubscriptionTier, Reminder } from '../types';
import { formatDate } from '../utils/formatters';

const TIER_DETAILS = {
  starter: { 
    name: 'Starter', 
    price: 300, 
    limit: '1 Business Unit', 
    features: ['Basic Financial Reports', 'Daily Sales Entry', 'Standard Support'],
    color: 'border-blue-200 bg-blue-50 text-blue-600'
  },
  growth: { 
    name: 'Growth', 
    price: 550, 
    limit: '2 Business Units', 
    features: ['Advanced Analytics', 'Expense Tracking', 'Priority Support', 'Role-Based Access'],
    color: 'border-amber-200 bg-amber-50 text-amber-600'
  },
  enterprise: { 
    name: 'Enterprise', 
    price: 1500, 
    limit: 'Unlimited Units', 
    features: ['Full Multi-Tenancy', 'Global Pulse Dashboard', 'API Access', '24/7 Dedicated Support'],
    color: 'border-indigo-200 bg-indigo-50 text-indigo-600'
  }
};

export const Billing: React.FC = () => {
  const { user, selectedOrgId } = useAuth();
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
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
      
      // Check if there's already a pending renewal request
      const pending = reminders.filter(r => 
        r.orgId === targetOrgId && 
        r.type === 'system_alert' && 
        r.status === 'pending'
      );
      setExistingReminders(pending);
      if (pending.length > 0) setRequestSent(true);

    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrgData();
  }, [targetOrgId]);

  const handleRequestResubscribe = async () => {
    if (!org || isProcessing || requestSent) return;
    setIsProcessing(true);
    
    try {
      // Simulate network request
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Create a system alert for the Super Admin to review
      await storage.saveReminder({
        businessId: 'ORG_LEVEL',
        businessName: org.name,
        date: new Date().toISOString().split('T')[0],
        sentBy: user?.id || '',
        sentByUserName: user?.name || 'Account Admin',
        status: 'pending',
        type: 'system_alert',
        orgId: org.id
      });
      
      setRequestSent(true);
    } catch (err) {
      alert("Renewal request failed. Please contact support@zarlytics.com");
    } finally {
      setIsProcessing(false);
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
  const tier = TIER_DETAILS[org.tier || 'starter'];

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 text-left">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Billing & Plan</h2>
          <p className="text-slate-500 font-medium">Manage your subscription and payment preferences</p>
        </div>
        <div className={`px-4 py-2 rounded-2xl border flex items-center gap-2 ${isExpired ? 'bg-rose-50 border-rose-100 text-rose-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>
          {isExpired ? <AlertTriangle size={16} /> : <ShieldCheck size={16} />}
          <span className="text-xs font-black uppercase tracking-widest">
            {isExpired ? 'Subscription Expired' : 'Account Active'}
          </span>
        </div>
      </div>

      {requestSent && (
        <div className="p-6 bg-blue-600 text-white rounded-3xl flex items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-500 shadow-xl shadow-blue-500/20">
          <Clock size={32} className="shrink-0 animate-pulse" />
          <div>
            <p className="font-black text-lg leading-tight">Renewal Request Pending</p>
            <p className="text-blue-100 text-sm font-medium">We've notified the platform administrators. Your account will be reactivated once the request is processed.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:scale-110 transition-transform pointer-events-none">
              <Zap size={180} />
            </div>
            
            <div className="relative z-10">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Current Plan</p>
              <div className="flex items-center gap-4 mb-6">
                <h3 className="text-5xl font-black text-slate-900 tracking-tighter">{tier.name}</h3>
                <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${tier.color}`}>
                  R{tier.price} / mo
                </span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                    <Layers size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Capacity</p>
                    <p className="text-sm font-bold text-slate-800">{tier.limit}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isExpired ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'}`}>
                    <Calendar size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Last Expiry / Renewal</p>
                    <p className={`text-sm font-bold ${isExpired ? 'text-rose-600' : 'text-slate-800'}`}>
                      {formatDate(org.subscriptionEndDate)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm">
             <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
               <ShieldCheck size={16} className="text-teal-500" /> Plan Features
             </h4>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               {tier.features.map((feature, i) => (
                 <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                   <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center text-teal-600 shadow-sm">
                     <CheckCircle2 size={14} />
                   </div>
                   <span className="text-xs font-bold text-slate-700">{feature}</span>
                 </div>
               ))}
             </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className={`p-8 rounded-[3rem] shadow-2xl flex flex-col justify-between min-h-[400px] transition-colors duration-500 ${requestSent ? 'bg-slate-50 border border-slate-200 text-slate-400' : 'bg-slate-900 text-white shadow-indigo-500/20'}`}>
            <div>
              <div className="flex items-center gap-3 mb-8">
                <div className={`p-3 rounded-2xl ${requestSent ? 'bg-slate-200 text-slate-400' : 'bg-white/10 text-white'}`}>
                  <CreditCard size={24} />
                </div>
                <div>
                  <h4 className="text-lg font-black tracking-tight leading-none">{requestSent ? 'Request Filed' : 'Renewal'}</h4>
                  <p className={`text-[10px] font-black uppercase tracking-widest ${requestSent ? 'text-slate-400' : 'text-slate-400'}`}>Manual Authorization Flow</p>
                </div>
              </div>

              <div className="space-y-4 mb-10">
                <div className="flex justify-between items-center text-sm font-medium">
                  <span className={requestSent ? 'text-slate-400' : 'text-slate-400'}>Subscription Renewal</span>
                  <span className={requestSent ? 'text-slate-400' : 'text-white'}>R{tier.price.toFixed(2)}</span>
                </div>
                <div className={`pt-4 border-t flex justify-between items-center ${requestSent ? 'border-slate-200' : 'border-white/10'}`}>
                  <span className="text-xs font-black uppercase tracking-widest">Total Valuation</span>
                  <span className={`text-2xl font-black ${requestSent ? 'text-slate-400' : 'text-white'}`}>R{tier.price.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {isExpired && !requestSent && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-400">
                  <AlertTriangle size={18} className="shrink-0" />
                  <p className="text-[10px] font-bold leading-tight">Your account is restricted. Requesting a renewal will alert the admin to reactivate your service.</p>
                </div>
              )}
              
              <button 
                onClick={handleRequestResubscribe}
                disabled={isProcessing || requestSent}
                className={`w-full py-5 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-3 group disabled:cursor-not-allowed ${
                  requestSent 
                    ? 'bg-emerald-100 text-emerald-600 border border-emerald-200' 
                    : 'bg-white text-slate-900 hover:bg-teal-50 shadow-xl'
                }`}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    <span>Processing Request...</span>
                  </>
                ) : requestSent ? (
                  <>
                    <CheckCircle2 size={20} />
                    <span>Request Sent</span>
                  </>
                ) : (
                  <>
                    Request Subscription Renewal
                    <Send size={18} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                  </>
                )}
              </button>
              
              <p className="text-center text-[9px] text-slate-500 font-bold uppercase tracking-widest">
                Admin review required for reactivation
              </p>
            </div>
          </div>
          
          <div className="p-6 bg-slate-50 border border-slate-200 rounded-[2rem] text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Assigned Tenant</p>
            <p className="text-xs font-black text-slate-800">{org.name}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
