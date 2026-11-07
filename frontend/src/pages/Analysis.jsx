import React, { useEffect, useState } from 'react';
import {
  Microscope,
  Key,
  GitFork,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  Search,
  Check,
  X
} from 'lucide-react';
import { analyzeDataset, updateFunctionalDependencies } from '../services/api';

const AnalysisPage = ({ activeDataset, onNavigate, onAnalysisComplete }) => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('dependencies'); // 'dependencies' | 'columns'
  const [profileData, setProfileData] = useState(null);
  const [dependencies, setDependencies] = useState([]);
  const [primaryKey, setPrimaryKey] = useState([]);
  const [candidateKeys, setCandidateKeys] = useState([]);
  const [minimalCover, setMinimalCover] = useState([]);
  const [saving, setSaving] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');

  const runAnalysis = async () => {
    if (!activeDataset?.id) return;
    setLoading(true);
    try {
      const res = await analyzeDataset(activeDataset.id);
      if (res.success) {
        setProfileData(res.profile);
        setPrimaryKey(res.primaryKey || []);
        setCandidateKeys(res.candidateKeys || []);
        setMinimalCover(res.minimalCover || []);

        setDependencies(
          (res.dependencies || []).map(fd => ({
            ...fd,
            isConfirmed: fd.isConfirmed !== undefined ? fd.isConfirmed : (fd.confidence >= 0.98 && (fd.violationCount || 0) === 0)
          }))
        );

        if (onAnalysisComplete) {
          onAnalysisComplete(res);
        }
      }
    } catch (err) {
      console.error('Analysis failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runAnalysis();
  }, [activeDataset?.id]);

  const toggleFDConfirmation = (index) => {
    setDependencies(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], isConfirmed: !copy[index].isConfirmed };
      return copy;
    });
  };

  const confirmAllFDs = (status) => {
    setDependencies(prev => prev.map(fd => ({ ...fd, isConfirmed: status })));
  };

  const saveConfirmedFDs = async () => {
    if (!activeDataset?.id) return;
    setSaving(true);
    try {
      await updateFunctionalDependencies(activeDataset.id, dependencies);
      onNavigate('normalization');
    } catch (err) {
      console.error('Failed to save FDs:', err);
    } finally {
      setSaving(false);
    }
  };

  if (!activeDataset) {
    return (
      <div className="bg-white border border-dashed border-slate-300 rounded-xl p-14 text-center text-slate-500">
        <Microscope className="w-12 h-12 mx-auto text-slate-400 mb-4" />
        <h3 className="text-base font-semibold text-slate-800">No Dataset Selected</h3>
        <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">Please upload or select a dataset from the catalog to run relational profiling.</p>
        <button
          onClick={() => onNavigate('upload')}
          className="mt-5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 shadow-xs transition-colors"
        >
          Go to Upload
        </button>
      </div>
    );
  }

  const filteredFDs = dependencies.filter(fd => {
    if (!filterQuery.trim()) return true;
    const q = filterQuery.toLowerCase();
    return fd.determinant.some(d => d.toLowerCase().includes(q)) ||
           fd.dependents.some(d => d.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dataset Analysis & Functional Dependencies</h1>
          <p className="text-sm text-slate-500 mt-1">
            Candidate key discovery via attribute closure, dependency mining with violation rates, and column data profiling.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={runAnalysis}
            disabled={loading}
            className="inline-flex items-center space-x-2 px-3.5 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Re-analyze</span>
          </button>

          <button
            onClick={saveConfirmedFDs}
            disabled={saving || loading}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors"
          >
            <span>Confirm & Synthesize 3NF</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-16 text-center text-slate-500">
          <RefreshCw className="w-8 h-8 mx-auto text-blue-600 animate-spin mb-4" />
          <h3 className="text-base font-semibold text-slate-800">Computing attribute closures & functional dependencies...</h3>
          <p className="text-sm text-slate-500 mt-1">Evaluating determinants up to size 3, equivalence partitions, and non-minimal pruning</p>
        </div>
      ) : profileData ? (
        <>
          {/* Top Academic Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Candidate Keys (Closure)</span>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {candidateKeys.length > 0 ? (
                  candidateKeys.map((k, idx) => (
                    <span key={idx} className="inline-flex items-center px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-900 font-mono text-xs font-semibold">
                      <Key className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
                      [{k.join(', ')}]
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-500 italic">All attributes required</span>
                )}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Canonical Minimal Cover (Fc)</span>
              <div className="mt-2.5 text-sm text-slate-700">
                <span className="text-2xl font-bold font-mono text-indigo-600 mr-1.5">{minimalCover.length}</span>
                <span className="font-medium">canonical rules</span>
                <p className="text-xs text-slate-400 mt-1">Extraneous attributes eliminated</p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Inferred Dependencies</span>
              <div className="mt-2.5 text-sm text-slate-700">
                <span className="text-2xl font-bold font-mono text-blue-600 mr-1.5">{dependencies.length}</span>
                <span className="font-medium">rules inferred</span>
                <p className="text-xs text-slate-400 mt-1">{dependencies.filter(d => d.isConfirmed).length} confirmed by user</p>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 space-x-8 text-sm font-semibold">
            <button
              onClick={() => setActiveTab('dependencies')}
              className={`pb-3.5 transition-colors border-b-2 flex items-center space-x-2 ${
                activeTab === 'dependencies'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <GitFork className="w-4 h-4" />
              <span>Functional Dependencies ({dependencies.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('columns')}
              className={`pb-3.5 transition-colors border-b-2 flex items-center space-x-2 ${
                activeTab === 'columns'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Microscope className="w-4 h-4" />
              <span>Column Profiles ({profileData.columns.length})</span>
            </button>
          </div>

          {/* TAB 1: FUNCTIONAL DEPENDENCIES */}
          {activeTab === 'dependencies' && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
              <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">
                    Functional Dependencies ($X \to Y$) & Violation Statistics
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Determinants evaluated up to size 3. Toggle checkboxes to confirm as true business rules before decomposition.
                  </p>
                </div>

                <div className="flex items-center space-x-2.5">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Filter column..."
                      value={filterQuery}
                      onChange={(e) => setFilterQuery(e.target.value)}
                      className="pl-9 pr-3 py-1.5 text-xs font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-48 bg-white"
                    />
                  </div>

                  <button
                    onClick={() => confirmAllFDs(true)}
                    className="px-3 py-1.5 text-xs bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => confirmAllFDs(false)}
                    className="px-3 py-1.5 text-xs bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-slate-100/70 text-slate-600 uppercase font-semibold text-xs tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4 w-14 text-center">Confirm</th>
                      <th className="py-3 px-5 font-mono">Determinant (X)</th>
                      <th className="py-3 px-2 text-center w-8">→</th>
                      <th className="py-3 px-5 font-mono">Dependent (Y)</th>
                      <th className="py-3 px-4 text-center font-mono">Confidence</th>
                      <th className="py-3 px-4 text-center font-mono">Violations</th>
                      <th className="py-3 px-4 text-center font-mono">Violation Rate</th>
                      <th className="py-3 px-5 text-right font-mono">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
                    {filteredFDs.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400 font-sans text-sm">
                          No functional dependencies match filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredFDs.map((fd, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={fd.isConfirmed}
                              onChange={() => toggleFDConfirmation(dependencies.indexOf(fd))}
                              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-3.5 px-5 font-mono font-bold text-slate-900">
                            <span className="px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200">
                              [{fd.determinant.join(', ')}]
                            </span>
                          </td>
                          <td className="py-3.5 px-2 text-center font-bold text-slate-400">→</td>
                          <td className="py-3.5 px-5 font-mono font-semibold text-blue-800">
                            <span className="px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200">
                              [{fd.dependents.join(', ')}]
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono text-xs tabular-nums font-medium">
                            {(fd.confidence * 100).toFixed(1)}%
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono text-xs tabular-nums">
                            {fd.violationCount > 0 ? (
                              <span className="text-rose-600 font-bold">{fd.violationCount} row(s)</span>
                            ) : (
                              <span className="text-emerald-600 font-medium">0</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono text-xs text-slate-600 tabular-nums">
                            {fd.violationRate ? `${fd.violationRate}%` : '0.00%'}
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            {fd.isCandidateKey ? (
                              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                                Candidate Key
                              </span>
                            ) : fd.isConfirmed ? (
                              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                Confirmed
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500">
                                Excluded
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: COLUMN PROFILES */}
          {activeTab === 'columns' && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
              <div className="p-5 border-b border-slate-200 bg-slate-50/50">
                <h3 className="font-semibold text-slate-900 text-sm">Column Profile & Inferred MySQL Data Types</h3>
                <p className="text-xs text-slate-500 mt-0.5">Null metrics, uniqueness cardinality, and scalar data types</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-slate-100/70 text-slate-600 uppercase font-semibold text-xs tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-5">Column Name</th>
                      <th className="py-3 px-5">Sanitized Identifier</th>
                      <th className="py-3 px-5">Detected MySQL Type</th>
                      <th className="py-3 px-5">Null Count</th>
                      <th className="py-3 px-5">Cardinality</th>
                      <th className="py-3 px-5">Sample Values</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {profileData.columns.map((col) => (
                      <tr key={col.originalName} className="hover:bg-slate-50/80">
                        <td className="py-3.5 px-5 font-semibold text-slate-900">{col.originalName}</td>
                        <td className="py-3.5 px-5 font-mono text-xs text-blue-600 font-semibold">{col.sanitizedName}</td>
                        <td className="py-3.5 px-5 font-mono text-xs text-slate-700 font-medium">{col.detectedType}</td>
                        <td className="py-3.5 px-5 text-xs font-mono tabular-nums">
                          {col.nullCount > 0 ? (
                            <span className="text-rose-600 font-semibold">{col.nullCount} ({col.nullPercentage}%)</span>
                          ) : (
                            <span className="text-emerald-600 font-medium">0 (0%)</span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 font-mono text-xs tabular-nums">{col.uniqueCount} / {profileData.totalRows}</td>
                        <td className="py-3.5 px-5 text-slate-500 text-xs font-mono max-w-[240px] truncate" title={col.sampleValues.join(', ')}>
                          {col.sampleValues.join(', ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
};

export default AnalysisPage;
