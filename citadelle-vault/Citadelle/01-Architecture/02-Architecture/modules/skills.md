# Module — Skills Plateforme (Runtime Citadelle)

**Statut** : Actif | **Version hub** : v1.6 | **Généré** : 2026-05-30T06:41:20.493Z

## Liens

- Hub opérationnel : [Hub SKILLS.md](../../../../server/data/skills/SKILLS.md)
- Télémétrie JSON : [skills-dashboard.json](../../04-Operations/reports/skills-dashboard.json)
- Schéma meta : `server/src/agent/contracts/skillMeta.schema.json`

## Synthèse

| Métrique | Valeur |
|----------|--------|
| Total skills | 26 |
| Runtime-backed | 18 |
| Prompt-only | 8 |
| Sub-skills ADR-008 | 4 |
| Erreurs CI | 0 |
| Avertissements CI | 0 |

## Couverture Vague 2

- PDF : ✅
- Egress : ✅
- Memory : ✅
- Quality : ✅

## Index runtime-backed

- **skill-007-orchestrator** : server/src/agent/orchestrator/SovereignOrchestrator.js → SovereignOrchestrator
- **skill-conversation-stability** : server/src/agent/telemetry/conversationHealthScore.js → computeHealthScore
- **skill-document-analysis** : citadelle-vault/Citadelle/03-Forge/document-analysis.js → documentAnalysis; server/src/agent/utils/contextAgent.js → default
- **skill-egress-security** : server/src/services/tool-output-sanitizer.js → sanitizeToolOutput; server/src/agent/agents/expertWebSearch.js → expertWebSearch; server/src/services/webSummarizer.js → summarizeWebPage
- **skill-epistemic-refusal** : server/src/agent/config/modeResponseContracts.js → INSUFFICIENT_SIGNAL_REFUSAL; server/src/agent/config/modeResponseContracts.js → evaluateEpistemicRefusal
- **skill-hybrid-retrieval** : server/src/retrieval/hybrid-retrieval.js → HybridRetrieval; server/src/retrieval/hybrid-retrieval.js → reciprocalRankFusion; server/src/retrieval/hybrid-retrieval.js → default
- **skill-intent-routing** : server/src/agent/utils/skillLoader.js → default; server/src/agent/config/intentContractRegistry.js → resolveIntentContract
- **skill-makers-checker** : server/src/verification/makersChecker.js → MakersChecker; server/src/verification/makersChecker.js → default
- **skill-mcp-bridge** : server/src/mcp/mcp-bridge.js → connectMcpServer; server/src/mcp/mcp-bridge.js → callMcpTool; server/src/mcp/mcp-bridge.js → registerMcpServers; server/src/mcp/mcp-bridge.js → validateMcpManifest
- **skill-memory-governance** : server/src/agent/memory/guardianship/curatedMemoryGate.js → assessMemoryEligibility; server/src/agent/memory/guardianship/memoryPromotionPolicy.js → assessPromotionEligibility
- **skill-obsidian-governance** : server/src/wiki/ingest_wiki_adrs.js → ingestAdr; server/src/wiki/ingest_wiki_adrs.js → batchIngestAdr; server/src/wiki/wiki_compiler.js → compileWikiFromVault
- **skill-pdf-extraction** : server/src/services/pdf-extractor.js → extractTextFromPdf; server/src/agent/utils/contextAgent.js → default
- **skill-quality-gate** : server/src/quality/quality-gate.js → runQualityGate; server/src/quality/quality-gate.js → generateGateReport; server/src/quality/conversationHealthScore.js → conversationHealthScore; server/src/quality/skillTriggerMatrixData.js → evaluateSkillTriggerAccuracy
- **skill-rag-ingestion** : server/src/wiki/ingest_wiki_adrs.js → ingestWikiChunksToHub; server/src/wiki/ingest_wiki_adrs.js → loadWikiRagChunks
- **skill-telemetry-observability** : server/src/ops/telemetry-observability.js → TelemetryObservability; server/src/ops/telemetry-observability.js → generateAlerts; server/src/agent/telemetry/telemetryPersistor.js → default; server/src/agent/telemetry/conversationHealthScore.js → computeHealthScore
- **skill-upload-security** : shared/uploadGuards.js → validateDoubleExtension; server/src/agent/utils/conversationGuards.js → isPureSocial
- **skill-vision-sota** : server/src/services/pdf-extractor.js → processPdfAttachment
- **skill-wiki-compiler** : server/src/wiki/wiki_compiler.js → compileWiki; server/src/wiki/wiki_compiler.js → generateIndex; server/src/wiki/wiki_compiler.js → compileWikiFromVault

## Sub-skills Obsidian (ADR-008)

Parent : `skill-obsidian-governance`

- `skill-hybrid-retrieval` ← parent `skill-rag-ingestion`
- `skill-obsidian-canvas` ← parent `skill-obsidian-governance`
- `skill-obsidian-cli` ← parent `skill-obsidian-governance`
- `skill-obsidian-markdown` ← parent `skill-obsidian-governance`

---

*Document généré automatiquement — ne pas éditer manuellement sans resync `npm run vault:sync`.*
