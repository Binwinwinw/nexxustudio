import express from "express";
import {
  buildIntentTriageDashboardPayload,
} from "../services/intentTriageDashboardService.js";
import { loadFeedbackEntries } from "../agent/classifiers/intentTriageAmbiguousAnalyzer.js";
import { getIntentTriageFeedbackPath } from "../agent/classifiers/intentTriageFeedbackRecorder.js";

const router = express.Router();

router.get("/dashboard", (req, res) => {
  try {
    const refresh = req.query.refresh === "1";
    const limit = req.query.limit;
    const payload = buildIntentTriageDashboardPayload({ refresh, limit });
    res.json(payload);
  } catch (err) {
    console.error("[intent-triage/dashboard]", err);
    res.status(500).json({ error: "Impossible de charger le dashboard triage." });
  }
});

router.get("/feedback/recent", (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
    const entries = loadFeedbackEntries(getIntentTriageFeedbackPath());
    const recent = [...entries]
      .sort((a, b) => String(b.recorded_at).localeCompare(String(a.recorded_at)))
      .slice(0, limit);
    res.json({
      total: entries.length,
      feedback_path: getIntentTriageFeedbackPath(),
      entries: recent,
    });
  } catch (err) {
    console.error("[intent-triage/feedback]", err);
    res.status(500).json({ error: "Impossible de lire le feedback triage." });
  }
});

export default router;
