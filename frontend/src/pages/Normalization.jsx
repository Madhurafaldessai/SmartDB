import React, { useEffect, useState } from 'react';
import {
  Cpu,
  ArrowRight,
  CheckCircle2,
  Layers,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Eye,
  ShieldCheck,
  GitMerge,
  Key,
  Database
} from 'lucide-react';
import { suggestNormalization } from '../services/api';

const NormalizationPage = ({ activeDataset, onNavigate, onNormalizationReady }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const fetchNormalization = async () => {
    if (!activeDataset?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await suggestNormalization(activeDataset.id);
      if (res.success) {
        setResult(res);
        if (onNormalizationReady) {
          onNormalizationReady(res);
        }
      } else {
        setError(res.message);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Normalization failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNormalization();
  }, [activeDataset?.id]);

  if (!activeDataset) {
    return (
      <div className="bg-white border border-dashed border-slate-300 rounded-xl p-14 text-center text-slate-500">
        <Cpu className="w-12 h-12 mx-auto text-slate-400 mb-4" />
        <h3 className="text-base font-semibold text-slate-800">No Dataset Selected</h3>
        <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">Please upload or select a dataset first to run 3NF synthesis.</p>
        <button
          onClick={() => onNavigate('upload')}
          className="mt-5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 shadow-xs transition-colors"
        >
          Go to Upload
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Academic Normalization Engine (1NF → 2NF → 3NF)</h1>
          <p className="text-sm text-slate-500 mt-1">
            Formal relational synthesis (Bernstein's algorithm) guaranteeing Lossless Join and Dependency Preservation.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchNormalization}
            disabled={loading}
            className="inline-flex items-center space-x-2 px-3.5 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Recalculate</span>
          </button>

          {result && (
            <button
              onClick={() => onNavigate('schema')}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors"
            >
              <span>Edit in Schema Designer</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-16 text-center text-slate-500">
          <RefreshCw className="w-8 h-8 mx-auto text-blue-600 animate-spin mb-4" />
          <h3 className="text-base font-semibold text-slate-800">Synthesizing 3NF relations from canonical minimal cover...</h3>
          <p className="text-sm text-slate-400 mt-1">Verifying lossless join and dependency preservation properties across relational projections</p>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-rose-700 text-sm">
          <AlertCircle className="w-5 h-5 mb-2" />
          {error}
        </div>
      ) : result ? (
        <>
          {/* Formal Relational Properties Banner */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Lossless-Join Property</span>
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="mt-3">
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {result.losslessJoinVerification?.isLossless ? 'VERIFIED ✓' : 'NOT SATISFIED'}
                </span>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  {result.losslessJoinVerification?.explanation}
                </p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Dependency Preservation</span>
                <GitMerge className="w-5 h-5 text-blue-600" />
              </div>
              <div className="mt-3">
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
                  {result.dependencyPreservationVerification?.isPreserved ? 'PRESERVED ✓' : 'PARTIAL'}
                </span>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  {result.dependencyPreservationVerification?.preservedCount} of {result.dependencyPreservationVerification?.totalCount} dependencies preserved across decomposed table projections.
                </p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Relational Synthesis</span>
                <Cpu className="w-5 h-5 text-purple-600" />
              </div>
              <div className="mt-3">
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200">
                  3NF (Bernstein's Algorithm)
                </span>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  Synthesized {result.tables?.length} non-redundant relation schemas directly from canonical minimal cover $F_c$.
                </p>
              </div>
            </div>
          </div>

          {/* Normal Form Stages Overview */}
          <div className="space-y-4">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">Academic Normalization Audit Trail</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {result.steps?.map((step, idx) => (
                <div key={idx} className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="font-bold text-xs px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 font-mono uppercase">
                        {step.stage}
                      </span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900">{step.title}</h3>
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{step.description}</p>
                  </div>
                  {step.actionsTaken && (
                    <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
                      {step.actionsTaken.join(' • ')}
                    </div>
                  )}
                  {step.details && (
                    <div className="mt-3 pt-3 border-t border-slate-100 font-mono text-xs text-slate-600 space-y-1">
                      {step.details.slice(0, 3).map((d, i) => (
                        <div key={i}>{d}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Minimal Cover Fc Display */}
          {result.minimalCover && result.minimalCover.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                    Canonical Minimal Cover ($F_c$)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Essential functional dependencies with extraneous left-hand-side attributes and redundant FDs removed
                  </p>
                </div>
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {result.minimalCover.length} Canonical Dependencies
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {result.minimalCover.map((fd, idx) => (
                  <div key={idx} className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-mono flex items-center justify-between">
                    <span className="font-bold text-slate-800">[{fd.determinant.join(', ')}]</span>
                    <span className="text-slate-400 mx-2 font-bold">→</span>
                    <span className="font-semibold text-indigo-700 truncate">[{fd.dependents.join(', ')}]</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Synthesized Normalized Tables */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  Synthesized 3NF Normalized Tables ({result.tables?.length})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Ready for review in Schema Designer and physical MySQL migration</p>
              </div>
              <button
                onClick={() => onNavigate('schema')}
                className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
              >
                <span>Open in Schema Designer</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {result.tables?.map((tbl) => (
                <div key={tbl.tableName} className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-slate-50 flex flex-col justify-between">
                  <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center space-x-2 truncate">
                      <Database className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="font-mono font-bold text-sm text-slate-900 truncate">{tbl.tableName}</span>
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono">
                      3NF
                    </span>
                  </div>

                  <div className="p-4 text-xs space-y-3 flex-1">
                    <div className="flex items-center space-x-1.5 text-xs text-amber-900 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-md font-mono">
                      <Key className="w-3.5 h-3.5 text-amber-600 shrink-0 mr-1" />
                      <span className="font-bold">PK:</span>
                      <span className="truncate">[{tbl.primaryKeys?.join(', ')}]</span>
                    </div>

                    <div className="text-xs text-slate-600">
                      <span className="font-semibold text-slate-700 block mb-1.5">Attributes ({tbl.columns?.length}):</span>
                      <div className="font-mono text-xs text-slate-600 flex flex-wrap gap-1.5">
                        {tbl.columns?.map(c => (
                          <span
                            key={c.columnName}
                            className={`px-2 py-0.5 rounded-md border ${
                              c.isPrimaryKey
                                ? 'bg-amber-50 border-amber-200 text-amber-900 font-bold'
                                : c.isForeignKey
                                ? 'bg-blue-50 border-blue-200 text-blue-900'
                                : 'bg-white border-slate-200 text-slate-700'
                            }`}
                          >
                            {c.columnName}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {tbl.description && (
                    <div className="px-4 py-2.5 border-t border-slate-200 text-xs text-slate-500 italic truncate bg-white">
                      {tbl.description}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default NormalizationPage;
