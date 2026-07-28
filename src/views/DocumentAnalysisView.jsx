import React, { useCallback, useEffect, useState } from "react";
import { FileSearch, Loader2, Play, Wrench, RefreshCw, FileText } from "lucide-react";
import {
  getSessionDocumentAnalysis,
  runSessionDocumentAnalysis,
  followupSessionDocumentAnalysis
} from "../lib/documentAnalysisApi.js";

export default function DocumentAnalysisView({ sessionId }) {
  const [loading, setLoading] = useState(true);
  const [docState, setDocState] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchState = useCallback(async () => {
    if (!sessionId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getSessionDocumentAnalysis(sessionId);
      setDocState(data.activeDocumentAnalysis || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  const handleAction = async (actionFn) => {
    if (!sessionId) return;
    setActionLoading(true);
    setError(null);
    try {
      await actionFn();
      // On rafraîchit l'état après l'action
      await fetchState();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAnalyze = () => handleAction(() => runSessionDocumentAnalysis(sessionId));
  
  const handleImprove = () => handleAction(() => followupSessionDocumentAnalysis(sessionId, "propose des améliorations"));
  
  const handleReview = () => handleAction(() => followupSessionDocumentAnalysis(sessionId, "quels sont les problèmes ?"));

  if (!sessionId) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500 text-sm p-8">
        Session requise pour l'analyse documentaire.
      </div>
    );
  }

  return (
    <div className="h-full min-h-[560px] flex flex-col text-slate-200 bg-slate-900 rounded-2xl overflow-hidden border border-white/10">
      {/* Header */}
      <header className="shrink-0 px-6 py-4 border-b border-white/10 flex items-center justify-between gap-4 bg-slate-800/50">
        <div className="flex items-center gap-3">
          <FileSearch className="text-blue-400" size={22} />
          <div>
            <h1 className="text-sm font-black uppercase tracking-widest text-white">
              Document Analysis
            </h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">
              Analyse de session courante
            </p>
          </div>
        </div>
        <button
          onClick={fetchState}
          disabled={loading || actionLoading}
          className="p-2 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          title="Rafraîchir"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-6 flex flex-col">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 space-y-4">
            <Loader2 className="animate-spin text-blue-500" size={32} />
            <p className="text-sm">Chargement de l'état du document actif...</p>
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl max-w-md text-center">
              <p className="text-red-400 font-medium mb-2">Erreur</p>
              <p className="text-red-300/80 text-sm">{error}</p>
              <button 
                onClick={fetchState}
                className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded-lg text-sm transition-colors"
              >
                Réessayer
              </button>
            </div>
          </div>
        ) : !docState ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-6">
              <FileSearch className="text-blue-400/50" size={32} />
            </div>
            <h2 className="text-lg font-medium text-white mb-2">Aucun document actif</h2>
            <p className="text-slate-400 text-sm max-w-sm">
              Aucun document n'est actif dans cette session. 
              Uploadez ou mentionnez un document dans le chat pour commencer l'analyse.
            </p>
          </div>
        ) : (
          <div className="max-w-3xl w-full mx-auto space-y-6">
            
            {/* Document Info Card */}
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 flex items-start gap-4">
              <div className="p-3 bg-blue-500/20 rounded-lg shrink-0">
                <FileText className="text-blue-400" size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-medium truncate" title={docState.fileName}>
                  {docState.fileName || "Document sans nom"}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-blue-500/20 text-blue-300">
                    Actif
                  </span>
                  <span className="text-xs text-slate-500">
                    Dernière analyse : {docState.analyzedAt ? new Date(docState.analyzedAt).toLocaleString('fr-FR') : "Jamais"}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={handleAnalyze}
                disabled={actionLoading}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors"
              >
                {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                Analyser
              </button>
              
              <button
                onClick={handleImprove}
                disabled={actionLoading}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-700/50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors"
              >
                {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Wrench size={16} />}
                Proposer améliorations
              </button>
              
              <button
                onClick={handleReview}
                disabled={actionLoading}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-700/50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors"
              >
                {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <FileSearch size={16} />}
                Quels sont les problèmes ?
              </button>
            </div>

            {/* Summary */}
            {docState.lastAnalysisExcerpt && (
              <div className="mt-8">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Résumé de la dernière analyse
                </h4>
                <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-5">
                  <p className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">
                    {docState.lastAnalysisExcerpt}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
