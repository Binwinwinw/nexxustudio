/* src/App.jsx */
import React, { useState, useCallback, useRef } from "react";
import {
  Rocket,
  StopCircle,
  RefreshCw,
  Cpu,
  Clipboard,
  Lightbulb,
  AlertTriangle,
  Globe,
  Monitor,
  Trash2,
  FolderSearch,
  Terminal as TerminalIcon,
} from "lucide-react";
import GlassCard from "./components/GlassCard";
import Timeline from "./components/Timeline";
import Starfield from "./components/Starfield";
import ChatBento from "./components/ChatBento";
import { CITADELLE_VIEWS } from "./context/citadelleViews.js";
import { SidebarProvider, useSidebar } from "./context/SidebarContext";
import { OperatorTraceProvider, useOperatorTrace } from "./context/OperatorTraceContext";
import { isGeneratorFirstIntent } from "../shared/generatorFirstPolicy.js";
import CitadelleSidebar, {
  CitadelleMobileNav,
} from "./components/layout/CitadelleSidebar";
import MainViewRouter from "./components/layout/MainViewRouter";

const Terminal = React.lazy(() => import("./components/Terminal"));
const AuditReport = React.lazy(() => import("./components/AuditReport"));
import ProductionService from "./services/ProductionService";
import { getReadinessUi } from "./services/readinessUi";
import {
  extractResultContent,
  resolveStreamResult,
} from "./services/streamResultResolver";
import {
  shouldApplyShortReplyVisualPacing,
  shouldHoldShortReplyDuringStream,
  revealShortReplyWithPacing,
  SHORT_REPLY_VISUAL_PACING,
} from "./services/shortReplyVisualPacing.js";

// Générateur d'ID universel et robuste (ne dépend pas de l'objet crypto si indisponible)
const generateUUID = () => {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID)
      return crypto.randomUUID();
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
        (
          c ^
          (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
        ).toString(16),
      );
    }
  } catch {
    /* Fallback manuel */
  }
  return "sess-" + Math.random().toString(36).substr(2, 9) + "-" + Date.now();
};

const SESSION_STORAGE_KEY = "nexxus_current_session_id";
const STREAM_FLUSH_MS = 50;

function computeStreamChatViews(rawContent = "") {
  const raw = String(rawContent || "");
  let chatDisplay = raw
    .replace(/<think>[\s\S]*?(?:<\/redacted_thinking>|<\/think>|$)/gi, "")
    .trim();

  let thoughtDisplay = "";
  const thoughtMatches = raw.match(
    /<think>([\s\S]*?)(?:<\/redacted_thinking>|<\/think>|$)/gi,
  );
  if (thoughtMatches) {
    thoughtDisplay = thoughtMatches
      .map((m) => m.replace(/<\/?think>/gi, ""))
      .join("\n---\n");
  }

  if (!chatDisplay && raw.includes("<think>")) {
    chatDisplay = "● ● ● *Réflexion souveraine en cours...*";
  }

  return { chatDisplay, thoughtDisplay };
}

function AppShell() {
  const { activeView, navigate } = useSidebar();
  const { registerTrace, updateTrace } = useOperatorTrace();
  const isChatView = activeView === CITADELLE_VIEWS.CHAT;
  const isSessionsView = activeView === CITADELLE_VIEWS.SESSIONS;
  const normalizeChatText = useCallback((value = "") => {
    return String(value).replace(/\s+/g, " ").trim().toLowerCase();
  }, []);

  const sanitizeChatHistory = useCallback((messages = []) => {
    return messages
      .filter(
        (message) =>
          message &&
          typeof message.content === "string" &&
          typeof message.role === "string",
      )
      .map((message) => ({
        role: message.role,
        content: message.content.trim(),
        attachment: message.attachment || null, // On préserve l'attachement pour l'affichage
      }))
      .filter((message) => message.content.length > 0 || message.attachment);
  }, []);

  const [projectGoal, setProjectGoal] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const isRunningRef = useRef(false);
  const chatAbortControllerRef = useRef(null);
  const textareaRef = useRef(null);
  const hasDetectedReadyRef = useRef(false); // SÉCURITÉ : Empêche les logs en boucle
  const pendingForgeHandoffRef = useRef(null);
  const [currentPhase, setCurrentPhase] = useState(null);
  const [completedPhases, setCompletedPhases] = useState([]);
  const [logs, setLogs] = useState([]);
  const [output, setOutput] = useState("");
  const [history, setHistory] = useState([]);
  const [isReadyForProduction, setIsReadyForProduction] = useState(false);
  const [progress, setProgress] = useState(null);

  // États du Chat Mentor
  const [chatMessages, setChatMessages] = useState([]);
  const [isChatTyping, setIsChatTyping] = useState(false);
  const [isChatRunning, setIsChatRunning] = useState(false); // Séparé de isRunning (Forge)
  const [validation, setValidation] = useState({
    metrics: { score: 0, missing: [] },
    forge_ready: false,
  });
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [auditSession, setAuditSession] = useState(null);
  const [impactReport, setImpactReport] = useState(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditTarget, setAuditTarget] = useState("");
  const [auditMode, setAuditMode] = useState("file"); // file, module, change
  // États de Session & UI
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(() => generateUUID());
  const [stats, setStats] = useState({ vram: null, tps: 0 });
  const [health, setHealth] = useState({ status: "offline", warmup: {} });
  const [bootstrapPhase, setBootstrapPhase] = useState("connecting");
  const [bootstrapMeta, setBootstrapMeta] = useState({
    readyStatus: "starting",
    serverReadyAt: null,
    apiReadyAt: null,
    sessionsLoadedAt: null,
  });
  const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
  const readinessUi = getReadinessUi(bootstrapMeta.readyStatus);

  const fetchReadyState = React.useCallback(async () => {
    const readyResponse = await fetch(`${API_BASE}/api/ready`, {
      credentials: "include",
    });
    const readyData = await readyResponse.json();

    setBootstrapMeta((prev) => ({
      ...prev,
      readyStatus: readyData.status || "starting",
      serverReadyAt: readyData.timestamps?.server_ready_at || null,
      apiReadyAt: readyData.timestamps?.api_ready_at || null,
    }));

    return readyData;
  }, [API_BASE]);

  const fetchSessions = React.useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/sessions`, {
        credentials: "include",
      });
      if (!response.ok) {
        console.error("Failed to fetch sessions", response.status);
        setSessions([]);
        return [];
      }
      const data = await response.json();
      const list = Array.isArray(data) ? data : [];
      setSessions(list);
      return list;
    } catch (error) {
      console.error("Failed to fetch sessions", error);
      setSessions([]);
      return [];
    }
  }, [API_BASE]);

  const applySessionState = useCallback(
    (session) => {
      const forge = session?.forge || {};
      const mentor = session?.mentor || {};

      setCurrentSessionId(session.id);
      localStorage.setItem(SESSION_STORAGE_KEY, session.id);
      setLogs(Array.isArray(forge.logs) ? forge.logs : []);
      setOutput(typeof forge.output === "string" ? forge.output : "");
      setHistory(Array.isArray(forge.history) ? forge.history : []);
      setCompletedPhases(
        Array.isArray(forge.completedPhases) ? forge.completedPhases : [],
      );
      setIsReadyForProduction(
        Boolean(
          forge.isReadyForProduction || session.validation?.forge_ready,
        ),
      );
      setChatMessages(sanitizeChatHistory(mentor.messages || []));
      setProjectGoal(session.projectGoal || "");
      setValidation(
        session.validation || {
          metrics: { score: 0, missing: [] },
          forge_ready: false,
        },
      );
    },
    [sanitizeChatHistory],
  );

  const loadSessionById = useCallback(
    async (id) => {
      const response = await fetch(`${API_BASE}/api/sessions/${id}`, {
        credentials: "include",
      });
      const session = await response.json();

      if (!response.ok) {
        throw new Error(
          session?.error || `Chargement impossible (${response.status})`,
        );
      }
      if (!session?.id) {
        throw new Error("Réponse session invalide");
      }

      applySessionState(session);
      navigate(CITADELLE_VIEWS.CHAT);
      return session;
    },
    [API_BASE, applySessionState, navigate],
  );

  /** Nouvelle conversation vierge (F5 / bouton « Nouveau »). L'historique reste dans la sidebar. */
  const startFreshSession = useCallback(
    (options = {}) => {
      const { goToChat = false } = options;
      const newId = generateUUID();
      setCurrentSessionId(newId);
      localStorage.setItem(SESSION_STORAGE_KEY, newId);
      setLogs([]);
      setOutput("");
      setHistory([]);
      setCompletedPhases([]);
      setIsReadyForProduction(false);
      setChatMessages([]);
      setProjectGoal("");
      setValidation({ metrics: { score: 0, missing: [] }, forge_ready: false });
      if (goToChat) navigate(CITADELLE_VIEWS.CHAT);
    },
    [navigate],
  );

  // Bootstrap initial : readiness backend puis chargement des sessions
  React.useEffect(() => {
    let isCancelled = false;

    const bootstrapApp = async () => {
      let retryDelayMs = 1500;
      setBootstrapPhase("connecting");

      try {
        while (!isCancelled) {
          try {
            const readyData = await fetchReadyState();
            if (readyData.status !== "starting") break;
            await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
          } catch (error) {
            console.error("Ready check error", error);
            retryDelayMs = Math.min(retryDelayMs * 2, 5000);
            await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
          }
        }

        if (isCancelled) return;

        setBootstrapPhase("loading_sessions");
        await fetchSessions();

        if (isCancelled) return;

        // Actualisation = chat vierge ; les sessions persistées restent listées à gauche.
        startFreshSession();

        if (isCancelled) return;

        setBootstrapMeta((prev) => ({
          ...prev,
          sessionsLoadedAt: new Date().toISOString(),
        }));
        setBootstrapPhase("ready");
      } catch (error) {
        console.error("Bootstrap error", error);
        if (!isCancelled) {
          setBootstrapPhase("loading_sessions");
          await fetchSessions();
          if (!isCancelled) startFreshSession();
          setBootstrapMeta((prev) => ({
            ...prev,
            sessionsLoadedAt: new Date().toISOString(),
          }));
          setBootstrapPhase("ready");
        }
      }
    };

    Promise.resolve().then(bootstrapApp);
    return () => {
      isCancelled = true;
    };
  }, [fetchReadyState, fetchSessions, startFreshSession]);

  // --- POLLING SENTINEL MONITOR (VRAM) ---
  React.useEffect(() => {
    const fetchStats = async () => {
      try {
        const [statsRes, healthRes] = await Promise.all([
          fetch(`${API_BASE}/api/stats`),
          fetch(`${API_BASE}/api/health/runtime`),
        ]);
        const statsData = await statsRes.json();
        const healthData = await healthRes.json();

        if (statsData.vram) {
          setStats((prev) => ({ ...prev, vram: statsData.vram }));
        }
        setHealth(healthData);
      } catch (e) {
        console.error("Failed to fetch citadel stats", e);
      }
    };

    fetchStats(); // Initial check
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, [API_BASE]);

  const saveCurrentSession = useCallback(
    async (overrides = {}) => {
      // On ne sauvegarde que s'il y a du contenu
      if (history.length === 0 && chatMessages.length === 0 && !overrides.title)
        return;

      try {
        const sessionData = {
          id: currentSessionId,
          title:
            overrides.title ||
            sessions.find((s) => s.id === currentSessionId)?.title ||
            "Projet Nexxus",
          timestamp: Date.now(),
          projectGoal,
          forge: {
            logs,
            output,
            history,
            completedPhases,
            isReadyForProduction,
          },
          mentor: { messages: sanitizeChatHistory(chatMessages) },
        };

        await fetch(`${API_BASE}/api/sessions/${currentSessionId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(sessionData),
        });

        if (overrides.title) fetchSessions(); // Re-fetch si le titre a changé
      } catch (error) {
        console.error("Auto-save failed", error);
      }
    },
    [
      API_BASE,
      currentSessionId,
      fetchSessions,
      logs,
      output,
      history,
      completedPhases,
      isReadyForProduction,
      chatMessages,
      sessions,
      projectGoal,
      sanitizeChatHistory,
    ],
  );

  // Sauvegarde automatique après chaque modification importante
  React.useEffect(() => {
    const timer = setTimeout(() => {
      saveCurrentSession();
    }, 2000); // Debounce de 2s
    return () => clearTimeout(timer);
  }, [history, chatMessages, output, projectGoal, saveCurrentSession]);

  // Sauvegarde avant fermeture / actualisation (complète le debounce 2s)
  React.useEffect(() => {
    const onPageHide = () => {
      void saveCurrentSession();
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [saveCurrentSession]);

  const handleSelectSession = async (id) => {
    try {
      await loadSessionById(id);
    } catch (error) {
      console.error("Session load error:", error);
      alert(
        error?.message
          ? `Erreur lors du chargement de la session : ${error.message}`
          : "Erreur lors du chargement de la session.",
      );
    }
  };

  const handleNewSession = () => {
    startFreshSession({ goToChat: true });
  };

  const handleOpenAudit = async (session) => {
    // Re-fetch to get freshest validation data
    try {
      const res = await fetch(`${API_BASE}/api/sessions/${session.id}`, {
        credentials: "include",
      });
      const data = await res.json();
      setAuditSession(data);
      setIsAuditOpen(true);
    } catch (e) {
      console.error("Audit Fetch Error:", e);
      setAuditSession(session);
      setIsAuditOpen(true);
    }
  };

  const handleDeleteSession = async (id) => {
    if (!window.confirm("Supprimer définitivement ce projet ?")) return;
    try {
      await fetch(`${API_BASE}/api/sessions/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      fetchSessions();
      if (id === currentSessionId) handleNewSession();
    } catch (error) {
      console.error("Session delete error:", error);
      alert("Erreur lors de la suppression.");
    }
  };

  const addLog = useCallback((message, type = "system") => {
    // Chaque étape est une entrée indépendante avec son propre timestamp.
    // La fusion a été supprimée : elle écrasait les horodatages et rendait
    // illisible la vitesse de chaque pallier de réflexion de l'agent.
    setLogs((prev) => [...prev, { message, type, timestamp: Date.now() }]);
  }, []);

  const handleStart = async (mode = "production", overrideGoal = null) => {
    const currentGoal = overrideGoal || projectGoal;
    if (!currentGoal) return alert("Veuillez décrire votre projet.");

    setIsRunning(true);
    isRunningRef.current = true;

    // Handoff chat → Forge : repartir sur une sortie Forge propre (pas le message de transfert)
    if (mode === "production" && overrideGoal) {
      setOutput("");
      setCompletedPhases([]);
    } else if (mode === "production" && history.length === 0) {
      setLogs([]);
      setOutput("");
      setCompletedPhases([]);
    } else if (mode === "brainstorming") {
      setOutput("");
      hasDetectedReadyRef.current = false; // Réinitialisation du verrou
    }

    // [ADR-015] Classification Generator-First pour bypasser les phases métacognitives sur les livrables lourds
    const isGeneratorFirst =
      mode === "production" && isGeneratorFirstIntent(currentGoal);

    const phases =
      mode === "brainstorming"
        ? ["expert_analyst"]
        : isGeneratorFirst
          ? ["expert_developer", "expert_qa"]
          : ["expert_pm", "expert_architect", "expert_developer", "expert_qa"];

    addLog(
      mode === "brainstorming"
        ? "Ouverture du canal de Brainstorming..."
        : "Initialisation de la Production...",
      "system",
    );

    if (isGeneratorFirst) {
      addLog("⚡ Mode Generator-First activé : Bypass PM & Architect pour sécuriser le timeout.", "system");
    }

    try {
      // Auto-titrage au premier message
      const currentSession = sessions.find((s) => s.id === currentSessionId);
      if (!currentSession || currentSession.title === "Projet Nexxus") {
        const title =
          currentGoal.split(" ").slice(0, 4).join(" ") +
          (currentGoal.split(" ").length > 4 ? "..." : "");
        saveCurrentSession({ title });
      }

      for (const phase of phases) {
        if (!isRunningRef.current) break;
        // On mappe le mode brainstorming sur l'id visuel du PM pour activer le halo
        setCurrentPhase(mode === "brainstorming" ? "expert_pm" : phase);
        addLog(
          mode === "brainstorming"
            ? "L'Analyste examine votre idée..."
            : `Lancement de la phase ${phase.replace("expert_", "").toUpperCase()}...`,
          mode === "brainstorming" ? "search" : "phase",
        );

        // On préfixe la requête pour l'analyste si on est en brainstorming
        const query =
          mode === "brainstorming" ? `DISCUSSION: ${currentGoal}` : currentGoal;

        await ProductionService.runPhase(
          query,
          phase,
          history,
          currentSessionId,
          {
            onToken: (token) => {
              setOutput((prev) => {
                const newOutput = prev + token;
                // Détection du signal [READY] avec verrouillage par Ref
                if (
                  mode === "brainstorming" &&
                  !hasDetectedReadyRef.current &&
                  newOutput.toUpperCase().includes("[READY]")
                ) {
                  hasDetectedReadyRef.current = true;
                  setIsReadyForProduction(true);
                  addLog(
                    "⚡ AUTORISATION DE FORGE DÉTECTÉE : Le concept est scellé.",
                    "success",
                  );
                }
                return newOutput;
              });
            },
            onStep: (text) => {
              let type = "system";
              if (text.includes("Strategic")) type = "routing";
              if (text.includes("BUILD") || text.includes("ACTION"))
                type = "action";
              if (text.includes("SEARCH") || text.includes("Source found"))
                type = "search";
              if (text.includes("SUCCESS")) type = "success";
              if (text.includes("ERROR")) type = "error";
              if (
                text.includes("⚖️ EVEIL") ||
                text.includes("AUDIT") ||
                text.includes("Critique:")
              )
                type = "audit";
              addLog(text, type);

              // SÉCURITÉ : Détection du signal [READY] dans le flux de logs/console
              if (
                mode === "brainstorming" &&
                !hasDetectedReadyRef.current &&
                text.toUpperCase().includes("[READY]")
              ) {
                hasDetectedReadyRef.current = true;
                setIsReadyForProduction(true);
                addLog(
                  "⚡ AUTORISATION DE FORGE DÉTECTÉE (via Console).",
                  "success",
                );
              }

              // NOTE: Les steps sont affichés dans le Terminal — on ne les injecte PAS dans output
              // (évite la pollution du rendu Markdown de la Forge)
            },
            onLog: (msg, type) => addLog(msg, type),
            onDone: (result, stats) => {
              if (stats && stats.tps) {
                setStats((prev) => ({ ...prev, tps: stats.tps }));
              }
              addLog(
                mode === "brainstorming"
                  ? "Analyse terminée."
                  : `Phase ${phase.replace("expert_", "").toUpperCase()} terminée.`,
                "success",
              );
              if (mode === "production")
                setCompletedPhases((prev) => [...prev, phase]);
              const trimmed = String(result || "").trim();
              const isHandoffEcho =
                /je transmets à la Forge/i.test(trimmed) &&
                trimmed.length < 800;
              if (trimmed && !isHandoffEcho) {
                setHistory((prev) => [
                  ...prev,
                  { role: "assistant", content: trimmed },
                ]);
              }
            },
            onError: (err) => {
              addLog(`Erreur: ${err.message}`, "error");
              throw err;
            },
          },
        );
      }
      if (isRunningRef.current && mode === "production") {
        addLog("Mission de production terminée.", "success");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsRunning(false);
      isRunningRef.current = false;
      setCurrentPhase(null);
      if (textareaRef.current) textareaRef.current.focus(); // On se contente de redonner le focus

      // Nettoyage après production lourde
      if (mode === "production") {
        fetch(`${API_BASE}/api/unload`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ modelName: "current" }),
        }).catch((e) => console.error("Post-prod purge failed:", e));
      }
    }
  };

  const handleSendMessage = async (content, imageFile = null, _options = {}) => {
    // Cas spécial : Validation du transfert
    if (content === "VALIDER LE TRANSFERT" && projectGoal) {
      setProjectGoal(projectGoal);
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "C'est fait ! Le briefing a été transféré à la Forge. Vous pouvez maintenant lancer la production à gauche.",
        },
      ]);
      return;
    }

    // [ADR-015] Interception Generator-First directe depuis le chat
    // Interdit si analyse d'un fichier/chemin existant (ex. projects/.../index.html).
    if (isGeneratorFirstIntent(content)) {
      setProjectGoal(content);
      setValidation((prev) => ({ ...prev, forge_ready: true }));
      setChatMessages((prev) => [
        ...prev,
        { role: "user", content },
        {
          role: "assistant",
          content: "🚀 Mode Generator-First détecté. Redirection immédiate vers la Forge de production.",
        }
      ]);
      setTimeout(() => handleStart("production", content), 100);
      return;
    }

    // Cas spécial : Annuler ou Brainstorming
    if (content === "ANNULER") {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Entendu. On efface tout et on recommence.",
        },
      ]);
      return;
    }

    if (content === "BRAINSTORMING") {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "D'accord, continuons d'affiner. Quel point voulez-vous approfondir ?",
        },
      ]);
      return;
    }

    const latestAssistantMessage = [...sanitizeChatHistory(chatMessages)]
      .reverse()
      .find((message) => message.role === "assistant");

    if (
      latestAssistantMessage &&
      normalizeChatText(content) ===
        normalizeChatText(latestAssistantMessage.content)
    ) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            'Je viens de recevoir ma réponse précédente en écho. Dites-moi simplement la suite souhaitée, par exemple : "prépare le conducteur minute par minute".',
        },
      ]);
      return;
    }

    const sanitizedChatHistory = sanitizeChatHistory(chatMessages);
    const outgoingHistory = sanitizedChatHistory.slice(-20);
    const isNewThread = sanitizedChatHistory.length === 0;

    setChatMessages((prev) => [
      ...prev,
      {
        role: "user",
        content,
        attachment: imageFile
          ? {
              name: imageFile.name,
              type: imageFile.type,
              url: imageFile.type.startsWith("image/")
                ? URL.createObjectURL(imageFile)
                : null,
            }
          : null,
      },
    ]);
    setIsChatTyping(true);
    setIsChatRunning(true); // Chat uniquement — n'active PAS le STOP flottant de la Forge
    chatAbortControllerRef.current = new AbortController();

    // Auto-titrage au premier message (Mentor)
    const currentSession = sessions.find((s) => s.id === currentSessionId);
    if (!currentSession || currentSession.title === "Projet Nexxus") {
      const title =
        content.split(" ").slice(0, 4).join(" ") +
        (content.split(" ").length > 4 ? "..." : "");
      saveCurrentSession({ title });
    }

    let activeTraceId = null;

    try {
      let body;
      const headers = {};

      if (imageFile) {
        body = new FormData();
        body.append("q", content);
        body.append("history", JSON.stringify(outgoingHistory));
        body.append("sessionId", currentSessionId);
        body.append("isNewThread", isNewThread);
        body.append("images", imageFile); // 'images' matched upload.array('images')
      } else {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify({
          q: content,
          history: outgoingHistory,
          sessionId: currentSessionId,
          isNewThread,
        });
      }

      const response = await fetch(`${API_BASE}/api/stream`, {
        method: "POST",
        headers,
        credentials: "include",
        signal: chatAbortControllerRef.current.signal,
        body,
      });

      if (!response.ok) {
        let serverError = "";
        let errPayload = null;
        const headerTraceId = response.headers.get("X-Trace-Id");
        if (headerTraceId) {
          registerTrace({
            traceId: headerTraceId,
            status: "error",
            source: "chat",
            sessionId: currentSessionId,
            error: `HTTP ${response.status}`,
          });
        }
        try {
          errPayload = await response.json();
          serverError =
            errPayload?.message ||
            errPayload?.error ||
            `Erreur serveur (${response.status})`;
        } catch {
          serverError = `Erreur serveur (${response.status})`;
        }

        const isUploadRejection =
          (response.status === 400 || response.status === 403) &&
          (errPayload?.code === "UPLOAD_DOUBLE_EXTENSION" ||
            errPayload?.code === "UPLOAD_REJECTED" ||
            /fichier|upload|autorise|autorisé|multer|file|extension multiple/i.test(
              serverError,
            ));

        const chatError =
          errPayload?.code === "UPLOAD_DOUBLE_EXTENSION"
            ? serverError
            : isUploadRejection
              ? `🔒 Upload refusé (sécurité) — ${serverError}\n\nLe fichier ne sera pas transmis au moteur d'analyse. Aucune réponse IA ne sera générée.`
              : `⚠️ **Requête refusée** — ${serverError}`;

        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", content: chatError },
        ]);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantContent = "";
      let finalAssistantContent = "";
      let streamDone = false;
      activeTraceId = response.headers.get("X-Trace-Id");

      if (activeTraceId) {
        registerTrace({
          traceId: activeTraceId,
          status: "in_progress",
          source: "chat",
          sessionId: currentSessionId,
        });
      }

      setChatMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      let streamFlushTimer = null;
      let pendingChatDisplay = "";
      let streamVisualStartedAt = null;
      let shortReplyPacingHold = false;
      let lastStreamMeta = {
        pipelinePath: null,
        stats: null,
        deliveryMode: null,
      };

      const flushChatDisplay = (display, { force = false } = {}) => {
        pendingChatDisplay = display;
        if (force) {
          if (streamFlushTimer) {
            clearTimeout(streamFlushTimer);
            streamFlushTimer = null;
          }
          setChatMessages((prev) => {
            if (prev.length === 0) return prev;
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: display,
            };
            return updated;
          });
          return;
        }
        if (streamFlushTimer) return;
        streamFlushTimer = setTimeout(() => {
          streamFlushTimer = null;
          setChatMessages((prev) => {
            if (prev.length === 0) return prev;
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: pendingChatDisplay,
            };
            return updated;
          });
        }, STREAM_FLUSH_MS);
      };

      const applyAssistantDisplay = async (text, { forcePacingCheck = true } = {}) => {
        const cleaned = String(text || "");
        // Ne jamais forcer le pacing sur un texte long / panel (évite affichage mid-liste).
        const usePacing =
          forcePacingCheck &&
          cleaned.length <= SHORT_REPLY_VISUAL_PACING.CHAR_THRESHOLD &&
          (shortReplyPacingHold ||
            shouldApplyShortReplyVisualPacing({
              text: cleaned,
              pipelinePath: lastStreamMeta.pipelinePath,
              stats: lastStreamMeta.stats,
              deliveryMode: lastStreamMeta.deliveryMode,
              streamStartedAt: streamVisualStartedAt,
            }));

        if (usePacing) {
          if (streamFlushTimer) {
            clearTimeout(streamFlushTimer);
            streamFlushTimer = null;
          }
          await revealShortReplyWithPacing(
            cleaned,
            (partial) => flushChatDisplay(partial, { force: true }),
            { streamStartedAt: streamVisualStartedAt },
          );
          return;
        }
        flushChatDisplay(cleaned, { force: true });
      };

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const event of events) {
          const lines = event.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;

            const dataStr = line.slice(6);

            if (dataStr === "[DONE]") {
              streamDone = true;
              break;
            }

            try {
              const data = JSON.parse(dataStr);

              if (data.trace_id) {
                activeTraceId = data.trace_id;
                registerTrace({
                  traceId: data.trace_id,
                  status: data.error ? "error" : "in_progress",
                  source: "chat",
                  sessionId: currentSessionId,
                  error: data.error || null,
                });
              }

              if (data.error) {
                updateTrace(data.trace_id || activeTraceId, {
                  status: "error",
                  error: String(data.error),
                  source: "chat",
                  sessionId: currentSessionId,
                });
              }

              if (data.token) {
                if (!streamVisualStartedAt) {
                  streamVisualStartedAt = Date.now();
                }
                assistantContent += data.token;

                const { chatDisplay, thoughtDisplay } =
                  computeStreamChatViews(assistantContent);

                if (thoughtDisplay) {
                  setOutput(thoughtDisplay);
                }

                if (
                  chatDisplay.length >
                  SHORT_REPLY_VISUAL_PACING.CHAR_THRESHOLD
                ) {
                  shortReplyPacingHold = false;
                } else if (
                  shouldHoldShortReplyDuringStream({
                    chatDisplay,
                    streamStartedAt: streamVisualStartedAt,
                    currentlyHolding: shortReplyPacingHold,
                  })
                ) {
                  shortReplyPacingHold = true;
                }

                if (shortReplyPacingHold) {
                  flushChatDisplay(
                    SHORT_REPLY_VISUAL_PACING.TYPING_PLACEHOLDER,
                    { force: true },
                  );
                } else {
                  flushChatDisplay(chatDisplay);
                }
              }

              if (data.step) {
                if (data.meta) {
                  setProgress({
                    message: data.step,
                    step: data.meta.step,
                    total: data.meta.total
                  });
                  if (data.meta.pipelinePath) {
                    addLog(`pipelinePath=${data.meta.pipelinePath}`, "routing");
                  }
                  const triage = data.meta.intentTriage || null;
                  const justIntent = data.meta.justIntent || null;
                  if (justIntent?.domain || triage?.top_intent) {
                    addLog(
                      `justIntent=${justIntent?.domain || "—"}/${justIntent?.action || "—"} strategy=${justIntent?.strategy || "—"} conf=${justIntent?.confidence || triage?.confidence || "—"}`,
                      "routing",
                    );
                  }
                }

                let type = "system";
                if (
                  data.step.includes("⚖️ EVEIL") ||
                  data.step.includes("AUDIT")
                )
                  type = "audit";
                // Les pensées internes (🧠 Pensée) ne sont PAS loguées en surface
                // pour ne pas polluer le Terminal visible de l'utilisateur.
                const isInternalThought = data.step.startsWith("🧠 Pensée");
                if (!isInternalThought) {
                  addLog(data.step, type);
                }

                // Indicateur de travail pendant la réflexion (PAS les pensées brutes)
                if (!assistantContent && !isInternalThought) {
                  setOutput(`⚙️ **${data.step}**`);
                }
              }

              if (data.tps) {
                setStats((prev) => ({ ...prev, tps: data.tps }));
              }

              if (data.done) {
                streamDone = true;
                lastStreamMeta = {
                  pipelinePath: data.pipeline_path || null,
                  stats: data.stats || null,
                  deliveryMode: data.delivery_mode || null,
                };
                if (data.pipeline_path) {
                  addLog(`pipelinePath=${data.pipeline_path} (fin tour)`, "routing");
                }
                if (data.stats?.sseChunks != null) {
                  addLog(
                    `stream delivery: ${data.stats.sseChunks} chunks · TTFT ${data.stats.firstChunkMs ?? "—"}ms · total ${data.stats.streamTotalMs ?? "—"}ms · ${data.stats.emitPath || data.delivery_mode || "—"}`,
                    "system",
                  );
                }
                if (data.forge_handoff && data.project_brief) {
                  pendingForgeHandoffRef.current = data.project_brief;
                  setProjectGoal(data.project_brief);
                  setValidation((prev) => ({ ...prev, forge_ready: true }));
                  setIsReadyForProduction(true);
                  addLog(
                    "Handoff Forge validé — production après fin du tour chat.",
                    "success",
                  );
                }
                updateTrace(data.trace_id || activeTraceId, {
                  status: "ok",
                  source: "chat",
                  sessionId: currentSessionId,
                });
                finalAssistantContent =
                  extractResultContent(data.result) || finalAssistantContent;
                const resolvedAssistantContent = resolveStreamResult(
                  assistantContent,
                  finalAssistantContent,
                );

                if (resolvedAssistantContent.trim()) {
                  assistantContent = resolvedAssistantContent
                    .replace(/<think>[\s\S]*?(?:<\/redacted_thinking>|<\/think>|$)/gi, "")
                    .trim();

                  await applyAssistantDisplay(assistantContent);
                  setProgress(null);
                }
                break;
              }
            } catch (error) {
              console.error("Chat stream parse error:", error);
            }
          }
        }
      }

      const trailingResolvedContent = resolveStreamResult(
        assistantContent,
        finalAssistantContent,
      );

      if (
        trailingResolvedContent.trim() &&
        trailingResolvedContent !== assistantContent
      ) {
        assistantContent = trailingResolvedContent
          .replace(/<think>[\s\S]*?(?:<\/redacted_thinking>|<\/think>|$)/gi, "")
          .trim();
        await applyAssistantDisplay(assistantContent);
      }

      if (streamFlushTimer) {
        clearTimeout(streamFlushTimer);
        streamFlushTimer = null;
      }

      // Le stream se ferme naturellement via [DONE] du serveur

      // Re-fetch session results to get new validation state
      const updatedSessionRes = await fetch(
        `${API_BASE}/api/sessions/${currentSessionId}`,
        { credentials: "include" },
      );
      const updatedData = await updatedSessionRes.json();
      if (updatedData.validation) {
        setValidation(updatedData.validation);
        if (updatedData.validation.forge_ready) {
          setIsReadyForProduction(true);
        }
      }
    } catch (error) {
      if (error.name !== "AbortError" && activeTraceId) {
        updateTrace(activeTraceId, {
          status: "error",
          error: error.message || "Stream interrompu",
          source: "chat",
          sessionId: currentSessionId,
        });
      }
      if (error.name === "AbortError") {
        addLog("🛑 Chat interrompu par l'utilisateur.", "error");
        setChatMessages((prev) => {
          const updated = [...prev];
          const lastIndex = updated.length - 1;
          if (updated[lastIndex]?.role === "assistant") {
            updated[lastIndex] = {
              ...updated[lastIndex],
              content: `${updated[lastIndex].content.trim()}\n\n🛑 Réflexion interrompue par l'utilisateur.`,
            };
          }
          return updated;
        });
      } else {
        console.error("Chat Error:", error);
        setChatMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Désolé, j'ai une petite perte de connexion...",
          },
        ]);
      }
    } finally {
      setIsChatTyping(false);
      setIsChatRunning(false); // Le chat est terminé, libération propre
      chatAbortControllerRef.current = null;

      const handoffBrief = pendingForgeHandoffRef.current;
      if (handoffBrief && !isRunningRef.current) {
        pendingForgeHandoffRef.current = null;
        setTimeout(() => handleStart("production", handoffBrief), 150);
      } else if (handoffBrief) {
        pendingForgeHandoffRef.current = null;
      }
      // Note: setIsRunning() n'est pas appelé ici — isRunning est réservé à la Forge
    }
  };

  const handleSendFeedback = async (rating, comment = "") => {
    try {
      await fetch(`${API_BASE}/api/sessions/${currentSessionId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ rating, comment }),
      });
      addLog(`Feedback envoyé (${rating}).`, "system");
    } catch (error) {
      console.error("Feedback error:", error);
      addLog(`Erreur d'envoi du feedback : ${error.message}`, "error");
    }
  };

  const runImpactAudit = async (target) => {
    if (!target) return;
    setIsAuditing(true);
    try {
      const response = await fetch(`${API_BASE}/api/security/impact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPath: target, mode: auditMode }),
      });
      const data = await response.json();
      setImpactReport(data);
    } catch (error) {
      console.error("Audit failed:", error);
    } finally {
      setIsAuditing(false);
    }
  };

  const handleStop = () => {
    if (isChatRunning && chatAbortControllerRef.current) {
      chatAbortControllerRef.current.abort();
      chatAbortControllerRef.current = null;
      setIsChatRunning(false);
      addLog("🛑 Chat interrompu par l'utilisateur.", "error");
      return;
    }

    if (isRunning) {
      isRunningRef.current = false;
      ProductionService.stop();
      setIsRunning(false);
      setCurrentPhase(null);
      fetch(`${API_BASE}/api/stop`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      }).catch((e) => console.error("Emergency stop failed:", e));
      addLog(
        "🛑 ARRÊT D'URGENCE : Cycle d'inférence rompu physiquement.",
        "error",
      );
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(output);
    alert("Copié dans le presse-papier !");
  };

  return (
    <div className="h-screen flex overflow-hidden bg-[#020617] text-slate-100">
      <CitadelleSidebar
        stats={stats}
        health={health}
        readyStatus={bootstrapMeta.readyStatus}
      />

      <div className="flex-1 flex flex-col min-w-0 min-h-0 relative overflow-hidden">
      <Starfield active={isRunning} count={200} />

      <React.Suspense fallback={null}>
        <AuditReport
          isOpen={isAuditOpen}
          onClose={() => setIsAuditOpen(false)}
          session={auditSession}
        />
      </React.Suspense>

      <CitadelleMobileNav />

      <div
        className={`flex-1 flex flex-col min-h-0 w-full items-center p-4 md:p-8 relative z-10 ${
          isChatView
            ? "overflow-y-auto overflow-x-hidden nexxus-scroll"
            : "overflow-hidden"
        }`}
      >
        <header className="w-full max-w-7xl flex flex-col md:flex-row items-center justify-between gap-4 mb-4 fadeIn relative z-10 px-4">
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <div className="flex items-center gap-3">
                <Cpu className="text-blue-500" size={28} />
                <h1 className="text-xl md:text-3xl font-black text-white uppercase tracking-tighter">
                  LA CITADELLE
                </h1>
                <span className="text-[9px] bg-blue-600 text-white px-2 py-0.5 rounded font-bold">
                  V3.0 ALPHA
                </span>
              </div>
              <p className="text-slate-500 tracking-[0.2em] font-bold text-[9px] uppercase mt-1">
                STATION DE TRAVAIL INTELLIGENTE & SOUVERAINE
              </p>
            </div>
          </div>

          <div className="flex flex-col items-center md:items-end gap-2 max-w-full">
            <div className="flex flex-wrap items-center justify-center md:justify-end gap-x-2 gap-y-1 bg-black/40 px-4 py-2 rounded-xl border border-white/10 text-[10px] uppercase tracking-[0.18em]">
              <span className="font-black text-blue-400">
                {bootstrapPhase === "connecting"
                  ? "Connexion a la Citadelle..."
                  : bootstrapPhase === "loading_sessions"
                    ? "Chargement des sessions..."
                    : "Citadelle interactive"}
              </span>
              <span className="text-slate-600 hidden sm:inline" aria-hidden>
                ·
              </span>
              <span className={`font-bold ${readinessUi.toneClass}`}>
                {readinessUi.label}
              </span>
              {bootstrapMeta.readyStatus === "degraded" && (
                <>
                  <span className="text-slate-600 hidden sm:inline" aria-hidden>
                    ·
                  </span>
                  <span className="text-amber-300/80 normal-case tracking-normal text-[9px]">
                    Capacites secondaires en cours
                  </span>
                </>
              )}
              {bootstrapMeta.apiReadyAt && (
                <>
                  <span className="text-slate-600 hidden sm:inline" aria-hidden>
                    ·
                  </span>
                  <span className="text-slate-500 font-mono normal-case tracking-normal">
                    API ready:{" "}
                    {new Date(bootstrapMeta.apiReadyAt).toLocaleTimeString()}
                  </span>
                </>
              )}
              {bootstrapMeta.sessionsLoadedAt && (
                <>
                  <span className="text-slate-600 hidden sm:inline" aria-hidden>
                    ·
                  </span>
                  <span className="text-slate-500 font-mono normal-case tracking-normal">
                    Sessions:{" "}
                    {new Date(bootstrapMeta.sessionsLoadedAt).toLocaleTimeString()}
                  </span>
                </>
              )}
            </div>
          </div>

        </header>

        <main
          className={`w-full max-w-7xl mx-auto flex flex-col flex-1 min-h-0 gap-6 relative z-10 px-4 pb-6 ${
            isSessionsView ? "overflow-hidden" : ""
          }`}
        >
          {isChatView && isRunning && (
            <section className="w-full bg-black/20 rounded-2xl border border-white/5 py-2 px-4 fadeIn">
              <Timeline
                currentPhase={currentPhase}
                completedPhases={completedPhases}
              />
            </section>
          )}

          <div
            className={`relative w-full flex flex-col lg:flex-row items-stretch gap-6 overflow-hidden rounded-3xl lg:p-4 flex-1 min-h-0 ${
              isChatView ? "min-h-[600px]" : "h-full"
            }`}
          >
            
            {isChatView && (
            <div 
              className={`transition-all duration-1000 ease-[cubic-bezier(0.23,1,0.32,1)] flex flex-col justify-center ${
                isRunning 
                  ? "relative flex-1 opacity-100 blur-none scale-100 z-10 pointer-events-auto" 
                  : "absolute inset-0 z-0 opacity-40 blur-md scale-95 pointer-events-none"
              } ${isChatTyping && !isRunning ? "drop-shadow-[0_0_20px_rgba(59,130,246,0.3)] animate-pulse" : ""}`}
            >
              <GlassCard className="relative overflow-hidden group h-full max-h-[600px] flex flex-col justify-center mx-auto w-full">
                <div className="flex flex-col items-center justify-center py-6 text-center gap-6">
                  <div className="relative">
                    <Rocket
                      size={48}
                      className={`transition-all duration-500 ${validation.forge_ready ? "text-emerald-500 scale-110 drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]" : "text-slate-700"} ${isChatTyping && !isRunning ? "animate-bounce" : ""}`}
                    />
                    {validation.forge_ready && !isRunning && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full animate-ping" />
                    )}
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-xl font-black tracking-tighter text-white uppercase">
                      {validation.forge_ready
                        ? "Projet Prêt pour Scellement"
                        : "Maturation du Concept"}
                    </h2>
                    <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em]">
                      {validation.metrics.score < 20
                        ? "Définissez vos objectifs avec l'Assistant Nexxus"
                        : `Progression de l'architecture : ${validation.metrics.score}%`}
                    </p>
                  </div>

                  <button
                    onClick={() => handleStart("production")}
                    disabled={isRunning || !validation.forge_ready}
                    className={`relative overflow-hidden group px-12 py-4 rounded-2xl font-black tracking-[0.3em] uppercase text-sm transition-all duration-500 pointer-events-auto ${
                      validation.forge_ready && !isRunning
                        ? "bg-emerald-600 text-white hover:bg-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.3)] hover:scale-105 active:scale-95"
                        : "bg-white/5 text-slate-600 cursor-not-allowed border border-white/5"
                    }`}
                  >
                    <span className="relative z-10">
                      {isRunning
                        ? "CONCEPTION EN COURS..."
                        : "DÉMARRER LA CONCEPTION"}
                    </span>
                    {validation.forge_ready && !isRunning && (
                      <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer" />
                    )}
                  </button>

                  {!validation.forge_ready &&
                    !isRunning &&
                    validation.metrics.missing.length > 0 && (
                      <div className="flex items-center gap-2 text-[9px] text-amber-500/70 font-bold uppercase tracking-widest bg-amber-500/5 px-4 py-2 rounded-lg border border-amber-500/10">
                        <AlertTriangle size={12} />
                        Bloqué : {validation.metrics.missing[0]}
                      </div>
                    )}
                </div>
                <div
                  className="absolute bottom-0 left-0 h-1 bg-emerald-500/20 transition-all duration-1000"
                  style={{ width: `${validation.metrics.score}%` }}
                />
              </GlassCard>
            </div>
            )}

            <div
              className={`relative z-20 transition-all duration-1000 ease-[cubic-bezier(0.23,1,0.32,1)] flex flex-col flex-1 min-h-0 ${
                isChatView && isRunning
                  ? "w-full lg:w-[450px] shrink-0 min-h-[600px]"
                  : "w-full h-full"
              } ${isChatView && !isRunning ? "min-h-[600px]" : ""}`}
            >
              <div
                className={`h-full flex-1 min-h-0 rounded-2xl overflow-hidden transition-all duration-1000 ${
                  isChatView && !isRunning
                    ? "bg-[#020617]/80 shadow-2xl backdrop-blur-xl border border-white/10"
                    : "border border-white/10 bg-[#020617]/60"
                }`}
              >
                <MainViewRouter
                  activeView={activeView}
                  sessionId={currentSessionId}
                  chatProps={{
                    messages: chatMessages,
                    onSendMessage: handleSendMessage,
                    onStop: handleStop,
                    onFeedback: handleSendFeedback,
                    isTyping: isChatTyping,
                    validation,
                    sessionId: currentSessionId,
                    progress,
                    onNewSession: handleNewSession,
                  }}
                  impactAuditProps={{
                    auditMode,
                    setAuditMode,
                    auditTarget,
                    setAuditTarget,
                    isAuditing,
                    runImpactAudit,
                    impactReport,
                    handleSendMessage,
                  }}
                  sessionsProps={{
                    sessions,
                    bootstrapPhase,
                    currentSessionId,
                    onSelectSession: handleSelectSession,
                    onNewSession: handleNewSession,
                    onDeleteSession: handleDeleteSession,
                    onOpenAudit: handleOpenAudit,
                  }}
                />
              </div>
            </div>
          </div>

          {isChatView && (
          <div className={`mb-12 transition-all duration-1000 ${isRunning ? "opacity-100 translate-y-0" : "opacity-60 hover:opacity-100 translate-y-2"}`}>
            <GlassCard
              className={`flex flex-col min-h-[400px] transition-all duration-1000 ${isRunning ? "animate-pulse-thinking border-emerald-500/30" : ""}`}
            >
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <TerminalIcon size={14} className="text-blue-400" />
                  <span className="text-[10px] font-bold tracking-widest uppercase text-slate-400">
                    Console d'Orchestration
                  </span>
                </div>
                <button
                  onClick={copyToClipboard}
                  className="p-2 rounded-lg hover:bg-white/5 text-slate-400 transition-colors"
                >
                  <Clipboard size={16} />
                </button>
              </div>
              <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                <div className="h-48 bg-black/40 rounded-xl border border-white/5 overflow-hidden">
                  <React.Suspense
                    fallback={
                      <div className="h-full flex items-center justify-center text-[9px] text-slate-600 font-mono animate-pulse uppercase tracking-widest">
                        Initialisation du Terminal...
                      </div>
                    }
                  >
                    <Terminal logs={logs} hideHeader={true} />
                  </React.Suspense>
                </div>
              </div>
            </GlassCard>
          </div>
          )}
        </main>

        <footer
          className="shrink-0 w-full py-8 text-slate-600 text-[10px] tracking-[0.3em] uppercase fadeIn text-center"
          style={{ animationDelay: "1s" }}
        >
          La Citadelle © 2026 // lacitadelle.ai
        </footer>
        {/* ── FLOATING STOP BUTTON ── Actif UNIQUEMENT pendant la Forge (production)
          NON activé pendant le chat — isRunning est réservé à la Forge */}
        {isRunning && (
          <button
            id="nexxus-emergency-stop"
            onClick={handleStop}
            title="Arrêt d'urgence — interrompt toute inférence en cours"
            className="fixed bottom-8 right-8 z-50 flex items-center gap-3 bg-red-600 hover:bg-red-500 active:scale-95 text-white font-black text-sm tracking-widest uppercase py-4 px-7 rounded-2xl shadow-[0_0_40px_rgba(239,68,68,0.5)] border border-red-400/40 transition-all duration-200"
            style={{ animation: "killPulse 1.5s ease-in-out infinite" }}
          >
            <StopCircle size={22} />
            STOP
          </button>
        )}
      </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <SidebarProvider>
      <OperatorTraceProvider>
        <AppShell />
      </OperatorTraceProvider>
    </SidebarProvider>
  );
}
