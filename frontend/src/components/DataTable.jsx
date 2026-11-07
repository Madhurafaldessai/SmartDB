import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';

const DataTable = ({ headers = [], rows = [], pageSize = 10, title, subtitle }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredRows = rows.filter((row) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return headers.some((h) => {
      const val = row[h];
      return val !== null && val !== undefined && String(val).toLowerCase().includes(term);
    });
  });

  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const currentRows = filteredRows.slice(startIndex, startIndex + pageSize);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
      {/* Header & Search Toolbar */}
      {(title || headers.length > 0) && (
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
          <div>
            {title && <h3 className="font-semibold text-slate-900 text-sm tracking-tight">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search or filter records..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9 pr-8 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white w-full sm:w-64"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Grid Table */}
      <div className="overflow-x-auto max-h-[500px]">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="bg-slate-100/80 text-slate-600 uppercase font-semibold text-xs tracking-wider sticky top-0 border-b border-slate-200 z-10">
            <tr>
              <th className="py-3 px-4 w-12 text-slate-400 text-center font-mono">#</th>
              {headers.map((header) => (
                <th key={header} className="py-3 px-5 font-mono whitespace-nowrap">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700 font-mono text-sm">
            {currentRows.length === 0 ? (
              <tr>
                <td colSpan={headers.length + 1} className="py-14 text-center text-slate-400 font-sans text-sm">
                  {searchTerm ? 'No records match search filter' : 'No records available'}
                </td>
              </tr>
            ) : (
              currentRows.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 text-center text-slate-400 text-xs select-none tabular-nums">
                    {startIndex + idx + 1}
                  </td>
                  {headers.map((header) => (
                    <td key={header} className="py-3.5 px-5 whitespace-nowrap max-w-[260px] truncate" title={String(row[header] ?? '')}>
                      {row[header] !== undefined && row[header] !== null && String(row[header]).trim() !== '' ? (
                        <span>{String(row[header])}</span>
                      ) : (
                        <span className="text-slate-300 italic font-sans text-xs">null</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500 font-sans">
        <div>
          Showing <span className="font-semibold text-slate-700">{filteredRows.length > 0 ? startIndex + 1 : 0}</span> to{' '}
          <span className="font-semibold text-slate-700">{Math.min(startIndex + pageSize, filteredRows.length)}</span> of{' '}
          <span className="font-semibold text-slate-700">{filteredRows.length}</span> rows
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-slate-700"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono font-medium text-slate-600 px-2">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-slate-700"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default DataTable;
