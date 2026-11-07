import React from 'react';

const StatCard = ({ title, value, icon: Icon, subtitle, change }) => {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:border-slate-300 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </span>
        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 border border-slate-200/80">
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div className="mt-3 flex items-baseline space-x-2.5">
        <span className="text-3xl font-bold tracking-tight text-slate-900 font-mono tabular-nums">
          {value}
        </span>
        {change && (
          <span className="text-xs font-semibold text-emerald-600">
            {change}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="mt-1.5 text-xs text-slate-500">
          {subtitle}
        </p>
      )}
    </div>
  );
};

export default StatCard;
