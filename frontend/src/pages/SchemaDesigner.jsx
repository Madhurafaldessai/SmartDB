import React, { useState, useEffect } from 'react';
import {
  Network,
  Play,
  Key,
  Link as LinkIcon,
  CheckCircle2,
  AlertCircle,
  Database,
  ArrowRight,
  RefreshCw,
  Sliders,
  Layers
} from 'lucide-react';
import { runMigration } from '../services/api';

const DATA_TYPES = [
  'INT',
  'BIGINT',
  'VARCHAR(64)',
  'VARCHAR(100)',
  'VARCHAR(255)',
  'TEXT',
  'DECIMAL(10,2)',
  'DATETIME',
  'DATE',
  'TINYINT(1)'
];

const SchemaDesignerPage = ({ activeDataset, initialSchema, onNavigate, onMigrationSuccess }) => {
  const [tables, setTables] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [targetDatabaseName, setTargetDatabaseName] = useState('');
  const [activeTableIdx, setActiveTableIdx] = useState(0);
  const [migrating, setMigrating] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (initialSchema) {
      setTables(initialSchema.tables || []);
      setRelationships(initialSchema.relationships || []);
      setTargetDatabaseName(initialSchema.targetDatabaseName || `smartdb_ds_${activeDataset?.id || '001'}`);
    }
  }, [initialSchema, activeDataset?.id]);

  const handleTableNameChange = (idx, newName) => {
    setTables(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], tableName: newName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_') };
      return copy;
    });
  };

  const handleColumnChange = (tableIdx, colIdx, field, value) => {
    setTables(prev => {
      const copy = [...prev];
      const table = { ...copy[tableIdx] };
      const columns = [...table.columns];
      columns[colIdx] = { ...columns[colIdx], [field]: value };
      table.columns = columns;
      copy[tableIdx] = table;
      return copy;
    });
  };

  const handleExecuteMigration = async () => {
    if (!activeDataset?.id) return;
    setMigrating(true);
    setError(null);
    setMigrationStatus('Creating MySQL database and executing DDL statements in topological order...');

    try {
      const res = await runMigration(activeDataset.id, {
        targetDatabaseName,
        tables,
        relationships
      });

      if (res.success) {
        setMigrationStatus('Migration completed successfully! Redirecting to live database record manager (CRUD)...');
        if (onMigrationSuccess) {
          onMigrationSuccess(res.result);
        }
        setTimeout(() => {
          onNavigate('crud');
        }, 1000);
      } else {
        setError(res.message || 'Migration failed');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Migration error');
    } finally {
      setMigrating(false);
    }
  };

  if (!tables || tables.length === 0) {
    return (
      <div className="bg-white border border-dashed border-slate-300 rounded-xl p-14 text-center text-slate-500">
        <Network className="w-12 h-12 mx-auto text-slate-400 mb-4" />
        <h3 className="text-base font-semibold text-slate-800">No Normalized Schema Generated Yet</h3>
        <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">Please run the 3NF Normalization Engine first to synthesize tables.</p>
        <button
          onClick={() => onNavigate('normalization')}
          className="mt-5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 shadow-xs transition-colors"
        >
          Go to 3NF Normalization
        </button>
      </div>
    );
  }

  const currentTable = tables[activeTableIdx] || tables[0];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Interactive Schema Designer</h1>
          <p className="text-sm text-slate-500 mt-1">
            Refine generated table names, column data types, and primary/foreign key constraints before MySQL deployment.
          </p>
        </div>

        <div className="flex items-center space-x-3 self-start sm:self-auto">
          <div className="flex items-center space-x-2 text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-xs">
            <span className="text-slate-400 font-mono text-xs uppercase font-semibold">Database:</span>
            <input
              type="text"
              value={targetDatabaseName}
              onChange={(e) => setTargetDatabaseName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
              className="text-xs font-mono font-bold text-slate-900 bg-transparent focus:outline-none w-44"
              title="Target MySQL Database Name"
            />
          </div>

          <button
            onClick={handleExecuteMigration}
            disabled={migrating}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors disabled:opacity-50"
          >
            {migrating ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4 fill-white" />
            )}
            <span>{migrating ? 'Deploying to MySQL...' : 'Deploy to MySQL'}</span>
          </button>
        </div>
      </div>

      {migrationStatus && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center space-x-3 text-sm font-medium text-emerald-800">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{migrationStatus}</span>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center space-x-3 text-sm font-medium text-rose-800">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Designer Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Table Selector List */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
          <div className="px-2 py-1 flex items-center justify-between border-b border-slate-100">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Tables ({tables.length})
            </span>
          </div>

          <div className="space-y-1.5">
            {tables.map((tbl, idx) => (
              <button
                key={idx}
                onClick={() => setActiveTableIdx(idx)}
                className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-between ${
                  activeTableIdx === idx
                    ? 'bg-slate-900 text-white shadow-xs font-semibold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center space-x-2.5 truncate">
                  <Database className={`w-4 h-4 shrink-0 ${activeTableIdx === idx ? 'text-blue-400' : 'text-slate-400'}`} />
                  <span className="font-mono text-xs truncate">{tbl.tableName}</span>
                </div>
                <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                  activeTableIdx === idx ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-500'
                }`}>
                  {tbl.columns.length}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Column Editor Area */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden flex flex-col">
          {/* Table Header Bar */}
          <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Table:</span>
              <input
                type="text"
                value={currentTable.tableName}
                onChange={(e) => handleTableNameChange(activeTableIdx, e.target.value)}
                className="px-3 py-1.5 font-mono font-bold text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center space-x-3 text-xs">
              <span className="text-slate-500 font-medium">Synthesized Level:</span>
              <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                {currentTable.normalFormLevel || '3NF'}
              </span>
            </div>
          </div>

          {/* Columns Editor Table */}
          <div className="overflow-x-auto flex-1 p-4">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-slate-100/70 text-slate-600 uppercase font-semibold text-xs tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-mono">Column Identifier</th>
                  <th className="py-3 px-4 font-mono">Source Attribute</th>
                  <th className="py-3 px-4 font-mono">MySQL Type</th>
                  <th className="py-3 px-3 text-center font-mono">Primary Key</th>
                  <th className="py-3 px-3 text-center font-mono">Nullable</th>
                  <th className="py-3 px-4 font-mono">Foreign Key Target</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-xs">
                {currentTable.columns.map((col, colIdx) => (
                  <tr key={colIdx} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-4">
                      <input
                        type="text"
                        value={col.columnName}
                        onChange={(e) => handleColumnChange(activeTableIdx, colIdx, 'columnName', e.target.value)}
                        className="px-2.5 py-1.5 text-xs font-mono font-medium border border-slate-200 rounded-lg w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                      />
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 font-sans text-xs">
                      {col.originalName}
                    </td>
                    <td className="py-2.5 px-4">
                      <select
                        value={col.dataType}
                        onChange={(e) => handleColumnChange(activeTableIdx, colIdx, 'dataType', e.target.value)}
                        className="px-2.5 py-1.5 text-xs font-mono border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      >
                        {DATA_TYPES.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={col.isPrimaryKey}
                        onChange={(e) => handleColumnChange(activeTableIdx, colIdx, 'isPrimaryKey', e.target.checked)}
                        className="w-4 h-4 text-amber-500 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                      />
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={col.isNullable && !col.isPrimaryKey}
                        disabled={col.isPrimaryKey}
                        onChange={(e) => handleColumnChange(activeTableIdx, colIdx, 'isNullable', e.target.checked)}
                        className="w-4 h-4 text-blue-500 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                      />
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-600">
                      {col.isForeignKey ? (
                        <span className="text-blue-700 font-semibold" title={`References ${col.foreignTable}(${col.foreignColumn})`}>
                          → {col.foreignTable}({col.foreignColumn})
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">None</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SchemaDesignerPage;
