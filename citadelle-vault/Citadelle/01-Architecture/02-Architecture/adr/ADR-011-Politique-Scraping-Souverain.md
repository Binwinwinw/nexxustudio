# ADR-011 — Politique de Scraping Souverain pour l'Expert Web Search

**Date** : 18/05/2026  
**Dernière révision** : 04/07/2026 — alignement runtime SERP-only (`expert_web_search`)  
**Statut** : ADOPTÉ  
**Décideur** : Gardien Souverain + Doctrine Fail-Closed v4.6

---

## Contexte

La Citadelle intègre un expert de recherche web (`expert_web_search`, module `expertWebSearch.js`) qui enrichit les réponses factuelles par des **preuves SERP** (titres, URLs, snippets courts). Ce n'est pas un navigateur autonome ni un crawler multi-pages : c'est un **collecteur de preuves gouverné** en amont par intent, slots et exclusions.

Implémentation runtime :

- Moteur principal : `duck-duck-scrape` (SERP DuckDuckGo)
- Fallback : page HTML `lite.duckduckgo.com/lite/`
- Service : `server/src/services/webSearchService.js`
- Policy technique : `server/src/agent/policies/webSourcePolicy.js`

> **Note historique** : les versions antérieures de cet ADR mentionnaient `expertWebNavigator` et une consultation de pages publiques. Le runtime actuel est **SERP-only** ; toute évolution vers un fetch page profond fera l'objet d'un ADR complémentaire.

---

## Analyse Juridique de Référence

Le scraping n'est pas illégal en soi, mais il doit être raisonné en **couches de risque** :

| Couche | Règle applicable | Verdict Citadelle |
|---|---|---|
| Accessibilité publique | hiQ v. LinkedIn (CFAA) — métadonnées SERP publiques | ✅ Usage ponctuel défendable |
| CGU du moteur / du site | Ryanair v. PR Aviation — CGU contractuellement opposables | ⚠️ Point le plus sensible (connecteur non officiel) |
| Données personnelles | RGPD + CNIL — minimisation, pas de collecte perso | ❌ Interdit (hors périmètre météo / faits actuels) |
| Charge serveur | Risque contractuel/réputationnel | ⚠️ Rate limiting obligatoire |
| Protections techniques | Contournement CAPTCHA/auth | ❌ Blocage automatique |

---

## Décision Architecturale

### Modèle SERP-only (runtime actuel)

1. Interrogation d'un moteur de recherche (DuckDuckGo)
2. Récupération d'au plus **5** résultats (titre, URL, snippet ≤ 400 caractères)
3. Filtrage, normalisation, sanitisation
4. Injection dans le briefing de l'orchestrateur / composeur
5. **Jamais** de réponse directe à l'utilisateur par l'expert

Pas de crawl profond des sites listés dans les résultats.

### Allowlist de confiance (score de source)

Domaines à confiance élevée pour le tri des snippets (pas une autorisation de crawl) :

- Documentation technique officielle (MDN, docs.python.org, etc.)
- Encyclopédies publiques (Wikipedia, Wikisource)
- Sites gouvernementaux et institutionnels (.gouv.fr, .gov, .europa.eu)
- Publications scientifiques en accès libre (arXiv, PubMed Open Access)

### Garde-fous techniques NON NÉGOCIABLES (fail-closed)

1. **Consultation et prise en compte de robots.txt** comme garde-fou opérationnel supplémentaire sur les domaines des URLs SERP retenues — abandon si `Disallow: /` pour `User-agent: *` ; ce mécanisme n'est ni une immunité juridique ni une garantie sur l'indexabilité des pages
2. **Rate limiting** — 1 requête minimum toutes les 2 secondes par domaine
3. **Détection et blocage** si : login requis, CAPTCHA présent, paywall, contenu sensible
4. **Pas de collecte durable de données personnelles** — snippets éphémères en mémoire de tour (`webTurnContext`) ; pas d'indexation ChromaDB des SERP
5. **User-Agent explicite** — identification honnête sur **tous** les chemins (`NexxusCitadel/1.0 (research-agent; non-commercial; local-use)`)
6. **Journalisation des sources** — toute URL retenue est tracée pour audit opérationnel
7. **Timeout strict** — 8 secondes max (recherche principale), 5 secondes (fallback DDG Lite) ; pas de retry agressif
8. **Pas de republication** — usage strictement interne, composition transformée par le composeur

### Règle pratique de décision (heuristique)

> « Collecter des preuves SERP courtes, filtrées et transformées — pas aspirer, republier ou contourner des protections d'accès. »

### Ce qui déclenche un blocage automatique

```javascript
const BLOCK_TRIGGERS = [
  'login', 'signin', 'password', 'captcha',      // Authentification
  'paywall', 'subscribe', 'premium',              // Contenu payant
  'personal data', 'données personnelles',        // Données sensibles
];
```

---

## Politique légale — expert_web_search (SERP gouvernée)

**Périmètre.** `expert_web_search` est un collecteur de preuves factuelles à usage interne. Il interroge un moteur de recherche (DuckDuckGo via bibliothèque tierce ou fallback DDG Lite), récupère au plus cinq résultats SERP (titre, URL, snippet court), les filtre, les sanitise, puis les transmet à l'orchestrateur / au composeur. Il ne répond jamais directement à l'utilisateur final.

**Ce que nous ne faisons pas.**

- Pas de crawl profond multi-pages des sites listés.
- Pas de contournement de login, CAPTCHA, paywall ou authentification.
- Pas de republication intégrale ni d'agrégation massive de contenu tiers.
- Pas de collecte ni de persistance durable de données personnelles issues du web (snippets éphémères en mémoire de tour uniquement ; pas d'indexation ChromaDB des SERP).
- Pas de revente ou redistribution des résultats bruts à des tiers.

**Ce que nous faisons pour limiter le risque.**

- Déclenchement gouverné en amont (intent + slots + exclusions), pas sur simple motif lexical.
- Requête web dérivée et bornée (ex. météo : lieu + métrique + « actuelle »).
- Rate limiting (≥ 2 s entre requêtes par domaine), timeout strict, plafond de cinq sources, snippets tronqués (400 caractères).
- Filtrage URL (login, paywall, captcha, checkout…) et sanitisation egress / injection.
- User-Agent identifiant l'agent (`NexxusCitadel/1.0`, usage non commercial local) sur tous les chemins, y compris le fallback.
- Journalisation des URLs retenues pour audit opérationnel.
- Échec explicite et rapide si zéro source ou erreur moteur (pas de bascule silencieuse vers un raisonneur lourd).

**robots.txt.** Consultation et prise en compte de robots.txt comme garde-fou opérationnel supplémentaire sur les domaines des résultats SERP. Ce mécanisme ne garantit ni l'indexabilité ni l'absence de restriction contractuelle sur les sites tiers ; il filtre ce que nous acceptons de réutiliser, pas ce que le moteur avait le droit d'afficher.

**Moteur tiers / ToS.** L'accès SERP s'appuie sur un connecteur non officiel (`duck-duck-scrape`) et un fallback HTML DDG Lite. L'usage retenu est ponctuel, à faible volume, non commercial, sans revente de données. Toute montée en charge, usage commercial ou couverture élargie (requêtes sensibles, personnes identifiables) impose une revue des conditions d'utilisation du moteur et, si besoin, migration vers une API SERP contractuellement couverte.

**Données personnelles (RGPD).** Les requêtes « faits actuels » (météo, horaires, taux…) ne ciblent pas de personnes. Dès qu'une requête pourrait ramener des données personnelles, le déclenchement web doit rester bloqué ou soumis à une politique dédiée (minimisation, finalité, durée de conservation nulle ou très courte).

**Qualité vs conformité.** La chaîne garantit la discipline de collecte, de filtrage et de transmission — pas la véracité ni la licéité des pages que le moteur liste. La réponse utilisateur est toujours une composition transformée, jamais une reprise brute.

**Revue.** Révision de cette politique en cas d'évolution jurisprudentielle, de changement de connecteur SERP, ou de passage à un usage commercial.

---

## Conséquences

- `expert_web_search` est un **outil de recherche factuelle ponctuelle SERP-only**, pas un scraper généraliste
- Tout usage commercial ou de revente de données nécessite **un avis juridique formel préalable**
- Revue périodique des ToS du moteur si le volume ou le périmètre des requêtes augmentent
- La politique est révisable par ADR en cas d'évolution jurisprudentielle

## Références

- hiQ Labs, Inc. v. LinkedIn Corp., 9th Cir. 2022
- Ryanair DAC v. PR Aviation BV, CJUE C-30/14, 2015
- CNIL — Recommandations sur le web scraping, 2023
- RGPD Art. 5 — Principes relatifs au traitement des données personnelles
- Runtime : `server/src/agent/agents/expertWebSearch.js`, `server/src/services/webSearchService.js`
