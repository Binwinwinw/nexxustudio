import { Router } from "express";
import { getSecurityTelemetry } from "../services/securityTelemetryService.js";

const router = Router();

router.get("/telemetry", (_req, res) => {
  try {
    res.json(getSecurityTelemetry());
  } catch (err) {
    console.error("[SecurityTelemetry] Error:", err.message);
    res.status(500).json({ error: "Impossible de charger la télémétrie sécurité." });
  }
});

export default router;
