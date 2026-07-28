/**
 * Gabarit HTML générique — fallback HTML_PROJECT_DELIVERY_V1 (hors atelier spécialisé).
 */
import { HTML_PROJECT_PROFILES } from "../policies/htmlProjectDeliveryPolicy.js";

function resolveTitle(query = "", profile = HTML_PROJECT_PROFILES.GENERIC) {
  const q = String(query || "");
  const notion = /\bnotion\b/i.test(q);
  if (notion) return "Page Notion — présentation";
  if (profile === HTML_PROJECT_PROFILES.LANDING) return "Landing Page — V1";
  if (profile === HTML_PROJECT_PROFILES.DASHBOARD) return "Dashboard — V1";
  if (profile === HTML_PROJECT_PROFILES.TEMPLATE) return "Template HTML — démo";
  return "Page HTML — V1";
}

export function buildGenericHtmlProjectHtml(query = "", profile = HTML_PROJECT_PROFILES.GENERIC) {
  const title = resolveTitle(query, profile);
  const isLanding = profile === HTML_PROJECT_PROFILES.LANDING;
  const isDashboard = profile === HTML_PROJECT_PROFILES.DASHBOARD;

  const hero = isLanding
    ? `    <section class="hero" id="accueil">
      <h2>Votre proposition de valeur en une phrase</h2>
      <p>Description courte du bénéfice principal — contenu d'exemple à personnaliser.</p>
      <a class="btn-primary" href="#contact">Commencer</a>
    </section>`
    : "";

  const dashboardAside = isDashboard
    ? `  <aside class="sidebar" aria-label="Navigation dashboard">
    <nav><ul>
      <li><a href="#overview" class="active">Vue d'ensemble</a></li>
      <li><a href="#metrics">Métriques</a></li>
      <li><a href="#activity">Activité</a></li>
    </ul></nav>
  </aside>`
    : "";

  const mainContent = isDashboard
    ? `    <section id="overview"><h2>Vue d'ensemble</h2><div class="cards">
      <article class="card"><h3>Utilisateurs</h3><p class="stat">1 248</p></article>
      <article class="card"><h3>Conversions</h3><p class="stat">8,4 %</p></article>
      <article class="card"><h3>Revenus</h3><p class="stat">12 500 €</p></article>
    </div></section>`
    : `    <section id="section-1"><h2>Section principale</h2><p>Contenu d'exemple structuré — remplacez par votre texte réel.</p></section>
    <section id="section-2"><h2>Détails</h2><ul><li>Point clé 1</li><li>Point clé 2</li><li>Point clé 3</li></ul></section>`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    :root { --bg:#f8fafc; --text:#0f172a; --muted:#64748b; --accent:#2563eb; --border:#e2e8f0; }
    * { box-sizing: border-box; }
    body { margin:0; font-family:system-ui,sans-serif; color:var(--text); background:var(--bg); }
    header { padding:1rem 1.5rem; background:#fff; border-bottom:1px solid var(--border); }
    header h1 { margin:0; font-size:1.35rem; }
    .layout { display:flex; min-height:calc(100vh - 64px); }
    .sidebar { width:240px; background:#1e293b; color:#e2e8f0; padding:1rem 0; }
    .sidebar a { display:block; padding:.5rem 1rem; color:inherit; text-decoration:none; }
    .sidebar a.active, .sidebar a:hover { background:rgba(255,255,255,.1); }
    main { flex:1; padding:1.5rem; max-width:960px; }
    section { background:#fff; border:1px solid var(--border); border-radius:8px; padding:1.25rem; margin-bottom:1rem; }
    .hero { text-align:center; padding:3rem 1.5rem; }
    .btn-primary { display:inline-block; margin-top:1rem; padding:.65rem 1.2rem; background:var(--accent); color:#fff; text-decoration:none; border-radius:6px; }
    .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:1rem; }
    .card { background:#f1f5f9; padding:1rem; border-radius:6px; }
    .stat { font-size:1.5rem; font-weight:700; margin:0; }
    footer { text-align:center; padding:1rem; color:var(--muted); font-size:.85rem; border-top:1px solid var(--border); }
    @media (max-width:768px) { .layout { flex-direction:column; } .sidebar { width:100%; } }
  </style>
</head>
<body>
  <header><h1>${title}</h1></header>
  <div class="layout">
${dashboardAside}
    <main>
${hero}
${mainContent}
    </main>
  </div>
  <footer><p>Page HTML V1 — <span id="y"></span></p></footer>
  <script>document.getElementById("y").textContent=new Date().getFullYear();</script>
</body>
</html>`;
}

export function buildGenericHtmlProjectProductionDelivery(query = "", profile = HTML_PROJECT_PROFILES.GENERIC) {
  const html = buildGenericHtmlProjectHtml(query, profile);
  return `✅ Objectif : page HTML V1 (${profile}) — autonome, responsive, contenu d'exemple.

📋 Code complet :

\`\`\`html
${html}
\`\`\`

🚀 Mode d'emploi : enregistrez le fichier, ouvrez-le dans un navigateur, remplacez le contenu d'exemple.

💡 Améliorations : branding, multi-pages, thème sombre, formulaire de contact.`;
}
