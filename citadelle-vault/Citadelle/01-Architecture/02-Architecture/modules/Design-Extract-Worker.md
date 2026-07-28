# Module : Design Extract Worker (v2)

**Statut** : spec validée — 27/05/2026  
**Skill** : `skill-design-extract`  
**Intent** : `DESIGN_EXTRACT`  
**ADR parent** : [[ADR-20260601-Suite-Design-Nexxus]]

---

## 1. Positionnement

Design Extract est la **couche d'observation ancrée** du trio design Citadelle :

```
Extract (ADN réel) → Nexxus Design (transposition) → Forge (matérialisation) → Impeccable (gate)
```

**Doctrine** : grounding avant génération, fail-closed, pas de couche spéculative.

| État | Périmètre |
|------|-----------|
| **v1 livré** | Fetch HTML + analyse cheerio statique, jobs async, envelope JSON/MD, egress gouverné |
| **v2 cible** | Crawl DOM + `getComputedStyle`, clustering couleurs/typo, golden tests sans LLM |

---

## 2. Pipeline opératoire (v2)

### Étapes séquentielles

| Step ID | Nom | Entrée | Sortie | Fail-closed |
|---------|-----|--------|--------|-------------|
| `design.extract.validate` | Validation entrée + egress | `{ url?, htmlSnapshot?, egressPolicy }` | OK / violations | Oui |
| `design.extract.fetch` | Fetch HTML gouverné | URL autorisée | `html`, `fetched_at` | Oui si timeout / HTML < 120 octets |
| `design.extract.snapshot` | Snapshot DOM (browser harness) | HTML rendu | `dom_snapshot`, viewport meta | Dégradé → v1 statique |
| `design.extract.styles` | Styles calculés | DOM + sélecteurs cibles | `computed_styles[]` | Incertitude si harness absent |
| `design.extract.cluster` | Clustering tokens | styles bruts | `tokens` structurés | Oui si palette vide ET typo vide |
| `design.extract.patterns` | Patterns layout / composants | DOM + classes | `patterns`, `layout_signatures` | Non (signal partiel OK) |
| `design.extract.editorial` | Ton éditorial | meta, h1–h3, CTA text | `editorial_tone` | Non |
| `design.extract.pack` | Envelope + artefacts | analyse agrégée | JSON + MD + `reproduction_prompt` | Oui |

### Sélecteurs cibles (browser harness)

Échantillonner au maximum **120 nœuds** pour limiter le coût :

```
html, body, header, nav, main, section, article, footer, aside,
h1, h2, h3, p, a, button, [role="button"], input, label,
[class*="btn"], [class*="card"], [class*="hero"], [class*="nav"]
```

Propriétés CSS extraites via `getComputedStyle` :

- `color`, `background-color`, `border-color`
- `font-family`, `font-size`, `font-weight`, `line-height`, `letter-spacing`
- `padding-*`, `margin-*`, `gap`
- `border-radius`, `box-shadow`
- `display`, `grid-template-columns`, `flex-direction` (signatures layout)

### Modes d'exécution

| Mode | Quand | Moteur |
|------|-------|--------|
| `static` | Harness indisponible ou `htmlSnapshot` inline | cheerio v1 |
| `rendered` | URL locale (`local-only`) ou crawl autorisé | Playwright / browser harness |
| `hybrid` | static + rendered merge | v2 par défaut en prod |

---

## 3. Schéma JSON — Envelope ADN (v2.0.0)

```json
{
  "version": "2.0.0",
  "kind": "nexxus.design.extract_result",
  "skill_id": "skill-design-extract",
  "source": {
    "url": "http://127.0.0.1:5173/",
    "fetched_at": "2026-05-27T12:00:00.000Z",
    "extraction_mode": "rendered",
    "viewport": { "width": 1440, "height": 900 }
  },
  "tokens": {
    "colors": {
      "primary": "#0f172a",
      "accent": "#6366f1",
      "surface": "#f8fafc",
      "text": "#1e293b",
      "palette_ranked": [
        { "hex": "#0f172a", "role": "primary", "frequency": 42, "sources": ["body", "header"] }
      ]
    },
    "typography": {
      "families": [
        { "name": "Inter", "roles": ["body", "heading"], "sizes_px": [14, 16, 24, 32] }
      ],
      "scale": [12, 14, 16, 20, 24, 32, 48]
    },
    "spacing": {
      "scale_px": [4, 8, 12, 16, 24, 32, 48],
      "dominant_gap": "16px"
    },
    "radius": { "values_px": [4, 8, 12, 16], "dominant": "8px" },
    "shadows": [
      { "value": "0 4px 12px rgba(15,23,42,0.12)", "frequency": 8 }
    ]
  },
  "layout_signatures": [
    { "pattern": "header+main+footer", "confidence": 0.92 },
    { "pattern": "sidebar+main", "confidence": 0.0 }
  ],
  "patterns": [
    { "name": "hero", "class_hint": "hero", "count": 1, "sample_selector": "section.hero" },
    { "name": "btn-primary", "class_hint": "btn-primary", "count": 3 }
  ],
  "dna_dossier": {
    "palette": [],
    "typography": {},
    "spacing_rhythm": [],
    "layout_sections": [],
    "cta_patterns": [],
    "component_patterns": [],
    "editorial_tone": {},
    "tech_stack_hints": []
  },
  "reproduction_prompt": "Refonte fidèle au style source observé...",
  "signals": {
    "palette": 6,
    "typography": 2,
    "sections": 4,
    "cta": 3,
    "computed_nodes": 87
  },
  "uncertainties": [
    "CSS externe non chargé en mode static"
  ],
  "quality_gate": {
    "score": 78,
    "merge_ok": true,
    "blockers": []
  },
  "generated_at": "2026-05-27T12:00:05.000Z"
}
```

### Règles de compatibilité v1 → v2

- `version` passe de `1.0.0` à `2.0.0` ; consommateurs Nexxus Design acceptent les deux.
- `tokens.colors` v1 (array plat) → v2 objet structuré ; adapter `buildDesignCreateEnvelope` avec normaliseur.
- `extraction_mode` absent en v1 → traiter comme `static`.

---

## 4. Heuristiques de clustering

### 4.1 Couleurs

1. **Collecte** : toutes valeurs `color`, `background-color`, `border-color` (computed + inline + `<style>`).
2. **Normalisation** : convertir rgb/hsl → hex 6 digits ; ignorer `transparent`, `inherit`, `#fff`/`#000` si fréquence > 80 % (bruit).
3. **Quantification** : regrouper par distance ΔE < 12 (CIE76 simplifié) ou bucket RGB ±8.
4. **Rôles** :
   - `primary` : couleur la plus fréquente sur `body`, `header`, `nav`
   - `accent` : couleur dominante sur `button`, `.btn`, `[role="button"]`, liens CTA
   - `surface` : `background-color` dominant sur `main`, `.card`, `section`
   - `text` : `color` dominant sur `p`, `body`
5. **Seuil minimum** : ≥ 3 couleurs distinctes post-cluster OU fail-closed `INSUFFICIENT_PALETTE`.

### 4.2 Typographie

1. **Collecte** : `font-family`, `font-size`, `font-weight`, `line-height` sur h1–h3, body, boutons.
2. **Nettoyage** : retirer fallbacks génériques (`sans-serif`, `system-ui`) ; garder première famille nommée.
3. **Regroupement** : même famille → union des `sizes_px` triés.
4. **Échelle** : déduire scale modulaire (ratio ~1.25) ; arrondir à 1 px près.
5. **Seuil** : ≥ 1 famille + ≥ 2 tailles distinctes.

### 4.3 Espacement (rythme)

1. **Collecte** : `padding`, `margin`, `gap` sur sections, cards, grilles.
2. **Normalisation** : tout convertir en px (base 16px pour rem).
3. **Scale** : fréquence des valeurs → top 8 ; détecter multiple commun (4 ou 8 px).
4. **dominant_gap** : valeur la plus fréquente sur flex/grid containers.

### 4.4 Layout signatures

Heuristiques structurelles (sans ML) :

| Signature | Condition DOM |
|-----------|---------------|
| `header+main+footer` | `header` + `main` + `footer` présents |
| `sidebar+main` | `aside`/`nav` latéral + `main`, `display:flex/grid` |
| `hero-first` | premier `section` ou `.hero` > 40 % viewport height |
| `card-grid` | ≥ 3 éléments `.card` ou `[class*="card"]` en sibling |

`confidence` = ratio nœuds matchés / nœuds échantillonnés.

### 4.5 Composants récurrents

- Classes contenant : `btn`, `card`, `hero`, `nav`, `modal`, `badge`, `pill`, `sidebar`, `container`, `grid`.
- Compter occurrences ; garder top 12 avec `sample_selector` CSS le plus spécifique.

### 4.6 Ton éditorial (approximatif, non-LLM)

- `title`, `meta description`, texte `h1`, longueur moyenne des `p`.
- Tags heuristiques : `concis` (< 80 car/h1), `institutionnel` (mots : plateforme, solution, entreprise), `technique` (API, orchestration, système).
- **Pas de LLM live** en v2 — classification par lexique fermé.

---

## 5. reproduction_prompt

Template contrôlé (pas de génération libre) :

```
Refonte fidèle au style source observé.
Palette dominante : {primary}, {accent}, {surface}.
Typographies : {families}.
Structure : {layout_signatures}.
Rythme espacement : base {dominant_gap}, scale {spacing_scale}.
Patterns à conserver : {top_patterns}.
Ne pas inventer de composants absents du dossier ADN.
Incertitudes : {uncertainties_count} signal(s) partiel(s).
```

---

## 6. Golden tests (sans LLM live)

### 6.1 Principes

- **Fixtures HTML** versionnées dans `server/tests/fixtures/design-extract/`.
- **Snapshots JSON** attendus (golden files) — comparaison structurelle, pas byte-identique sur dates.
- **Aucun appel réseau** en CI ; harness mocké ou snapshots inline.
- **Aucun LLM** — validation purement algorithmique.

### 6.2 Sites de référence (fixtures)

| Fixture | Ce qu'elle valide |
|---------|-------------------|
| `citadelle-local.html` | Palette slate/indigo, Inter, hero+cta, sections sémantiques |
| `minimal-landing.html` | Fail-closed palette insuffisante (< 3 couleurs) |
| `css-external-missing.html` | Incertitude CSS externe en mode static |
| `dense-component-page.html` | Clustering composants (card-grid, btn variants) |
| `typography-scale.html` | Échelle typo modulaire 1.25 |

### 6.3 Critères d'acceptation par test

| Test | Assertion |
|------|-----------|
| `golden-palette-citadelle` | `tokens.colors.primary` ∈ `{#0f172a, #0f172b}` (ΔE bucket) ; ≥ 3 couleurs ranked |
| `golden-typography-citadelle` | `tokens.typography.families[0].name` contient `Inter` |
| `golden-layout-citadelle` | `layout_signatures` contient `header+main+footer` confidence ≥ 0.8 |
| `golden-fail-closed-minimal` | `ok: false`, code `INSUFFICIENT_PALETTE` |
| `golden-reproduction-prompt` | longueur 120–800 chars ; contient « Refonte fidèle » ; pas de placeholder `{` |
| `golden-envelope-schema` | `kind`, `version`, `skill_id`, `tokens`, `reproduction_prompt` présents |
| `golden-job-sse` | job async émet `design.extract.pack` puis `done: true` |
| `golden-egress-local-only` | `https://example.com` → `EGRESS_LOCAL_ONLY` |

### 6.4 Seuil quality_gate (envelope)

| Score | Critère |
|-------|---------|
| +25 | ≥ 3 couleurs clusterisées |
| +25 | ≥ 1 famille typo + scale |
| +20 | ≥ 2 layout signatures |
| +15 | ≥ 2 patterns composants |
| +15 | reproduction_prompt valide |
| **merge_ok** | score ≥ 60 ET aucun blocker |

Blockers : `INSUFFICIENT_PALETTE`, `FETCH_FAILED`, `EGRESS_DENIED`.

---

## 7. API (inchangée v1)

```
POST   /api/design/extract/jobs
GET    /api/design/extract/stream/:jobId
GET    /api/design/extract/jobs/:jobId
DELETE /api/design/extract/jobs/:jobId
```

Body v2 additionnel optionnel :

```json
{
  "url": "http://127.0.0.1:5173/",
  "egressPolicy": "local-only",
  "extractionMode": "rendered",
  "viewport": { "width": 1440, "height": 900 }
}
```

---

## 8. Dépendances & ordre d'implémentation

```
Phase A (livré v1)     : fetch + cheerio + jobs + envelope 1.0.0
Phase B (v2.0)         : designExtractColorCluster.js + typography/spacing cluster
Phase C (v2.0)         : browser harness adapter (Playwright local-only)
Phase D (v2.0)         : golden tests + quality_gate
Phase E (après Extract): Nexxus Design → Forge sur envelope normalisée
Phase F                : Impeccable Cockpit pre-merge gate
```

**Browser harness** : module transverse `skill-browser-harness` — spec Phase C : [[Browser-Harness-Phase-C]]. Design Extract consomme Observe en mode `hybrid`, sans devenir un skill chat.

---

## 9. Non-objectifs v2

- Génération UI (→ Nexxus Design)
- Audit polish (→ Impeccable)
- Crawl multi-pages / SPA deep navigation (v3)
- LLM pour ton éditorial ou reproduction_prompt

---

## Liens

- [[skill-design-extract]]
- [[skill-nexxus-design]]
- [[skill-impeccable]]
- [[ADR-20260601-Suite-Design-Nexxus]]
- `server/src/services/design-extract/` — implémentation runtime
