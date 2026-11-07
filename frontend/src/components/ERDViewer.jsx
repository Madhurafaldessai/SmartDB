import React from 'react';
import { Key, Link as LinkIcon, Database, ArrowRight } from 'lucide-react';

const ERDViewer = ({ tables = [], relationships = [], databaseName }) => {
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 shadow-md text-slate-100 overflow-hidden">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-800 gap-4 mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center text-blue-400">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide uppercase">
              Relational Entity-Relationship Diagram (ERD)
            </h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Database: <span className="text-slate-200 font-semibold">{databaseName || 'smartdb_dataset'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-5 text-xs font-mono">
          <span className="flex items-center space-x-2 text-amber-400">
            <Key className="w-3.5 h-3.5" />
            <span>Primary Key (PK)</span>
          </span>
          <span className="flex items-center space-x-2 text-blue-400">
            <LinkIcon className="w-3.5 h-3.5" />
            <span>Foreign Key (FK)</span>
          </span>
        </div>
      </div>

      {/* Grid of Normalized Tables */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tables.map((table) => (
          <div
            key={table.tableName || table.id}
            className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xs flex flex-col hover:border-slate-700 transition-colors"
          >
            {/* Table Header */}
            <div className="bg-slate-800/90 px-4 py-3 border-b border-slate-700/80 flex items-center justify-between">
              <span className="font-mono font-bold text-sm text-white tracking-tight flex items-center space-x-2">
                <Database className="w-3.5 h-3.5 text-blue-400" />
                <span>{table.tableName}</span>
              </span>
              <span className="text-xs font-mono text-slate-400 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded">
                {table.rowCount !== undefined ? `${table.rowCount} rows` : `${table.columns?.length || 0} cols`}
              </span>
            </div>

            {/* Table Columns */}
            <div className="divide-y divide-slate-800/80 text-xs">
              {table.columns?.map((col) => {
                const isPK = col.isPK || col.isPrimaryKey;
                const isFK = col.isFK || col.isForeignKey;
                const colName = col.name || col.columnName;
                const dataType = col.type || col.dataType;

                return (
                  <div
                    key={colName}
                    className={`px-4 py-2.5 flex items-center justify-between hover:bg-slate-800/50 transition-colors ${
                      isPK ? 'bg-amber-500/5' : isFK ? 'bg-blue-500/5' : ''
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                      {isPK ? (
                        <Key className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      ) : isFK ? (
                        <LinkIcon className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      ) : (
                        <span className="w-3.5 h-3.5 block shrink-0" />
                      )}
                      <span className={`font-mono truncate text-xs ${
                        isPK ? 'font-bold text-amber-300' : isFK ? 'font-semibold text-blue-300' : 'text-slate-300'
                      }`}>
                        {colName}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <span className="font-mono text-xs text-slate-500 uppercase">
                        {dataType}
                      </span>
                      {isPK && (
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-amber-400/20 text-amber-300 rounded border border-amber-400/30">
                          PK
                        </span>
                      )}
                      {isFK && (
                        <span
                          className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-blue-400/20 text-blue-300 rounded border border-blue-400/30"
                          title={`References ${col.foreignTable}(${col.foreignColumn})`}
                        >
                          FK
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ERDViewer;
