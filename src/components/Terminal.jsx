/* src/components/Terminal.jsx */
import React, { useEffect, useRef } from 'react';
import { Terminal as TerminalIcon, Cpu, SignpostBig, Settings, CheckCircle2, AlertTriangle, User, Search, ShieldCheck } from 'lucide-react';

const iconMap = {
  system: Cpu,
  routing: SignpostBig,
  action: Settings,
  success: CheckCircle2,
  error: AlertTriangle,
  thinking: User,
  phase: TerminalIcon,
  search: Search,
  audit: ShieldCheck
};

const LogEntry = ({ log }) => {
  const { message, type = 'system', timestamp } = log;
  const Icon = iconMap[type] || Cpu;
  const timeStr = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className={`flex items-start gap-3 mb-1.5 font-mono text-[11px] fadeIn`}>
      <span className="text-slate-500 whitespace-nowrap opacity-70">{timeStr}</span>
      <span className={`flex-shrink-0 mt-0.5 ${type === 'error' ? 'text-red-400' : (type === 'success' ? 'text-emerald-400' : (type === 'search' ? 'text-sky-400' : (type === 'audit' ? 'text-indigo-400' : 'text-blue-400')))}`}>
        <Icon size={12} />
      </span>
      <span className={`leading-snug ${type === 'phase' ? 'text-blue-400 font-bold text-glow' : (type === 'thinking' ? 'text-slate-400 italic' : (type === 'search' ? 'text-sky-300' : (type === 'audit' ? 'text-indigo-300 italic' : '')))}`}>
        {message}
      </span>
    </div>
  );
};

const Terminal = ({ logs = [], hideHeader = false }) => {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className={`glass-panel flex flex-col h-full relative overflow-hidden bg-black/40 border-white/5 group ${hideHeader ? 'border-none bg-transparent' : ''}`}>
      {/* Cinematic Scanlines */}
      <div className="absolute top-0 left-0 w-full h-[2px] bg-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.6)] animate-[scanning_3s_linear_infinite] z-20 pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.02),rgba(0,255,0,0.01),rgba(0,0,255,0.02))] bg-[length:100%_2px,3px_100%] z-10 pointer-events-none" />
      
      {!hideHeader && (
        <div className="flex items-center justify-between p-3 border-b border-white/5 bg-white/5 relative z-30">
          <div className="flex items-center gap-2">
            <TerminalIcon size={14} className="text-blue-400 animate-pulse" />
            <span className="text-[10px] font-bold tracking-widest uppercase text-slate-400 animate-flicker">Console d'Orchestration</span>
          </div>
          <div className="flex gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500/40" />
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500/40" />
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/40" />
          </div>
        </div>
      )}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 scrollbar-thin relative z-30 bg-blue-900/5"
      >
        {logs.length === 0 && (
          <div className="text-slate-600 italic text-sm">La Citadelle opérationnelle. En attente de directive...</div>
        )}
        {logs.map((log, index) => (
          <LogEntry key={index} log={log} />
        ))}
      </div>
    </div>
  );
};

export default Terminal;
