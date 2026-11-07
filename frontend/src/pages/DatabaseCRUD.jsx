import React, { useEffect, useState } from 'react';
import {
  Database,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Search,
  Key,
  Link as LinkIcon,
  AlertCircle,
  CheckCircle2,
  Layers,
  ChevronLeft,
  ChevronRight,
  X,
  ArrowRight
} from 'lucide-react';
import {
  getGeneratedTables,
  getTableRecords,
  createRecord,
  updateRecord,
  deleteRecord
} from '../services/api';

const DatabaseCRUDPage = ({ activeDataset, onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [tables, setTables] = useState([]);
  const [selectedTableName, setSelectedTableName] = useState('');
  const [recordsData, setRecordsData] = useState({
    records: [],
    columns: [],
    primaryKeys: [],
    totalRecords: 0,
    page: 1,
    pageSize: 12,
    totalPages: 1
  });
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [databaseName, setDatabaseName] = useState('');

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [activeRow, setActiveRow] = useState(null);
  const [formData, setFormData] = useState({});
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Load all generated tables for the dataset
  const loadTables = async () => {
    if (!activeDataset?.id) return;
    setLoading(true);
    try {
      const res = await getGeneratedTables(activeDataset.id);
      if (res.success) {
        setDatabaseName(res.databaseName);
        setTables(res.tables || []);
        if (res.tables && res.tables.length > 0) {
          const initialTable = selectedTableName || res.tables[0].tableName;
          setSelectedTableName(initialTable);
        }
      }
    } catch (err) {
      console.error('Failed to load generated tables:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTables();
  }, [activeDataset?.id]);

  // Load records whenever selected table or page or search changes
  const loadRecords = async (page = 1, search = searchQuery) => {
    if (!activeDataset?.id || !selectedTableName) return;
    setRecordsLoading(true);
    setActionSuccess(null);
    try {
      const res = await getTableRecords(activeDataset.id, selectedTableName, {
        page,
        pageSize: 12,
        search
      });
      if (res.success) {
        setRecordsData({
          records: res.records || [],
          columns: res.columns || [],
          primaryKeys: res.primaryKeys || [],
          totalRecords: res.totalRecords || 0,
          page: res.page || 1,
          pageSize: res.pageSize || 12,
          totalPages: res.totalPages || 1
        });
      }
    } catch (err) {
      console.error('Failed to load records:', err);
    } finally {
      setRecordsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedTableName) {
      loadRecords(1, searchQuery);
    }
  }, [selectedTableName, activeDataset?.id]);

  // Handle Create Record
  const handleOpenAdd = () => {
    const initial = {};
    recordsData.columns.forEach(c => {
      initial[c.name] = '';
    });
    setFormData(initial);
    setModalError(null);
    setShowAddModal(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setModalSubmitting(true);
    setModalError(null);
    try {
      const res = await createRecord(activeDataset.id, selectedTableName, formData);
      if (res.success) {
        setShowAddModal(false);
        setActionSuccess(res.message);
        loadRecords(recordsData.page);
        loadTables(); // Update table row count
      } else {
        setModalError(res.message);
      }
    } catch (err) {
      setModalError(err.response?.data?.message || err.message || 'Error inserting record');
    } finally {
      setModalSubmitting(false);
    }
  };

  // Handle Edit Record
  const handleOpenEdit = (row) => {
    setActiveRow(row);
    setFormData({ ...row });
    setModalError(null);
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setModalSubmitting(true);
    setModalError(null);

    // Build keys object from primary keys
    const keys = {};
    recordsData.primaryKeys.forEach(pk => {
      keys[pk] = activeRow[pk];
    });

    try {
      const res = await updateRecord(activeDataset.id, selectedTableName, keys, formData);
      if (res.success) {
        setShowEditModal(false);
        setActionSuccess(res.message);
        loadRecords(recordsData.page);
      } else {
        setModalError(res.message);
      }
    } catch (err) {
      setModalError(err.response?.data?.message || err.message || 'Error updating record');
    } finally {
      setModalSubmitting(false);
    }
  };

  // Handle Delete Record
  const handleOpenDelete = (row) => {
    setActiveRow(row);
    setModalError(null);
    setShowDeleteModal(true);
  };

  const handleDeleteSubmit = async () => {
    setModalSubmitting(true);
    setModalError(null);

    const keys = {};
    recordsData.primaryKeys.forEach(pk => {
      keys[pk] = activeRow[pk];
    });

    try {
      const res = await deleteRecord(activeDataset.id, selectedTableName, keys);
      if (res.success) {
        setShowDeleteModal(false);
        setActionSuccess(res.message);
        loadRecords(recordsData.page);
        loadTables();
      } else {
        setModalError(res.message);
      }
    } catch (err) {
      setModalError(err.response?.data?.message || err.message || 'Error deleting record');
    } finally {
      setModalSubmitting(false);
    }
  };

  if (!activeDataset) {
    return (
      <div className="bg-white border border-dashed border-slate-300 rounded-xl p-14 text-center text-slate-500">
        <Database className="w-12 h-12 mx-auto text-slate-400 mb-4" />
        <h3 className="text-base font-semibold text-slate-800">No Dataset Selected</h3>
        <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">Please upload, normalize, and migrate a dataset first to manage generated tables.</p>
        <button
          onClick={() => onNavigate('upload')}
          className="mt-5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 shadow-xs transition-colors"
        >
          Go to Dataset Upload
        </button>
      </div>
    );
  }

  if (activeDataset.status !== 'migrated' && tables.length === 0) {
    return (
      <div className="bg-white border border-dashed border-slate-300 rounded-xl p-14 text-center text-slate-500">
        <Database className="w-12 h-12 mx-auto text-slate-400 mb-4" />
        <h3 className="text-base font-semibold text-slate-800">Physical Tables Not Generated Yet</h3>
        <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
          Dataset has been profiled, but physical MySQL tables have not been deployed. Please complete the schema migration step.
        </p>
        <button
          onClick={() => onNavigate('schema')}
          className="mt-5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 shadow-xs transition-colors"
        >
          Open Schema Designer
        </button>
      </div>
    );
  }

  const selectedTableMeta = tables.find(t => t.tableName === selectedTableName) || null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Generated Database & Record Operations (CRUD)</h1>
          <p className="text-sm text-slate-500 mt-1">
            Perform live Create, Read, Update, and Delete operations on normalized MySQL 8 tables. Foreign key constraints are actively verified.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              loadTables();
              loadRecords(recordsData.page);
            }}
            className="inline-flex items-center space-x-1.5 px-3 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${recordsLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Record</span>
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center space-x-3 text-sm font-medium text-emerald-800">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Database Context & Table Switcher Tabs */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs uppercase font-semibold text-slate-400 tracking-wider">Connected MySQL Database</span>
              <div className="font-mono font-bold text-sm text-slate-900">{databaseName || activeDataset.target_database}</div>
            </div>
          </div>

          {/* Table Selector Tabs */}
          <div className="flex flex-wrap gap-2">
            {tables.map(tbl => (
              <button
                key={tbl.tableName}
                onClick={() => setSelectedTableName(tbl.tableName)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-colors flex items-center space-x-2 ${
                  selectedTableName === tbl.tableName
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span>{tbl.tableName}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded ${
                  selectedTableName === tbl.tableName ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-500'
                }`}>
                  {tbl.rowCount}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Selected Table Metadata Strip */}
        {selectedTableMeta && (
          <div className="px-5 py-3 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center space-x-1.5 text-amber-900 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md">
                <Key className="w-3.5 h-3.5 text-amber-600" />
                <span className="font-bold">PK:</span>
                <span>[{selectedTableMeta.primaryKeys?.join(', ') || 'None'}]</span>
              </span>

              {selectedTableMeta.columns?.filter(c => c.isForeignKey).map(fk => (
                <span key={fk.name} className="flex items-center space-x-1.5 text-blue-900 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-md" title={`References ${fk.foreignReference?.referencedTable}(${fk.foreignReference?.referencedColumn})`}>
                  <LinkIcon className="w-3.5 h-3.5 text-blue-600" />
                  <span className="font-bold">FK:</span>
                  <span>{fk.name} → {fk.foreignReference?.referencedTable}</span>
                </span>
              ))}
            </div>

            {/* Search Filter */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder={`Search in ${selectedTableName}...`}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  loadRecords(1, e.target.value);
                }}
                className="pl-9 pr-8 py-1.5 text-xs font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-56 bg-white"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    loadRecords(1, '');
                  }}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Records Data Table */}
        <div className="overflow-x-auto max-h-[520px]">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-slate-100/70 text-slate-600 uppercase font-semibold text-xs tracking-wider sticky top-0 border-b border-slate-200 z-10">
              <tr>
                <th className="py-3 px-4 w-12 text-slate-400 text-center font-mono">#</th>
                {recordsData.columns?.map(col => (
                  <th key={col.name} className="py-3 px-5 font-mono whitespace-nowrap">
                    <div className="flex items-center space-x-1.5">
                      {col.isPrimaryKey && <Key className="w-3 h-3 text-amber-500 shrink-0" />}
                      {col.isForeignKey && <LinkIcon className="w-3 h-3 text-blue-500 shrink-0" />}
                      <span>{col.name}</span>
                    </div>
                  </th>
                ))}
                <th className="py-3 px-5 text-right font-mono">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-mono text-xs">
              {recordsLoading ? (
                <tr>
                  <td colSpan={(recordsData.columns?.length || 0) + 2} className="py-14 text-center text-slate-400 font-sans text-sm">
                    <RefreshCw className="w-6 h-6 mx-auto text-blue-600 animate-spin mb-2" />
                    Querying records from MySQL...
                  </td>
                </tr>
              ) : recordsData.records.length === 0 ? (
                <tr>
                  <td colSpan={(recordsData.columns?.length || 0) + 2} className="py-14 text-center text-slate-400 font-sans text-sm">
                    {searchQuery ? 'No records match search filter' : 'No records exist in this table yet. Click "Add New Record" to insert.'}
                  </td>
                </tr>
              ) : (
                recordsData.records.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 text-center text-slate-400 text-xs select-none tabular-nums">
                      {(recordsData.page - 1) * recordsData.pageSize + idx + 1}
                    </td>
                    {recordsData.columns.map(col => {
                      const val = row[col.name];
                      return (
                        <td key={col.name} className="py-3 px-5 whitespace-nowrap max-w-[240px] truncate" title={String(val ?? '')}>
                          {val !== undefined && val !== null && String(val).trim() !== '' ? (
                            <span className={col.isPrimaryKey ? 'font-bold text-slate-900' : ''}>
                              {String(val)}
                            </span>
                          ) : (
                            <span className="text-slate-300 italic font-sans text-xs">null</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="py-3 px-5 text-right font-sans whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleOpenEdit(row)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          title="Edit record"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenDelete(row)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                          title="Delete record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500 font-sans">
          <div>
            Showing <span className="font-semibold text-slate-700">{recordsData.totalRecords > 0 ? (recordsData.page - 1) * recordsData.pageSize + 1 : 0}</span> to{' '}
            <span className="font-semibold text-slate-700">{Math.min(recordsData.page * recordsData.pageSize, recordsData.totalRecords)}</span> of{' '}
            <span className="font-semibold text-slate-700">{recordsData.totalRecords}</span> records in <code className="font-mono text-slate-800">{selectedTableName}</code>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => loadRecords(recordsData.page - 1)}
              disabled={recordsData.page <= 1}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-slate-700"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono font-medium text-slate-600 px-2">
              Page {recordsData.page} of {recordsData.totalPages}
            </span>
            <button
              onClick={() => loadRecords(recordsData.page + 1)}
              disabled={recordsData.page >= recordsData.totalPages}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-slate-700"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* --- ADD RECORD MODAL --- */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-base font-bold text-slate-900">Insert Record into `{selectedTableName}`</h3>
                <p className="text-xs text-slate-500 mt-0.5">Enter attribute values conforming to table data types</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
              {modalError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs leading-relaxed flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}

              {recordsData.columns.map(col => (
                <div key={col.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-mono font-semibold text-slate-800 flex items-center space-x-1.5">
                      <span>{col.name}</span>
                      {col.isPrimaryKey && <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-sans font-bold">PK</span>}
                      {col.isForeignKey && <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-sans font-bold">FK</span>}
                    </label>
                    <span className="font-mono text-slate-400 text-[11px]">{col.columnType}</span>
                  </div>

                  <input
                    type="text"
                    value={formData[col.name] ?? ''}
                    onChange={(e) => setFormData({ ...formData, [col.name]: e.target.value })}
                    placeholder={col.isForeignKey ? `References ${col.foreignReference?.referencedTable}(${col.foreignReference?.referencedColumn})` : `Value`}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none"
                  />
                  {col.isForeignKey && (
                    <p className="text-[11px] text-blue-600 font-sans">
                      Must match an existing `{col.foreignReference?.referencedColumn}` in `{col.foreignReference?.referencedTable}`.
                    </p>
                  )}
                </div>
              ))}

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50"
                >
                  {modalSubmitting ? 'Inserting...' : 'Insert Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- EDIT RECORD MODAL --- */}
      {showEditModal && activeRow && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-base font-bold text-slate-900">Update Record in `{selectedTableName}`</h3>
                <p className="text-xs text-slate-500 mt-0.5">Modify fields and execute parameterized SQL UPDATE</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
              {modalError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs leading-relaxed flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}

              {recordsData.columns.map(col => (
                <div key={col.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-mono font-semibold text-slate-800 flex items-center space-x-1.5">
                      <span>{col.name}</span>
                      {col.isPrimaryKey && <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-sans font-bold">PK</span>}
                      {col.isForeignKey && <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-sans font-bold">FK</span>}
                    </label>
                    <span className="font-mono text-slate-400 text-[11px]">{col.columnType}</span>
                  </div>

                  <input
                    type="text"
                    value={formData[col.name] ?? ''}
                    disabled={col.isPrimaryKey} // Lock primary keys during update for integrity
                    onChange={(e) => setFormData({ ...formData, [col.name]: e.target.value })}
                    className={`w-full px-3 py-2 text-xs font-mono border rounded-lg focus:outline-none ${
                      col.isPrimaryKey
                        ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'
                        : 'bg-white border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                    }`}
                  />
                  {col.isPrimaryKey && (
                    <p className="text-[10px] text-slate-400 font-sans">Primary key locked to identify record.</p>
                  )}
                </div>
              ))}

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50"
                >
                  {modalSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- DELETE RECORD CONFIRMATION MODAL --- */}
      {showDeleteModal && activeRow && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center space-x-3 bg-rose-50/50">
              <div className="w-10 h-10 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Confirm Record Deletion</h3>
                <p className="text-xs text-slate-500 mt-0.5">Table: <code className="font-mono text-slate-700">{selectedTableName}</code></p>
              </div>
            </div>

            <div className="p-5 space-y-3">
              {modalError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs leading-relaxed flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}

              <p className="text-xs text-slate-600 leading-relaxed">
                Are you sure you want to delete this record from the MySQL database?
              </p>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs font-mono space-y-1">
                {recordsData.primaryKeys.map(pk => (
                  <div key={pk} className="flex justify-between">
                    <span className="text-slate-500 font-semibold">{pk}:</span>
                    <span className="font-bold text-slate-900">{String(activeRow[pk])}</span>
                  </div>
                ))}
              </div>

              <p className="text-[11px] text-slate-500">
                Note: If this row is referenced by a foreign key constraint in a child table, MySQL will reject the operation to prevent orphan records.
              </p>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSubmit}
                disabled={modalSubmitting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50"
              >
                {modalSubmitting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DatabaseCRUDPage;
