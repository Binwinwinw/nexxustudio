/* src/components/AsyncForgePanel.jsx */
import React, { useState, useEffect, useRef } from 'react';
import { Terminal as TerminalIcon, Play, XCircle, AlertCircle, FileText, CheckCircle, Code, Clock, HardDrive, Cpu, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import './Cockpit.css'; // réutilise les styles premium existants

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const AsyncForgePanel = ({ sessionId }) => {
  const [task, setTask] = useState('Validation automatisée du service Async Forge v0.2');
  const [repo, setRepo] = useState('./server');
  const [testCommand, setTestCommand] = useState('npm run test:completeness');
  const [model, setModel] = useState('ornith:9b');
  const [critiqueModel, setCritiqueModel] = useState('deepseek-r1:8b');
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeJobId, setActiveJobId] = useState(null);
  const [expandedJobId, setExpandedJobId] = useState(null);
  const terminalEndRef = useRef(null);

  const activeJob = jobs.find(j => j.id === activeJobId);

  // Charger la liste des jobs
  const fetchJobs = async () => {
    if (!sessionId) return;
    try {
      const jobsUrl = new URL(`${API_BASE}/api/forge/jobs`);
      jobsUrl.searchParams.set('sessionId', sessionId);
      const response = await fetch(jobsUrl.toString(), {
        credentials: 'include',
      });
      const data = await response.ok ? await response.json() : [];
      setJobs(data);
      
      // Si un job actif est en cours, on continue le polling
      const active = data.find(j => j.status === 'RUNNING' || j.status === 'PENDING');
      if (active) {
        setActiveJobId(active.id);
        setLoading(true);
      } else {
        setActiveJobId(null);
        setLoading(false);
      }
    } catch (err) {
      console.error('❌ Erreur de chargement des jobs:', err);
    }
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 2000);
    return () => clearInterval(interval);
  }, [sessionId]);

  // Défilement automatique du terminal
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeJob?.stdout]);

  // Lancer un nouveau job
  const handleRun = async (e) => {
    e.preventDefault();
    if (!task || !repo || !testCommand) return alert('Tous les champs sont requis.');
    if (!sessionId) return alert('Session active requise.');

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/forge/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ task, repo, testCommand, model, critiqueModel, sessionId })
      });
      const result = await response.json();
      if (result.success) {
        setActiveJobId(result.jobId);
        fetchJobs();
      } else {
        alert(`Échec : ${result.error}`);
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      alert('Erreur réseau lors du lancement.');
      setLoading(false);
    }
  };

  // Annuler le job en cours
  const handleCancel = async (jobId) => {
    if (!window.confirm('Voulez-vous vraiment tuer de force cette sandbox éphémère ?')) return;

    try {
      const response = await fetch(`${API_BASE}/api/forge/jobs/${jobId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sessionId }),
      });
      const result = await response.json();
      if (result.success) {
        setActiveJobId(null);
        setLoading(false);
        fetchJobs();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleExpand = (jobId) => {
    setExpandedJobId(expandedJobId === jobId ? null : jobId);
  };

  return (
    <div className="space-y-6">
      {/* SECTION SUPÉRIEURE : CONTROLLER */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* FORMULAIRE DE CONTRÔLE */}
        <div className="cockpit-card lg:col-span-1 flex flex-col justify-between">
          <div>
            <div className="card-header">
              <Play size={14} className="text-cyan-400" />
              <span>PILOTAGE DE SANDBOX ÉPHÉMÈRE</span>
            </div>
            
            <form onSubmit={handleRun} className="space-y-4 mt-2">
              <div>
                <label className="text-[10px] uppercase font-black opacity-50 tracking-wider">Tâche d'évaluation / Mutation</label>
                <textarea
                  value={task}
                  onChange={(e) => setTask(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 mt-1 h-20 resize-none font-sans"
                  placeholder="Ex: Refactoring du module de routage sémantique..."
                  disabled={loading}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-black opacity-50 tracking-wider">Modèle de Mutation</label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full bg-black/45 border border-white/10 rounded-lg p-2 text-xs text-white mt-1 focus:outline-none focus:border-cyan-500/50 font-sans"
                    disabled={loading}
                  >
                    <option value="ornith:9b">ornith:9b</option>
                    <option value="qwen3.5:9b">qwen3.5:9b</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-black opacity-50 tracking-wider">Modèle de Critique</label>
                  <select
                    value={critiqueModel}
                    onChange={(e) => setCritiqueModel(e.target.value)}
                    className="w-full bg-black/45 border border-white/10 rounded-lg p-2 text-xs text-white mt-1 focus:outline-none focus:border-cyan-500/50 font-sans"
                    disabled={loading}
                  >
                    <option value="deepseek-r1:8b">deepseek-r1:8b</option>
                    <option value="deepseek-r1:14b">deepseek-r1:14b</option>
                    <option value="qwen3.5:27b">qwen3.5:27b</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-black opacity-50 tracking-wider">Sous-Dépôt Cible</label>
                  <input
                    type="text"
                    value={repo}
                    onChange={(e) => setRepo(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-xs text-white mt-1 focus:outline-none focus:border-cyan-500/50 font-mono"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-black opacity-50 tracking-wider">Commande de Validation</label>
                  <input
                    type="text"
                    value={testCommand}
                    onChange={(e) => setTestCommand(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-xs text-white mt-1 focus:outline-none focus:border-cyan-500/50 font-mono"
                    disabled={loading}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all duration-300 ${
                  loading
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 animate-pulse'
                    : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-950/20 active:scale-[0.98]'
                }`}
              >
                {loading ? 'Sandbox active...' : 'Déployer Sandbox Éphémère'}
              </button>
            </form>
          </div>
        </div>

        {/* TERMINAL EN DIRECT */}
        <div className="cockpit-card lg:col-span-2 flex flex-col min-h-[300px]">
          <div className="card-header flex justify-between items-center">
            <div className="flex items-center gap-2">
              <TerminalIcon size={14} className="text-emerald-400" />
              <span>TERMINAL DE SANDBOX (SORTIE DUMP)</span>
            </div>
            {activeJob && (
              <div className="flex items-center gap-3">
                <span className="text-[9px] uppercase font-black px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 animate-pulse">
                  {activeJob.status} ({activeJob.progress}%)
                </span>
                <button
                  onClick={() => handleCancel(activeJob.id)}
                  className="p-1 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded-lg transition-all"
                  title="Avorter le job"
                >
                  <XCircle size={14} />
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 bg-black/60 rounded-xl border border-white/5 p-4 font-mono text-[11px] text-emerald-400/90 overflow-y-auto max-h-[250px] space-y-1 mt-2 scrollbar-thin">
            {activeJob ? (
              <>
                <div className="text-slate-500 italic mb-2">[Job {activeJob.id} initialisé en mode isolé network:none]</div>
                {activeJob.stdout.split('\n').map((line, idx) => (
                  <div key={idx} className="leading-relaxed whitespace-pre-wrap">{line}</div>
                ))}
                {activeJob.stderr && (
                  <div className="text-red-400 whitespace-pre-wrap">{activeJob.stderr}</div>
                )}
                <div ref={terminalEndRef} />
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 italic py-10">
                <TerminalIcon size={28} className="opacity-20 mb-2" />
                <span>Aucune sandbox active. Lancez une tâche pour observer le live-stream.</span>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* HISTORIQUE ET AUDITS */}
      <div className="cockpit-card">
        <div className="card-header flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-purple-400" />
            <span>JOURNAL DES MUTATIONS & CERTIFICATIONS (v0.2)</span>
          </div>
          <button onClick={fetchJobs} className="p-1 hover:bg-white/5 rounded-lg text-slate-400 transition-all">
            <RefreshCw size={12} />
          </button>
        </div>

        <div className="overflow-x-auto mt-2 rounded-xl border border-white/5 bg-black/10">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-[10px] uppercase font-black tracking-wider opacity-60 bg-white/5">
                <th className="p-4">Identifiant / Job</th>
                <th className="p-4">Tâche évaluee</th>
                <th className="p-4">Docker Image</th>
                <th className="p-4">Statut</th>
                <th className="p-4">Durée</th>
                <th className="p-4">Mutations</th>
                <th className="p-4 text-center">Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-slate-600 italic">
                    Aucun historique de sandbox enregistré.
                  </td>
                </tr>
              ) : (
                jobs.map((job) => {
                  const isExpanded = expandedJobId === job.id;
                  return (
                    <React.Fragment key={job.id}>
                      <tr className="hover:bg-white/5 transition-colors font-medium">
                        <td className="p-4 font-mono text-[10px] opacity-75">{job.id}</td>
                        <td className="p-4 max-w-[200px] truncate" title={job.task}>{job.task}</td>
                        <td className="p-4 font-mono text-[10px] opacity-60">{job.image_name}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            job.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-400' :
                            job.status === 'FAILED' ? 'bg-red-500/10 text-red-400' :
                            job.status === 'TIMEOUT' ? 'bg-amber-500/10 text-amber-400' :
                            'bg-blue-500/10 text-blue-400 animate-pulse'
                          }`}>
                            {job.status}
                          </span>
                        </td>
                        <td className="p-4 font-mono">{(job.duration_ms / 1000).toFixed(2)}s</td>
                        <td className="p-4 font-mono text-cyan-400">{job.diff_stat || '0, 0'}</td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => toggleExpand(job.id)}
                            disabled={job.status === 'RUNNING' || job.status === 'PENDING'}
                            className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all active:scale-95 disabled:opacity-35"
                          >
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </td>
                      </tr>

                      {/* LIGNE EXTENSION DÉTAILS D'AUDIT */}
                      {isExpanded && (
                        <tr>
                          <td colSpan="7" className="bg-black/45 p-6 border-y border-white/5 space-y-6">
                            
                            {/* BLOCS DE MÉTA-DONNÉES EN BOÎTE */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div className="stat-box-mini">
                                <span className="label"><HardDrive size={10} className="inline mr-1" /> Stratégie Sandbox</span>
                                <span className="val text-white">{job.sandbox_strategy}</span>
                              </div>
                              <div className="stat-box-mini">
                                <span className="label"><Cpu size={10} className="inline mr-1" /> OS / Plateforme</span>
                                <span className="val text-slate-300">{job.host_fingerprint?.os || 'Windows'}</span>
                              </div>
                              <div className="stat-box-mini">
                                <span className="label"><TerminalIcon size={10} className="inline mr-1" /> Docker Moteur</span>
                                <span className="val text-slate-300 truncate" title={job.host_fingerprint?.docker_version}>
                                  {job.host_fingerprint?.docker_version?.split(',')[0] || 'Docker Engine'}
                                </span>
                              </div>
                              <div className="stat-box-mini">
                                <span className="label"><Clock size={10} className="inline mr-1" /> Horodatage UTC</span>
                                <span className="val text-slate-300">{new Date(job.start_time).toLocaleString()}</span>
                              </div>
                            </div>

                            {/* RAPPORT ET DIFF CÔTE À CÔTE */}
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                              
                              {/* AUDIT REPORT BOX */}
                              <div className="bg-black/30 border border-white/5 rounded-xl p-4 flex flex-col max-h-[350px]">
                                <div className="text-[10px] uppercase font-black opacity-40 mb-3 flex items-center gap-1.5">
                                  <FileText size={12} className="text-purple-400" />
                                  Rapport de Certification d'Audit
                                </div>
                                <div className="flex-1 overflow-y-auto text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-wrap pr-2 scrollbar-thin">
                                  {job.report || 'Aucun rapport généré pour ce job.'}
                                </div>
                              </div>

                              {/* GIT MUTATIONS DIFF BOX */}
                              <div className="bg-black/30 border border-white/5 rounded-xl p-4 flex flex-col max-h-[350px]">
                                <div className="text-[10px] uppercase font-black opacity-40 mb-3 flex items-center gap-1.5">
                                  <Code size={12} className="text-cyan-400" />
                                  Mutations de Code (Git Diff)
                                </div>
                                <div className="flex-1 overflow-y-auto font-mono text-[10px] leading-relaxed overflow-x-auto whitespace-pre pr-2 bg-black/40 rounded-lg p-3 border border-white/5 scrollbar-thin">
                                  {job.diff ? (
                                    job.diff.split('\n').map((line, idx) => {
                                      let colorClass = 'text-slate-400';
                                      if (line.startsWith('+') && !line.startsWith('+++')) colorClass = 'text-emerald-400 bg-emerald-950/20';
                                      else if (line.startsWith('-') && !line.startsWith('---')) colorClass = 'text-red-400 bg-red-950/20';
                                      else if (line.startsWith('@@') || line.startsWith('diff')) colorClass = 'text-cyan-500 font-bold';
                                      return (
                                        <div key={idx} className={`${colorClass} px-1 rounded-sm`}>{line}</div>
                                      );
                                    })
                                  ) : (
                                    <div className="text-slate-600 italic text-center py-10">Aucune mutation de code appliquée.</div>
                                  )}
                                </div>
                              </div>

                            </div>

                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AsyncForgePanel;
