
import React from 'react';
import { LucideIcon, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isUp: boolean;
  };
  color: 'blue' | 'teal' | 'rose' | 'amber' | 'emerald' | 'indigo';
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, icon: Icon, trend, color }) => {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    teal: 'bg-teal-50 text-teal-600 border-teal-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100'
  };

  const trendColor = trend?.isUp ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'text-rose-600 bg-rose-50 border-rose-100';

  return (
    <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200 flex flex-col justify-between group hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 h-full min-h-[160px]">
      <div className="flex items-start justify-between mb-6">
        <div className={`p-4 rounded-2xl border ${colorMap[color]} transition-transform group-hover:scale-110 duration-300`}>
          <Icon size={24} />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-tight ${trendColor}`}>
            {trend.isUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {trend.value}%
          </div>
        )}
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{label}</p>
        <h3 className="text-3xl font-black text-slate-900 truncate tracking-tighter" title={value}>{value}</h3>
      </div>
    </div>
  );
};
