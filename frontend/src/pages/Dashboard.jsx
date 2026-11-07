import React, { useEffect, useState } from 'react';
import {
  Database,
  FileSpreadsheet,
  Upload,
  ArrowRight,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Layers
} from 'lucide-react';
import { getAllDatasets, deleteDataset } from '../services/api';

const Dashboard = ({ onSelectDataset, onNavigate, activeDataset }) => {
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteModalDataset, setDeleteModalDataset] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [deleteSuccess, setDeleteSuccess] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await getAllDatasets();
      setDatasets(res.datasets || []);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDeleteClick = (ds, e) => {
    e.stopPropagation();
    setDeleteModalDataset(ds);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteModalDataset) return;
    setDeletingId(deleteModalDataset.id);
    setDeleteError(null);
    try {
      const res = await deleteDataset(deleteModalDataset.id);
      if (res.success) {
        setDeleteSuccess(res.message);
        setDeleteModalDataset(null);
        loadData();
        setTimeout(() => setDeleteSuccess(null), 5000);
      } else {
        setDeleteError(res.message);
      }
    } catch (err) {
      setDeleteError(err.response?.data?.message || err.message || 'Error deleting dataset');
    } finally {
      setDeletingId(null);
    }
  };

  const currentFocus = activeDataset || (datasets.length > 0 ? datasets[0] : null);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">SmartDB Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            CSV & Excel data segregation, 3NF relational decomposition, and MySQL database management.
          </p>
        </div>

        <button
          onClick={() => onNavigate('upload')}
          className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors self-start sm:self-auto"
        >
          <Upload className="w-4 h-4" />
          <span>Upload New Dataset</span>
        </button>
      </div>

      {deleteSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center space-x-3 text-sm font-medium text-emerald-800">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{deleteSuccess}</span>
        </div>
      )}

      {/* Active Pipeline Focus Banner */}
      {currentFocus && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center space-x-2.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Active Dataset
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
                <span>{currentFocus.row_count} records</span>
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
              {currentFocus.status === 'migrated' ? (
                <>
                  <button
                    onClick={() => {
                      onSelectDataset(currentFocus);
                      onNavigate('crud');
                    }}
                    className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors"
                  >
                    <Database className="w-4 h-4" />
                    <span>Manage Database (CRUD)</span>
                  </button>
                  <button
                    onClick={() => {
                      onSelectDataset(currentFocus);
                      onNavigate('export');
                    }}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition-colors"
                  >
                    <span>Deliverables & ERD</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    onSelectDataset(currentFocus);
                    onNavigate(currentFocus.status === 'analyzed' ? 'normalization' : 'analysis');
                  }}
                  className="inline-flex items-center space-x-2 px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors"
                >
                  <span>{currentFocus.status === 'analyzed' ? 'Proceed to 3NF Normalization' : 'Start Dependency Analysis'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Datasets Catalog Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="font-semibold text-slate-900 text-base tracking-tight">Uploaded Datasets</h2>
            <p className="text-xs text-slate-500 mt-0.5">Manage datasets, trigger relational normalization, or perform CRUD on migrated MySQL tables</p>
          </div>
          <button
            onClick={loadData}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 transition-colors"
            title="Refresh list"
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
                <th className="py-3.5 px-5 font-mono">Status</th>
                <th className="py-3.5 px-5 font-mono">Target MySQL Database</th>
                <th className="py-3.5 px-5 text-right font-mono">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
              {datasets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-slate-400 font-sans text-sm">
                    <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    No datasets uploaded yet. Click "Upload New Dataset" to begin.
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
                        <span className="text-slate-400 italic font-sans text-xs">Not migrated</span>
                      )}
                    </td>
                    <td className="py-4 px-5 text-right font-sans">
                      <div className="flex items-center justify-end space-x-2">
                        {ds.status === 'migrated' ? (
                          <button
                            onClick={() => {
                              onSelectDataset(ds);
                              onNavigate('crud');
                            }}
                            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                          >
                            <Database className="w-3.5 h-3.5" />
                            <span>CRUD</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              onSelectDataset(ds);
                              onNavigate('analysis');
                            }}
                            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-blue-600 rounded-lg border border-slate-200 text-xs font-semibold transition-colors"
                          >
                            <span>Open Pipeline</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          onClick={(e) => handleDeleteClick(ds, e)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete dataset and drop generated MySQL database"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- CONFIRM DATASET DELETION MODAL --- */}
      {deleteModalDataset && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center space-x-3 bg-rose-50/50">
              <div className="w-10 h-10 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Dataset & Resources</h3>
                <p className="text-xs text-slate-500 mt-0.5">Permanent cascading cleanup</p>
              </div>
            </div>

            <div className="p-5 space-y-3 text-xs text-slate-600">
              {deleteError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{deleteError}</span>
                </div>
              )}

              <p className="leading-relaxed">
                Are you sure you want to delete <strong className="text-slate-900 font-mono">{deleteModalDataset.original_name}</strong>?
              </p>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1 text-slate-700">
                <div className="font-semibold text-slate-900 mb-1">The following will be permanently removed:</div>
                <div>• Stored raw file on disk (<code className="font-mono text-slate-600">{deleteModalDataset.stored_filename}</code>)</div>
                {deleteModalDataset.target_database && (
                  <div>• Dynamic MySQL database <strong className="font-mono text-rose-700">`{deleteModalDataset.target_database}`</strong> (all physical tables & data)</div>
                )}
                <div>• All metadata: columns, functional dependencies, candidate keys, and normalization runs.</div>
              </div>

              <p className="text-[11px] text-slate-400">
                This action cannot be undone.
              </p>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setDeleteModalDataset(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deletingId !== null}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50"
              >
                {deletingId ? 'Cleaning up...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
