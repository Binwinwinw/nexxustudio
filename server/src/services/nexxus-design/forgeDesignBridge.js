/**
 * Bridge Nexxus Design → Forge — blueprint.md, App.jsx, manifest composants.
 */

export const FORGE_SCAFFOLD_TEMPLATE = 'react-vite';

function escAttr(value = '') {
  return String(value).replace(/"/g, '\\"');
}

/**
 * @param {object} createEnvelope — nexxus.design.create_result
 */
export function renderBlueprintMarkdown(createEnvelope = {}) {
  const { blueprint, tokens, components, page_structure, ux_copy, assembly } = createEnvelope;
  const lines = [
    '# Blueprint Nexxus Design',
    '',
    `- Objectif : **${createEnvelope.objective}**`,
    `- Layout : \`${blueprint?.layout || '—'}\``,
    `- Template Forge : \`${assembly?.scaffold_template || FORGE_SCAFFOLD_TEMPLATE}\``,
    `- Source Extract : ${createEnvelope.source?.extract_url || 'inline'}`,
    '',
    '## Tokens',
    '',
    `- Primary : \`${tokens?.colors?.primary || '—'}\``,
    `- Accent : \`${tokens?.colors?.accent || '—'}\``,
    `- Surface : \`${tokens?.colors?.surface || '—'}\``,
    `- Typo : ${tokens?.typography?.families?.[0]?.name || 'Inter'}`,
    '',
    '## Layout signatures',
    '',
  ];

  for (const entry of blueprint?.layout_signatures || []) {
    lines.push(`- ${entry.pattern} (confidence ${entry.confidence})`);
  }

  lines.push('', '## Composants', '');
  for (const component of components || []) {
    lines.push(`- **${component.id}** (${component.role})`);
  }

  lines.push('', '## Structure de page', '');
  for (const section of page_structure || []) {
    lines.push(`- \`${section.id}\` — ${section.role} → ${(section.children || []).join(', ')}`);
  }

  lines.push('', '## UX copy', '');
  for (const [key, value] of Object.entries(ux_copy || {})) {
    if (value) lines.push(`- ${key} : ${value}`);
  }

  if ((blueprint?.assembly_notes || []).length > 0) {
    lines.push('', '## Notes d\'assemblage', '');
    for (const note of blueprint.assembly_notes) {
      lines.push(`- ${note}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

/**
 * @param {object} createEnvelope
 */
export function renderAppJsx(createEnvelope = {}) {
  const objective = createEnvelope.objective || 'landing';
  const colors = createEnvelope.tokens?.colors || {};
  const copy = createEnvelope.ux_copy || {};
  const primary = colors.primary || '#0f172a';
  const accent = colors.accent || colors.primary || '#6366f1';
  const surface = colors.surface || '#f8fafc';
  const text = colors.text || primary;

  if (objective === 'cockpit') {
    return `function App() {
  return (
    <div className="min-h-screen p-4 text-[${escAttr(text)}]" style={{ backgroundColor: '${escAttr(primary)}' }}>
      <header className="mb-6">
        <h1 className="text-2xl font-bold">${escAttr(copy.headline || 'Dashboard')}</h1>
        <p className="text-sm opacity-80">${escAttr(copy.subheadline || '')}</p>
      </header>
      <main className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {['Jobs actifs', 'Succès', 'Latence P50'].map((label) => (
            <div key={label} className="rounded-xl p-4" style={{ backgroundColor: '#1e293b' }}>
              <div className="text-2xl font-semibold text-[${escAttr(accent)}]">42</div>
              <div className="text-xs opacity-70">{label}</div>
            </div>
          ))}
        </div>
        <table className="w-full rounded-xl overflow-hidden text-sm" style={{ backgroundColor: '#1e293b' }}>
          <thead>
            <tr className="text-left opacity-70">
              <th className="p-3">Service</th>
              <th className="p-3">Statut</th>
              <th className="p-3">Latence</th>
            </tr>
          </thead>
          <tbody>
            <tr><td className="p-3">Browser Harness</td><td className="p-3">OK</td><td className="p-3">45ms</td></tr>
            <tr><td className="p-3">Design Extract</td><td className="p-3">OK</td><td className="p-3">120ms</td></tr>
          </tbody>
        </table>
      </main>
    </div>
  );
}

export default App;
`;
  }

  if (objective === 'design_system') {
    return `function App() {
  return (
    <div className="min-h-screen p-8" style={{ backgroundColor: '${escAttr(surface)}', color: '${escAttr(text)}' }}>
      <main className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-3xl font-bold">${escAttr(copy.headline || 'Composants')}</h1>
        <p className="opacity-80">${escAttr(copy.subheadline || '')}</p>
        <section className="rounded-2xl p-6 shadow-sm space-y-4" style={{ backgroundColor: '#ffffff' }}>
          <div className="flex gap-2">
            <span className="rounded-full px-3 py-1 text-sm text-white" style={{ backgroundColor: '#10b981' }}>Actif</span>
            <span className="rounded-full px-3 py-1 text-sm text-white" style={{ backgroundColor: '#f59e0b' }}>Beta</span>
          </div>
          <button type="button" className="rounded-lg px-5 py-2 font-semibold text-white" style={{ backgroundColor: '${escAttr(accent)}' }}>
            ${escAttr(copy.cta || 'Action')}
          </button>
          <button type="button" className="rounded-lg px-5 py-2" style={{ backgroundColor: '#e2e8f0', color: '${escAttr(primary)}' }}>
            Secondaire
          </button>
        </section>
      </main>
    </div>
  );
}

export default App;
`;
  }

  return `function App() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '${escAttr(surface)}', color: '${escAttr(text)}' }}>
      <header className="border-b px-6 py-4" style={{ borderColor: '${escAttr(primary)}22' }}>
        <nav className="font-medium">Menu</nav>
      </header>
      <main>
        <section className="px-6 py-16 text-center">
          <h1 className="text-4xl font-bold mb-2">${escAttr(copy.headline || 'La Citadelle')}</h1>
          <h2 className="text-xl opacity-80 mb-8">${escAttr(copy.subheadline || '')}</h2>
        </section>
        <article className="mx-auto max-w-2xl rounded-2xl p-6 mb-12 shadow-sm" style={{ backgroundColor: '#ffffff' }}>
          <p className="mb-6">Design system local-first pour Nexxus Studio.</p>
          <a href="#forge" className="inline-block rounded-lg px-6 py-3 font-semibold text-white" style={{ backgroundColor: '${escAttr(accent)}' }}>
            ${escAttr(copy.cta || 'Découvrir')}
          </a>
        </article>
      </main>
      <footer className="px-6 py-8 text-center text-sm opacity-60">© Nexxus Studio</footer>
    </div>
  );
}

export default App;
`;
}

/**
 * @param {object} createEnvelope
 */
export function buildComponentsManifest(createEnvelope = {}) {
  return {
    version: '1.0.0',
    kind: 'nexxus.forge.components_manifest',
    objective: createEnvelope.objective,
    scaffold_template: createEnvelope.assembly?.scaffold_template || FORGE_SCAFFOLD_TEMPLATE,
    components: (createEnvelope.components || []).map((entry) => ({
      id: entry.id,
      role: entry.role,
      props: entry.props,
      tailwind_hint: entry.tailwind,
    })),
    page_structure: createEnvelope.page_structure || [],
    generated_at: new Date().toISOString(),
  };
}

/**
 * @param {object} createEnvelope
 * @param {object} [options]
 * @param {string} [options.projectTitle]
 */
export function buildForgeScaffold(createEnvelope = {}, options = {}) {
  const projectTitle = options.projectTitle || `Nexxus ${createEnvelope.objective || 'UI'}`;
  const appJsx = renderAppJsx(createEnvelope);
  const blueprintMd = renderBlueprintMarkdown(createEnvelope);
  const manifest = buildComponentsManifest(createEnvelope);

  return {
    scaffold_template: FORGE_SCAFFOLD_TEMPLATE,
    project_title: projectTitle,
    files: {
      'blueprint.md': blueprintMd,
      'src/App.jsx': appJsx,
      'components-manifest.json': JSON.stringify(manifest, null, 2),
      'forge-scaffold.json': JSON.stringify(
        {
          template: FORGE_SCAFFOLD_TEMPLATE,
          objective: createEnvelope.objective,
          layout: createEnvelope.blueprint?.layout,
          source_url: createEnvelope.source?.extract_url,
        },
        null,
        2,
      ),
    },
    manifest,
  };
}

export default {
  FORGE_SCAFFOLD_TEMPLATE,
  renderBlueprintMarkdown,
  renderAppJsx,
  buildComponentsManifest,
  buildForgeScaffold,
};
