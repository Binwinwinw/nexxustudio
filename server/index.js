/* server/index.js */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config({
  path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".env"),
});

import "./src/security/envValidator.js";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import agent from "./src/agent/agent.js";
import expertRouter from "./src/agent/router/expertRouter.js";
import projectBuilder from "./src/tools/projectBuilder.js";
import ollama from "./src/llm/ollama.js";
import thermalTelemetry from "./src/agent/telemetry/thermalTelemetry.js";
import { getStats as getPipelineStats, getRecent as getPipelineRecent } from "./src/agent/telemetry/pipelineTelemetry.js";
import securityHooks from './src/hooks/securityHooks.js';
import sessionRepository from "./src/db/repositories/sessionRepository.js";
import eventRepository from "./src/db/repositories/eventRepository.js";
import runtimeService from "./src/services/runtimeService.js";
import { resolveSessionConversationHistory } from "./src/services/sessionHistoryService.js";
import snapshotRepository from "./src/db/repositories/snapshotRepository.js";
import sessionAccessService from "./src/services/sessionAccessService.js";
import {
  getSessionListCache,
  setSessionListCache,
  invalidateSessionListCache,
} from "./src/services/sessionListCache.js";
import { isPureSocial } from "./src/agent/utils/conversationGuards.js";
import authService from "./src/security/authService.js";
import vramManager from "./src/agent/utils/vramManager.js";
import { requireAuth } from "./src/security/authMiddleware.js";
import {
  createRequireMandatorySession,
  validateTelemetryFeedback,
} from "./src/security/sessionMiddleware.js";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import {
  scanProjectDirectory,
  loadQAAudit,
} from "./src/forge/utils/projectScanner.js";
import handoffRepository from "./src/db/repositories/handoffRepository.js";
import warmupModels, { warmupStatus, scheduleTier2Warmup } from "./src/services/warmupService.js";
import { buildWarmupCockpitSnapshot } from "./src/services/warmupCockpitSnapshot.js";
import {
  getActiveTier1ChatModel,
  getBootProfile,
  listTier3ExpertModels,
  MODEL_CONFIG,
} from "./src/config/models.js";
import { AGENT_ROLES } from "./src/agent/policies/agentRolePolicy.js";
import {
  initBootstrapDiagnostics,
  getBootTraceId,
  getBootstrapDiagnostics,
  recordBootstrapEvent,
} from "./src/services/bootstrapDiagnostics.js";
import {
  evaluateLive,
  evaluateStartup,
  evaluateReady,
  toHealthPayload,
} from "./src/services/healthProbeService.js";
import multer from "multer";
import { analyzeImage } from "./src/services/imageAnalyzer.js";
import knowledgeHub from "./src/services/knowledgeHub.js";
import telemetryPersistor from "./src/agent/telemetry/telemetryPersistor.js";
import turnTelemetry from "./src/agent/telemetry/turnTelemetry.js";
import traceStore from "./src/agent/telemetry/traceStore.js";
import traceContextMiddleware from "./src/middleware/traceContextMiddleware.js";
import impactAuditModule from "./src/forge/audit/impactAuditModule.js";
import projectMemoryPromoter from "./src/tools/projectMemoryPromoter.js";
import projectScanner from "./src/tools/projectScanner.js";
import reliabilityLogger from "./src/agent/utils/reliabilityLogger.js";
import groundTruthService from "./src/agent/utils/groundTruthService.js";
import turnConsolidationService from "./src/services/turnConsolidationService.js";
import AsyncForgeService from "./src/services/AsyncForgeService.js";
import analyticsRouter from "./src/routes/analyticsApi.js";
import governanceRouter from "./src/routes/governanceRoutes.js";
import intentTriageRouter from "./src/routes/intentTriageRoutes.js";
import securityTelemetryRouter from "./src/routes/securityTelemetryRoutes.js";
import workspaceRoutes from "./src/routes/workspaceRoutes.js";
import documentAnalysisRouter from "./src/routes/documentAnalysisRoutes.js";
import sessionDocumentAnalysisRouter from "./src/routes/sessionDocumentAnalysisRoutes.js";
import {
  createArtifactRouter,
  createSessionRunsHandlers,
} from "./src/routes/artifactRoutes.js";
import { scheduleArtifactCleanup } from "./src/services/artifacts/artifactCleanup.js";
import responseThinkingCleaner from "./src/agent/utils/responseThinkingCleaner.js";
import { resolvePipelineFallback } from "./src/agent/utils/genericGreetingGuards.js";
import { scheduleCuratedMemoryIngest } from "./src/agent/memory/guardianship/curatedMemoryIngest.js";
import { scheduleWebCandidateMemoryIngest } from "./src/agent/memory/web-candidates/scheduleWebCandidateMemory.js";
import { applyWebCandidateSessionFeedback } from "./src/agent/memory/web-candidates/webFallbackMemoryRecorder.js";
import OllamaStreamProcessor from "./src/agent/utils/ollamaStreamProcessor.js";
import { emitTextChunksSmooth } from "./src/agent/utils/streamTextChunks.js";
import productionJobManager from "./src/services/ProductionJobManager.js";
import videoJobManager from "./src/services/nexxus-video/VideoJobManager.js";
import {
  validateVideoUploadFile,
  persistSecureVideoUpload,
  VIDEO_UPLOAD_REJECTION_CODES,
} from "./src/services/nexxus-video/videoUploadService.js";
import { NEXXUS_VIDEO_LIMITS } from "./src/services/nexxus-video/videoRouterContract.js";
import designExtractJobManager from "./src/services/design-extract/DesignExtractJobManager.js";
import { validateDesignExtractInput } from "./src/services/design-extract/designExtractContract.js";
import browserHarnessJobManager from "./src/services/browser-harness/BrowserHarnessJobManager.js";
import { validateObserveInput } from "./src/services/browser-harness/browserHarnessContract.js";
import nexxusDesignJobManager from "./src/services/nexxus-design/NexxusDesignJobManager.js";
import { validateDesignCreateInput } from "./src/services/nexxus-design/nexxusDesignContract.js";
import designPipelineJobManager from "./src/services/design-pipeline/DesignPipelineJobManager.js";
import { validateDesignPipelineInput } from "./src/services/design-pipeline/designPipelineContract.js";
import impeccableJobManager from "./src/services/impeccable/ImpeccableJobManager.js";
import { validateDesignAuditInput } from "./src/services/impeccable/impeccableContract.js";
import { getImpeccableCockpitSnapshot } from "./src/services/impeccable/impeccableCockpitSnapshot.js";
import conversationHealth from "./src/agent/telemetry/conversationHealth.js";
import { computeHealthScore } from "./src/agent/telemetry/conversationHealthScore.js";
import conversationStabilityChecklist from "./src/agent/config/conversationStabilityChecklist.js";
import { buildMemoryGovernanceSnapshot } from "./src/agent/memory/guardianship/memoryGovernanceMetrics.js";

const execAsync = promisify(exec);

import ImpactAnalyzer from "./src/security/impactAnalyzer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexPath = path.resolve(
  __dirname,
  "cache/workspace_index.json",
);
const impactAnalyzer = new ImpactAnalyzer(indexPath);

// Déclaré ici pour que restartLog et processBootAt y aient accès dès le boot
const serverStartedAt = new Date().toISOString();
initBootstrapDiagnostics();

// --- BOUCLIERS RÉSILIENCE ---
process.on("uncaughtException", (err) => {
  console.error("🔥 CRITICAL: Uncaught Exception:", err);
  restartLog.push({
    timestamp: new Date().toISOString(),
    reason: "uncaughtException",
    detail: err?.message || String(err),
  });
});

process.on("unhandledRejection", (reason, promise) => {
  console.error(
    "🔥 CRITICAL: Unhandled Rejection at:",
    promise,
    "reason:",
    reason,
  );
  restartLog.push({
    timestamp: new Date().toISOString(),
    reason: "unhandledRejection",
    detail: reason?.message || String(reason),
  });
});
// ----------------------------

// --- RESTART DIAGNOSTIC LOG (v4.3) ---
// Conserve les N dernières causes de perturbation du process en mémoire vive.
// Ne persiste pas : un restart réel vide ce tableau, ce qui est le signal exact.
const RESTART_LOG_MAX = 50;
const restartLog = [];
const processBootAt = serverStartedAt;

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === "production";
const INTERNAL_TOKEN = process.env.INTERNAL_API_TOKEN;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || INTERNAL_TOKEN;

if (IS_PROD) {
  app.set("trust proxy", 1);
}
const BROWSER_COOKIE = "nexxus_browser_id";
const readinessState = {
  routerReady: false,
  routerReadyAt: null,
  knowledgeHubReady: false,
  knowledgeHubReadyAt: null,
};

function getHealthProbeContext() {
  return {
    uptimeSeconds: process.uptime(),
    bootTraceId: getBootTraceId(),
    routerReady: readinessState.routerReady,
    warmupPhase: warmupStatus.phase,
    warmupIsReady: warmupStatus.isReady,
    warmupModels: warmupStatus.models,
    knowledgeHubReady: readinessState.knowledgeHubReady,
  };
}

function sendHealthProbe(res, evaluator) {
  const ctx = getHealthProbeContext();
  const evaluation = evaluator(ctx);
  res.status(evaluation.httpStatus).json(toHealthPayload(evaluation));
}

import {
  validateDoubleExtension,
  UPLOAD_REJECTION_CODES,
} from "../shared/uploadGuards.js";
const ALLOWED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const ALLOWED_TEXT_MIMES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/html",
  "text/css",
  "text/javascript",
  "text/x-typescript",
  "application/json",
  "application/javascript",
  "application/xml",
  "application/x-yaml",
  "application/yaml",
  "application/pdf",
]);

const TEXT_ATTACHMENT_EXT =
  /\.(txt|csv|json|md|html|htm|php|js|css|ts|jsx|tsx|xml|yml|yaml|py|sql|pdf)$/i;

function isAllowedUpload(file) {
  const mime = String(file?.mimetype || "");
  const name = String(file?.originalname || file?.name || "");
  if (ALLOWED_IMAGE_MIMES.has(mime)) return true;
  if (ALLOWED_TEXT_MIMES.has(mime)) return true;
  if (mime.startsWith("text/")) return true;
  if (
    (mime === "application/octet-stream" || mime === "") &&
    TEXT_ATTACHMENT_EXT.test(name)
  ) {
    return true;
  }
  return TEXT_ATTACHMENT_EXT.test(name);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    const name = String(file?.originalname || file?.name || "");
    const doubleExt = validateDoubleExtension(name);
    if (doubleExt.rejected) {
      const err = new Error(doubleExt.message);
      err.code = doubleExt.code || UPLOAD_REJECTION_CODES.DOUBLE_EXTENSION;
      return cb(err);
    }
    if (isAllowedUpload(file)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Type de fichier non autorise. Formats acceptes : images (jpeg, png, webp, gif), documents texte (txt, md, json, csv, html, etc.) et PDF.",
        ),
      );
    }
  },
});

const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: NEXXUS_VIDEO_LIMITS.maxFileSizeBytes,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const name = String(file?.originalname || file?.name || "");
    const doubleExt = validateDoubleExtension(name);
    if (doubleExt.rejected) {
      const err = new Error(doubleExt.message);
      err.code = doubleExt.code || UPLOAD_REJECTION_CODES.DOUBLE_EXTENSION;
      return cb(err);
    }
    if (
      NEXXUS_VIDEO_LIMITS.allowedMimeTypes.includes(
        String(file?.mimetype || "").toLowerCase(),
      ) &&
      /\.mp4$/i.test(name)
    ) {
      cb(null, true);
    } else {
      const err = new Error("Upload vidéo refusé — MP4 (video/mp4) uniquement.");
      err.code = VIDEO_UPLOAD_REJECTION_CODES.MIME_NOT_ALLOWED;
      cb(err);
    }
  },
});

// ============================================================
// SEC-00 : En-têtes de sécurité HTTP (ADR-009)
// ============================================================
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// ============================================================
// SEC-01 : CORS — Origines restreintes par environnement
// ============================================================
const ALLOWED_ORIGINS = (
  process.env.CORS_ORIGINS || "http://localhost:5173,http://localhost:4173"
)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // curl, SSE natif, Postman local
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      console.warn(`[CORS] Origine refusée : ${origin}`);
      callback(new Error(`CORS: Origine non autorisée — ${origin}`));
    },
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-API-Token", "X-Trace-Id", "Last-Event-ID", "Cache-Control"],
    exposedHeaders: ["Content-Disposition", "Content-Type", "Content-Length"],
    credentials: true,
  }),
);

app.use(express.json({ limit: "5mb" })); // Cap taille des payloads (Souverain/Local)
app.use(traceContextMiddleware);
app.use("/analytics", express.static(path.join(__dirname, "public/analytics")));
app.use("/api/analytics", requireSessionAccess);
app.use(analyticsRouter);
app.use("/api/governance", requireSessionAccess, governanceRouter);
app.use("/api/intent-triage", requireSessionAccess, intentTriageRouter);
app.use("/api/security", requireSessionAccess, securityTelemetryRouter);
app.use("/api/workspaces", requireSessionAccess, requireLocalOperator, workspaceRoutes);

function parseCookies(req) {
  const raw = req.headers.cookie || "";
  return raw.split(";").reduce((acc, part) => {
    const [key, ...valueParts] = part.trim().split("=");
    if (!key) return acc;
    acc[key] = decodeURIComponent(valueParts.join("="));
    return acc;
  }, {});
}

function setBrowserCookie(res, browserId) {
  const parts = [
    `${BROWSER_COOKIE}=${encodeURIComponent(browserId)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${60 * 60 * 24 * 365}`,
  ];

  if (IS_PROD) {
    parts.push("Secure");
  }

  res.setHeader("Set-Cookie", parts.join("; "));
}

async function ensureBrowserId(req, res) {
  const cookies = parseCookies(req);
  let browserId = cookies[BROWSER_COOKIE];
  if (!browserId) {
    browserId = sessionAccessService.generateBrowserId();
    setBrowserCookie(res, browserId);
  }
  req.browserId = browserId;
  return browserId;
}

function getSessionIdFromRequest(req) {
  return (
    req.params?.id ||
    req.body?.sessionId ||
    req.body?.id ||
    req.query?.sessionId ||
    null
  );
}

async function requireSessionAccess(req, res, next) {
  try {
    const browserId = await ensureBrowserId(req, res);
    const sessionId = getSessionIdFromRequest(req);

    if (!sessionId) {
      req.browserId = browserId;
      return next();
    }

    const hasAccess = await sessionAccessService.ensureAccess(
      sessionId,
      browserId,
    );
    if (!hasAccess) {
      return res.status(403).json({ error: "Acces refuse a cette session." });
    }

    next();
  } catch (error) {
    res.status(500).json({ error: safeError(error) });
  }
}

const requireMandatorySession = createRequireMandatorySession({
  ensureBrowserId,
  getSessionIdFromRequest,
  sessionAccessService,
  safeError,
});

// ============================================================
// SEC-02 : Rate Limiting natif (sans dépendance externe)
// ============================================================
const rateLimitStore = new Map();

function rateLimit(maxRequests, windowMs) {
  return (req, res, next) => {
    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    const key = `${ip}:${req.path}`;
    const now = Date.now();
    const entry = rateLimitStore.get(key);
    if (!entry || now > entry.resetAt) {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (entry.count >= maxRequests) {
      res.setHeader("Retry-After", Math.ceil((entry.resetAt - now) / 1000));
      return res
        .status(429)
        .json({ error: "Trop de requêtes. Réessayez dans un moment." });
    }
    entry.count++;
    next();
  };
}

app.use(
  "/api/documents",
  requireMandatorySession,
  rateLimit(24, 60_000),
  documentAnalysisRouter,
);

const artifactRunsHandlers = createSessionRunsHandlers();
app.use(
  "/api/artifacts",
  rateLimit(120, 60_000),
  createArtifactRouter({
    getBrowserId: ensureBrowserId,
    sessionAccessService,
  }),
);
app.get("/api/sessions/:id/runs", requireSessionAccess, artifactRunsHandlers.listRuns);
app.get(
  "/api/sessions/:id/runs/:runId",
  requireSessionAccess,
  artifactRunsHandlers.getRun,
);

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetAt) rateLimitStore.delete(key);
  }
}, 60_000);

// ============================================================
// SEC-04 : Guard pour routes destructives (stop / unload)
// ============================================================
function requireInternalToken(req, res, next) {
  if (!INTERNAL_TOKEN) {
    return res
      .status(503)
      .json({ error: "INTERNAL_API_TOKEN manquant cote serveur." });
  }
  const token = req.headers["x-api-token"] || req.body?.token;
  if (token !== INTERNAL_TOKEN)
    return res.status(401).json({ error: "Non autorisé." });
  next();
}

function isLoopbackAddress(address = "") {
  return (
    address === "127.0.0.1" ||
    address === "::1" ||
    address === "::ffff:127.0.0.1"
  );
}

function requireLocalOperator(req, res, next) {
  if (IS_PROD) {
    return res
      .status(403)
      .json({ error: "Operation desactivee en production." });
  }

  const remoteAddress = req.ip || req.socket?.remoteAddress || "";
  if (!isLoopbackAddress(remoteAddress)) {
    return res
      .status(403)
      .json({ error: "Operation reservee au poste local." });
  }

  next();
}

// ============================================================
// SEC-05 : Masquage des détails d'erreur en production
// ============================================================
function safeError(err) {
  if (IS_PROD) return "Une erreur interne est survenue.";
  return err?.message || String(err);
}

// ============================================================
// DEBUG : Vérification du Secret (Temporaire)
// ============================================================
import workspaceIndexer from "./src/services/workspaceIndexer.js";

app.post("/api/forge/audit", requireMandatorySession, async (req, res) => {
  const { query, score, projectPath, sessionId } = req.body;
  const startTime = Date.now();
  let autoIndexed = false;

  if (!query) {
    return res
      .status(400)
      .json({ error: "L'intention (query) est requise pour l'audit." });
  }

  try {
    if (projectPath) {
      autoIndexed = true;
      console.log(`[Forge] Auto-indexing requested for: ${projectPath}`);
      await workspaceIndexer.indexDirectory(
        projectPath,
        path.basename(projectPath),
      );
    }

    const auditReport = await impactAuditModule.runAudit(query, score || 0);

    // TÉLÉMÉTRIE
    telemetryPersistor.recordAuditPerformance({
      type: "forge",
      target: query,
      durationMs: Date.now() - startTime,
      autoIndexed,
      success: true,
      sessionId,
    });

    res.json(auditReport);
  } catch (err) {
    console.error("[API][ForgeAudit] Error:", err.message);
    telemetryPersistor.recordAuditPerformance({
      type: "forge",
      target: query,
      durationMs: Date.now() - startTime,
      autoIndexed,
      success: false,
      sessionId,
    });
    res.status(500).json({ error: "Échec de l'audit d'impact." });
  }
});

// ============================================================
// ASYNC FORGE : Endpoints d'Ingénierie Sandbox Asynchrone (v0.2)
// ============================================================
app.post("/api/forge/run", requireMandatorySession, (req, res) => {
  const { task, repo, testCommand, model, critiqueModel } = req.body;
  if (!task || !repo || !testCommand) {
    return res
      .status(400)
      .json({ error: "Les champs task, repo et testCommand sont requis." });
  }

  try {
    const jobId = AsyncForgeService.startJob(
      task,
      repo,
      testCommand,
      model,
      critiqueModel,
    );
    res.json({ success: true, jobId });
  } catch (error) {
    console.error("❌ [API][ForgeRun] Erreur:", error);
    res.status(500).json({ error: safeError(error) });
  }
});

app.get("/api/forge/jobs", requireMandatorySession, (req, res) => {
  try {
    const jobs = AsyncForgeService.listJobs();
    res.json(jobs);
  } catch (error) {
    console.error("❌ [API][ForgeJobs] Erreur:", error);
    res.status(500).json({ error: safeError(error) });
  }
});

app.get("/api/forge/jobs/:id", requireMandatorySession, (req, res) => {
  try {
    const job = AsyncForgeService.getJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: "Job introuvable." });
    }
    res.json(job);
  } catch (error) {
    console.error(`❌ [API][ForgeJob][${req.params.id}] Erreur:`, error);
    res.status(500).json({ error: safeError(error) });
  }
});

app.post(
  "/api/forge/jobs/:id/cancel",
  requireMandatorySession,
  async (req, res) => {
    try {
      const success = await AsyncForgeService.cancelJob(req.params.id);
      if (!success) {
        return res
          .status(404)
          .json({ error: "Job actif introuvable ou déjà terminé." });
      }
      res.json({ success: true });
    } catch (error) {
      console.error(`❌ [API][ForgeCancel][${req.params.id}] Erreur:`, error);
      res.status(500).json({ error: safeError(error) });
    }
  },
);

// ============================================================
// AUTH-01 : Endpoint de Login Souverain
// ============================================================
app.post("/api/auth/login", rateLimit(5, 60_000), async (req, res) => {
  const { username, password } = req.body;

  if (username === "admin" && password === ADMIN_PASSWORD) {
    const token = authService.generateToken({ username, role: "architect" });
    return res.json({ token, expires: "24h" });
  }

  res.status(401).json({ error: "Identifiants invalides." });
});

// --- SONDES SANTÉ M1-S2 (live / startup / ready) ---
const HEALTH_PROBE_ROUTES = [
  ["live", evaluateLive],
  ["startup", evaluateStartup],
  ["ready", evaluateReady],
];

for (const [probeName, evaluator] of HEALTH_PROBE_ROUTES) {
  const handler = (_req, res) => sendHealthProbe(res, evaluator);
  app.get(`/api/health/${probeName}`, handler);
  app.get(`/health/${probeName}`, handler);
}

app.get("/api/bootstrap/diagnostics", (_req, res) => {
  const ctx = getHealthProbeContext();
  res.json({
    ...getBootstrapDiagnostics(),
    probes: {
      live: evaluateLive(ctx).status,
      startup: evaluateStartup(ctx).status,
      ready: evaluateReady(ctx).status,
    },
    warmup: {
      phase: warmupStatus.phase,
      isReady: warmupStatus.isReady,
      models: warmupStatus.models,
    },
    timestamps: {
      server_started_at: serverStartedAt,
      router_ready_at: readinessState.routerReadyAt,
      knowledge_hub_ready_at: readinessState.knowledgeHubReadyAt,
    },
  });
});

// --- ROUTE HEALTH / RUNTIME (READY-FAST) ---
app.get("/api/health/runtime", (req, res) => {
  const neuralMatrix = buildWarmupCockpitSnapshot(warmupStatus);
  res.json({
    status: neuralMatrix.is_ready ? "optimal" : "warming_up",
    trace_id: req.traceId || null,
    boot_profile: neuralMatrix.boot_profile,
    headline: neuralMatrix.headline,
    neural_matrix: neuralMatrix,
    tiers: {
      tier1: neuralMatrix.tier1,
      tier2: neuralMatrix.tier2,
      tier3: neuralMatrix.tier3,
    },
    doctrine: {
      max_concurrent_experts: MODEL_CONFIG.MAX_CONCURRENT_EXPERTS,
      max_vram_gb: MODEL_CONFIG.MAX_VRAM_GB,
    },
    tier2_deferred: neuralMatrix.tier2_deferred,
    vram_strategy: "Tier1 boot → ready ~5s, Tier2 deferred, Tier3 lazy",
  });
});

// --- TRACES MVP (M1-S1) ---
app.get("/api/traces/:traceId", requireSessionAccess, (req, res) => {
  const trace = traceStore.get(req.params.traceId);
  if (!trace) {
    return res.status(404).json({
      error: "Trace introuvable ou expirée (ring buffer).",
      trace_id: req.params.traceId,
    });
  }
  res.json({ data: trace, meta: { trace_id: trace.trace_id, api_version: "mvp" } });
});

app.get("/api/traces", requireSessionAccess, (req, res) => {
  const sessionId = req.query.sessionId || req.query.session_id;
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  if (!sessionId) {
    return res.status(400).json({ error: "sessionId requis." });
  }
  res.json({
    data: traceStore.listBySession(String(sessionId), limit),
    meta: { trace_id: req.traceId || null, api_version: "mvp" },
  });
});

app.get("/api/ready", (req, res) => {
  const backendReady = true;
  const routerReady = readinessState.routerReady;
  const knowledgeHubReady = readinessState.knowledgeHubReady;
  const warmupReady = Boolean(warmupStatus.isReady);

  let status = "starting";
  if (backendReady && routerReady) {
    status = knowledgeHubReady && warmupReady ? "ready" : "degraded";
  }

  res.json({
    status,
    backend: backendReady ? "ready" : "starting",
    router: routerReady ? "ready" : "starting",
    knowledgeHub: knowledgeHubReady ? "ready" : "starting",
    warmup: {
      phase: warmupStatus.phase,
      isReady: warmupReady,
      models: warmupStatus.models,
    },
    timestamps: {
      server_ready_at: serverStartedAt,
      api_ready_at: readinessState.routerReadyAt,
      sessions_loaded_at: null,
      knowledgehub_ready_at: readinessState.knowledgeHubReadyAt,
    },
  });
});

app.get("/api/health/thermal", async (req, res) => {
  const stats = thermalTelemetry.getAllStats();
  const runtime = {};

  // Résolution async des états thermiques (await requis sur getThermalState)
  await Promise.all(
    Array.from(ollama.activeModels).map(async (model) => {
      runtime[model] = {
        state: await ollama.getThermalState(model),
        queue: ollama.queueDepths.get(model) || 0,
        stats: stats[model] || {},
      };
    }),
  );

  // Vraie pression GPU mesurée via nvidia-smi (await requis)
  const pressureGb = await ollama.calculateVRAMPressure();
  // Limite réelle détectée au boot, pas une constante figée
  const vramLimit = ollama.vramLimit;
  const pressureRatio = vramLimit > 0 ? pressureGb / vramLimit : 0;

  let governanceMode = "CRUISE";
  let governanceModeReason = `ratio ${(pressureRatio * 100).toFixed(1)}% < 60%`;
  if (pressureRatio > 0.85) {
    governanceMode = "PANIC";
    governanceModeReason = `ratio ${(pressureRatio * 100).toFixed(1)}% > 85%`;
  } else if (pressureRatio > 0.75) {
    governanceMode = "RESTRICTED";
    governanceModeReason = `ratio ${(pressureRatio * 100).toFixed(1)}% > 75%`;
  } else if (pressureRatio > 0.6) {
    governanceMode = "SELECTIVE";
    governanceModeReason = `ratio ${(pressureRatio * 100).toFixed(1)}% > 60%`;
  }

  res.json({
    activeCount: ollama.activeModels.size,
    multiLoadedLimit: parseInt(process.env.OLLAMA_MAX_LOADED_MODELS) || 2,
    vram: {
      used_est_gb: pressureGb,
      limit_gb: vramLimit,
      pressure_percent: Math.round(pressureRatio * 100),
      governance_mode: governanceMode,
    },
    // Bloc de traçabilité : formule exacte, source de la mesure, seuils appliqués
    vram_debug: {
      formula: "used_gb / limit_gb = pressure_ratio",
      source:
        "nvidia-smi memory.used (MB / 1024, 2 décimales), fallback: sum(model.base + context_overhead)",
      raw_used_gb: pressureGb,
      raw_limit_gb: vramLimit,
      pressure_ratio: parseFloat(pressureRatio.toFixed(4)),
      governance_mode: governanceMode,
      governance_mode_reason: governanceModeReason,
      thresholds: {
        PANIC: "> 0.85",
        RESTRICTED: "> 0.75",
        SELECTIVE: "> 0.60",
        CRUISE: "<= 0.60",
      },
    },
    heartbeat: {
      model: getActiveTier1ChatModel(),
      active: !!ollama.heartbeatInterval,
      interval: "10m",
      status: governanceMode === "PANIC" ? "PANIC_MODE" : "HEALTHY",
    },
    governance_metrics: stats.governance || {},
    budget_distribution: {
      identity: Array.from(ollama.activeModels).filter(
        (m) => (ollama.modelWeights[m]?.priority || 3) === 1,
      ),
      reasoner: Array.from(ollama.activeModels).filter(
        (m) => (ollama.modelWeights[m]?.priority || 3) === 2,
      ),
      specialists: Array.from(ollama.activeModels).filter(
        (m) => (ollama.modelWeights[m]?.priority || 3) === 3,
      ),
    },
    runtime,
    history: stats.models,
  });
});

// --- ENDPOINT DIAGNOSTIC RESTARTS (v4.3) ---
app.get("/api/health/restarts", (req, res) => {
  res.json({
    process_boot_at: processBootAt,
    uptime_s: Math.floor(process.uptime()),
    // Si ce tableau est vide, le process n'a jamais vu d'erreur depuis ce boot.
    // S'il est absent après un redémarrage, c'est la preuve que le process a été tué.
    disturbance_count: restartLog.length,
    last_disturbances: restartLog.slice(-10).reverse(),
  });
});

// --- ROUTE STATS (SENTINEL MONITOR) ---
// --- HARDWARE METRICS CACHE (Anti-Spam v4.2) ---
let hardwareCache = {
  data: null,
  lastFetch: 0,
  isFetching: false,
};

const getHardwareStats = async () => {
  const now = Date.now();
  const CACHE_TTL = 2000; // 2 seconds

  if (hardwareCache.data && now - hardwareCache.lastFetch < CACHE_TTL) {
    return hardwareCache.data;
  }

  if (hardwareCache.isFetching) {
    // Return stale data if fetching is in progress to avoid congestion
    return hardwareCache.data || { vram: { total: 0, used: 0, percent: 0 } };
  }

  hardwareCache.isFetching = true;
  try {
    const { stdout } = await execAsync(
      "nvidia-smi --query-gpu=memory.total,memory.used --format=csv,noheader,nounits",
    );
    const [total, used] = stdout
      .trim()
      .split(",")
      .map((s) => parseInt(s.trim()));
    hardwareCache.data = {
      vram: {
        total,
        used,
        free: total - used,
        percent: ((used / total) * 100).toFixed(1),
      },
    };
    hardwareCache.lastFetch = Date.now();
  } catch (err) {
    console.error("[Hardware] nvidia-smi failed:", err.message);
    // Fallback to minimal data
    hardwareCache.data = hardwareCache.data || {
      vram: { total: 0, used: 0, percent: 0 },
    };
  } finally {
    hardwareCache.isFetching = false;
  }
  return hardwareCache.data;
};

app.get("/api/stats", async (req, res) => {
  const stats = await getHardwareStats();
  res.json({ ...stats, timestamp: Date.now() });
});

// --- ROUTE COCKPIT (TÉLÉMÉTRIE INDUSTRIELLE) ---
app.post(
  "/api/telemetry/feedback",
  requireMandatorySession,
  rateLimit(30, 60_000),
  async (req, res) => {
    const validation = validateTelemetryFeedback(req.body);
    if (!validation.ok) {
      return res.status(400).json({ error: validation.error });
    }

    const { sessionId, score, comment } = validation.data;
    try {
      await knowledgeHub.addDocuments([
        {
          id: `user_feedback_${Date.now()}`,
          content: `[USER_FEEDBACK] Session: ${sessionId} | Score: ${score}/5 | Comment: ${comment}`,
          metadata: { type: "user_feedback", score, sessionId },
        },
      ]);
      console.log(
        `[Telemetry] User feedback received for ${sessionId}: ${score}/5`,
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Échec de l'enregistrement du feedback." });
    }
  },
);

// Cache pour la santé du graphe (v4.2)
let graphHealthCache = { data: null, time: 0 };

app.get("/api/telemetry/cockpit", requireSessionAccess, async (req, res) => {
  const sessionId = String(req.query.sessionId || req.sessionId || "").trim();
  if (!sessionId) {
    return res.status(400).json({ error: "sessionId requis." });
  }

  try {
    // 1. Santé du noyau (Hardware + Télémétrie Turn)
    const hardware = await getHardwareStats();
    const vram = hardware.vram;

    // 2. Routage & Cognition (Snapshot actuel)
    const routing = turnTelemetry.snapshot();

    // 3. Maturité & Forge (Snapshot DB)
    const snapshot = await snapshotRepository.getLatestSnapshot(sessionId);
    const maturity = {
      projectId:
        snapshot?.state_json?.projectName ||
        snapshot?.state_json?.projectTitle ||
        "unknown",
      phase: snapshot?.current_phase || "DISCOVERY",
      score: snapshot?.state_json?.metrics?.score || 0,
      readiness: snapshot?.state_json?.metrics?.readiness || {},
      recommendation:
        routing.metrics.routing_explanation?.plan ||
        "Continuer la phase de découverte.",
    };

    // 4. Feedback Loop (Derniers incidents ChromaDB)
    const incidents = await knowledgeHub.getLatestIncidents(5);
    const promotions = await knowledgeHub.getLatestPromotions(5);

    // 5. Governance & Graph Health (Cached v4.2)
    const graphPath = path.join(
      __dirname,
      "..",
      "citadelle-vault",
      "Citadelle",
      "02-Architecture",
      "diagrams",
      "citadel-graph-v1.json",
    );
    const now = Date.now();

    if (!graphHealthCache.data || now - graphHealthCache.time > 10000) {
      let health = { density: 0, nodes: 0, edges: 0, status: "N/A" };
      if (fs.existsSync(graphPath)) {
        try {
          const graphData = JSON.parse(fs.readFileSync(graphPath, "utf8"));
          const nodesCount = graphData.nodes.length;
          const edgesCount = graphData.edges.length;
          const density =
            nodesCount > 1
              ? (edgesCount / ((nodesCount * (nodesCount - 1)) / 2)).toFixed(2)
              : 0;
          health = {
            density,
            nodes: nodesCount,
            edges: edgesCount,
            status: density > 0.1 ? "Healthy" : "Fragmented",
          };
        } catch (e) {
          /* ignore */
        }
      }
      graphHealthCache = { data: health, time: now };
    }
    const graphHealth = graphHealthCache.data;

    const pipeline_metrics = getPipelineStats();
    const recent_requests = getPipelineRecent(50);

    res.json({
      health: {
        ...vram,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
        latency: routing.metrics.avgLatency || 120,
        sseActive: true,
      },
      routing: {
        lastExpert:
          routing.metrics.routing_explanation?.selectedExpert || "None",
        rationale:
          routing.metrics.routing_explanation?.rationale ||
          "En attente d'instruction...",
        confidence: routing.metrics.routing_explanation?.confidenceScore || 0,
        candidates: routing.metrics.cognitiveCandidates,
        tokens: routing.metrics.totalTokens || 0,
      },
      maturity,
      governance: {
        blockedCount: incidents.length,
        sovereigntyLevel: incidents.length > 3 ? "Restricted" : "High",
        graphHealth,
      },
      audit: await (async () => {
        try {
          const metricsPath = path.resolve(process.cwd(), "AUDIT_METRICS.json");
          const logs = JSON.parse(fs.readFileSync(metricsPath, "utf8"));
          const total = logs.length;
          const avgLatency =
            total > 0
              ? (
                  logs.reduce((acc, l) => acc + l.durationMs, 0) / total
                ).toFixed(0)
              : 0;
          const autoIndexedCount = logs.filter((l) => l.autoIndexed).length;
          const successRate =
            total > 0
              ? ((logs.filter((l) => l.success).length / total) * 100).toFixed(
                  0,
                )
              : 0;

          return { avgLatency, autoIndexedCount, successRate, total };
        } catch (e) {
          return {
            avgLatency: 0,
            autoIndexedCount: 0,
            successRate: 0,
            total: 0,
          };
        }
      })(),
      pipeline_metrics,
      recent_requests,
      incidents: incidents.map((doc) => ({
        id: doc.id,
        severity: doc.metadata.severity,
        summary: (doc.content || "").slice(0, 50) + "...",
      })),
      jurisprudence: promotions.map((p) => ({
        id: p.id,
        title: p.metadata.title || p.id,
        timestamp: p.timestamp,
        score: p.metadata.score,
      })),
      warmup: warmupStatus,
      neural_matrix: buildWarmupCockpitSnapshot(warmupStatus),
      thermal: {
        active: Array.from(ollama.activeModels),
        states: Object.fromEntries(
          Array.from(ollama.activeModels).map((m) => [
            m,
            ollama.getThermalState(m),
          ]),
        ),
        queue: Object.fromEntries(ollama.queueDepths),
        metrics: thermalTelemetry.getAllStats(),
      },
      multimodal: routing.multimodal,
      reliability: await groundTruthService.getAccuracyStats(),
      design_quality: getImpeccableCockpitSnapshot(sessionId),
      timestamp: Date.now(),
    });
  } catch (err) {
    console.error("[Cockpit API] Error:", err.message);
    res.status(500).json({ error: "Échec de récupération de la télémétrie." });
  }
});

// --- ROUTE RELIABILITY (VAGUE 2) ---
app.get("/api/reliability/stats", requireSessionAccess, async (req, res) => {
  try {
    const { date } = req.query;
    const stats = await reliabilityLogger.getDailyStats(date);
    if (!stats) {
      return res
        .status(404)
        .json({ error: "Aucune donnée de fiabilité pour cette date." });
    }
    res.json(stats);
  } catch (err) {
    console.error("[Reliability API] Error:", err.message);
    res
      .status(500)
      .json({ error: "Échec de récupération des stats de fiabilité." });
  }
});

app.post("/api/reliability/label", requireSessionAccess, async (req, res) => {
  try {
    const { turnId, label, comment } = req.body;
    if (!turnId || !label) {
      return res.status(400).json({ error: "turnId et label sont requis." });
    }
    await groundTruthService.labelTurn(turnId, label, comment);

    // Vague 3 : Déclenchement de la consolidation mémoire sur feedback
    // On ne l'attend pas (fire & forget) pour ne pas bloquer l'UI
    turnConsolidationService
      .consolidate(turnId, label, comment)
      .catch((err) => {
        console.error(
          `[LTM-Hook] Échec de consolidation asynchrone: ${err.message}`,
        );
      });

    res.json({ success: true });
  } catch (err) {
    console.error("[GroundTruth API] Error:", err.message);
    res.status(500).json({ error: "Échec de l'enregistrement du label." });
  }
});

app.get("/api/reliability/accuracy", requireSessionAccess, async (req, res) => {
  try {
    const stats = await groundTruthService.getAccuracyStats();
    res.json(stats || { message: "Aucune donnée de calibration disponible." });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Échec de récupération des stats de calibration." });
  }
});

// Initialisation du routeur (embeddings) au démarrage
console.log("-----------------------------------------");
console.log(">>> NEXXUS CITADEL CORE ACTIVE (V5.0) <<<");
console.log("-----------------------------------------");
console.log("Initializing Nexxus Citadel AI Engine...");
expertRouter
  .init()
  .then(() => {
    readinessState.routerReady = true;
    readinessState.routerReadyAt = new Date().toISOString();
    recordBootstrapEvent("router.ready", {
      status: "ok",
      message: "Expert router initialisé",
    });
    console.log("Nexxus Citadel AI Engine Ready.");
    // INITIALISATION MÉMOIRE VECTORIELLE (Knowledge Hub)
    knowledgeHub
      .init()
      .then(() => {
        readinessState.knowledgeHubReady = true;
        readinessState.knowledgeHubReadyAt = new Date().toISOString();
        recordBootstrapEvent("knowledge_hub.ready", {
          status: "ok",
          message: "Knowledge Hub prêt",
        });
      })
      .catch((err) => {
        recordBootstrapEvent("knowledge_hub.degraded", {
          status: "error",
          message: err?.message || "ChromaDB injoignable",
        });
        console.warn(
          "[KnowledgeHub] Initialisation reportée (ChromaDB injoignable).",
        );
      });
    // PRÉCHAUFFAGE SOUVERAIN ASYNCHRONE (Ready-Fast)
    warmupModels();
  })
  .catch((err) => {
    recordBootstrapEvent("router.init.error", {
      status: "error",
      message: err?.message || "Échec init expert router",
    });
    console.error("[Router] Échec initialisation:", err);
  });

/**
 * Endpoint de streaming (SSE)
 */
app.post(
  "/api/stream",
  upload.array("images", 5),
  requireMandatorySession,
  rateLimit(30, 60_000),
  async (req, res) => {
    let { q, history = [] } = req.body;
    const sessionId = req.sessionId;

    // Support multipart JSON parsing
    if (typeof history === "string") {
      try {
        history = JSON.parse(history);
      } catch (e) {
        history = [];
      }
    }

    // Désactiver les timeouts pour les longs traitements LLM
    req.socket.setTimeout(0);
    req.socket.setNoDelay(true);
    req.socket.setKeepAlive(true);

    scheduleTier2Warmup('first_traffic');

    const traceId = turnTelemetry.startTrace({
      traceId: req.traceId,
      sessionId,
      query: q,
    });
    req.traceId = traceId;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Désactive le buffering proxy (Nginx)
    res.setHeader("X-Trace-Id", traceId);
    res.flushHeaders(); // Envoi immédiat des en-têtes pour établir la connexion

    const send = (data) => {
      res.write(`data: ${JSON.stringify({ trace_id: traceId, ...data })}\n\n`);
    };

    let streamStatus = "ok";
    let streamError = null;

    // Canal séparé pour les pensées internes (debug uniquement, invisible en prod)
    const sendThought = (thought) => {
      if (process.env.DEBUG_THOUGHTS === "true") {
        res.write(`data: ${JSON.stringify({ debug_thought: thought })}\n\n`);
      }
      // Loggé côté serveur mais jamais envoyé au client standard
      // console.debug(`[Thought] ${thought.slice(0, 80)}...`);
    };

    const heartbeat = setInterval(() => {
      send({ status: "ping", timestamp: Date.now() });
    }, 3000);

    try {
      send({ status: "connected", trace_id: traceId });
      conversationHealth.markStreamStart();

      const startTime = Date.now();
      let tokenCount = 0;
      let sseChunkCount = 0;
      let firstChunkMs = null;
      let streamEmitPath = "none";

      const emitVisibleToken = (chunk, extra = {}) => {
        const piece = String(chunk || "");
        if (!piece) return;
        if (firstChunkMs == null) {
          firstChunkMs = Date.now() - startTime;
        }
        sseChunkCount++;
        if (extra.delivery_mode && streamEmitPath === "none") {
          streamEmitPath = extra.delivery_mode;
        } else if (streamEmitPath === "none") {
          streamEmitPath = "pipeline";
        } else if (
          extra.delivery_mode &&
          streamEmitPath !== extra.delivery_mode
        ) {
          streamEmitPath = "mixed";
        }
        send({ token: piece, ...extra });
      };

      // --- INTEGRATION NEXXUS DB (PROPHYLACTIQUE) ---
      await runtimeService.recordUserMessage(
        sessionId,
        q,
        "CONVERSATION",
        req.browserId,
      );

      const resolvedHistory = await resolveSessionConversationHistory(sessionId, {
        clientHistory: history,
        limit: 40,
        metricsSource: "api_stream",
      });

      // Récupérer l'état actuel du projet pour le gating par phase
      const snapshot = await snapshotRepository.getLatestSnapshot(sessionId);
      const projectState = snapshot?.state_json || null;
      // ----------------------------------------------

      // Tracer la propagation des images (diagnostic vision)
      const imageFiles = req.files || [];
      if (imageFiles.length > 0) {
        console.log(
          `[Upload] 📎 ${imageFiles.length} fichier(s) reçu(s) par /api/stream → transmission à agent.run`,
        );
      }

      const streamProcessor = new OllamaStreamProcessor({
        onThought: sendThought,
        onChunk: (chunk) => {
          if (!chunk) return;
          tokenCount++;
          emitVisibleToken(chunk);
        },
      });

      const result = await agent.run(q, resolvedHistory, {
        projectState,
        sessionId,
        traceId,
        images: imageFiles,
        onStep: (step, meta) => send({ step: step, meta }),
        onThought: sendThought,
        onContent: (token) => {
          const pushChunk = (chunk) => {
            const piece = String(chunk || "");
            if (!piece) return;
            streamProcessor.processToken(piece);
            tokenCount += piece.length;
          };
          const raw = String(token || "");
          // Panel / liste structurée : un seul passage (évite troncature mid-liste en UI)
          if (
            raw.length > 48 &&
            !/\n\s*\d+[).]\s+\S/.test(raw) &&
            !/\bChoisis un num[eé]ro\b/i.test(raw)
          ) {
            emitTextChunksSmooth(raw, pushChunk);
          } else {
            pushChunk(raw);
          }
        },
      });

      streamProcessor.finalize();
      const { currentResponse, fullResponse } = streamProcessor.getResult();
      const cleanedResult = responseThinkingCleaner.clean(String(result || ""));
      let assistantText = cleanedResult.trim() || currentResponse?.trim() || "";
      const turnSnapPreFallback = turnTelemetry.snapshot();
      const pipelineFallbackApplied =
        turnSnapPreFallback.metrics?.delivery_fallback_applied === true ||
        turnSnapPreFallback.metrics?.legacy?.delivery_fallback_applied === true;

      // Réponses bulk (buffered_final) : émission SSE par fragments lissés.
      if (tokenCount === 0 && assistantText) {
        emitTextChunksSmooth(assistantText, (chunk) => {
          tokenCount += chunk.length;
          emitVisibleToken(chunk, { delivery_mode: "buffered" });
        });
      }

      if (tokenCount === 0 && !assistantText.trim()) {
        console.log(
          "[StreamProcessor] Stream finished but no visible tokens were sent. Triggering HTTP fallback.",
          {
            pipelinePath: turnSnapPreFallback?.metrics?.pipeline_path,
            intent: turnSnapPreFallback?.metrics?.intent_contract_id,
            queryLen: String(q || "").length,
            pipelineFallbackApplied,
          },
        );
        conversationHealth.recordIncident("no_visible_tokens", {
          mode: "SIMPLE_FAST_OR_PIPELINE",
          model: "mixed",
          sessionId,
          pipelinePath: turnSnapPreFallback?.metrics?.pipeline_path,
        });
        const fallback = resolvePipelineFallback({
          query: q,
          history: resolvedHistory,
          rawResponse: result || fullResponse,
          reason: pipelineFallbackApplied
            ? "no_visible_tokens_after_pipeline_fallback"
            : "no_visible_tokens",
        });
        if (String(fallback || "").trim()) {
          conversationHealth.recordIncident("fallback_triggered", {
            reason: pipelineFallbackApplied
              ? "no_visible_tokens_after_pipeline_fallback"
              : "no_visible_tokens",
            mode: "SIMPLE_FAST_OR_PIPELINE",
            model: "mixed",
            sessionId,
          });
          assistantText = fallback;
          emitTextChunksSmooth(fallback, (chunk) => {
            tokenCount += chunk.length;
            emitVisibleToken(chunk, { delivery_mode: "http_fallback" });
          });
        }
      }

      // --- INTEGRATION NEXXUS DB (POST-RESPONSE) ---
      const duration = (Date.now() - startTime) / 1000;
      const streamTotalMs = Date.now() - startTime;
      const tps = duration > 0 ? (tokenCount / duration).toFixed(2) : 0;

      turnTelemetry.setMetric("stream_sse_chunks", sseChunkCount);
      turnTelemetry.setMetric("stream_first_chunk_ms", firstChunkMs);
      turnTelemetry.setMetric("stream_total_ms", streamTotalMs);
      turnTelemetry.setMetric("stream_emit_path", streamEmitPath);

      if (process.env.STREAM_DELIVERY_LOG === "true") {
        console.log(
          JSON.stringify({
            event: "stream.delivery",
            trace_id: traceId,
            session_id: sessionId,
            sse_chunks: sseChunkCount,
            first_chunk_ms: firstChunkMs,
            total_ms: streamTotalMs,
            emit_path: streamEmitPath,
            delivery_mode:
              turnSnapPreFallback.metrics?.delivery_mode ||
              turnSnapPreFallback.metrics?.legacy?.delivery_mode ||
              streamEmitPath,
            pipeline_path: turnSnapPreFallback?.metrics?.pipeline_path,
          }),
        );
      }

      await runtimeService.recordAssistantResponse(
        sessionId,
        assistantText || result,
        "CONVERSATION",
        {
          tps,
          totalTokens: tokenCount,
          duration,
        },
        req.browserId,
      );
      scheduleCuratedMemoryIngest({
        userQuery: q,
        assistantResponse: assistantText || result,
        sessionId,
        turnId: turnTelemetry.snapshot().turnId,
      });
      scheduleWebCandidateMemoryIngest({
        userQuery: q,
        assistantResponse: assistantText || result,
        sessionId,
        turnId: turnTelemetry.snapshot().turnId,
      });
      // ----------------------------------------------

      const turnSnap = turnTelemetry.snapshot();
      const turnLegacy = turnSnap.metrics?.legacy || {};
      send({
        done: true,
        trace_id: traceId,
        pipeline_path: turnTelemetry.getLastPipelinePath(),
        result: assistantText || cleanedResult || currentResponse || "",
        delivery_mode:
          turnSnap.metrics?.delivery_mode ||
          turnSnap.metrics?.legacy?.delivery_mode ||
          (tokenCount > 0 ? "buffered" : "empty"),
        stats: {
          tps,
          totalTokens: tokenCount,
          duration,
          sseChunks: sseChunkCount,
          firstChunkMs: firstChunkMs,
          streamTotalMs,
          emitPath: streamEmitPath,
        },
        forge_handoff: turnLegacy.forge_handoff === true,
        project_brief:
          typeof turnLegacy.forge_brief === "string"
            ? turnLegacy.forge_brief
            : null,
      });

      clearInterval(heartbeat);
      res.write("data: [DONE]\n\n");
      res.end();
    } catch (error) {
      streamStatus = "error";
      streamError = error;
      clearInterval(heartbeat);
      turnTelemetry.recordError(error, { phase: "stream" });
      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "error",
          trace_id: traceId,
          session_id: sessionId,
          event: "stream.error",
          status: "error",
          error: safeError(error),
        }),
      );
      conversationHealth.recordIncident("stream_error", {
        reason: safeError(error),
        mode: "SIMPLE_FAST_OR_PIPELINE",
        model: "mixed",
        sessionId,
        traceId,
      });
      send({
        trace_id: traceId,
        message: { content: "⚠️ Erreur serveur: " + safeError(error) },
        error: safeError(error),
      });
      res.end();
    } finally {
      turnTelemetry.finishTrace({
        status: streamStatus,
        error: streamError || undefined,
      });
    }
  },
);

app.get("/api/conversation/health", requireSessionAccess, (_req, res) => {
  const snapshot = conversationHealth.snapshot();
  const globalScore = snapshot.globalScore ?? computeHealthScore(snapshot.today);
  const kpis = {
    noWhiteScreen: snapshot.today.noVisibleTokens === 0,
    fallbackRateTargetLt1Pct: snapshot.today.fallbackRatePct < 1,
    qualityGateReady: globalScore >= 85,
  };

  res.json({
    checklist: conversationStabilityChecklist,
    health: snapshot,
    globalScore,
    kpis,
  });
});

app.get("/api/memory/governance", requireSessionAccess, (_req, res) => {
  const snapshot = buildMemoryGovernanceSnapshot();
  res.json({
    governance: snapshot,
    globalScore: snapshot.globalScore,
    kpis: snapshot.kpis,
  });
});

/**
 * Endpoint d'Audit d'Impact (Sécurité & Architecture)
 */
app.post("/api/security/impact", requireLocalOperator, async (req, res) => {
  const { targetPath, mode = "file", sessionId } = req.body;
  const startTime = Date.now();
  let autoIndexed = false;

  if (!targetPath) {
    return res.status(400).json({ error: "Chemin cible manquant." });
  }

  try {
    let report = await impactAnalyzer.analyze(targetPath, mode);

    // AUTO-REPAIR : Si le module n'est pas indexé, on le fait à la volée
    if (report.error && mode === "module") {
      autoIndexed = true;
      console.log(
        `[ImpactAPI] Module non indexé. Lancement de l'indexation auto : ${targetPath}`,
      );
      try {
        await workspaceIndexer.indexDirectory(
          targetPath,
          path.basename(targetPath),
        );
        report = await impactAnalyzer.analyze(targetPath, mode);
      } catch (indexErr) {
        console.error(
          "[ImpactAPI] Échec de l'indexation auto:",
          indexErr.message,
        );
      }
    }

    // TÉLÉMÉTRIE
    telemetryPersistor.recordAuditPerformance({
      type: "security",
      target: targetPath,
      durationMs: Date.now() - startTime,
      autoIndexed,
      success: !report.error,
      sessionId,
    });

    res.json(report);
  } catch (error) {
    console.error("[ImpactAPI] Error:", error.message);
    telemetryPersistor.recordAuditPerformance({
      type: "security",
      target: targetPath,
      durationMs: Date.now() - startTime,
      autoIndexed,
      success: false,
      sessionId,
    });
    res.status(500).json({ error: "Échec de l'analyse d'impact." });
  }
});

/**
 * Endpoint de Pipeline Epistemique (Anti-hallucination)
 */
import { runPipeline } from "./src/agent/orchestrator/runPipeline.js";
import auditRepository from "./src/db/repositories/auditRepository.js";

app.post("/api/pipeline/run", requireSessionAccess, async (req, res) => {
  const { query, debug, include_intermediate_steps } = req.body;
  try {
    const envelope = {
      query_id: `qry_${Date.now()}`,
      user_query: query,
      context: { time_utc: new Date().toISOString() },
      constraints: {
        max_tool_calls: 5,
        allow_web: false,
        allow_db: true,
        allow_code: true,
        allow_logs: true,
      },
    };

    const result = await runPipeline(envelope, { include_intermediate_steps });
    res.json(result);
  } catch (err) {
    console.error("[Pipeline API] Error:", err.message, err.stack);
    res.status(500).json({
      error: "Échec du pipeline.",
      message: err.message,
      stack: err.stack,
    });
  }
});

app.post("/api/pipeline/submit", requireSessionAccess, async (req, res) => {
  const { query, debug, include_intermediate_steps } = req.body;
  try {
    const queryId = `qry_${Date.now()}`;
    const envelope = {
      query_id: queryId,
      user_query: query,
      context: { time_utc: new Date().toISOString() },
      constraints: {
        max_tool_calls: 5,
        allow_web: false,
        allow_db: true,
        allow_code: true,
        allow_logs: true,
      },
    };

    // Fire and forget runPipeline
    runPipeline(envelope, { include_intermediate_steps }).catch((err) => {
      console.error("[Pipeline API] Async Error:", err.message);
    });

    res.json({ job_id: queryId, status: "processing" });
  } catch (err) {
    console.error("[Pipeline API] Submit Error:", err.message, err.stack);
    res.status(500).json({
      error: "Échec de la soumission du pipeline.",
      message: err.message,
    });
  }
});

app.get("/api/pipeline/:job_id", requireSessionAccess, async (req, res) => {
  try {
    const queryId = req.params.job_id;
    const events = await auditRepository.getEventsByQuery(queryId);

    if (!events || events.length === 0) {
      return res
        .status(404)
        .json({ error: "Job introuvable ou pas encore démarré." });
    }

    const finalVerdict = events.find((e) => e.stage === "verdict.final");

    // Construire le debug_trace pour le client
    const debug_trace = {};
    for (const evt of events) {
      let data = evt.payload_json;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch (e) {}
      }

      if (evt.stage === "router.plan") debug_trace.plan = data;
      else if (evt.stage === "retrieval.evidence") debug_trace.retrieval = data;
      else if (evt.stage === "extraction.facts") debug_trace.extraction = data;
      else if (evt.stage === "synthesis.draft") debug_trace.draft = data;
      else if (evt.stage === "critic.review") debug_trace.review = data;
    }

    if (finalVerdict) {
      let payload =
        typeof finalVerdict.payload_json === "string"
          ? JSON.parse(finalVerdict.payload_json)
          : finalVerdict.payload_json;
      payload.debug_trace = debug_trace;
      return res.json({
        status: "completed",
        result: payload,
        steps: events.length,
      });
    }

    const lastEvent = events[events.length - 1];
    res.json({
      status: "processing",
      current_stage: lastEvent.stage,
      last_update: lastEvent.created_at || new Date().toISOString(),
      steps_completed: events.length,
      debug_trace, // Provide partial trace during processing
    });
  } catch (err) {
    console.error("[Pipeline API] Job Poll Error:", err.message);
    res.status(500).json({ error: "Erreur lors de la récupération du job." });
  }
});

/**
 * Endpoint de Vision Multimodale (Analyse d'image + OCR)
 */
app.post(
  "/api/vision/analyze",
  requireSessionAccess,
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Aucun fichier image fourni." });
      }

      const result = await analyzeImage(req.file.buffer, req.file.originalname);
      res.json(result);
    } catch (error) {
      console.error("[VisionAPI] Error:", error.message);
      res.status(500).json({ error: "Échec de l'analyse visuelle." });
    }
  },
);

/**
 * Endpoint de Consensus SMAC (Stochastic Multi-Agent Consensus)
 * Orchestre 3 agents avec des températures divergentes (0.1, 0.2, 0.4)
 */
app.post(
  "/api/smac/arbitrate",
  requireAuth,
  rateLimit(30, 60_000),
  async (req, res) => {
    const { query, context = {} } = req.body;
    const startTime = Date.now();

    if (!query) {
      return res.status(400).json({ error: "Requête (query) manquante." });
    }

    try {
      // 1. Définition des agents du consensus (Configuration ADR-003 ajustée aux modèles dispos)
      const agents = [
        { name: "Architecte", model: "qwen3.5:9b", temperature: 0.1 },
        { name: "Analyste", model: "ornith:9b", temperature: 0.2 },
        { name: "Auditeur", model: AGENT_ROLES.SECURITY_AUDITOR, temperature: 0.4 },
      ];

      console.log(
        `[SMAC] 🧠 Arbitrage lancé pour: "${query.substring(0, 50)}..."`,
      );

      // 2. Exécution séquentielle (Sécurité VRAM pour GPU local)
      const responses = [];
      for (const agentDef of agents) {
        const start = Date.now();
        const response = await ollama.chat(
          [
            {
              role: "system",
              content: `Vous êtes l'agent ${agentDef.name}. Appliquez le protocole SMAC.`,
            },
            { role: "user", content: query },
          ],
          agentDef.model,
          {
            temperature: agentDef.temperature,
          },
        );
        responses.push({
          agent: agentDef.name,
          content: response,
          duration: Date.now() - start,
        });
      }

      // 3. Calcul du Consensus (Similitude de Jaccard simplifiée pour le test)
      // Note: Dans une version future, on utilisera des embeddings.
      const calculateSimilarity = (a, b) => {
        const setA = new Set(a.toLowerCase().split(/\W+/));
        const setB = new Set(b.toLowerCase().split(/\W+/));
        const intersection = new Set([...setA].filter((x) => setB.has(x)));
        const union = new Set([...setA, ...setB]);
        return intersection.size / union.size;
      };

      const sim12 = calculateSimilarity(
        responses[0].content,
        responses[1].content,
      );
      const sim13 = calculateSimilarity(
        responses[0].content,
        responses[2].content,
      );
      const sim23 = calculateSimilarity(
        responses[1].content,
        responses[2].content,
      );

      const consensusScore = (sim12 + sim13 + sim23) / 3;

      // 4. Détermination du niveau de confiance (ADR-003)
      let decision = "REJET (Incertitude trop élevée)";
      let action = "STOP";

      if (consensusScore >= 0.95) {
        decision = "GO (CONFIRMÉ)";
        action = "REVISE_ARCHI";
      } else if (consensusScore >= 0.85) {
        decision = "GO (SOUS RÉSERVE)";
        action = "HUMAN_VALIDATION";
      } else if (consensusScore >= 0.75) {
        decision = "GO (AUTOMATIQUE)";
        action = "EXECUTE";
      }

      const totalDuration = Date.now() - startTime;

      const result = {
        query,
        consensus: {
          score: consensusScore.toFixed(3),
          decision,
          action,
        },
        agents: responses,
        metrics: {
          totalDuration,
          p50: totalDuration, // Simplifié pour le retour unitaire
          timestamp: new Date().toISOString(),
        },
      };

      res.json(result);
    } catch (error) {
      console.error("[SMAC API] Error:", error.message);
      res.status(500).json({ error: "Échec de l'arbitrage SMAC." });
    }
  },
);

/**
 * Endpoint d'Indexation de Connaissances (Manuel)
 */
app.post("/api/knowledge/index", requireInternalToken, async (req, res) => {
  const { content, metadata = {}, id } = req.body;

  if (!content) {
    return res.status(400).json({ error: "Contenu requis pour l'indexation." });
  }

  try {
    const docId =
      id || `manual_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
    await knowledgeHub.addDocuments([
      {
        id: docId,
        content,
        metadata: {
          ...metadata,
          source: metadata.source || "manual_import",
          timestamp: new Date().toISOString(),
        },
      },
    ]);

    res.json({ success: true, id: docId });
  } catch (error) {
    res.status(500).json({ error: "Échec de l'indexation." });
  }
});

/**
 * Endpoint de Recherche Sémantique (Knowledge Hub)
 */
app.post("/api/knowledge/query", requireInternalToken, async (req, res) => {
  const { query, limit = 5, filter = {} } = req.body;

  if (!query) {
    return res.status(400).json({ error: "Requête (query) manquante." });
  }

  try {
    const results = await knowledgeHub.query(query, limit, filter);
    res.json(results);
  } catch (error) {
    console.error("[KnowledgeQueryAPI] Error:", error.message);
    res.status(500).json({ error: "Échec de la recherche sémantique." });
  }
});

/**
 * Endpoint de Chat (Discussion simple sans streaming)
 */
app.post(
  "/api/chat",
  requireMandatorySession,
  rateLimit(30, 60_000),
  async (req, res) => {
    const { query, history = [], isNewThread = false } = req.body;
    const normalizedQuery = String(query || "")
      .trim()
      .toLowerCase();
    const isDiscussion = normalizedQuery.includes("discussion:");
    const shortSocial = isPureSocial(normalizedQuery, isDiscussion);
    const requestId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let expertKey = req.body.expertKey;

    if (expertKey === "undefined" || expertKey === "null" || expertKey === "") {
      expertKey = undefined;
    }

    if (shortSocial) {
      expertKey = undefined;
      console.log("[ROUTER] Social short query -> no forced expert");
    }

    console.log("[POST /api/chat] expertKey =", expertKey);
    console.log("[POST /api/chat] body =", req.body);
    console.log(
      `[CHAT][${requestId}] REQUEST_RECEIVED session=${req.sessionId} history=${Array.isArray(history) ? history.length : 0} isNewThread=${Boolean(isNewThread)}`,
    );

    scheduleTier2Warmup('first_traffic');

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

    try {
      const startTime = Date.now();
      let tokenCount = 0;

      // --- INTEGRATION NEXXUS DB (PROPHYLACTIQUE) ---
      const sessionId = req.sessionId;
      await runtimeService.recordUserMessage(
        sessionId,
        query,
        "CONVERSATION",
        req.browserId,
      );

      const resolvedHistory = await resolveSessionConversationHistory(sessionId, {
        clientHistory: history,
        limit: 40,
        metricsSource: "api_chat",
      });

      // Récupérer l'état actuel du projet pour le gating par phase
      const snapshot = await snapshotRepository.getLatestSnapshot(sessionId);
      const projectState = snapshot?.state_json || null;
      // ----------------------------------------------

      console.log(
        `[CHAT][${requestId}] AGENT_RUN_START resolvedHistory=${resolvedHistory.length} clientHistory=${Array.isArray(history) ? history.length : 0}`,
      );
      const result = await agent.run(query, resolvedHistory, {
        projectState,
        onStep: (text, meta) => send({ step: text, meta }),
        onContent: (token) => {
          tokenCount++;
          send({ token });
        },
        forcedExpertKey: expertKey || undefined,
        disableRecentMemory: Boolean(isNewThread),
        chatMode: true,
        cavemanLevel: req.body.cavemanLevel || "LITE",
      });
      console.log(
        `[CHAT][${requestId}] AGENT_RUN_COMPLETED tokens=${tokenCount} resultLength=${String(result || "").length}`,
      );

      // --- INTEGRATION NEXXUS DB (POST-RESPONSE) ---
      const duration = (Date.now() - startTime) / 1000;
      const tps = duration > 0 ? (tokenCount / duration).toFixed(2) : 0;

      console.log(`[CHAT][${requestId}] ASSISTANT_RESPONSE_PERSIST_START`);
      await runtimeService.recordAssistantResponse(
        sessionId,
        result,
        "CONVERSATION",
        {
          tps,
          duration,
          expertKey,
        },
        req.browserId,
      );
      scheduleCuratedMemoryIngest({
        userQuery: query,
        assistantResponse: result,
        sessionId,
        turnId: turnTelemetry.snapshot().turnId,
      });
      scheduleWebCandidateMemoryIngest({
        userQuery: query,
        assistantResponse: result,
        sessionId,
        turnId: turnTelemetry.snapshot().turnId,
      });
      console.log(
        `[CHAT][${requestId}] ASSISTANT_RESPONSE_PERSIST_DONE tps=${tps} duration=${duration.toFixed(2)}s`,
      );
      // ----------------------------------------------

      console.log(`[CHAT][${requestId}] DONE_EVENT_PREPARING`);
      const telemetry = turnTelemetry.snapshot();
      console.log(
        `[CHAT][${requestId}] EXPLANATION_FOUND=${!!telemetry.metrics.routing_explanation}`,
      );

      // ── FILET DE SÉCURITÉ FINAL : Nettoyage strict de toute réflexion interne ──
      const cleanedResult = responseThinkingCleaner.clean(String(result || ""));
      const hasEscapedThinking =
        responseThinkingCleaner.hasEscapedThinking(cleanedResult);
      if (hasEscapedThinking) {
        console.warn(
          `[CHAT][${requestId}] ⚠️ THINKING ESCAPED DETECTED - Added extra sanitization`,
        );
      }

      send({
        tps,
        done: true,
        result: cleanedResult,
        turnId: telemetry.turnId,
        explanation: telemetry.metrics.routing_explanation,
      });
      console.log(`[CHAT][${requestId}] DONE_EVENT_SEND_DONE`);
      // 🔄 FEEDBACK LOOP (R -> N) : Persistance avant fermeture
      telemetryPersistor
        .recordTurn(turnTelemetry.snapshot(), sessionId)
        .catch((err) => {
          console.error(`[FeedbackLoop] Error:`, err.message);
        });

      res.write("data: [DONE]\n\n");
      console.log(`[CHAT][${requestId}] SSE_DONE_MARKER_WRITTEN`);
      res.end();
      console.log(`[CHAT][${requestId}] SSE_CLOSED`);
    } catch (error) {
      console.error(`[CHAT][${requestId}] ERROR`, error);
      send({ error: safeError(error) });
      res.end();
    }
  },
);

/**
 * Endpoints for Resumable Asynchronous Production Jobs
 */
app.post(
  "/api/production/job",
  requireMandatorySession,
  rateLimit(30, 60_000),
  (req, res) => {
    try {
      const { query, history = [], expert, isNewThread, cavemanLevel } = req.body;
      const sessionId = req.sessionId;

      const jobId = productionJobManager.startJob({
        query,
        expert,
        history,
        sessionId,
        browserId: req.browserId,
        cavemanLevel,
        traceId: req.traceId,
      });

      res.json({ success: true, jobId, trace_id: req.traceId });
    } catch (error) {
      res.status(500).json({ success: false, error: safeError(error) });
    }
  }
);

app.get(
  "/api/production/stream/:jobId",
  requireMandatorySession,
  (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const jobId = req.params.jobId;
    const lastEventId = req.headers["last-event-id"] || req.query.lastIndex || "0";

    productionJobManager.subscribe(jobId, lastEventId, res, {
      browserId: req.browserId,
    });
  },
);

app.delete(
  "/api/production/job/:jobId",
  requireLocalOperator,
  (req, res) => {
    productionJobManager.abortJob(req.params.jobId);
    res.json({ success: true });
  }
);

/**
 * Nexxus Video — jobs asynchrones (upload MP4 sécurisé + pipeline)
 */
app.post(
  "/api/video/jobs",
  requireMandatorySession,
  rateLimit(10, 60_000),
  videoUpload.single("video"),
  async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({
          error: "Fichier vidéo requis (champ video, MP4).",
          trace_id: req.traceId || null,
          code: VIDEO_UPLOAD_REJECTION_CODES.EMPTY_FILE,
        });
      }

      const validation = validateVideoUploadFile({
        buffer: file.buffer,
        mimetype: file.mimetype,
        originalname: file.originalname,
        size: file.size,
      });

      if (!validation.ok) {
        return res.status(400).json({
          error: validation.message,
          trace_id: req.traceId || null,
          code: validation.code,
        });
      }

      const stored = await persistSecureVideoUpload({
        buffer: file.buffer,
        traceId: req.traceId,
      });

      const { objective = "summary", depth = "fast", query = "" } = req.body || {};
      const { jobId, traceId } = videoJobManager.startJob({
        filePath: stored.storagePath,
        objective,
        depth,
        query,
        sessionId: req.sessionId,
        browserId: req.browserId,
        traceId: req.traceId,
      });

      res.json({
        success: true,
        jobId,
        trace_id: traceId,
        file_id: stored.fileId,
        source_hash: stored.sourceHash,
        stream_url: `/api/video/stream/${jobId}`,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: safeError(error),
        trace_id: req.traceId || null,
      });
    }
  },
);

app.get(
  "/api/video/stream/:jobId",
  requireMandatorySession,
  (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    videoJobManager.subscribe(req.params.jobId, req.headers["last-event-id"] || req.query.lastIndex || "0", res, {
      browserId: req.browserId,
    });
  },
);

app.get(
  "/api/video/jobs/:jobId",
  requireMandatorySession,
  (req, res) => {
    const job = videoJobManager.getJob(req.params.jobId);
    if (!job || !videoJobManager.canAccess(req.params.jobId, req.browserId)) {
      return res.status(404).json({
        error: "Job vidéo introuvable ou accès refusé.",
        trace_id: req.traceId || null,
      });
    }

    res.json({
      jobId: job.id,
      status: job.status,
      trace_id: job.traceId,
      objective: job.objective,
      events_count: job.events.length,
      meta: { trace_id: req.traceId || job.traceId, api_version: "mvp" },
    });
  },
);

app.delete(
  "/api/video/jobs/:jobId",
  requireMandatorySession,
  (req, res) => {
    if (!videoJobManager.canAccess(req.params.jobId, req.browserId)) {
      return res.status(403).json({
        error: "Accès refusé.",
        trace_id: req.traceId || null,
      });
    }
    videoJobManager.abortJob(req.params.jobId);
    res.json({ success: true, trace_id: req.traceId || null });
  },
);

/**
 * Design Extract — jobs asynchrones (rétro-ingénierie ADN visuel)
 */
app.post(
  "/api/design/extract/jobs",
  requireMandatorySession,
  rateLimit(12, 60_000),
  async (req, res) => {
    try {
      const {
        url = null,
        query = "",
        egressPolicy = "local-only",
        htmlSnapshot = null,
        extractionMode = "static",
        viewport = null,
        browserLauncher = undefined,
      } = req.body || {};

      const validation = validateDesignExtractInput({
        url,
        query,
        egressPolicy,
        htmlSnapshot,
        extractionMode,
      });

      if (!validation.ok) {
        return res.status(400).json({
          error: validation.violations[0]?.message || "Entrée Design Extract invalide.",
          trace_id: req.traceId || null,
          code: validation.violations[0]?.code || "VALIDATION_FAILED",
          violations: validation.violations,
        });
      }

      const { jobId, traceId } = designExtractJobManager.startJob({
        url,
        htmlSnapshot,
        query,
        egressPolicy,
        extractionMode,
        viewport,
        browserLauncher,
        sessionId: req.sessionId,
        browserId: req.browserId,
        traceId: req.traceId,
      });

      res.json({
        success: true,
        jobId,
        trace_id: traceId,
        stream_url: `/api/design/extract/stream/${jobId}`,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: safeError(error),
        trace_id: req.traceId || null,
      });
    }
  },
);

app.get(
  "/api/design/extract/stream/:jobId",
  requireMandatorySession,
  (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    designExtractJobManager.subscribe(
      req.params.jobId,
      req.headers["last-event-id"] || req.query.lastIndex || "0",
      res,
      { browserId: req.browserId },
    );
  },
);

app.get(
  "/api/design/extract/jobs/:jobId",
  requireMandatorySession,
  (req, res) => {
    const job = designExtractJobManager.getJob(req.params.jobId);
    if (!job || !designExtractJobManager.canAccess(req.params.jobId, req.browserId)) {
      return res.status(404).json({
        error: "Job Design Extract introuvable ou accès refusé.",
        trace_id: req.traceId || null,
      });
    }

    res.json({
      jobId: job.id,
      status: job.status,
      trace_id: job.traceId,
      url: job.url,
      events_count: job.events.length,
      meta: { trace_id: req.traceId || job.traceId, api_version: "mvp" },
    });
  },
);

app.delete(
  "/api/design/extract/jobs/:jobId",
  requireMandatorySession,
  (req, res) => {
    if (!designExtractJobManager.canAccess(req.params.jobId, req.browserId)) {
      return res.status(403).json({
        error: "Accès refusé.",
        trace_id: req.traceId || null,
      });
    }
    designExtractJobManager.abortJob(req.params.jobId);
    res.json({ success: true, trace_id: req.traceId || null });
  },
);

/**
 * Browser Harness — observation autonome (debug, audit, QA)
 */
app.post(
  "/api/browser/observe",
  requireMandatorySession,
  rateLimit(12, 60_000),
  async (req, res) => {
    try {
      const {
        url = null,
        egressPolicy = "local-only",
        viewport = null,
        captureScreenshot = false,
      } = req.body || {};

      const validation = validateObserveInput({
        url,
        egressPolicy,
        viewport,
        captureScreenshot,
        traceId: req.traceId,
      });

      if (!validation.ok) {
        return res.status(400).json({
          error: validation.violations[0]?.message || "Entrée Browser Observe invalide.",
          trace_id: req.traceId || null,
          code: validation.violations[0]?.code || "VALIDATION_FAILED",
          violations: validation.violations,
        });
      }

      const { jobId, traceId } = browserHarnessJobManager.startJob({
        url: validation.normalized.url,
        egressPolicy: validation.normalized.egressPolicy,
        viewport: validation.normalized.viewport,
        captureScreenshot: validation.normalized.captureScreenshot,
        sessionId: req.sessionId,
        browserId: req.browserId,
        traceId: req.traceId,
      });

      res.json({
        success: true,
        jobId,
        trace_id: traceId,
        stream_url: `/api/browser/observe/${jobId}/stream`,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: safeError(error),
        trace_id: req.traceId || null,
      });
    }
  },
);

app.get(
  "/api/browser/observe/:jobId/stream",
  requireMandatorySession,
  (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    browserHarnessJobManager.subscribe(
      req.params.jobId,
      req.headers["last-event-id"] || req.query.lastIndex || "0",
      res,
      { browserId: req.browserId },
    );
  },
);

app.get(
  "/api/browser/observe/:jobId",
  requireMandatorySession,
  (req, res) => {
    if (!browserHarnessJobManager.canAccess(req.params.jobId, req.browserId)) {
      return res.status(404).json({
        error: "Job Browser Harness introuvable ou accès refusé.",
        trace_id: req.traceId || null,
      });
    }

    const status = browserHarnessJobManager.getJobStatus(req.params.jobId);
    if (!status) {
      return res.status(404).json({
        error: "Job Browser Harness introuvable.",
        trace_id: req.traceId || null,
      });
    }

    res.json({
      ...status,
      meta: { trace_id: req.traceId || status.trace_id, api_version: "mvp" },
    });
  },
);

app.delete(
  "/api/browser/observe/:jobId",
  requireMandatorySession,
  (req, res) => {
    if (!browserHarnessJobManager.canAccess(req.params.jobId, req.browserId)) {
      return res.status(403).json({
        error: "Accès refusé.",
        trace_id: req.traceId || null,
      });
    }
    browserHarnessJobManager.abortJob(req.params.jobId);
    res.json({ success: true, trace_id: req.traceId || null });
  },
);

/**
 * Nexxus Design — jobs asynchrones (create + bridge Forge)
 */
app.post(
  "/api/design/create/jobs",
  requireMandatorySession,
  rateLimit(12, 60_000),
  async (req, res) => {
    try {
      const {
        query = "",
        objective = "redesign",
        referenceDna = null,
        extractEnvelope = null,
        projectTitle = null,
        emitForge = true,
      } = req.body || {};

      const validation = validateDesignCreateInput({
        query,
        objective,
        referenceDna: referenceDna || extractEnvelope,
      });

      if (!validation.ok) {
        return res.status(400).json({
          error:
            validation.violations[0]?.message || "Entrée Nexxus Design invalide.",
          trace_id: req.traceId || null,
          code: validation.violations[0]?.code || "VALIDATION_FAILED",
          violations: validation.violations,
        });
      }

      const { jobId, traceId } = nexxusDesignJobManager.startJob({
        query,
        objective,
        referenceDna: referenceDna || extractEnvelope,
        projectTitle,
        emitForge: emitForge !== false,
        sessionId: req.sessionId,
        browserId: req.browserId,
        traceId: req.traceId,
      });

      res.json({
        success: true,
        jobId,
        trace_id: traceId,
        stream_url: `/api/design/create/${jobId}/stream`,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: safeError(error),
        trace_id: req.traceId || null,
      });
    }
  },
);

app.get(
  "/api/design/create/:jobId/stream",
  requireMandatorySession,
  (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    nexxusDesignJobManager.subscribe(
      req.params.jobId,
      req.headers["last-event-id"] || req.query.lastIndex || "0",
      res,
      { browserId: req.browserId },
    );
  },
);

app.get(
  "/api/design/create/:jobId",
  requireMandatorySession,
  (req, res) => {
    if (!nexxusDesignJobManager.canAccess(req.params.jobId, req.browserId)) {
      return res.status(404).json({
        error: "Job Nexxus Design introuvable ou accès refusé.",
        trace_id: req.traceId || null,
      });
    }

    const status = nexxusDesignJobManager.getJobStatus(req.params.jobId);
    if (!status) {
      return res.status(404).json({
        error: "Job Nexxus Design introuvable.",
        trace_id: req.traceId || null,
      });
    }

    res.json({
      ...status,
      meta: { trace_id: req.traceId || status.trace_id, api_version: "mvp" },
    });
  },
);

app.delete(
  "/api/design/create/:jobId",
  requireMandatorySession,
  (req, res) => {
    if (!nexxusDesignJobManager.canAccess(req.params.jobId, req.browserId)) {
      return res.status(403).json({
        error: "Accès refusé.",
        trace_id: req.traceId || null,
      });
    }
    nexxusDesignJobManager.abortJob(req.params.jobId);
    res.json({ success: true, trace_id: req.traceId || null });
  },
);

/**
 * Design Pipeline D4 — Extract → Design Create → Forge (job orchestré)
 */
app.post(
  "/api/design/pipeline/jobs",
  requireMandatorySession,
  rateLimit(12, 60_000),
  async (req, res) => {
    try {
      const {
        url = null,
        query = "",
        objective = "redesign",
        referenceDna = null,
        extractEnvelope = null,
        extractionMode = "hybrid",
        egressPolicy = "local-only",
        htmlSnapshot = null,
        viewport = null,
        projectTitle = null,
        emitForge = true,
      } = req.body || {};

      const validation = validateDesignPipelineInput({
        url,
        query,
        objective,
        referenceDna: referenceDna || extractEnvelope,
        extractionMode,
        egressPolicy,
        htmlSnapshot,
      });

      if (!validation.ok) {
        return res.status(400).json({
          error:
            validation.violations[0]?.message || "Entrée pipeline design invalide.",
          trace_id: req.traceId || null,
          code: validation.violations[0]?.code || "VALIDATION_FAILED",
          violations: validation.violations,
        });
      }

      const { jobId, traceId } = designPipelineJobManager.startJob({
        url,
        query,
        objective,
        referenceDna: referenceDna || extractEnvelope,
        extractEnvelope,
        extractionMode,
        egressPolicy,
        htmlSnapshot,
        viewport,
        projectTitle,
        emitForge: emitForge !== false,
        sessionId: req.sessionId,
        browserId: req.browserId,
        traceId: req.traceId,
      });

      res.json({
        success: true,
        jobId,
        trace_id: traceId,
        mode: validation.mode,
        stream_url: `/api/design/pipeline/${jobId}/stream`,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: safeError(error),
        trace_id: req.traceId || null,
      });
    }
  },
);

app.get(
  "/api/design/pipeline/:jobId/stream",
  requireMandatorySession,
  (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    designPipelineJobManager.subscribe(
      req.params.jobId,
      req.headers["last-event-id"] || req.query.lastIndex || "0",
      res,
      { browserId: req.browserId },
    );
  },
);

app.get(
  "/api/design/pipeline/:jobId",
  requireMandatorySession,
  (req, res) => {
    if (!designPipelineJobManager.canAccess(req.params.jobId, req.browserId)) {
      return res.status(404).json({
        error: "Job pipeline design introuvable ou accès refusé.",
        trace_id: req.traceId || null,
      });
    }

    const status = designPipelineJobManager.getJobStatus(req.params.jobId);
    if (!status) {
      return res.status(404).json({
        error: "Job pipeline design introuvable.",
        trace_id: req.traceId || null,
      });
    }

    res.json({
      ...status,
      meta: { trace_id: req.traceId || status.trace_id, api_version: "mvp" },
    });
  },
);

app.delete(
  "/api/design/pipeline/:jobId",
  requireMandatorySession,
  (req, res) => {
    if (!designPipelineJobManager.canAccess(req.params.jobId, req.browserId)) {
      return res.status(403).json({
        error: "Accès refusé.",
        trace_id: req.traceId || null,
      });
    }
    designPipelineJobManager.abortJob(req.params.jobId);
    res.json({ success: true, trace_id: req.traceId || null });
  },
);

/**
 * Impeccable — audit qualité design (Phase E)
 */
app.post(
  "/api/impeccable/audit/jobs",
  requireMandatorySession,
  rateLimit(12, 60_000),
  async (req, res) => {
    try {
      const {
        query = "",
        target = null,
        pipelineJobId = null,
        createJobId = null,
        artifactDir = null,
        createEnvelope = null,
        extractEnvelope = null,
        browserObservation = null,
        includeVisualAudit = false,
      } = req.body || {};

      const validation = validateDesignAuditInput({
        query: query || target,
        target,
        pipelineJobId,
        createJobId,
        artifactDir,
        createEnvelope,
        extractEnvelope,
      });

      if (!validation.ok) {
        return res.status(400).json({
          error: validation.violations[0]?.message || "Entrée audit Impeccable invalide.",
          trace_id: req.traceId || null,
          code: validation.violations[0]?.code || "VALIDATION_FAILED",
          violations: validation.violations,
        });
      }

      const { jobId, traceId } = impeccableJobManager.startJob({
        query: query || target,
        target,
        pipelineJobId,
        createJobId,
        artifactDir,
        createEnvelope,
        extractEnvelope,
        browserObservation,
        includeVisualAudit: includeVisualAudit === true,
        sessionId: req.sessionId,
        browserId: req.browserId,
        traceId: req.traceId,
      });

      res.json({
        success: true,
        jobId,
        trace_id: traceId,
        stream_url: `/api/impeccable/audit/${jobId}/stream`,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: safeError(error),
        trace_id: req.traceId || null,
      });
    }
  },
);

app.get(
  "/api/impeccable/audit/:jobId/stream",
  requireMandatorySession,
  (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    impeccableJobManager.subscribe(
      req.params.jobId,
      req.headers["last-event-id"] || req.query.lastIndex || "0",
      res,
      { browserId: req.browserId },
    );
  },
);

app.get(
  "/api/impeccable/audit/:jobId",
  requireMandatorySession,
  (req, res) => {
    if (!impeccableJobManager.canAccess(req.params.jobId, req.browserId)) {
      return res.status(404).json({
        error: "Job Impeccable introuvable ou accès refusé.",
        trace_id: req.traceId || null,
      });
    }

    const status = impeccableJobManager.getJobStatus(req.params.jobId);
    if (!status) {
      return res.status(404).json({
        error: "Job Impeccable introuvable.",
        trace_id: req.traceId || null,
      });
    }

    res.json({
      ...status,
      meta: { trace_id: req.traceId || status.trace_id, api_version: "mvp" },
    });
  },
);

app.get(
  "/api/impeccable/latest",
  requireMandatorySession,
  (req, res) => {
    const snapshot = getImpeccableCockpitSnapshot(req.sessionId);
    res.json({
      snapshot: snapshot || null,
      meta: { trace_id: req.traceId || null },
    });
  },
);

app.delete(
  "/api/impeccable/audit/:jobId",
  requireMandatorySession,
  (req, res) => {
    if (!impeccableJobManager.canAccess(req.params.jobId, req.browserId)) {
      return res.status(403).json({
        error: "Accès refusé.",
        trace_id: req.traceId || null,
      });
    }
    impeccableJobManager.abortJob(req.params.jobId);
    res.json({ success: true, trace_id: req.traceId || null });
  },
);

/**
 * Route d'URGENCE pour stopper l'IA — protégée par token (SEC-04)
 */
app.post("/api/stop", requireLocalOperator, async (req, res) => {
  try {
    ollama.stopAll();
    res.json({ success: true, message: "IA Interrompue" });
  } catch (error) {
    res.status(500).json({ success: false, message: safeError(error) });
  }
});

/**
 * Endpoint pour décharger un modèle — protégé par token (SEC-04)
 */
app.post("/api/unload", requireLocalOperator, async (req, res) => {
  const { modelName } = req.body;
  if (!modelName || typeof modelName !== "string") {
    return res
      .status(400)
      .json({ success: false, message: "modelName requis." });
  }
  try {
    if (modelName === "current") {
      const result = await vramManager.unloadAll();
      return res.json({ success: result.success });
    }
    const success = await ollama.unloadModel(modelName);
    res.json({ success });
  } catch (error) {
    res.status(500).json({ success: false, message: safeError(error) });
  }
});

/**
 * Observabilité : Monitoring de la performance de l'API Sessions
 */
app.use("/api/sessions", (req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (duration > 50) {
      // Log de performance si > 50ms
      console.log(
        `[Sentinelle API] ${req.method} ${req.originalUrl} - ${duration}ms`,
      );
    }
  });
  next();
});

app.use("/api/sessions", requireSessionAccess);

/**
 * Endpoints pour la gestion des SESSIONS
 */
app.get("/api/sessions", async (req, res) => {
  const routeStart = Date.now();
  const timings = { cache: "miss", dbMs: 0, serializeMs: 0 };

  try {
    let sessions = getSessionListCache(req.browserId);

    if (sessions) {
      timings.cache = "hit";
    } else {
      const dbStart = Date.now();
      sessions = await sessionRepository.listAccessibleWithPreview(
        req.browserId,
      );
      timings.dbMs = Date.now() - dbStart;
      setSessionListCache(req.browserId, sessions);
    }

    const serializeStart = Date.now();
    res.json(sessions);
    timings.serializeMs = Date.now() - serializeStart;

    const totalMs = Date.now() - routeStart;
    if (totalMs > 50) {
      console.log(
        `[Sentinelle API] GET /api/sessions - ${totalMs}ms`,
        timings,
      );
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/sessions/:id", async (req, res) => {
  try {
    const session = await sessionRepository.findById(req.params.id);
    if (!session) return res.status(404).json({ error: "Session non trouvée" });

    // Récupérer les événements pour reconstruire l'histoire
    const events = await eventRepository.getEventsBySession(req.params.id);

    // Récupérer le dernier snapshot pour les métriques de maturité et l'état UI persisté
    const latestSnapshot = await snapshotRepository.getLatestSnapshot(
      req.params.id,
    );
    const uiState = latestSnapshot?.state?.ui_state || {};
    const validation = latestSnapshot
      ? latestSnapshot.state
      : { metrics: { score: 0, missing: [] }, signals: { forge_ready: false } };

    // Formatage pour le frontend (Support de la persistance Forge)
    const feedbackEvents = events.filter(
      (e) => e.event_type === "user_feedback",
    );
    const conversationEvents = events.filter(
      (e) => e.event_type === "user_message" || e.event_type === "ai_response",
    );

    const formattedSession = {
      id: session.id,
      title: session.title,
      timestamp: session.created_at,
      projectGoal: uiState.projectGoal || "",
      validation,
      forge: {
        logs: uiState.logs || [],
        output: uiState.output || "",
        history:
          uiState.history && uiState.history.length > 0
            ? uiState.history
            : conversationEvents
                .filter((e) => e.event_type === "ai_response")
                .map((e) => ({
                  role: "assistant",
                  content: e.payload_json?.content,
                })),
        completedPhases: uiState.completedPhases || [],
        isReadyForProduction:
          uiState.isReadyForProduction || validation.forge_ready || false,
      },
      mentor: {
        messages:
          uiState.messages && uiState.messages.length > 0
            ? uiState.messages
            : conversationEvents.map((e) => ({
                role: e.event_type === "user_message" ? "user" : "assistant",
                content: e.payload_json?.content,
              })),
      },
      feedback: feedbackEvents.map((e) => ({
        rating: e.payload_json?.rating,
        comment: e.payload_json?.comment,
        timestamp: e.created_at || null,
      })),
    };

    res.json(formattedSession);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.use("/api/sessions", sessionDocumentAnalysisRouter);

app.post("/api/sessions/:id", async (req, res) => {
  try {
    const { title, forge, mentor } = req.body;

    // 1. Sauvegarde du titre (Base Project)
    await sessionRepository.save(
      req.params.id,
      title || "Projet Nexxus Citadel",
    );

    // 2. Persistance de l'état UI complet (V2.0 Core Persistence)
    if (forge || mentor || req.body.projectGoal !== undefined) {
      const latestSnapshot = await snapshotRepository.getLatestSnapshot(
        req.params.id,
      );
      const currentMaturity = latestSnapshot?.state || {
        metrics: { score: 0, missing: [] },
      };

      const uiSyncState = {
        ...currentMaturity,
        ui_state: {
          logs: (forge?.logs || []).slice(-1000), // Cap logs (1000 last)
          output: (forge?.output || "").slice(0, 50000), // Cap Markdown (50k chars)
          completedPhases: forge?.completedPhases,
          isReadyForProduction: forge?.isReadyForProduction,
          messages: mentor?.messages,
          projectGoal: (req.body.projectGoal || "").slice(0, 2000), // Cap Briefing (2k chars)
        },
      };

      await snapshotRepository.saveSnapshot(
        req.params.id,
        uiSyncState,
        latestSnapshot?.event_version || 0,
      );
    }

    invalidateSessionListCache(req.browserId);
    res.json({ success: true, id: req.params.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



app.post("/api/sessions/:id/feedback", async (req, res) => {
  try {
    const sessionId = req.params.id;
    const { rating, comment = "" } = req.body;
    const allowedRatings = ["useful", "unhelpful", "neutral"];

    if (!rating || !allowedRatings.includes(rating)) {
      return res.status(400).json({
        error: "Rating invalide. Utilisez useful, unhelpful ou neutral.",
      });
    }

    await runtimeService.recordEvent(
      sessionId,
      {
        type: "user_feedback",
        actor: "user",
        family: "FEEDBACK",
        payload: { rating, comment: String(comment || "").slice(0, 1000) },
      },
      req.browserId,
    );

    void applyWebCandidateSessionFeedback({
      sessionId,
      rating,
      comment,
    }).catch((err) =>
      console.error("[WebCandidateMemory] feedback:", err.message),
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Feedback error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/sessions/:id", async (req, res) => {
  try {
    const success = await sessionRepository.delete(req.params.id);
    if (success) {
      await sessionAccessService.release(req.params.id);
      invalidateSessionListCache(req.browserId);
    }
    res.json({ success });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Endpoint spécial pour la création de projet (Action)
 */
const PROJECTS_ROOT = path.resolve(__dirname, "../projects");

/**
 * Endpoint pour l'Explorateur Global (Toutes les forges)
 */
app.get("/api/forge/global/artifacts", requireLocalOperator, async (req, res) => {
  try {
    const tree = await scanProjectDirectory(PROJECTS_ROOT);
    res.json({
      tree,
      qa: null,
      workspace: "Global Root",
    });
  } catch (error) {
    console.error("[API:GlobalArtifacts] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Endpoint pour le monitoring des artefacts Forge
 */
app.get("/api/sessions/:id/forge/artifacts", async (req, res) => {
  try {
    const sessionId = req.params.id;

    // 1. Trouver le titre du projet pour identifier le dossier
    const handoffs = await handoffRepository.findBySessionId(sessionId);
    if (!handoffs || handoffs.length === 0) {
      return res.json({
        tree: [],
        qa: null,
        message: "Aucun handoff trouvé pour cette session.",
      });
    }

    // On prend le dernier handoff réussi ou en cours
    const lastHandoff = handoffs.sort((a, b) => b.id - a.id)[0];
    const projectTitle =
      lastHandoff.handoff_data?.project_summary?.projectTitle ||
      lastHandoff.handoff_data?.projectTitle ||
      "unknown";

    const slug = projectTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const projectPath = path.join(PROJECTS_ROOT, slug);
    console.log(`[API:Artifacts] Scanning project: ${projectPath}`);

    // 2. Scanner le répertoire et charger le QA
    const tree = await scanProjectDirectory(projectPath);
    const qa = await loadQAAudit(projectPath);

    res.json({
      tree,
      qa,
      workspace: slug,
    });
  } catch (error) {
    console.error("[API:Artifacts] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Endpoint pour lire le contenu d'un artefact spécifique
 */
app.get("/api/sessions/:id/forge/artifacts/content", async (req, res) => {
  try {
    const sessionId = req.params.id;
    const filePath = req.query.path; // Chemin relatif (ex: architecture.md)

    if (!filePath) return res.status(400).json({ error: "Chemin requis" });

    // 1. Trouver le slug (dossier projet)
    const handoffs = await handoffRepository.findBySessionId(sessionId);
    if (!handoffs || handoffs.length === 0) {
      return res.status(404).json({ error: "Dossier projet introuvable." });
    }

    const lastHandoff = handoffs.sort((a, b) => b.id - a.id)[0];
    const projectTitle =
      lastHandoff.handoff_data?.project_summary?.projectTitle ||
      lastHandoff.handoff_data?.projectTitle ||
      "unknown";

    const slug = projectTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    // 2. Sécuriser le chemin (Prévenir Directory Traversal)
    const baseDir = path.resolve(path.join(PROJECTS_ROOT, slug));
    const resolvedPath = path.resolve(baseDir, filePath);

    if (
      !resolvedPath.startsWith(baseDir + path.sep) &&
      resolvedPath !== baseDir
    ) {
      return res.status(403).json({ error: "Accès refusé." });
    }

    // 3. Lire le fichier
    const content = await fs.promises.readFile(resolvedPath, "utf8");
    res.json({ content });
  } catch (error) {
    console.error("[API:ArtifactContent] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 🏥 Health Check Endpoint (Industrial Grade)
 */
app.get("/api/health", (req, res) => {
  const ctx = getHealthProbeContext();
  const ready = evaluateReady(ctx);
  const live = evaluateLive(ctx);
  res.status(live.httpStatus).json({
    status: ready.ok ? "ready" : "not_ready",
    probes: {
      live: live.status,
      startup: evaluateStartup(ctx).status,
      ready: ready.status,
    },
    trace_id: ctx.bootTraceId,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    endpoints: {
      live: "/api/health/live",
      startup: "/api/health/startup",
      ready: "/api/health/ready",
    },
  });
});

app.get("/api/hooks/state", requireSessionAccess, (req, res) => {
  res.json(securityHooks.getState());
});

app.post(
  "/api/hooks/activate",
  requireSessionAccess,
  rateLimit(30, 60_000),
  (req, res) => {
    const { hook } = req.body;
    if (!hook || typeof hook !== "string") {
      return res.status(400).json({ error: "hook requis." });
    }
    securityHooks.activate(hook);
    res.json({ success: true, hook, action: "activated" });
  },
);

app.post(
  "/api/hooks/deactivate",
  requireSessionAccess,
  rateLimit(30, 60_000),
  (req, res) => {
    const { hook } = req.body;
    if (!hook || typeof hook !== "string") {
      return res.status(400).json({ error: "hook requis." });
    }
    securityHooks.deactivate(hook);
    res.json({ success: true, hook, action: "deactivated" });
  },
);

// Support fallback path
app.get("/api/ping", (req, res) => {
  res.json({
    status: "ready",
    uptime: process.uptime(),
    timestamp: Date.now(),
    version: "4.5.0-industrial",
  });
});

app.get("/api/forge/global/artifacts/content", requireLocalOperator, async (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) return res.status(400).json({ error: "Chemin requis" });

    const resolvedPath = path.resolve(PROJECTS_ROOT, filePath);
    // SEC-FIX: Ajout du séparateur pour bloquer la faille Path Traversal (LFI)
    if (!resolvedPath.startsWith(PROJECTS_ROOT + path.sep) && resolvedPath !== PROJECTS_ROOT) {
      return res.status(403).json({ error: "Accès refusé." });
    }

    const content = await fs.promises.readFile(resolvedPath, "utf8");
    res.json({ content });
  } catch (error) {
    console.error("[API:GlobalArtifactContent] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post(
  "/api/build",
  requireInternalToken,
  rateLimit(5, 60_000),
  async (req, res) => {
    const { projectName, files } = req.body;

    // SEC-03 : Validation et assainissement du projectName
    if (!projectName || typeof projectName !== "string") {
      return res
        .status(400)
        .json({ success: false, message: "projectName requis." });
    }
    const safeProjectName = projectName
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64);
    if (!safeProjectName) {
      return res
        .status(400)
        .json({ success: false, message: "projectName invalide." });
    }
    if (!Array.isArray(files) || files.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "files[] requis et non vide." });
    }

    try {
      const result = await projectBuilder.build(safeProjectName, files);
      res.json({ success: true, message: result });
    } catch (error) {
      res.status(500).json({ success: false, message: safeError(error) });
    }
  },
);

/**
 * Endpoint de Scan des Projets (Maturité)
 */
app.get("/api/projects/scan", requireLocalOperator, async (req, res) => {
  try {
    const projects = await projectScanner.scanProjects();
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: "Échec du scan des projets." });
  }
});

/**
 * Endpoint de Promotion de Projet (Stage-Gate)
 */
app.post("/api/projects/promote", requireLocalOperator, async (req, res) => {
  const { projectId } = req.body;
  if (!projectId) return res.status(400).json({ error: "projectId requis." });

  try {
    const result = await projectMemoryPromoter.promote(projectId);
    res.json(result);
  } catch (error) {
    console.error("[PromoteAPI] Error:", error.message);
    res.status(500).json({ error: error.message || "Échec de la promotion." });
  }
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "Fichier trop volumineux (maximum 10 Mo)."
        : err.message;
    return res.status(400).json({ error: message, code: "UPLOAD_REJECTED" });
  }
  if (err?.message?.includes("Type de fichier")) {
    return res.status(400).json({
      error: err.message,
      code: "UPLOAD_REJECTED",
    });
  }
  if (
    err?.code === UPLOAD_REJECTION_CODES.DOUBLE_EXTENSION ||
    err?.message?.includes("Upload refusé (sécurité)")
  ) {
    return res.status(403).json({
      error: err.message,
      code: UPLOAD_REJECTION_CODES.DOUBLE_EXTENSION,
    });
  }
  next(err);
});

scheduleArtifactCleanup();

const server = app.listen(PORT, () => {
  console.log(`Nexxus Studio Backend running on http://localhost:${PORT}`);
});

// --- RESILIENCE SHUTDOWN HANDLER (v3.6) ---
const gracefulShutdown = (signal) => {
  console.log(
    `\n[Server] 🛑 Signal ${signal} reçu. Fermeture de La Citadelle...`,
  );

  // 1. Arrêter d'accepter de nouvelles requêtes
  server.close(async () => {
    console.log("[Server] ✅ HTTP Server fermé.");

    try {
      // 2. Cleanup des ressources
      console.log("[Server] 🧹 Nettoyage des processus IA en cours...");
      await ollama.stopAll();

      console.log("[Server] 👋 Shutdown terminé avec succès.");
      process.exit(0);
    } catch (err) {
      console.error("[Server] ❌ Erreur lors du shutdown:", err);
      process.exit(1);
    }
  });

  // Sécurité : forcer le kill après 5s si ça traîne (Anti-Zombie)
  setTimeout(() => {
    console.error("[Server] ⚠️ Shutdown trop long (Timeout 5s), force exit.");
    process.exit(1);
  }, 5000);
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
