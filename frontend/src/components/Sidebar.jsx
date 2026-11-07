import React from 'react';
import {
  LayoutDashboard,
  UploadCloud,
  Microscope,
  Network,
  Cpu,
  Download,
  Database,
  ArrowRight,
  FileSpreadsheet
} from 'lucide-react';

const Sidebar = ({ activeTab, setActiveTab, activeDataset }) => {
  const pipelineSteps = [
    { id: 'dashboard', step: null, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'upload', step: '1', label: 'Dataset Ingestion', icon: UploadCloud },
    { id: 'analysis', step: '2', label: 'Profiling & Dependencies', icon: Microscope, requiresDataset: true },
    { id: 'normalization', step: '3', label: '3NF Synthesis & Proofs', icon: Cpu, requiresDataset: true },
    { id: 'schema', step: '4', label: 'Schema Designer', icon: Network, requiresDataset: true },
    { id: 'export', step: '5', label: 'MySQL Deliverables & ERD', icon: Download, requiresDataset: true },
  ];

  return (
    <aside className="w-72 bg-slate-900 text-slate-300 flex flex-col justify-between shrink-0 select-none border-r border-slate-800">
      <div className="p-5 space-y-7">
        {/* Navigation Group */}
        <div>
          <div className="px-3 mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
              Relational Pipeline
            </span>
          </div>

          <nav className="space-y-1">
            {pipelineSteps.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const isDisabled = item.requiresDataset && !activeDataset;

              return (
                <button
                  key={item.id}
                  disabled={isDisabled}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : isDisabled
                      ? 'text-slate-600 cursor-not-allowed hover:bg-transparent'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : isDisabled ? 'text-slate-600' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.step && (
                    <span className={`text-xs font-mono px-2 py-0.5 rounded font-medium ${
                      isActive ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-400'
                    }`}>
                      0{item.step}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Active Dataset Drawer */}
        {activeDataset ? (
          <div className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-4 text-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                Active Dataset
              </span>
              <span className="flex items-center space-x-1.5 text-xs text-emerald-400 font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span className="capitalize">{activeDataset.status || 'Ready'}</span>
              </span>
            </div>

            <div className="font-mono text-sm font-semibold text-white truncate" title={activeDataset.original_name || activeDataset.originalName}>
              {activeDataset.original_name || activeDataset.originalName}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-700/70 text-xs font-mono">
              <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-xs uppercase mb-0.5">Rows</span>
                <span className="text-slate-100 font-bold text-sm tabular-nums">
                  {activeDataset.row_count || activeDataset.rowCount || 0}
                </span>
              </div>
              <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-xs uppercase mb-0.5">Columns</span>
                <span className="text-slate-100 font-bold text-sm tabular-nums">
                  {activeDataset.column_count || activeDataset.columnCount || 0}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="border border-dashed border-slate-800 rounded-xl p-5 text-center">
            <FileSpreadsheet className="w-8 h-8 text-slate-700 mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-medium">No active dataset selected.</p>
            <button
              onClick={() => setActiveTab('upload')}
              className="mt-2 text-xs font-semibold text-blue-400 hover:text-blue-300"
            >
              Upload file to begin →
            </button>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-5 border-t border-slate-800/80 text-xs text-slate-400 space-y-1">
        <div className="flex items-center justify-between">
          <span className="font-medium text-slate-300">SmartDB Academic Engine</span>
          <span className="font-mono text-slate-400">v2.4</span>
        </div>
        <p className="text-slate-400 text-xs">Bernstein 3NF Synthesis & MySQL 8</p>
      </div>
    </aside>
  );
};

export default Sidebar;
