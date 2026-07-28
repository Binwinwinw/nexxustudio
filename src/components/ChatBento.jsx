/* src/components/ChatBento.jsx */
import React, { useState, useRef, useEffect } from "react";
import { Send, User, Bot, Sparkles, Paperclip, Loader2, FolderSearch, FileCode, MessageSquare, Terminal as TerminalIcon, StopCircle, X, RefreshCw, AlertTriangle, Globe, Plus } from "lucide-react";
import GlassCard from "./GlassCard";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import PedagogicalMarkdownMessage, {
  isPedagogicalTableMessage,
} from "./PedagogicalMarkdownMessage.jsx";
import {
  validateDoubleExtension,
} from "../../shared/uploadGuards.js";

/** Table GFM — ne pas forcer le rendu <pre> (sinon pipes bruts). */
function hasMarkdownTable(text = "") {
  const t = String(text || "");
  return /^\|.+\|\s*$/m.test(t) && /^\|\s*:?-{3,}/m.test(t);
}

/** Panel numéroté (open_exploration) — afficher tel quel, pas via <ol> Markdown. */
function isStructuredNumberedReply(text = "") {
  const t = String(text || "");
  if (hasMarkdownTable(t)) return false;
  return (
    /\n\s*\d+[.)]\s+\S/.test(t) &&
    (/\bChoisis un num[eé]ro\b/i.test(t) ||
      /\bdiscussion libre\b/i.test(t) ||
      /\btu as le choix\b/i.test(t))
  );
}

const ChatBento = ({
  messages,
  onSendMessage,
  onStop,
  isTyping,
  validation = { metrics: { score: 0 }, current_phase: "DISCOVERY" },
  onFeedback,
  sessionId,
  progress,
  onNewSession,
}) => {
  const [input, setInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState(null);
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  const lastAssistantMessage = [...messages]
    .reverse()
    .find((m) => m.role === "assistant");

  useEffect(() => {
    setFeedbackStatus(null);
  }, [lastAssistantMessage?.content]);

  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadAlert, setUploadAlert] = useState(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping, isUploading]);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const doubleExt = validateDoubleExtension(file.name);
    if (doubleExt.rejected) {
      setUploadAlert(doubleExt.message);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploadAlert(null);
    setSelectedFile(file);
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    setUploadAlert(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if ((!input.trim() && !selectedFile) || isTyping || isUploading) return;

    const outgoing = input.trim();

    onSendMessage(outgoing, selectedFile);
    setInput("");
    removeSelectedFile();
    if (textareaRef.current) textareaRef.current.style.height = '44px';
  };

  return (
    <GlassCard className="h-full flex flex-col border-white/5 bg-slate-950/40 backdrop-blur-2xl shadow-2xl overflow-hidden p-0!">
      {/* 1. HEADER BENTO (COMPACT & OPERATIONAL) */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center border border-blue-500/30">
            <Bot className="text-blue-400" size={16} />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h3 className="text-[10px] font-black tracking-widest uppercase text-white">Nexxus-Core</h3>
              <span className="text-[8px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-mono uppercase">Live</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[8px] text-slate-500 font-bold uppercase tracking-tighter">Managed Runtime v3.1</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[7px] text-slate-500 font-mono uppercase animate-pulse hidden sm:inline">Session Active</span>
          {onNewSession && (
            <button
              type="button"
              onClick={onNewSession}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold uppercase"
              title="Nouvelle conversation"
            >
              <Plus size={14} />
              Nouveau
            </button>
          )}
        </div>
      </div>

      {/* 2. CONVERSATION FLOW */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-6 py-6 space-y-8 nexxus-scroll relative"
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-6 py-10 animate-fade-in">
            <div className="p-5 bg-blue-500/10 rounded-2xl border border-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.1)]">
              <Sparkles className="text-blue-400" size={32} />
            </div>
            <div className="max-w-xs space-y-2">
              <h4 className="text-xs font-black text-white uppercase tracking-[0.3em]">Station de Conception</h4>
              <p className="text-[10px] text-slate-400 leading-relaxed font-bold uppercase opacity-80">
                Initialisation du flux créatif. En attente de directive stratégique.
              </p>
            </div>
          </div>
        )}

        {progress && (
          <div className="mb-4 flex gap-3 rounded-xl border border-blue-500/20 bg-slate-900/60 p-4 backdrop-blur-md shadow-[0_0_20px_rgba(59,130,246,0.08)] animate-fade-in">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-500/30 bg-blue-600/20">
              <Loader2 size={16} className="animate-spin text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-blue-300 leading-relaxed">
                {progress.message}
              </p>
              <div className="mb-1.5 h-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-linear-to-r from-blue-600 to-cyan-400 transition-all duration-300"
                  style={{ width: `${(progress.step / progress.total) * 100}%` }}
                />
              </div>
              <p className="text-[8px] font-mono uppercase tracking-tighter text-slate-500">
                Étape {progress.step} sur {progress.total}
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, idx) => {
          const isAssistant = msg.role === "assistant";
          const isLast = idx === messages.length - 1;
          
          // 1. Nettoyage des métadonnées de protocole (Sécurisé contre les valeurs nulles)
          const rawContent = String(msg.content || "");
          let displayContent = rawContent.replace(/\[\[READY: ([\s\S]*?)\]\]/, "");
          const hasPause = displayContent.includes("[PAUSE_STATE]");
          displayContent = displayContent.replace("[PAUSE_STATE]", "");

          if (isAssistant) {
            // 2. Suppression RADICALE des balises de réflexion (Protocole Souverain)
            // Gère les balises fermées ET les balises ouvertes en cours de flux
            displayContent = displayContent.replace(/<(think|thought)>[\s\S]*?(?:<\/\1>|$)/gi, "");
            
            // 3. Échappement des autres balises XML non autorisées pour éviter les fuites UI
            displayContent = displayContent.replace(
              /<(?!\/?(action|detail|summary|br|p|b|i|em|strong|code|pre))[^>]*>/gi,
              (m) => `\\${m}`
            );
          }

          if (!displayContent.trim() && isAssistant && !hasPause) return null;

          return (
            <div key={idx} className={`flex flex-col ${isAssistant ? "items-start" : "items-end"} gap-2 animate-fade-in`}>
              <div className={`flex items-center gap-2 mb-1`}>
                {isAssistant ? <Bot size={12} className="text-blue-400" /> : <User size={12} className="text-slate-500" />}
                <span className={`text-[9px] font-black uppercase tracking-widest ${isAssistant ? "text-blue-400" : "text-slate-500"}`}>{isAssistant ? "Assistant Nexxus" : "Moi"}</span>
              </div>
              
              <div className={`max-w-[95%] w-full sm:w-[min(100%,42rem)] p-4 rounded-2xl shadow-xl text-sm leading-relaxed ${
                isAssistant 
                  ? "bg-slate-900/80 text-slate-200 rounded-tl-none border border-white/10 backdrop-blur-md min-h-[5rem]" 
                  : "bg-blue-600/30 text-blue-50 border border-blue-500/40 rounded-tr-none shadow-[0_0_20px_rgba(37,99,235,0.1)]"
              }`}>
                <div className={`prose prose-invert prose-sm max-w-none custom-markdown ${
                  isAssistant && isPedagogicalTableMessage(displayContent)
                    ? "custom-markdown--pedagogical max-h-[min(560px,60vh)] overflow-y-auto nexxus-scroll pr-1"
                    : isAssistant
                      ? "max-h-[min(420px,50vh)] overflow-y-auto nexxus-scroll pr-1"
                      : ""
                }`}>
                  {isAssistant && isStructuredNumberedReply(displayContent) ? (
                    <pre className="m-0 whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-slate-200 bg-transparent border-0 p-0">
                      {displayContent}
                    </pre>
                  ) : isAssistant && isPedagogicalTableMessage(displayContent) ? (
                    <PedagogicalMarkdownMessage content={displayContent} />
                  ) : (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {displayContent}
                    </ReactMarkdown>
                  )}
                </div>

                {/* Affichage des pièces jointes dans la bulle */}
                {msg.attachment && (
                  <div className="mt-3 p-2 bg-black/20 rounded-xl border border-white/5 flex items-center gap-3">
                    {msg.attachment.type?.startsWith('image/') ? (
                      <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/10">
                        <img src={msg.attachment.url || "#"} alt="Attach" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-400">
                        <FileCode size={20} />
                      </div>
                    )}
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] font-bold text-white truncate max-w-[150px]">{msg.attachment.name}</span>
                      <span className="text-[8px] text-slate-500 uppercase font-black tracking-widest">
                        {msg.attachment.type?.startsWith('image/') ? "Image Vision" : "Document Contexte"}
                      </span>
                    </div>
                  </div>
                )}

                {isAssistant && hasPause && isLast && (
                  <div className="mt-4 pt-4 border-t border-white/5">
                    <button
                      onClick={() => onSendMessage("Oui")}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all shadow-lg shadow-blue-500/20"
                    >
                      <RefreshCw size={14} className="animate-spin-slow" />
                      Continuer la génération
                    </button>
                  </div>
                )}

                {isAssistant && isLast && displayContent.includes("voulez-vous que je l’extraie ?") && (
                  <div className="mt-4 pt-4 border-t border-white/5 flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-amber-400">
                      <AlertTriangle size={14} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Action Épistémique Requise</span>
                    </div>
                    <button
                      onClick={() => {
                        const urlMatch = displayContent.match(/https?:\/\/[^\s/$.?#].[^\s]*/gi) || rawContent.match(/https?:\/\/[^\s/$.?#].[^\s]*/gi);
                        const url = urlMatch ? urlMatch[0] : "";
                        onSendMessage(`Oui, extrais et analyse l'URL : ${url}`);
                      }}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-amber-500/20 group"
                    >
                      <Globe size={16} className="group-hover:rotate-12 transition-transform" />
                      Extraire et Analyser le dépôt
                    </button>
                    <p className="text-[9px] text-slate-500 italic">
                      L'agent Nexxus ne peut pas garantir la validité technique sans cette extraction.
                    </p>
                  </div>
                )}

                {isAssistant && isLast && displayContent.includes("[PLAN_PENDING_APPROVAL]") && (
                  <div className="mt-4 pt-4 border-t border-white/5 flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-blue-400">
                      <RefreshCw size={14} className="animate-spin-slow" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Plan en attente d'approbation</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => onSendMessage("PLAN_APPROVED")}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-blue-500/20"
                      >
                        Approuver et Exécuter
                      </button>
                      <button
                        onClick={() => onSendMessage("Modifier le plan : ")}
                        className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                      >
                        Réviser
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {(isTyping || isUploading) && (
          <div className="flex flex-col items-start gap-2">
            <div className="flex items-center gap-2 mb-1">
              <Bot size={12} className="text-blue-400" />
              <span className="text-[9px] font-black uppercase tracking-widest text-blue-400">Nexxus-Core</span>
            </div>
            <div className="bg-slate-900/80 p-4 rounded-2xl rounded-tl-none border border-white/10 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0s" }}></div>
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
                </div>
                {isUploading && (
                  <span className="text-[10px] text-blue-400 font-black uppercase tracking-widest animate-pulse">Analyse Vision...</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. COMPOSER BENTO (OPERATIONAL UNITY) */}
      <div className="p-4 bg-black/60 border-t border-white/10 backdrop-blur-2xl">
        {uploadAlert && (
          <div className="mb-3 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-950/40 px-3 py-2 text-[11px] text-red-200">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-400" />
            <div className="min-w-0 flex-1 whitespace-pre-wrap">{uploadAlert.replace(/\*\*/g, "")}</div>
            <button
              type="button"
              onClick={() => setUploadAlert(null)}
              className="shrink-0 text-red-400 hover:text-red-200"
              aria-label="Fermer l'alerte"
            >
              <X size={14} />
            </button>
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            style={{ display: 'none' }}
            accept="image/*,.txt,.md,.js,.json,.pdf,.py,.html,.css,.sql"
          />
          {selectedFile && (
            <div className="mb-3 px-1">
              <span className="block text-[10px] font-black uppercase tracking-widest text-emerald-400">
                Pièce jointe active
              </span>
              <span className="block text-[11px] text-white truncate">{selectedFile.name}</span>
            </div>
          )}
          <div className="relative flex items-end gap-0 bg-white/5 border border-white/10 rounded-2xl overflow-hidden focus-within:border-blue-500/50 transition-all">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isTyping || isUploading}
              className="p-4 text-slate-500 hover:text-blue-400 hover:bg-white/5 transition-all disabled:opacity-30 border-r border-white/5"
              title="Attacher un fichier (Image ou Document)"
            >
              <Paperclip size={18} />
            </button>
            
            <textarea
              ref={textareaRef}
              rows="1"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = e.target.scrollHeight + 'px';
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              maxLength={32768}
              placeholder="Entrer une directive…"
              className="flex-1 bg-transparent border-none py-4 px-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-0 resize-none max-h-40 overflow-y-auto nexxus-scroll"
              style={{ height: '52px' }}
            />
            
            {isTyping ? (
              <button
                type="button"
                onClick={onStop}
                className="p-4 bg-red-600 hover:bg-red-500 text-white transition-all border-l border-red-400/20 animate-pulse"
                title="Arrêt d'urgence"
              >
                <StopCircle size={18} />
              </button>
            ) : (
              <button
                type="submit"
                disabled={(!input.trim() && !selectedFile) || isUploading}
                className="p-4 bg-blue-600 hover:bg-blue-500 text-white transition-all disabled:opacity-20 disabled:grayscale border-l border-blue-400/20"
              >
                <Send size={18} />
              </button>
            )}
          </div>
          <div className="flex justify-between items-center mt-2 px-1">
             <span className="text-[7px] text-slate-600 font-mono uppercase tracking-tighter">Secure Signal: AES-256 Enabled</span>
             <span className="text-[7px] text-slate-600 font-mono uppercase tracking-tighter">Buffer: {input.length}/32768</span>
          </div>
        </form>
      </div>
    </GlassCard>
  );
};

export default ChatBento;
