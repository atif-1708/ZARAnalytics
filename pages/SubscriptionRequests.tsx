
import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Building2, 
  User, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  ArrowRight, 
  ShieldCheck, 
  AlertTriangle,
  Layers,
  Zap,
  TrendingUp
} from 'lucide-react';
import { storage } from '../services/mockStorage';
import { Reminder, Organization, SubscriptionTier } from '../types';
import { formatDate } from '../utils/formatters';

export const SubscriptionRequests: React.FC = () => {
  const [requests, setRequests] = useState<Reminder[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rData, oData] = await Promise.all([
        storage.getReminders(),
        storage.getOrganizations()
      ]);
      // Filter for pending subscription requests (identified by absence of businessId)
      const subRequests = rData.filter(r => r.type === 'system_alert' && r.status === 'pending' && !r.businessId);
      setRequests(subRequests);
      setOrganizations(oData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAction = async (request: Reminder, action: 'approve' | 'decline') => {
    setProcessingId(request.id);
    try {
      if (action === 'approve' && request.orgId) {
        const org = organizations.find(o => o.id === request.orgId);
        if (org) {
          // Parse requested tier from bracketed label: "OrgName [TIER] (ACTION | FOR: YYYY-MM)"
          let newTier: SubscriptionTier = org.tier;
          const label = request.businessName.toUpperCase();
          
          if (label.includes('[ENTERPRISE]')) newTier = 'enterprise';
          else if (label.includes('[GROWTH]')) newTier = 'growth';
          else if (label.includes('[STARTER]')) newTier = 'starter';
          
          // Fallback for legacy requests without brackets
          else if (label.includes('UPGRADE TO ENTERPRISE')) newTier = 'enterprise';
          else if (label.includes('UPGRADE TO GROWTH')) newTier = 'growth';
          else if (label.includes('UPGRADE TO STARTER')) newTier = 'starter';

          // 1. Update the Organization Expiry to NEXT MONTH
          const nextMonth = new Date();
          nextMonth.setMonth(nextMonth.getMonth() + 1);
          const newExpiryStr = nextMonth.toISOString().split('T')[0];

          await storage.saveOrganization({
            ...org,
            tier: newTier,
            isActive: true,
            subscriptionEndDate: newExpiryStr
          });
          
          // 2. Log the collection in the current month's audit ledger
          // We use the CURRENT MONTH for the audit record so it shows in the active ledger
          const currentMonth = new Date().toISOString().slice(0, 7);
          
          await storage.saveReminder({
            orgId: org.id,
            businessId: undefined,
            businessName: `${org.name} [${newTier.toUpperCase()}] (AUTHORIZED | FOR: ${currentMonth})`,
            date: new Date().toISOString().split('T')[0],
            sentBy: request.sentBy,
            sentByUserName: 'Platform Authority',
            status: 'read',
            type: 'system_alert'
          });
        }
      }

      // Mark original request as processed (read)
      await storage.saveReminder({ ...request, status: 'read' });
      await loadData();
    } catch (err: any) {
      alert("Action failed: " + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-indigo-600" size={40} /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20 text-left">
      <div>
        <h2 className="text-3xl font-black text-white tracking-tight">Subscription Queue</h2>
        <p className="text-slate-500 font-medium">Review and authorize manual billing requests from tenants</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {requests.length === 0 ? (
          <div className="p-20 border-2 border-dashed border-white/5 rounded-[3rem] text-center bg-white/5">
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-3xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} />
            </div>
            <h4 className="text-xl font-black text-white mb-1">Queue Clear</h4>
            <p className="text-slate-500 text-sm font-medium">No pending subscription or upgrade requests found.</p>
          </div>
        ) : (
          requests.map((req) => {
            const org = organizations.find(o => o.id === req.orgId);
            const isUpgrade = req.businessName.toLowerCase().includes('upgrade');
            
            return (
              <div key={req.id} className="bg-slate-900 border border-white/5 rounded-[2.5rem] p-8 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 hover:border-indigo-500/30 transition-all group">
                <div className="flex items-center gap-6 flex-1">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg shrink-0 ${isUpgrade ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white'}`}>
                    {isUpgrade ? <Zap size={32} /> : <TrendingUp size={32} />}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h4 className="text-xl font-black text-white tracking-tight uppercase">
                        {req.businessName.split('[')[0].trim()}
                      </h4>
                      <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest ${
                         req.businessName.includes('[ENTERPRISE]') ? 'bg-indigo-500 text-white' :
                         req.businessName.includes('[GROWTH]') ? 'bg-amber-500 text-white' : 'bg-blue-500 text-white'
                      }`}>
                         {req.businessName.match(/\[(.*?)\]/)?.[1] || 'Renewal'}
                      </span>
                      <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded-md text-[8px] font-black text-slate-400 uppercase tracking-widest">
                        ID: {req.id.substring(0, 8)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                        <User size={12} className="text-indigo-400" />
                        Requested by {req.sentByUserName}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                        <Clock size={12} className="text-indigo-400" />
                        Received {formatDate(req.date)}
                      </div>
                      {org && (
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                          <Layers size={12} />
                          Active Plan: {org.tier}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                  <button 
                    disabled={!!processingId}
                    onClick={() => handleAction(req, 'decline')}
                    className="flex-1 md:flex-none px-6 py-3 bg-white/5 text-rose-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-500/10 transition-all border border-white/5"
                  >
                    Dismiss
                  </button>
                  <button 
                    disabled={!!processingId}
                    onClick={() => handleAction(req, 'approve')}
                    className="flex-1 md:flex-none px-8 py-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-2"
                  >
                    {processingId === req.id ? (
                      <Loader2 className="animate-spin" size={14} />
                    ) : (
                      <>
                        Authorize <ArrowRight size={14} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="bg-white/5 border border-white/5 p-6 rounded-[2rem] flex items-center gap-4">
        <ShieldCheck size={24} className="text-indigo-500" />
        <p className="text-xs font-medium text-slate-400">
          <span className="font-black text-indigo-400 uppercase mr-2">Security Protocol:</span>
          Approving a request sets the new expiry to one month from today. The transaction is recorded in the current month's audit ledger to reflect real-time collection.
        </p>
      </div>
    </div>
  );
};
