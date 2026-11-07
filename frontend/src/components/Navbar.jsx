import React, { useEffect, useState } from 'react';
import { Database, RefreshCw, CheckCircle2, AlertCircle, Server, Terminal } from 'lucide-react';
import { getHealth } from '../services/api';

const Navbar = ({ activeDataset }) => {
  const [dbStatus, setDbStatus] = useState({ loading: true, connected: false, error: null });

  const checkDb = async () => {
    try {
      const res = await getHealth();
      setDbStatus({
        loading: false,
        connected: res.database?.connected || false,
        error: res.database?.error || null
      });
    } catch (err) {
      setDbStatus({ loading: false, connected: false, error: 'Backend API unreachable' });
    }
  };

  useEffect(() => {
    checkDb();
    const interval = setInterval(checkDb, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 shrink-0">
      {/* Left: Product Brand */}
      <div className="flex items-center space-x-3.5">
        <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center text-white shadow-xs border border-slate-800">
          <Database className="w-5 h-5 text-blue-400" />
        </div>
        <div className="flex items-baseline space-x-2.5">
          <span className="font-bold text-base tracking-tight text-slate-900">SmartDB</span>
          <span className="text-xs text-slate-500 font-medium hidden sm:inline">Database Normalization & Migration</span>
          <span className="text-xs font-mono font-medium text-slate-500 bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded">
            MySQL 8
          </span>
        </div>
      </div>

      {/* Right: Active Dataset & Server Health */}
      <div className="flex items-center space-x-4">
        {activeDataset && (
          <div className="hidden md:flex items-center space-x-2.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Active:</span>
            <span className="font-mono text-xs font-semibold text-slate-800 max-w-[220px] truncate" title={activeDataset.original_name || activeDataset.originalName}>
              {activeDataset.original_name || activeDataset.originalName}
            </span>
            <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded uppercase ${
              activeDataset.status === 'migrated'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : activeDataset.status === 'analyzed'
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              {activeDataset.status}
            </span>
          </div>
        )}

        {/* Live MySQL Health Status */}
        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center space-x-2">
            {dbStatus.loading ? (
              <RefreshCw className="w-3.5 h-3.5 text-slate-400 animate-spin" />
            ) : dbStatus.connected ? (
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            ) : (
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500"></span>
            )}
            <span className={`font-mono text-xs font-medium ${dbStatus.connected ? 'text-slate-700' : 'text-rose-600'}`}>
              {dbStatus.loading ? 'Checking...' : dbStatus.connected ? 'MySQL 3306 Connected' : 'MySQL Offline'}
            </span>
          </div>
          <button
            onClick={checkDb}
            title="Refresh database connection check"
            className="text-slate-400 hover:text-slate-600 transition-colors p-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
