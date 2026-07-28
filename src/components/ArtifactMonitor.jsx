import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import MermaidDiagram from './MermaidDiagram';
import { 
  Folder, 
  FileText, 
  ChevronRight, 
  ChevronDown, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Search,
  Box,
  Layout,
  Clock,
  HardDrive,
  Eye,
  FileCode,
  ArrowLeft
} from 'lucide-react';

const ArtifactMonitor = ({ sessionId }) => {
  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const [data, setData] = useState({ tree: [], qa: null, workspace: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  
  // États pour la lecture de fichier
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [contentLoading, setContentLoading] = useState(false);

  const fetchArtifacts = async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/api/sessions/${sessionId}/forge/artifacts`, {
        credentials: 'include'
      });
      if (!resp.ok) throw new Error('Erreur de chargement des artefacts');
      let json = await resp.json();
      
      // Fallback global si vide (Forge Stérile)
      if (!json.tree || json.tree.length === 0) {
        const globalResp = await fetch(`${API_BASE}/api/forge/global/artifacts`, {
          credentials: 'include'
        });
        if (globalResp.ok) {
          json = await globalResp.json();
        }
      }

      setData(json);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchFileContent = async (item) => {
    if (item.type !== 'file') return;
    
    setSelectedFile(item);
    setContentLoading(true);
    setFileContent('');
    
    try {
      const endpoint = data.workspace === 'Global Root' 
        ? `${API_BASE}/api/forge/global/artifacts/content`
        : `${API_BASE}/api/sessions/${sessionId}/forge/artifacts/content`;
        
      const resp = await fetch(`${endpoint}?path=${encodeURIComponent(item.path || item.name)}`, {
        credentials: 'include'
      });
      if (!resp.ok) throw new Error('Impossible de lire le fichier');
      const json = await resp.json();
      setFileContent(json.content);
    } catch (err) {
      setFileContent(`⚠️ Erreur : ${err.message}`);
    } finally {
      setContentLoading(false);
    }
  };

  useEffect(() => {
    if (sessionId) fetchArtifacts();
  }, [sessionId]);

  const getFileQAStatus = (fileName) => {
    if (!data.qa || !data.qa.checks) return null;
    const check = data.qa.checks.find(c => c.name.includes(fileName));
    return check ? check.status : null;
  };

  const renderTree = (items, depth = 0) => {
    return items
      .filter(item => item.name.toLowerCase().includes(search.toLowerCase()))
      .map((item, i) => {
        const itemKey = item.path || item.name;
        const isSelected = selectedFile?.path === item.path || selectedFile?.name === item.name;
        
        return (
          <div key={`${depth}-${itemKey}`} className="select-none">
            <div 
              onClick={() => fetchFileContent(item)}
              className={`flex items-center gap-2 py-1.5 px-3 rounded-lg transition-all cursor-pointer group ${
                isSelected ? 'bg-blue-500/20 border border-blue-500/30' : 'hover:bg-white/5 border border-transparent'
              }`}
              style={{ paddingLeft: `${depth * 1.5 + 0.75}rem` }}
            >
              {item.type === 'directory' ? (
                <Folder size={16} className="text-blue-400/80" />
              ) : (
                <FileText size={16} className={`${isSelected ? 'text-blue-400' : 'text-slate-400'} group-hover:text-blue-300 transition-colors`} />
              )}
              
              <span className={`text-[11px] font-medium truncate flex-1 ${isSelected ? 'text-white font-bold' : 'text-slate-300'}`}>
                {item.name}
              </span>
              
              {item.type === 'file' && (
                <div className="flex items-center gap-2 text-slate-600">
                  {getFileQAStatus(item.name) === 'PASS' && <CheckCircle2 size={12} className="text-emerald-500" />}
                  {getFileQAStatus(item.name) === 'FAIL' && <XCircle size={12} className="text-red-500" />}
                  {isSelected && <Eye size={10} className="text-blue-400 animate-pulse" />}
                </div>
              )}
            </div>
            {item.children && renderTree(item.children, depth + 1)}
          </div>
        );
      });
  };

  // Composant personnalisé pour le rendu Markdown (Mermaid)
  const MarkdownComponents = {
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      const lang = match ? match[1] : '';
      
      if (!inline && lang === 'mermaid') {
        return <MermaidDiagram chart={String(children).replace(/\n$/, '')} />;
      }
      
      return (
        <code className={`${className} bg-slate-900 px-1 py-0.5 rounded text-blue-300`} {...props}>
          {children}
        </code>
      );
    },
    // Stylisation Nexxus pour les titres
    h1: ({node, ...props}) => <h1 className="text-lg font-black text-white mt-6 mb-4 border-b border-white/10 pb-2 uppercase tracking-tight" {...props} />,
    h2: ({node, ...props}) => <h2 className="text-sm font-bold text-blue-400 mt-6 mb-3 uppercase tracking-widest" {...props} />,
    h3: ({node, ...props}) => <h3 className="text-xs font-bold text-slate-300 mt-4 mb-2 uppercase" {...props} />,
    p: ({node, ...props}) => <p className="text-[11px] text-slate-400 leading-relaxed mb-4" {...props} />,
    li: ({node, ...props}) => <li className="text-[11px] text-slate-400 mb-1" {...props} />,
    ul: ({node, ...props}) => <ul className="list-disc ml-4 mb-4" {...props} />,
  };

  return (
    <div className="flex flex-col h-full bg-slate-950/40 border-l border-white/5 animate-in slide-in-from-right duration-300">
      
      {/* Header Panel */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
        <div className="flex items-center gap-3">
          {selectedFile ? (
            <button 
              onClick={() => setSelectedFile(null)}
              className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 transition-colors"
            >
              <ArrowLeft size={16} />
            </button>
          ) : (
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400 border border-blue-500/20">
              <Layout size={18} />
            </div>
          )}
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-white leading-none">
              {selectedFile ? "Visionneuse" : "Explorateur Forge"}
            </h3>
            <p className="text-[9px] font-mono text-slate-500 uppercase tracking-tighter mt-1.5">
              {selectedFile ? selectedFile.name : `Workspace: ${data.workspace || '---'}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
           {selectedFile && (
             <span className="text-[9px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded font-mono border border-blue-500/20">
               {selectedFile.mtime ? new Date(selectedFile.mtime).toLocaleTimeString() : 'LIVE'}
             </span>
           )}
           <button 
             onClick={fetchArtifacts}
             className="p-2 hover:bg-white/10 rounded-lg transition-all text-slate-400 hover:text-white"
           >
             <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
           </button>
        </div>
      </div>

      {/* Content Area */}
      {selectedFile ? (
        <div className="flex-1 overflow-y-auto p-6 bg-slate-950/60 custom-scrollbar">
          {contentLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-600">
               <div className="w-8 h-1 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 animate-loading-bar" />
               </div>
               <p className="text-[9px] uppercase tracking-widest animate-pulse font-bold">Lecture des données...</p>
            </div>
          ) : (
            <div className="custom-markdown max-w-2xl mx-auto">
               {selectedFile.name.endsWith('.md') || selectedFile.name.endsWith('.json') ? (
                 <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
                    {selectedFile.name.endsWith('.json') ? `\`\`\`json\n${fileContent}\n\`\`\`` : fileContent}
                 </ReactMarkdown>
               ) : (
                 <pre className="text-[10px] font-mono text-slate-400 bg-black/40 p-4 rounded-xl border border-white/5 overflow-x-auto">
                    {fileContent}
                 </pre>
               )}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Search Bar */}
          <div className="p-3 border-b border-white/5">
            <div className="relative">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input 
                type="text" 
                placeholder="Filtrer les fichiers..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-black/40 border border-white/5 rounded-md pl-8 pr-3 py-1.5 text-[10px] text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 transition-all font-mono"
              />
            </div>
          </div>

          {/* Main Explorer Area */}
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {loading && !data.tree.length ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-600">
                 <div className="w-8 h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 animate-loading-bar" />
                 </div>
                 <p className="text-[10px] uppercase tracking-widest animate-pulse font-bold">Scanning project...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-3">
                 <XCircle size={32} className="text-red-500/50" />
                 <p className="text-xs text-slate-400 leading-relaxed font-medium">{error}</p>
                 <button onClick={fetchArtifacts} className="mt-2 text-[10px] text-blue-400 uppercase font-black tracking-widest hover:text-blue-300 transition-all">Réessayer</button>
              </div>
            ) : data.tree.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-4 text-slate-600">
                 <Box size={40} className="opacity-20 translate-y-2" />
                 <div className="space-y-1">
                   <p className="text-[10px] uppercase tracking-widest font-black text-slate-500">Forge Stérile</p>
                   <p className="text-[9px] text-slate-600 italic leading-relaxed">Aucun artefact physique n'a été produit sur le disque pour le moment.</p>
                 </div>
              </div>
            ) : (
              <div className="space-y-1">
                {renderTree(data.tree)}
              </div>
            )}
          </div>
        </>
      )}

      {/* Stats Footer */}
      <div className="p-3 border-t border-white/5 bg-black/40 flex items-center justify-between">
        <div className="flex items-center gap-3">
           <div className="flex items-center gap-1.5 text-emerald-400 font-mono text-[9px] font-black">
              <CheckCircle2 size={10} /> 
              {data.qa?.status || 'NOT_AUDITED'}
           </div>
           {!selectedFile && (
             <div className="flex items-center gap-1.5 text-slate-600 font-mono text-[9px]">
                <HardDrive size={10} />
                DISC.IO
             </div>
           )}
        </div>
        <div className="text-[9px] text-slate-700 font-mono uppercase tracking-tighter">
           Nexxus Forge V0.5
        </div>
      </div>

    </div>
  );
};

export default ArtifactMonitor;
