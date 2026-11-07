import React, { useEffect, useState } from 'react';
import { Database, FileSpreadsheet, Layers, CheckCircle2, ArrowRight, Upload, Clock, RefreshCw, Sparkles, AlertCircle } from 'lucide-react';
import StatCard from '../components/StatCard';
import { getAllDatasets } from '../services/api';

const Dashboard = ({ onSelectDataset, onNavigate, activeDataset }) => {
  const [datasets, setDatasets] = useState([]);
  const [stats, setStats] = useState({ total_datasets: 0, migrated_datasets: 0, total_generated_tables: 0 });
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await getAllDatasets();
      setDatasets(res.datasets || []);
      setStats(res.stats || { total_datasets: 0, migrated_datasets: 0, total_generated_tables: 0 });
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const currentFocus = activeDataset || (datasets.length > 0 ? datasets[0] : null);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            Automated database normalization, functional dependency mining, and direct MySQL 8 migration.
          </p>
        </div>

        <button
          onClick={() => onNavigate('upload')}
          className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors self-start sm:self-auto"
        >
          <Upload className="w-4 h-4" />
          <span>Ingest New Dataset</span>
        </button>
      </div>

      {/* Active Dataset Next-Action Banner (if available) */}
      {currentFocus ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center space-x-2.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Current Pipeline Target
                </span>
                <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded uppercase ${
                  currentFocus.status === 'migrated'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : currentFocus.status === 'analyzed'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  {currentFocus.status}
                </span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 font-mono tracking-tight">
                {currentFocus.original_name}
              </h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 font-mono">
                <span>{currentFocus.row_count} rows</span>
                <span>•</span>
                <span>{currentFocus.column_count} columns</span>
                <span>•</span>
                <span>Format: .{currentFocus.file_type}</span>
                {currentFocus.target_database && (
                  <>
                    <span>•</span>
                    <span className="text-blue-700 font-medium">DB: {currentFocus.target_database}</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-3 shrink-0">
              <button
                onClick={() => {
                  onSelectDataset(currentFocus);
                  onNavigate('analysis');
                }}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-semibold transition-colors"
              >
                Inspect FDs
              </button>
              <button
                onClick={() => {
                  onSelectDataset(currentFocus);
                  onNavigate(currentFocus.status === 'migrated' ? 'export' : 'normalization');
                }}
                className="inline-flex items-center space-x-2 px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors"
              >
                <span>{currentFocus.status === 'migrated' ? 'View Live MySQL Schema' : 'Synthesize 3NF Relations'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center">
          <FileSpreadsheet className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">No active dataset in pipeline</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            Upload an unnormalized CSV or Excel file or load one of our academic demonstration datasets to start.
          </p>
          <button
            onClick={() => onNavigate('upload')}
            className="mt-4 inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-xs"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Dataset</span>
          </button>
        </div>
      )}

      {/* Streamlined Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard
          title="Ingested Datasets"
          value={stats.total_datasets}
          icon={FileSpreadsheet}
          subtitle="Tabular sources stored in system catalog"
        />
        <StatCard
          title="Migrated MySQL Schemas"
          value={stats.migrated_datasets}
          icon={CheckCircle2}
          subtitle="Normalized to 3NF under InnoDB engine"
        />
        <StatCard
          title="Normalized Tables Created"
          value={stats.total_generated_tables}
          icon={Layers}
          subtitle="Synthesized relational tables with primary & foreign keys"
        />
      </div>

      {/* Spacious Datasets Catalog Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="font-semibold text-slate-900 text-base tracking-tight">Processed Datasets Catalog</h2>
            <p className="text-xs text-slate-500 mt-0.5">Select any dataset to inspect, run 3NF synthesis, or export</p>
          </div>
          <button
            onClick={loadData}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 transition-colors"
            title="Refresh catalog"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-slate-100/70 text-slate-600 uppercase font-semibold text-xs tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-5 font-mono">Dataset Name</th>
                <th className="py-3.5 px-5 font-mono">Format</th>
                <th className="py-3.5 px-5 font-mono">Dimensions</th>
                <th className="py-3.5 px-5 font-mono">Pipeline Status</th>
                <th className="py-3.5 px-5 font-mono">Target MySQL Database</th>
                <th className="py-3.5 px-5 text-right font-mono">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
              {datasets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-slate-400 font-sans text-sm">
                    <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    No datasets ingested yet. Click "Ingest New Dataset" above to get started.
                  </td>
                </tr>
              ) : (
                datasets.map((ds) => (
                  <tr key={ds.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-5 font-medium text-slate-900 font-sans">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                          <FileSpreadsheet className="w-4 h-4" />
                        </div>
                        <span className="font-semibold text-slate-800 truncate max-w-[240px]" title={ds.original_name}>
                          {ds.original_name}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-5 uppercase font-mono font-semibold text-slate-500 text-xs">
                      .{ds.file_type}
                    </td>
                    <td className="py-4 px-5 tabular-nums text-slate-600 font-mono text-xs">
                      {ds.row_count} rows × {ds.column_count} cols
                    </td>
                    <td className="py-4 px-5">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold uppercase ${
                          ds.status === 'migrated'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : ds.status === 'analyzed'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {ds.status}
                      </span>
                    </td>
                    <td className="py-4 px-5 font-mono text-xs text-slate-600">
                      {ds.target_database ? (
                        <span className="text-blue-700 font-semibold">{ds.target_database}</span>
                      ) : (
                        <span className="text-slate-400 italic font-sans text-xs">Not deployed</span>
                      )}
                    </td>
                    <td className="py-4 px-5 text-right font-sans">
                      <button
                        onClick={() => {
                          onSelectDataset(ds);
                          onNavigate(ds.status === 'migrated' ? 'export' : 'analysis');
                        }}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-blue-600 rounded-lg border border-slate-200 text-xs font-semibold transition-colors"
                      >
                        <span>{ds.status === 'migrated' ? 'View Deliverables' : 'Open Pipeline'}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
