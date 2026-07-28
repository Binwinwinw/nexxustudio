/* src/components/ErrorBoundary.jsx */
import React from 'react';
import { ShieldAlert, RefreshCw, Terminal } from 'lucide-react';
import GlassCard from './GlassCard';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("🚨 CITADEL CRITICAL FAILURE:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    // Purge locale et rechargement
    localStorage.clear();
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-sans selection:bg-red-500/30">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(220,38,38,0.05)_0%,transparent_70%)] pointer-events-none" />
          
          <GlassCard className="max-w-2xl w-full border-red-500/20 bg-black/40 backdrop-blur-3xl shadow-[0_0_50px_rgba(220,38,38,0.1)] p-8">
            <div className="flex flex-col items-center text-center gap-6">
              <div className="w-20 h-20 bg-red-600/20 rounded-3xl flex items-center justify-center border border-red-500/30 animate-pulse shadow-[0_0_20px_rgba(220,38,38,0.2)]">
                <ShieldAlert className="text-red-500" size={40} />
              </div>
              
              <div className="space-y-2">
                <h1 className="text-3xl font-black tracking-tighter text-white uppercase italic">
                  Système en État de Choc
                </h1>
                <p className="text-xs text-red-400 font-mono uppercase tracking-[0.3em]">
                  Défaut de Rendu Critique Détecté
                </p>
              </div>

              <div className="w-full bg-black/60 rounded-xl border border-white/5 p-4 text-left font-mono">
                <div className="flex items-center gap-2 mb-2 text-slate-500 text-[10px] uppercase font-bold tracking-widest">
                  <Terminal size={12} />
                  <span>Détails du Signal</span>
                </div>
                <div className="text-[11px] text-red-300/80 leading-relaxed overflow-x-auto nexxus-scroll max-h-32">
                  {this.state.error && this.state.error.toString()}
                </div>
              </div>

              <div className="flex flex-col gap-4 w-full">
                <button
                  onClick={this.handleReset}
                  className="w-full flex items-center justify-center gap-3 py-4 bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest text-xs rounded-xl transition-all shadow-lg shadow-red-900/20 group"
                >
                  <RefreshCw size={18} className="group-hover:rotate-180 transition-transform duration-500" />
                  Réinitialiser la Conscience
                </button>
                <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold opacity-60">
                  Note : La réinitialisation purge le cache local pour restaurer la stabilité.
                </p>
              </div>
            </div>
          </GlassCard>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
