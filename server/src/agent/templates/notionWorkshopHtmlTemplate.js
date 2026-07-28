/**
 * Gabarit HTML production — atelier d'initiation Notion.
 * Référence qualité minimale pour CODE_DELIVERY_V1 (workshop).
 */
export const NOTION_WORKSHOP_MODULES = [
  {
    id: "decouvrir-notion",
    title: "Découvrir Notion",
    summary: "Comprendre l'espace de travail, les pages et la logique bloc.",
  },
  {
    id: "interface-navigation",
    title: "Interface et navigation",
    summary: "Sidebar, recherche rapide et organisation de l'espace.",
  },
  {
    id: "pages-blocs",
    title: "Pages et blocs",
    summary: "Titres, listes, callouts, colonnes et mise en page.",
  },
  {
    id: "bases-donnees",
    title: "Bases de données",
    summary: "Propriétés, vues tableau/galerie/calendrier et filtres.",
  },
  {
    id: "collaboration-partage",
    title: "Collaboration et partage",
    summary: "Permissions, commentaires, publication et modèles.",
  },
  {
    id: "cas-pratique",
    title: "Cas pratique final",
    summary: "Construire un mini hub personnel en 15 minutes.",
  },
];

const SECTION_CONTENT = {
  "decouvrir-notion": `
    <p>Notion est un espace de travail modulaire : tout est une <strong>page</strong>, composée de <strong>blocs</strong> réorganisables. Un workspace regroupe vos pages privées, partagées et d'équipe.</p>
    <ul>
      <li><strong>Workspace</strong> — conteneur principal (perso ou équipe).</li>
      <li><strong>Page</strong> — document vivant, imbriquable à l'infini.</li>
      <li><strong>Bloc</strong> — unité de contenu (texte, image, tableau, etc.).</li>
    </ul>
    <p class="tip">💡 Bon réflexe débutant : une page = un objectif clair (notes, projet, wiki).</p>`,
  "interface-navigation": `
    <p>La <strong>sidebar</strong> (barre latérale) est votre carte du territoire : favoris, pages récentes, espaces d'équipe. La <strong>recherche rapide</strong> (Ctrl/Cmd + K) permet d'atteindre n'importe quelle page en quelques frappes.</p>
    <ul>
      <li>Épingler les pages essentielles en favoris.</li>
      <li>Créer des dossiers logiques (Projets, Ressources, Archives).</li>
      <li>Utiliser des icônes et couvertures pour repérer visuellement.</li>
    </ul>
    <p class="tip">💡 Sur mobile, la sidebar se replie — pensez à nommer vos pages explicitement.</p>`,
  "pages-blocs": `
    <p>Chaque page est une toile de blocs. Les types les plus utiles en initiation :</p>
    <ul>
      <li><strong>Titres</strong> H1 → H3 pour structurer la lecture.</li>
      <li><strong>Listes à puces / numérotées</strong> pour les procédures.</li>
      <li><strong>Callout</strong> pour les rappels et avertissements.</li>
      <li><strong>Colonnes</strong> pour comparer ou juxtaposer.</li>
      <li><strong>Toggle</strong> pour masquer le détail sans encombrer.</li>
    </ul>
    <p>Glisser-déposer un bloc change l'ordre ; le menu <kbd>⋮⋮</kbd> ouvre duplication, couleur et commentaires.</p>`,
  "bases-donnees": `
    <p>Une base de données Notion est une page dont les entrées sont des lignes structurées par <strong>propriétés</strong> (texte, nombre, date, sélection, relation…).</p>
    <ul>
      <li><strong>Vue Tableau</strong> — édition dense, tri et filtres.</li>
      <li><strong>Vue Galerie</strong> — cartes visuelles (idéal portfolios).</li>
      <li><strong>Vue Calendrier</strong> — planning sur propriété date.</li>
      <li><strong>Vue Liste</strong> — lecture rapide verticale.</li>
    </ul>
    <p class="tip">💡 Liez deux bases avec une propriété <em>Relation</em> pour un mini-CRM ou un suivi de tâches.</p>`,
  "collaboration-partage": `
    <p>Notion brille en équipe : commentaires inline, mentions @, historique des versions et permissions granulaires.</p>
    <ul>
      <li><strong>Partage</strong> — inviter par e-mail ou lien (lecture / commentaire / édition).</li>
      <li><strong>Templates</strong> — dupliquer une page modèle pour standardiser.</li>
      <li><strong>Publication web</strong> — rendre une page publique en lecture seule.</li>
    </ul>
    <p>Vérifiez toujours le niveau d'accès avant d'y coller des données sensibles.</p>`,
  "cas-pratique": `
    <p><strong>Exercice guidé (≈ 15 min)</strong> — construire un « Hub perso » :</p>
    <ol>
      <li>Créer une page <em>Mon Hub</em> avec icône et couverture.</li>
      <li>Ajouter 3 sous-pages : Tâches, Notes, Ressources.</li>
      <li>Dans Tâches, insérer une base « À faire » (statut, priorité, échéance).</li>
      <li>Épingler le Hub en favori et tester la recherche rapide.</li>
      <li>Partager en lecture seule à un collègue pour validation.</li>
    </ol>
    <p class="tip">💡 Vous avez maintenant une structure réutilisable — dupliquez-la pour chaque nouveau projet.</p>`,
};

function buildNavItems() {
  return NOTION_WORKSHOP_MODULES.map(
    (m) => `          <li><a href="#${m.id}" class="nav-link" data-section="${m.id}">${m.title}</a></li>`,
  ).join("\n");
}

function buildSections() {
  return NOTION_WORKSHOP_MODULES.map((m, index) => {
    const content = SECTION_CONTENT[m.id] || `<p>Module ${index + 1} — contenu à compléter.</p>`;
    return `      <section id="${m.id}" class="module" aria-labelledby="heading-${m.id}">
        <p class="module-step">Module ${index + 1} / ${NOTION_WORKSHOP_MODULES.length}</p>
        <h2 id="heading-${m.id}">${m.title}</h2>
        <p class="module-lead">${m.summary}</p>
        ${content}
      </section>`;
  }).join("\n\n");
}

/**
 * HTML autonome prêt à ouvrir dans un navigateur.
 */
export function buildNotionWorkshopProductionHtml() {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="Atelier d'initiation à Notion — espace de travail, pages, blocs, bases de données et collaboration." />
  <title>Atelier d'initiation à Notion</title>
  <style>
    :root {
      --color-bg: #f8fafc;
      --color-surface: #ffffff;
      --color-sidebar: #1e293b;
      --color-sidebar-text: #e2e8f0;
      --color-accent: #2563eb;
      --color-accent-hover: #1d4ed8;
      --color-text: #0f172a;
      --color-muted: #64748b;
      --header-h: 4.5rem;
      --sidebar-w: 17rem;
      --radius: 0.5rem;
      --shadow: 0 1px 3px rgb(15 23 42 / 0.08);
    }

    *, *::before, *::after { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      font-size: 1rem;
      line-height: 1.6;
      color: var(--color-text);
      background: var(--color-bg);
    }

    .skip-link {
      position: absolute;
      left: -9999px;
      top: 0;
      z-index: 1000;
      padding: 0.75rem 1rem;
      background: var(--color-accent);
      color: #fff;
    }
    .skip-link:focus { left: 0; }

    .site-header {
      position: sticky;
      top: 0;
      z-index: 200;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      min-height: var(--header-h);
      padding: 0.75rem 1.25rem;
      background: var(--color-sidebar);
      color: #fff;
      box-shadow: var(--shadow);
    }
    .site-header h1 {
      margin: 0;
      font-size: clamp(1.1rem, 2.5vw, 1.35rem);
      font-weight: 700;
    }
    .site-header .subtitle {
      margin: 0.15rem 0 0;
      font-size: 0.85rem;
      color: var(--color-sidebar-text);
    }
    .header-cta {
      display: inline-flex;
      align-items: center;
      padding: 0.5rem 1rem;
      border-radius: var(--radius);
      background: var(--color-accent);
      color: #fff;
      text-decoration: none;
      font-weight: 600;
      font-size: 0.9rem;
      white-space: nowrap;
    }
    .header-cta:hover, .header-cta:focus-visible {
      background: var(--color-accent-hover);
      outline: 2px solid #93c5fd;
      outline-offset: 2px;
    }

    .sidebar-toggle {
      display: none;
      position: fixed;
      bottom: 1.25rem;
      right: 1.25rem;
      z-index: 300;
      padding: 0.75rem 1rem;
      border: none;
      border-radius: 999px;
      background: var(--color-accent);
      color: #fff;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgb(37 99 235 / 0.35);
    }
    .sidebar-toggle:focus-visible {
      outline: 2px solid #93c5fd;
      outline-offset: 2px;
    }

    .layout {
      display: flex;
      min-height: calc(100vh - var(--header-h));
    }

    .site-sidebar {
      position: sticky;
      top: var(--header-h);
      flex: 0 0 var(--sidebar-w);
      align-self: flex-start;
      max-height: calc(100vh - var(--header-h));
      overflow-y: auto;
      padding: 1.25rem 0;
      background: var(--color-sidebar);
      color: var(--color-sidebar-text);
    }
    .site-sidebar nav ul {
      list-style: none;
      margin: 0;
      padding: 0 0.75rem;
    }
    .site-sidebar .nav-link {
      display: block;
      padding: 0.55rem 0.75rem;
      margin-bottom: 0.2rem;
      border-radius: var(--radius);
      color: inherit;
      text-decoration: none;
      font-size: 0.92rem;
      transition: background 0.15s, color 0.15s;
    }
    .site-sidebar .nav-link:hover,
    .site-sidebar .nav-link:focus-visible {
      background: rgb(255 255 255 / 0.1);
      outline: none;
    }
    .site-sidebar .nav-link.active {
      background: var(--color-accent);
      color: #fff;
      font-weight: 600;
    }

    .site-main {
      flex: 1;
      min-width: 0;
      padding: 1.5rem clamp(1rem, 4vw, 2.5rem) 3rem;
    }

    .module {
      margin-bottom: 2.5rem;
      padding: 1.5rem;
      background: var(--color-surface);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
    }
    .module-step {
      margin: 0 0 0.5rem;
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--color-muted);
    }
    .module h2 { margin: 0 0 0.35rem; font-size: 1.35rem; }
    .module-lead {
      margin: 0 0 1rem;
      color: var(--color-muted);
      font-size: 1.02rem;
    }
    .module ul, .module ol { padding-left: 1.25rem; }
    .module li { margin-bottom: 0.35rem; }
    .tip {
      margin-top: 1rem;
      padding: 0.75rem 1rem;
      border-left: 4px solid var(--color-accent);
      background: #eff6ff;
      border-radius: 0 var(--radius) var(--radius) 0;
      font-size: 0.95rem;
    }
    kbd {
      padding: 0.1rem 0.35rem;
      border-radius: 0.25rem;
      background: #e2e8f0;
      font-size: 0.85em;
    }

    .site-footer {
      padding: 1.25rem clamp(1rem, 4vw, 2.5rem);
      text-align: center;
      font-size: 0.85rem;
      color: var(--color-muted);
      border-top: 1px solid #e2e8f0;
      background: var(--color-surface);
    }

    @media (max-width: 768px) {
      .site-sidebar {
        position: fixed;
        top: var(--header-h);
        left: 0;
        bottom: 0;
        z-index: 250;
        transform: translateX(-100%);
        transition: transform 0.25s ease;
        box-shadow: 4px 0 16px rgb(0 0 0 / 0.15);
      }
      .site-sidebar.is-open { transform: translateX(0); }
      .sidebar-toggle { display: block; }
      .header-cta { display: none; }
      .site-header .brand { max-width: 70%; }
    }
  </style>
</head>
<body>
  <a class="skip-link" href="#contenu-principal">Aller au contenu</a>

  <header class="site-header">
    <div class="brand">
      <h1>Atelier d'initiation à Notion</h1>
      <p class="subtitle">Parcours guidé — espace de travail, blocs, bases de données, partage</p>
    </div>
    <a class="header-cta" href="#cas-pratique">Commencer l'exercice final</a>
  </header>

  <div class="layout">
    <aside class="site-sidebar" id="sidebar" aria-label="Navigation des modules de l'atelier">
      <nav>
        <ul>
${buildNavItems()}
        </ul>
      </nav>
    </aside>

    <main id="contenu-principal" class="site-main" tabindex="-1">
${buildSections()}
    </main>
  </div>

  <button type="button" class="sidebar-toggle" id="sidebar-toggle" aria-expanded="false" aria-controls="sidebar">
    Menu modules
  </button>

  <footer class="site-footer">
    <p>Atelier Notion — initiation · <span id="footer-year"></span> · Document pédagogique autonome</p>
  </footer>

  <script>
    (function () {
      var toggle = document.getElementById("sidebar-toggle");
      var sidebar = document.getElementById("sidebar");
      var links = document.querySelectorAll(".nav-link");
      var yearEl = document.getElementById("footer-year");
      if (yearEl) yearEl.textContent = String(new Date().getFullYear());

      if (toggle && sidebar) {
        toggle.addEventListener("click", function () {
          var open = sidebar.classList.toggle("is-open");
          toggle.setAttribute("aria-expanded", open ? "true" : "false");
        });
        links.forEach(function (link) {
          link.addEventListener("click", function () {
            if (window.matchMedia("(max-width: 768px)").matches) {
              sidebar.classList.remove("is-open");
              toggle.setAttribute("aria-expanded", "false");
            }
          });
        });
      }

      var sections = Array.prototype.slice.call(document.querySelectorAll(".module"));
      function setActive(id) {
        links.forEach(function (link) {
          link.classList.toggle("active", link.getAttribute("data-section") === id);
        });
      }
      if ("IntersectionObserver" in window && sections.length) {
        var observer = new IntersectionObserver(
          function (entries) {
            entries.forEach(function (entry) {
              if (entry.isIntersecting) setActive(entry.target.id);
            });
          },
          { rootMargin: "-30% 0px -55% 0px", threshold: 0 }
        );
        sections.forEach(function (section) { observer.observe(section); });
      } else if (sections[0]) {
        setActive(sections[0].id);
      }
    })();
  </script>
</body>
</html>`;
}
