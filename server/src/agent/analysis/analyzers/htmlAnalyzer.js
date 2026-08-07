/**
 * Adaptateur HTML — sémantique, a11y, dépendances UI, SEO, UX shell.
 */
import {
  SOURCE_FILE_ROLES,
} from "../sourceFileAnalysisContract.js";

function escapeRegExp(s = "") {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Nom accessible probable : label[for], encapsulé, aria-label, aria-labelledby, soft tabulaire.
 * @param {string} content
 * @param {string} tag
 * @param {number} matchIndex
 * @returns {boolean}
 */
export function controlHasProbableAccessibleName(content, tag, matchIndex = 0) {
  const t = String(tag || "");
  if (/\baria-label\s*=/i.test(t)) return true;

  const labelledBy = t.match(/\baria-labelledby\s*=\s*["']([^"']+)["']/i)?.[1];
  if (labelledBy) {
    const ids = labelledBy.split(/\s+/).filter(Boolean);
    if (
      ids.some((id) =>
        new RegExp(`\\bid=["']${escapeRegExp(id)}["']`, "i").test(content),
      )
    ) {
      return true;
    }
  }

  const id = t.match(/\bid=["']([^"']+)["']/i)?.[1];
  if (id) {
    if (
      new RegExp(`<label[^>]*\\bfor=["']${escapeRegExp(id)}["']`, "i").test(
        content,
      )
    ) {
      return true;
    }
  }

  // Encapsulé dans <label>…</label>
  const before = content.slice(0, Math.max(0, matchIndex));
  const lastLabelOpen = before.toLowerCase().lastIndexOf("<label");
  if (lastLabelOpen >= 0) {
    const afterOpen = before.slice(lastLabelOpen);
    if (!/<\/label>/i.test(afterOpen)) return true;
  }

  // Soft tabulaire : <th> dans la même ligne avant le contrôle
  const lastTr = before.toLowerCase().lastIndexOf("<tr");
  if (lastTr >= 0) {
    const rowBefore = content.slice(lastTr, matchIndex);
    if (/<th\b/i.test(rowBefore) && !/<\/tr>/i.test(rowBefore)) return true;
  }

  return false;
}

/**
 * @param {string} content
 * @returns {string[]}
 */
function collectControlsMissingAccessibleName(content) {
  const missing = [];
  const re = /<input\b[^>]*>/gi;
  let m;
  while ((m = re.exec(content)) !== null) {
    const tag = m[0];
    const type = (tag.match(/\btype=["']([^"']+)["']/i)?.[1] || "text").toLowerCase();
    if (["hidden", "submit", "button", "image", "reset"].includes(type)) continue;
    if (!controlHasProbableAccessibleName(content, tag, m.index)) {
      missing.push(tag);
    }
  }
  return missing;
}

/**
 * @param {ReturnType<typeof analyzeHtmlSource>} report
 * @returns {object}
 */
export function buildHtmlAnalyzerFactsPayload(report) {
  const facts = report?.facts || {};
  return {
    hasTitle: Boolean(facts.hasTitle),
    titleText: facts.titleText || null,
    hasViewport: Boolean(facts.hasViewport),
    hasCharset: Boolean(facts.hasCharset),
    accessibleNameGaps: Number(facts.accessibleNameGaps) || 0,
    strengths: (report?.strengths || []).slice(0, 4),
    findings: (report?.findings || [])
      .slice(0, 4)
      .map((f) => ({ id: f.id, claim: f.claim, severity: f.severity })),
    analyzer: report?.analyzer || "html",
    path: report?.path || null,
  };
}

/**
 * @param {string} content
 * @param {{ path: string, ext: string, bytes: number, lines: number }} meta
 */
export function analyzeHtmlSource(content, meta) {
  const findings = [];
  const strengths = [];
  const structure = [];
  const recommendations = [];
  const unknowns = [];
  let findingIdx = 1;

  const pushFinding = (claim, severity, evidence) => {
    findings.push({
      id: `F${findingIdx++}`,
      claim,
      severity,
      evidence: evidence || undefined,
    });
  };

  const hasDoctype = /<!DOCTYPE\s+html>/i.test(content);
  const langMatch = content.match(/<html[^>]*\blang\s*=\s*["']([^"']+)["']/i);
  const titleMatch = content.match(/<title[^>]*>([^<]*)<\/title>/i);
  const h1Matches = content.match(/<h1\b[^>]*>/gi) || [];
  const hasHeader = /<header\b/i.test(content);
  const hasMain = /<main\b/i.test(content);
  const hasFooter = /<footer\b/i.test(content);
  const hasNav = /<nav\b/i.test(content);
  const hasViewport = /name=["']viewport["']/i.test(content);
  const hasCharset = /charset\s*=/i.test(content);

  const usesTailwind =
    /cdn\.tailwindcss\.com/i.test(content) || /\btailwind\b/i.test(content);
  const usesBootstrap = /bootstrap/i.test(content);
  const usesFontAwesome = /font-awesome|fontawesome|fa-/i.test(content);
  const usesLeaflet = /leaflet/i.test(content);

  const searchInputs = [
    ...content.matchAll(/<input\b[^>]*>/gi),
  ].map((m) => m[0]);
  const iconButtons = [
    ...content.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/gi),
  ].map((m) => m[0]);

  const controlsMissingAccessibleName = collectControlsMissingAccessibleName(content);

  const iconButtonsMissingName = iconButtons.filter((btn) => {
    const hasText = />[^<]*[A-Za-zÀ-ÿ]{2,}[^<]*</.test(btn.replace(/<i\b[^>]*>[\s\S]*?<\/i>/gi, ""));
    const hasAria = /\baria-label=/i.test(btn);
    const mostlyIcon = /<i\b|class=["'][^"']*\bfa[s]?[\s"']/i.test(btn);
    return mostlyIcon && !hasAria && !hasText;
  });

  const hasMap = /\bid=["']map["']/i.test(content) || /leaflet/i.test(content);
  const mapTall =
    /#map[^{]*\{[^}]*height\s*:\s*80vh/i.test(content) ||
    /id=["']map["'][^>]*style=["'][^"']*height\s*:\s*80vh/i.test(content);

  const seoJsNote =
    /contenu[^\n.]{0,40}(?:généré|genere).{0,40}(?:JS|javascript)|SEO\.md|injecté en JS/i.test(
      content,
    );
  const moduleScripts = (content.match(/<script[^>]+type=["']module["']/gi) || [])
    .length;
  const externalScripts = (content.match(/<script[^>]+src=/gi) || []).length;

  const hasSkipLink =
    /\bskip-link\b/i.test(content) &&
    /<a[^>]+href=["']#[^"']+["']/i.test(content);
  const hasLocalStylesheet =
    /<link[^>]+rel=["']stylesheet["'][^>]+href=["'](?!https?:)/i.test(content) ||
    /href=["'][^"']*\.css["']/i.test(content);
  const localScriptDefer = /<script[^>]+src=["'][^"']+\.js["'][^>]*\bdefer\b/i.test(
    content,
  );
  const hasGoogleFonts = /fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(content);
  const hasMetaDescription = /<meta[^>]+name=["']description["']/i.test(content);
  const hasOpenGraph = /property=["']og:/i.test(content);
  const hasAtelierSection =
    /\bid=["']atelier["']/i.test(content) || /\bclass=["'][^"']*atelier/i.test(content);
  const heroTitleOnParagraph = /<p[^>]*\bid=["']hero-title["']/i.test(content);
  const hasAriaLive = /aria-live=/i.test(content);
  const hasProofPanel = /\bproof-panel\b/i.test(content) || /<dl\b/i.test(content);
  const labeledControls = /<label\b[^>]*>[\s\S]*?<\/(label|select|input)/i.test(content);

  const isPresentationLanding =
    hasSkipLink &&
    hasHeader &&
    hasMain &&
    hasFooter &&
    hasNav &&
    (hasAtelierSection ||
      /\bid=["'](?:role|capacites|capacités)["']/i.test(content)) &&
    (hasLocalStylesheet || localScriptDefer);

  // Structure
  if (hasDoctype) structure.push("DOCTYPE html présent");
  if (langMatch) structure.push(`\`lang="${langMatch[1]}"\` sur \`<html>\``);
  if (titleMatch) structure.push(`\`<title>\` : ${titleMatch[1].trim()}`);
  if (h1Matches.length) structure.push(`${h1Matches.length} élément(s) \`<h1>\``);
  if (hasHeader) structure.push("Landmark \`<header>\`");
  if (hasMain) structure.push("Landmark \`<main>\`");
  if (hasFooter) structure.push("Landmark \`<footer>\`");
  if (hasNav) structure.push("Landmark \`<nav>\`");
  else structure.push("Pas de \`<nav>\` explicite (filtres/zones en \`div\`)");
  if (hasMap) structure.push("Zone carte interactive (\`#map\` / Leaflet)");
  if (/modal/i.test(content)) structure.push("Modale (Bootstrap ou équivalent)");
  if (/theme-toggle|data-theme|dark/i.test(content)) {
    structure.push("Contrôle de thème détecté");
  }
  if (hasSkipLink) structure.push("Lien d’évitement (skip link) vers le contenu principal");
  if (hasAtelierSection) {
    structure.push("Section atelier / démo interactive (contrôles + panneau de preuve)");
  }
  if (hasProofPanel) structure.push("Panneau de métriques (`<dl>` / preuve runtime)");
  if (labeledControls) structure.push("Formulaire ou contrôle avec `<label>` explicite");
  if (localScriptDefer) structure.push("Script applicatif local chargé en `defer`");
  if (hasLocalStylesheet) structure.push("Feuille de style locale liée (`style.css` ou équivalent)");

  const deps = [];
  if (usesTailwind) deps.push("Tailwind");
  if (usesBootstrap) deps.push("Bootstrap");
  if (usesFontAwesome) deps.push("Font Awesome");
  if (usesLeaflet) deps.push("Leaflet");
  if (deps.length) structure.push(`Dépendances UI : ${deps.join(", ")}`);

  // Strengths
  if (langMatch?.[1]?.toLowerCase().startsWith("fr")) {
    strengths.push("\`lang=\"fr\"\` correctement défini pour les technologies d’assistance.");
  }
  if (h1Matches.length === 1) {
    strengths.push("Un seul \`<h1>\` — hiérarchie de titre principale saine.");
  }
  if (hasHeader && hasMain && hasFooter) {
    strengths.push("Landmarks \`header\` / \`main\` / \`footer\` présents.");
  }
  if (hasCharset) {
    strengths.push("Meta charset présent.");
  }
  if (hasViewport) {
    strengths.push("Meta viewport présent.");
  }
  if (titleMatch) {
    strengths.push(`Balise \`<title>\` présente (« ${titleMatch[1].trim().slice(0, 80)} »).`);
  }
  if (iconButtons.some((b) => /\btype=["']button["']/i.test(b) || /<button\b/i.test(b))) {
    strengths.push("Actions principales en vrais \`<button>\` (pas des \`div\` cliquables).");
  }
  if (/<img\b[^>]*\balt=/i.test(content)) {
    strengths.push("Au moins une image avec attribut \`alt\`.");
  }
  if (seoJsNote) {
    strengths.push(
      "Note SEO présente : conscience que le contenu injecté en JS limite l’indexation.",
    );
  }
  if (moduleScripts > 0) {
    strengths.push("Script applicatif en module ES6 — séparation logique claire.");
  }
  if (hasSkipLink) {
    strengths.push("Lien d’évitement vers `#contenu` — bon réflexe accessibilité clavier.");
  }
  if (hasNav && /<nav[^>]+aria-label=/i.test(content)) {
    strengths.push("Navigation principale avec `aria-label` explicite.");
  }
  if (labeledControls) {
    strengths.push("Au moins un contrôle de formulaire correctement étiqueté (`<label>`).");
  }
  if (hasMetaDescription) {
    strengths.push("Meta `description` présente pour le résumé moteur de recherche.");
  }
  if (hasAriaLive) {
    strengths.push("Zone `aria-live` pour annoncer des mises à jour (horloge / preuve).");
  }
  if (localScriptDefer && !usesTailwind && !usesBootstrap) {
    strengths.push(
      "Stack front légère : CSS/JS locaux sans empilement de frameworks UI lourds.",
    );
  }

  // Findings — faits négatifs head
  if (!titleMatch) {
    pushFinding("Balise `<title>` manquante.", "high");
  }
  if (!hasViewport) {
    pushFinding("Meta viewport manquante.", "high");
  }
  if (!hasCharset) {
    pushFinding("Meta charset manquante.", "medium");
  }

  if (controlsMissingAccessibleName.length > 0) {
    pushFinding(
      `${controlsMissingAccessibleName.length} contrôle(s) de formulaire sans nom accessible probable (ni label[for], ni encapsulation <label>, ni aria-label / aria-labelledby, ni contexte tabulaire soft).`,
      "high",
      controlsMissingAccessibleName[0].slice(0, 100),
    );
    recommendations.push(
      "Associer un nom accessible à chaque checkbox/radio/champ (label[for], encapsulation, aria-label ou aria-labelledby).",
    );
  }

  // Findings
  if (usesTailwind && usesBootstrap) {
    pushFinding(
      "La page mélange plusieurs couches UI externes (Tailwind + Bootstrap" +
        (usesFontAwesome ? " + Font Awesome" : "") +
        (usesLeaflet ? " + Leaflet" : "") +
        "), ce qui accélère le prototypage mais augmente le coût de cohérence visuelle et de maintenance.",
      "medium",
      deps.join(" + "),
    );
    recommendations.push(
      "Si Bootstrap n’est requis que pour la modale, évaluer une modale plus légère pour réduire la dette de dépendances.",
    );
  }

  if (iconButtonsMissingName.length > 0) {
    pushFinding(
      "Des boutons pilotés par icône n’ont pas de nom accessible garanti (\`aria-label\` ou texte visible).",
      "high",
      iconButtonsMissingName[0].replace(/\s+/g, " ").slice(0, 100),
    );
    recommendations.push(
      "Ajouter \`aria-label\` sur les boutons icônes (recherche, filtres avancés, clear, thème si besoin).",
    );
  }

  if (!hasNav && (/filter-btn|filters|recherche/i.test(content))) {
    pushFinding(
      "La base sémantique est correcte, mais plusieurs zones fonctionnelles (filtres / résultats) restent en \`div\` génériques — un \`<nav>\`, \`<section aria-labelledby>\`, \`<form>\` ou \`<ul>/<li>\` améliorerait a11y et lisibilité.",
      "medium",
    );
    recommendations.push(
      "Structurer filtres et résultats filtrés avec des landmarks / listes sémantiques.",
    );
  }

  if (mapTall) {
    pushFinding(
      "La carte semble pivoter l’expérience, mais sa hauteur par défaut (80vh / min-height élevé) peut alourdir l’UI sur petits écrans.",
      "low",
      "height:80vh",
    );
    recommendations.push(
      "Vérifier le comportement responsive de \`#map\` (hauteur mobile, collapse, priorité contenu).",
    );
  }

  if (seoJsNote || moduleScripts > 0) {
    pushFinding(
      "Le HTML pose un shell applicatif ; la valeur SEO / contenu dépend fortement du rendu des données injectées en JavaScript.",
      "medium",
    );
  }

  if (h1Matches.length === 0) {
    pushFinding("Aucun \`<h1>\` détecté — hiérarchie de titres incomplète.", "medium");
  } else if (h1Matches.length > 1) {
    pushFinding(
      `Plusieurs \`<h1>\` (${h1Matches.length}) — risque de confusion pour SEO et lecteurs d’écran.`,
      "low",
    );
  }

  if (!langMatch) {
    pushFinding("Attribut `lang` manquant sur `<html>`.", "high");
  }

  const linkedAppJs = /src=["']app\.js["']/i.test(content);
  const linkedHomeJs = /src=["'][^"']*home\.js["']/i.test(content);
  const linkedLocalModule =
    /<script[^>]+type=["']module["'][^>]+src=/i.test(content) ||
    /<script[^>]+src=[^>]+type=["']module["']/i.test(content);

  if (
    isPresentationLanding &&
    (localScriptDefer || linkedAppJs || linkedHomeJs || linkedLocalModule)
  ) {
    const scriptLabel = linkedHomeJs
      ? "home.js"
      : linkedAppJs
        ? "app.js"
        : "le script module lié";
    pushFinding(
      `La logique interactive (thème, modale, timer, stats…) est potentiellement portée par \`${scriptLabel}\` — cette revue HTML ne valide pas le comportement runtime. Dire « non visible dans ce fichier », pas « non implémenté ».`,
      "medium",
      linkedHomeJs
        ? 'script type="module" src="home.js"'
        : linkedAppJs
          ? 'script src="app.js"'
          : "script type=module src=",
    );
    recommendations.push(
      `Relire \`${scriptLabel}\` et le CSS lié dans le même tour pour une revue bout-en-bout (motion, focus, modale, thème).`,
    );
  }

  if (hasGoogleFonts) {
    pushFinding(
      "Polices chargées depuis Google Fonts — dépendance réseau, latence (FOUT) et impact vie privée / conformité à anticiper.",
      "low",
      "fonts.googleapis.com",
    );
    recommendations.push(
      "Envisager auto-hébergement des polices ou `font-display: swap` côté CSS si le LCP est sensible.",
    );
  }

  if (heroTitleOnParagraph && h1Matches.length > 0) {
    pushFinding(
      "L’identité « hero » utilise un `<p id=\"hero-title\">` référencé par `aria-labelledby` alors qu’un `<h1>` séparé porte le message principal — outline et SEO peuvent diverger.",
      "medium",
      'id="hero-title"',
    );
    recommendations.push(
      "Aligner titre visible, unique `<h1>` et cible `aria-labelledby` (éviter deux titres concurrents).",
    );
  }

  if (hasMetaDescription && !hasOpenGraph) {
    pushFinding(
      "Meta description présente mais pas de balises Open Graph / Twitter Card — partage social moins prévisible.",
      "low",
    );
    recommendations.push(
      "Ajouter `og:title`, `og:description` et une image de preview si la page est partagée.",
    );
  }

  if (
    isPresentationLanding &&
    /animation|reveal|pulse|transform/i.test(content) &&
    !/prefers-reduced-motion/i.test(content)
  ) {
    pushFinding(
      "Animations / reveals annoncés dans le markup sans garde `prefers-reduced-motion` visible dans ce fichier.",
      "low",
    );
  }

  if (externalScripts > 0 && !/integrity=/i.test(content)) {
    const cdnScripts = (content.match(/<script[^>]+src=["']https?:/gi) || []).length;
    if (cdnScripts > 0) {
      pushFinding(
        "Scripts CDN sans attribut `integrity` (SRI) détectés — risque supply-chain si le CDN est compromis.",
        "medium",
      );
      recommendations.push("Ajouter Subresource Integrity sur les scripts/styles CDN critiques.");
    }
  }

  // Surfaces sécurité HTML (statique — pas un React Doctor)
  const hasInlineHandlers =
    /\son(?:click|error|load|submit|mouseover)\s*=/i.test(content);
  const hasJavascriptUrl = /\bhref\s*=\s*["']\s*javascript:/i.test(content);
  const hasInlineScript =
    /<script\b(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/i.test(content);
  const hasCsp =
    /http-equiv\s*=\s*["']Content-Security-Policy["']/i.test(content) ||
    /\bContent-Security-Policy\b/i.test(content);
  const hasPasswordField = /type\s*=\s*["']password["']/i.test(content);
  const hasAutocompleteOff = /autocomplete\s*=\s*["']off["']/i.test(content);

  if (hasInlineHandlers) {
    pushFinding(
      "Handlers inline (`onclick` / `onerror`…) détectés — surface XSS et CSP plus difficiles à durcir.",
      "high",
      "on*=",
    );
    recommendations.push(
      "Déplacer la logique vers un module JS externe et interdire les handlers inline via CSP.",
    );
  }
  if (hasJavascriptUrl) {
    pushFinding(
      "Lien `javascript:` détecté — vecteur XSS / navigation non sûre.",
      "high",
      "href=javascript:",
    );
  }
  if (hasInlineScript && !hasCsp) {
    pushFinding(
      "Script inline sans Content-Security-Policy visible — risque d'injection XSS non mitigué au niveau markup.",
      "medium",
    );
    recommendations.push(
      "Ajouter une CSP restrictive (idéalement en en-tête HTTP) et préférer scripts externes + nonces/hashes.",
    );
  }
  if (hasPasswordField && !hasAutocompleteOff) {
    pushFinding(
      "Champ mot de passe sans `autocomplete` explicite — vérifier la politique navigateur / gestionnaire de secrets.",
      "low",
      'type="password"',
    );
  }

  unknowns.push(
    "Sans exécuter le CSS/JS ni un rendu navigateur, impossible de certifier le comportement réel (recherche, carte, modale, thème, responsive).",
  );
  if (externalScripts > 0) {
    unknowns.push(
      "Les scripts/CDN externes ne sont pas exécutés dans cette analyse statique — disponibilité réseau et versions non vérifiées.",
    );
  }
  unknowns.push(
    "Les fichiers liés (css/, js/, img/) hors ce HTML ne sont pas lus dans ce tour.",
  );

  if (recommendations.length < 2) {
    recommendations.push(
      "Conserver la structure landmarks et renforcer labels / noms accessibles sur les contrôles.",
    );
  }

  const isAppShell =
    isPresentationLanding ||
    hasMap ||
    /search-input|filter-btn|modal/i.test(content) ||
    moduleScripts > 0 ||
    (usesTailwind && usesBootstrap);

  const summary = isPresentationLanding
    ? "Landing de présentation du studio (héro, rôle, capacités, atelier démo) : le HTML structure le récit et les landmarks, tandis que `style.css` et `app.js` portent le thème, les animations et le panneau de preuve interactif."
    : isAppShell
      ? "Shell HTML d’application interactive (exploration / recherche / filtrage" +
        (hasMap ? " / carte" : "") +
        "), plus qu’une page de contenu statique. Architecture fonctionnelle lisible : zones héro, contrôles, contenu principal et feedback (loader / modale)."
      : "Document HTML avec structure de page classique ; rôle plutôt présentation / contenu que shell applicatif lourd.";

  const roleLabel = isPresentationLanding
    ? "Landing de présentation interactive (démo atelier)"
    : isAppShell
      ? "Shell UI applicatif (exploration interactive)"
      : "Page / composant HTML";

  const roleRationale = isPresentationLanding
    ? "Landmarks complets (`header` / `nav` / `main` / `footer`), skip link, sections ancrées et zone atelier avec contrôles + preuve runtime — typique page vitrine produit, pas shell données type carte/recherche."
    : isAppShell
      ? "Présence de contrôles applicatifs (recherche, filtres, modale, carte ou modules JS) indiquant un shell interactif plutôt qu’une page statique."
      : "Peu de signaux d’application lourde : structure documentaire classique sans carte/recherche/modale dominante.";

  return {
    access: "read_full",
    path: meta.path,
    ext: meta.ext,
    bytes: meta.bytes,
    lines: meta.lines,
    role: isAppShell ? SOURCE_FILE_ROLES.UI_SHELL : SOURCE_FILE_ROLES.UI_COMPONENT,
    roleLabel,
    roleRationale,
    summary,
    structure,
    strengths: strengths.slice(0, 8),
    findings,
    unknowns,
    recommendations: recommendations.slice(0, 6),
    confidence: findings.length >= 3 ? "high" : "medium",
    analyzer: "html",
    facts: {
      hasTitle: Boolean(titleMatch),
      titleText: titleMatch ? titleMatch[1].trim() : null,
      hasViewport,
      hasCharset,
      accessibleNameGaps: controlsMissingAccessibleName.length,
    },
  };
}
