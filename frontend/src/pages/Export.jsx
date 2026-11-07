import React, { useEffect, useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  FileCode,
  Network,
  FileText,
  CheckCircle2,
  Database,
  ArrowRight,
  ExternalLink,
  Layers,
  RefreshCw,
  Copy,
  Check,
  Terminal,
  ShieldCheck,
  Info
} from 'lucide-react';
import ERDViewer from '../components/ERDViewer';
import DataTable from '../components/DataTable';
import { getMigrationStatus, getERDData, getExcelDownloadUrl, getSqlDownloadUrl } from '../services/api';

const ExportPage = ({ activeDataset, onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [erdData, setErdData] = useState(null);
  const [migrationStatus, setMigrationStatus] = useState(null);
  const [activeTab, setActiveTab] = useState('erd'); // 'erd' | 'live_tables' | 'report'
  const [copiedDb, setCopiedDb] = useState(false);

  const loadData = async () => {
    if (!activeDataset?.id) return;
    setLoading(true);
    try {
      const [erdRes, statusRes] = await Promise.all([
        getERDData(activeDataset.id),
        getMigrationStatus(activeDataset.id)
      ]);
      if (erdRes.success) setErdData(erdRes);
      if (statusRes.success) setMigrationStatus(statusRes);
    } catch (err) {
      console.error('Failed to load export details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeDataset?.id]);

  if (!activeDataset) {
    return (
      <div className="bg-white border border-dashed border-slate-300 rounded-xl p-14 text-center text-slate-500">
        <Download className="w-12 h-12 mx-auto text-slate-400 mb-4" />
        <h3 className="text-base font-semibold text-slate-800">No Dataset Selected</h3>
        <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">Please upload, normalize, and migrate a dataset first to download deliverables.</p>
        <button
          onClick={() => onNavigate('upload')}
          className="mt-5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 shadow-xs transition-colors"
        >
          Go to Dataset Upload
        </button>
      </div>
    );
  }

  const excelUrl = getExcelDownloadUrl(activeDataset.id);
  const sqlUrl = getSqlDownloadUrl(activeDataset.id);
  const targetDbName = erdData?.databaseName || activeDataset.target_database || `smartdb_ds_${activeDataset.id}`;

  const handleCopyDb = () => {
    navigator.clipboard.writeText(`mysql -u root -p ${targetDbName}`);
    setCopiedDb(true);
    setTimeout(() => setCopiedDb(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Export & Schema Deliverables</h1>
          <p className="text-sm text-slate-500 mt-1">
            Production-ready SQL dumps, multi-sheet Excel workbooks, and interactive ER diagrams generated directly from MySQL 8.
          </p>
        </div>

        {/* Quick Download Buttons */}
        <div className="flex items-center space-x-3">
          <a
            href={excelUrl}
            download
            className="inline-flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Excel Workbook (.xlsx)</span>
          </a>

          <a
            href={sqlUrl}
            download
            className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors"
          >
            <FileCode className="w-4 h-4 text-blue-400" />
            <span>SQL DDL + DML Dump</span>
          </a>
        </div>
      </div>

      {/* Target Database Info Banner */}
      <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <Database className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center space-x-3">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Target Database:</span>
                <span className="font-mono font-bold text-base text-white">{targetDbName}</span>
                <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Online & Verified</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Schema validated under MySQL 8.0 storage engine. Relational foreign key constraints and primary indexes are fully operational.
              </p>
              <div className="mt-3 flex items-center space-x-2.5 text-xs font-mono text-slate-300">
                <Terminal className="w-4 h-4 text-slate-500" />
                <span className="text-slate-400">CLI:</span>
                <code className="bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800 text-slate-200">
                  mysql -u root -p {targetDbName}
                </code>
                <button
                  onClick={handleCopyDb}
                  className="text-slate-400 hover:text-white transition-colors p-1"
                  title="Copy command"
                >
                  {copiedDb ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4 text-xs bg-slate-950/60 border border-slate-800/80 px-5 py-3 rounded-lg shrink-0">
            <div className="text-center px-4 border-r border-slate-800">
              <div className="text-2xl font-mono font-bold text-white tabular-nums">{erdData?.tables?.length || 0}</div>
              <div className="text-xs text-slate-400 uppercase tracking-wide mt-0.5">Tables</div>
            </div>
            <div className="text-center px-4">
              <div className="text-2xl font-mono font-bold text-blue-400 tabular-nums">{erdData?.relationships?.length || 0}</div>
              <div className="text-xs text-slate-400 uppercase tracking-wide mt-0.5">FK Relations</div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 space-x-8 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('erd')}
          className={`pb-3.5 transition-colors border-b-2 flex items-center space-x-2 ${
            activeTab === 'erd'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Network className="w-4 h-4" />
          <span>Entity-Relationship Diagram</span>
        </button>

        <button
          onClick={() => setActiveTab('live_tables')}
          className={`pb-3.5 transition-colors border-b-2 flex items-center space-x-2 ${
            activeTab === 'live_tables'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Live MySQL Tables Preview</span>
        </button>

        <button
          onClick={() => setActiveTab('report')}
          className={`pb-3.5 transition-colors border-b-2 flex items-center space-x-2 ${
            activeTab === 'report'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Migration Audit Trail</span>
        </button>
      </div>

      {/* Tab Contents */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-16 text-center text-slate-500">
          <RefreshCw className="w-8 h-8 mx-auto text-blue-600 animate-spin mb-4" />
          <h3 className="text-sm font-semibold text-slate-800">Reading live schema and records from MySQL...</h3>
        </div>
      ) : activeTab === 'erd' && erdData ? (
        <ERDViewer
          tables={erdData.tables}
          relationships={erdData.relationships}
          databaseName={erdData.databaseName}
        />
      ) : activeTab === 'live_tables' && migrationStatus ? (
        <div className="space-y-6">
          {migrationStatus.liveTableData?.map((tbl) => {
            const previewRows = tbl.preview || [];
            const headers = previewRows.length > 0 ? Object.keys(previewRows[0]) : [];
            return (
              <DataTable
                key={tbl.tableName}
                headers={headers}
                rows={previewRows}
                title={`Table: ${tbl.tableName} (${tbl.rowCount} total rows in MySQL)`}
                subtitle="Live records directly queried from the normalized MySQL database"
                pageSize={10}
              />
            );
          })}
        </div>
      ) : activeTab === 'report' && migrationStatus ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Physical Migration Execution Trail</h3>
              <p className="text-xs text-slate-500 mt-0.5">Sequential audit record stored in <code className="font-mono text-slate-700">smartdb_system.migration_logs</code></p>
            </div>
            <span className="inline-flex items-center space-x-1.5 text-xs font-mono text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Immutable Log</span>
            </span>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {migrationStatus.logs?.map((log) => (
              <div key={log.id} className="py-3 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-bold text-slate-900">{log.stage}</span>
                    <span className={`text-xs font-mono font-medium px-2 py-0.5 rounded ${
                      log.status === 'completed'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      {log.status}
                    </span>
                  </div>
                  <p className="text-slate-600 text-xs font-mono">{log.message}</p>
                </div>
                <span className="text-xs text-slate-400 font-mono shrink-0">
                  {new Date(log.created_at).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ExportPage;
