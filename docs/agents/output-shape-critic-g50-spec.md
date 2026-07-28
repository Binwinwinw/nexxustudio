# G50 — Output Shape Critic — Mini-spec doctrine

**État** : 23/07/2026 — doctrine figée, implémentation **observe-first** (pas d’enforcement).  
**Famille** : contrat de sortie / preuve / rendu.  
**Voisins** : [posture-deliverable-epistemic-spec-v1.md](./posture-deliverable-epistemic-spec-v1.md), `deliverableContractPolicy.js` (P0.1), ADR Posture/Deliverable.

---

## Doctrine (une phrase)

> **Le LLM produit le fond sous contrainte ; il n’arbitre pas le mode d’affichage.**

Sépare obligatoirement :

| Couche | Responsable | Exemple |
|--------|-------------|---------|
| **Contenu** | LLM / analyseur | Findings, recommandations |
| **Preuve** | Contrat + critic | Extrait ancré, tableau, rien |
| **Rendu** | Renderer UI | Fence indenté, table native |
| **Action** | Consentement + sandbox | Exécuter / appliquer patch — jamais par défaut |

---

## Problème

Sans critique de forme :

- le modèle mélange prose et HTML échappé (`\<a href=…>`) ;
- « audit » déclenche parfois un mur de code inutile ;
- on confond **pouvoir formater** et **savoir quand formater**.

La capacité technique (fence, table, execute) ne suffit pas : il faut un **jugement de restitution**.

---

## Décision

Introduire un **Output Shape Critic** (G50) : couche légère **après** le contrat de sortie (`promisedValue` / `replyShape` conversationnel), **avant** le renderer final.

```
route (famille / attachmentTask)
  → DeliverableContract (valeur promise)
  → OutputShapeCritic (forme de preuve)
  → renderer (matérialise)
```

Ce n’est **pas** un second EPISTEMIC lourd.  
Ce n’est **pas** l’exécution de code dans le chat.  
C’est un arbitre de **forme de preuve**.

---

## Formes autorisées (v1)

| `evidenceShape` | Quand | Interdit |
|-----------------|-------|----------|
| `prose_only` | Constat simple, peu de dimensions | Snippet décoratif |
| `table` | Comparaison multi-critères (≥2 axes, ≥2 lignes utiles) | Tableau 1×1 = prose |
| `code_snippet` | Finding ancré sur source visible | Extrait > 12 lignes ; HTML échappé inline |
| `no_snippet` | Asset / runtime non lu (« non visible dans ce fichier ») | Faux snippet inventé |
| `action_block` | Patch / run proposé — **opt-in utilisateur** seulement | `execute=true` sans consentement |

Extension future (hors v1) : `patch_preview`, `metrics_chart` — seulement si le critic les autorise.

---

## Règles de déclenchement (simples)

1. **`security_audit` / `code_review` + PJ courte** → défaut `prose_only` ; max **1–2** `code_snippet` si finding ancré.
2. **Finding avec evidence texte ≤ 12 lignes** → `code_snippet` fencé (`html`/`php`/`js`…), indentation préservée.
3. **Référence hors inventaire PJ** → `no_snippet` + mention soft-guard (déjà P1.1).
4. **Comparaison / matrice** (sévérité × composant × impact) → `table`.
5. **Demande explicite d’exécution** → `action_block` candidate ; run seulement après consentement UI (hors scope G50 v1).
6. **Amalgame détecté** (backslash-escaped tags, fence sans langage, chaîne > 200 chars sans `\n`) → **rejeter** la forme code ; forcer `prose_only` ou re-extrait.

---

## Contrat JSON (observe)

```json
{
  "$schema": "output-shape-contract/v1",
  "family": "output_shape",
  "version": 1,
  "mode": "observe",
  "evidenceShape": "prose_only",
  "allowedShapes": ["prose_only", "code_snippet", "no_snippet"],
  "maxSnippets": 2,
  "maxSnippetLines": 12,
  "reasons": ["security_audit_short_html"],
  "blockedShapes": ["action_block"],
  "telemetry": {
    "rule": "output_shape_critic_g50",
    "enforcement": false
  }
}
```

Hook pipeline cible (après DeliverableContract) :

```
[PIPELINE] output_shape=prose_only maxSnippets=2 enforce=false
```

---

## Relation avec DeliverableContract

| Concept | Rôle |
|---------|------|
| `promisedValue` | *Quoi* on promet (advice, patch, explanation…) |
| `replyShape` (actuel) | Forme **conversationnelle** (menu, care, short_open…) |
| `evidenceShape` (G50) | Forme de **preuve / restitution technique** |

G50 **n’écrase pas** les shapes sociales ; il complète les tours `DOCUMENT_ATTACHED`, `security_audit`, `code_*`, analyses repo.

---

## Phases

| Phase | Comportement |
|-------|----------------|
| **P0 observe** | Émettre `evidenceShape` + télémétrie ; ne pas réécrire la réponse |
| **P0.1 sanitize soft** | Détecter amalgames code ; suffixe / note, pas kill du livrable (`overrideLocked`) |
| **P1 enforce** | Composer / finalRenderer bornés aux shapes autorisées ; fence obligatoire |

---

## Non-objectifs (v1)

- Sandbox d’exécution JS/PHP dans le chat  
- Tables interactives riches (tri/filtre) — rendu markdown structuré suffit en P0  
- Remplacer React Doctor / analyseurs HTML — le critic choisit la **forme**, pas l’outil d’analyse  

---

## Exemple canonique

**Requête** : « analyse le fichier joint pour un audit sécurité » + `maintenance.html`

| Décision | Valeur |
|----------|--------|
| Route | `attachment_task_full_pipeline` / `security_audit` |
| `evidenceShape` | `prose_only` (+ optionnel 1 snippet) |
| Snippet autorisé | uniquement le `<a href="index.html">…</a>` si finding « contournement maintenance » |
| Interdit | Mur HTML échappé, faux `home.css`, tableau vide |

---

## Critères d’acceptation

- [ ] Doctrine relue dans ce fichier + ADR  
- [ ] Module `outputShapeCriticPolicy.js` (observe) branché pipeline  
- [ ] Télémétrie console `output_shape=…`  
- [ ] Tests : security_audit court → pas `action_block` ; amalgame `\<a` → bloqué en observe  
- [ ] Pas de régression soft-guard PJ (`append_only`)

---

## Références

- ADR : `citadelle-vault/.../adr/ADR-20260723-Output-Shape-Critic-G50-v1.md`
- Soft-guard PJ : `fileContextGuard.js` (précédence livrable)
- Attachment tasks : `attachmentTaskPolicy.js` (`security_audit`, …)
