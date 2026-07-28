/* server/public/analytics/dashboard.js */

document.addEventListener('DOMContentLoaded', () => {
  const timeSelect = document.getElementById('time-window-select');
  const spinnerOverlay = document.getElementById('loading-spinner-overlay');

  // Initialisation du chargement
  loadDashboardData(timeSelect.value);

  // Événement de changement de période
  timeSelect.addEventListener('change', (e) => {
    loadDashboardData(e.target.value);
  });
});

// ── Échappement Sécurisé Anti-XSS (Doctrine de Sécurité) ─────────────────────
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  const stringVal = typeof str === 'string' ? str : String(str);
  return stringVal
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Chargement des Données depuis l'API ─────────────────────────────────────
async function loadDashboardData(days) {
  showSpinner(true);
  try {
    const [analyticsRes, workspacesRes] = await Promise.all([
      fetch(`/api/analytics/metrics?days=${days}`),
      fetch(`/api/workspaces/health`)
    ]);

    if (!analyticsRes.ok) throw new Error(`Erreur HTTP Analytics : ${analyticsRes.status}`);

    const data = await analyticsRes.json();
    if (data.success) {
      renderDashboard(data);
    } else {
      showErrorState("Le serveur a retourné une réponse invalide pour l'observabilité.");
    }

    if (workspacesRes.ok) {
      const wsData = await workspacesRes.json();
      renderWorkspacesDashboard(wsData);
    } else {
      console.warn("Impossible de charger la santé des Workspaces (Droits insuffisants ou erreur).");
    }

  } catch (error) {
    console.error("[Dashboard] Fetch failed:", error);
    showErrorState(error.message);
  } finally {
    showSpinner(false);
  }
}

function showSpinner(show) {
  const overlay = document.getElementById('loading-spinner-overlay');
  if (overlay) {
    overlay.style.opacity = show ? '1' : '0';
    overlay.style.pointerEvents = show ? 'all' : 'none';
  }
}

function showErrorState(message) {
  console.error("Dashboard Error State active:", message);
  const container = document.querySelector('.content-viewport');
  if (container) {
    let banner = document.getElementById('api-error-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'api-error-banner';
      // Correction du CSS: justify-content: space-between
      banner.style.cssText = 'background-color:rgba(239,68,68,0.1); border:1px solid hsl(352,75%,52%); color:hsl(352,75%,52%); padding:16px; border-radius:8px; font-size:14px; display:flex; align-items:center; justify-content: space-between; width:100%; transition: all 0.3s ease;';
      container.prepend(banner);
    }
    
    // Remplacement anti-XSS radical : aucun innerHTML injecté
    banner.innerHTML = '';
    
    const messageSpan = document.createElement('span');
    const labelStrong = document.createElement('strong');
    labelStrong.textContent = "Alerte Connexion API : ";
    messageSpan.appendChild(labelStrong);

    const messageText = document.createTextNode(`${message} — Mode dégradé de secours activé.`);
    messageSpan.appendChild(messageText);

    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
    closeButton.style.cssText = 'background:none; border:none; color:inherit; cursor:pointer; font-weight:bold; margin-left:20px; font-size: 16px;';
    closeButton.addEventListener('click', () => {
      banner.remove();
    });

    banner.appendChild(messageSpan);
    banner.appendChild(closeButton);
  }
}

// ── Rendu Global du Dashboard ───────────────────────────────────────────────
function renderDashboard(data) {
  // 1. Télémétrie Système (Topbar)
  const statusWarmupEl = document.getElementById('status-warmup');
  statusWarmupEl.textContent = data.system_status.warmup_ready ? 'READY / OPTIMAL' : 'WARMING UP';
  statusWarmupEl.style.color = data.system_status.warmup_ready ? 'var(--accent-green)' : 'var(--accent-orange)';
  
  const statusVramEl = document.getElementById('status-vram');
  statusVramEl.textContent = `${data.system_status.vram_pressure_pct}%`;
  statusVramEl.style.color = data.system_status.vram_pressure_pct > 80 ? 'var(--accent-red)' : 'var(--accent-blue)';
  
  const statusGovEl = document.getElementById('status-gov');
  statusGovEl.textContent = escapeHtml(data.system_status.governance_mode);
  statusGovEl.style.color = data.system_status.governance_mode === 'CRUISE' ? 'var(--accent-green)' : 'var(--accent-orange)';

  // Mise à jour de la source du graphe
  const sourceLbl = document.getElementById('system-source-lbl');
  if (data.source === 'database') {
    sourceLbl.textContent = 'Base Active';
    sourceLbl.parentElement.style.borderColor = 'var(--accent-green)';
  } else {
    // Mode dégradé ou mock
    const reason = data.degraded_reason ? ` (${data.degraded_reason})` : '';
    sourceLbl.textContent = `Résilience Active${escapeHtml(reason)}`;
    sourceLbl.parentElement.style.borderColor = 'var(--accent-orange)';
  }

  // 2. KPIs Top Row (Chiffres animés avec tabular-nums)
  animateCounter('kpi-total-runs', data.kpis.total_runs);
  animateCounterPercent('kpi-rejection-rate', data.kpis.rejection_rate_pct);
  animateCounter('kpi-failed-safe', data.kpis.failed_safe_runs);
  animateCounterMs('kpi-avg-latency', data.kpis.avg_latency_ms);
  animateCounterMs('kpi-avg-critic-latency', data.kpis.avg_critic_latency_ms);

  // 3. Section Graphique d'Évolution (SVG Dynamique)
  renderTrendSvg(data.verdict_trend);

  // 4. Section Modes d'Échec Dominants
  renderFailureModes(data.failure_modes);

  // 5. Section Table de Détails Récents
  renderEventsTable(data.recent_events);
}

// ── Rendu de la Vue Santé Workspaces ─────────────────────────────────────────
function renderWorkspacesDashboard(data) {
  if (!data) return;

  // KPI Cards
  animateCounter('ws-active-runs', data.active_runs || 0);
  animateCounter('ws-orphans', data.orphans_count || 0);
  animateCounter('ws-recent-errors', data.recent_failures ? data.recent_failures.length : 0);
  animateCounterMs('ws-avg-duration', data.average_run_duration_ms || 0);

  // Distribution par Statut
  const statusContainer = document.getElementById('ws-status-distribution');
  if (statusContainer) {
    statusContainer.innerHTML = '';
    const statuses = Object.entries(data.workspaces_by_status || {});
    if (statuses.length === 0) {
      statusContainer.innerHTML = '<div style="color:var(--color-text-muted);font-size:13px;padding:10px;">Aucun workspace enregistré.</div>';
    } else {
      statuses.forEach(([status, count]) => {
        const div = document.createElement('div');
        div.className = 'failure-item';
        const spanName = document.createElement('span');
        spanName.className = 'failure-name';
        spanName.textContent = status.toUpperCase();
        const spanCount = document.createElement('span');
        spanCount.className = 'failure-count-badge tabular-nums';
        spanCount.style.backgroundColor = 'var(--accent-blue-alpha)';
        spanCount.style.color = 'var(--accent-blue)';
        spanCount.textContent = count;
        div.appendChild(spanName);
        div.appendChild(spanCount);
        statusContainer.appendChild(div);
      });
    }
  }

  // Profils Réseau
  const networkContainer = document.getElementById('ws-network-distribution');
  if (networkContainer) {
    networkContainer.innerHTML = '';
    const networks = Object.entries(data.network_profile_distribution || {});
    if (networks.length === 0) {
      networkContainer.innerHTML = '<div style="color:var(--color-text-muted);font-size:13px;padding:10px;">Aucun run récent.</div>';
    } else {
      networks.forEach(([net, count]) => {
        const div = document.createElement('div');
        div.className = 'failure-item';
        const spanName = document.createElement('span');
        spanName.className = 'failure-name';
        spanName.textContent = net === 'none' ? 'ISOLÉ (NONE)' : net.toUpperCase();
        const spanCount = document.createElement('span');
        spanCount.className = 'failure-count-badge tabular-nums';
        spanCount.style.backgroundColor = 'var(--accent-green-alpha)';
        spanCount.style.color = 'var(--accent-green)';
        spanCount.textContent = count;
        div.appendChild(spanName);
        div.appendChild(spanCount);
        networkContainer.appendChild(div);
      });
    }
  }

  // Dernières Erreurs
  const tbody = document.getElementById('ws-recent-failures-body');
  if (tbody) {
    tbody.innerHTML = '';
    const failures = data.recent_failures || [];
    if (failures.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 3;
      td.style.textAlign = 'center';
      td.style.color = 'var(--color-text-muted)';
      td.textContent = "Aucune erreur récente.";
      tr.appendChild(td);
      tbody.appendChild(tr);
    } else {
      failures.forEach(f => {
        const tr = document.createElement('tr');
        const tdRun = document.createElement('td');
        tdRun.className = 'tabular-nums';
        tdRun.textContent = f.runId;
        const tdWs = document.createElement('td');
        tdWs.textContent = f.workspaceId;
        const tdErr = document.createElement('td');
        tdErr.style.color = 'var(--accent-red)';
        tdErr.style.fontWeight = '600';
        tdErr.textContent = f.error;
        tr.appendChild(tdRun);
        tr.appendChild(tdWs);
        tr.appendChild(tdErr);
        tbody.appendChild(tr);
      });
    }
  }
}

// ── Helpers Animations des Compteurs ────────────────────────────────────────
function animateCounter(id, targetValue) {
  const el = document.getElementById(id);
  if (!el) return;
  
  const start = 0;
  const duration = 800;
  const startTime = performance.now();

  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const value = Math.floor(start + progress * (targetValue - start));
    el.textContent = value;

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      el.textContent = targetValue;
    }
  }
  requestAnimationFrame(update);
}

function animateCounterPercent(id, targetValue) {
  const el = document.getElementById(id);
  if (!el) return;
  
  const start = 0;
  const duration = 800;
  const startTime = performance.now();

  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const value = (start + progress * (targetValue - start)).toFixed(1);
    el.textContent = `${value}%`;

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      el.textContent = `${targetValue.toFixed(1)}%`;
    }
  }
  requestAnimationFrame(update);
}

function animateCounterMs(id, targetValue) {
  const el = document.getElementById(id);
  if (!el) return;
  
  const start = 0;
  const duration = 800;
  const startTime = performance.now();

  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const value = Math.floor(start + progress * (targetValue - start));
    el.textContent = `${value} ms`;

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      el.textContent = `${Math.round(targetValue)} ms`;
    }
  }
  requestAnimationFrame(update);
}

// ── Tracé Vectoriel SVG Haute Fidélité (Sans Dépendance Tierce) ─────────────
function renderTrendSvg(trendData) {
  const container = document.getElementById('trend-chart-box');
  if (!container) return;

  if (!trendData || trendData.length === 0) {
    container.innerHTML = '';
    const fallback = document.createElement('div');
    fallback.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%;color:var(--color-text-muted);font-size:13px;';
    fallback.textContent = 'Aucune tendance temporelle disponible.';
    container.appendChild(fallback);
    return;
  }

  // Dimensions
  const width = container.clientWidth || 700;
  const height = 240;
  const paddingX = 50;
  const paddingY = 30;

  const maxVal = Math.max(...trendData.map(d => d.total_runs), 5);
  const steps = trendData.length;
  const stepX = (width - paddingX * 2) / (steps - 1 || 1);

  // Génération hautement sécurisée via createElementNS (Doctrine XSS absolue)
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('preserveAspectRatio', 'none');

  const defs = document.createElementNS(svgNS, 'defs');
  const grad = document.createElementNS(svgNS, 'linearGradient');
  grad.setAttribute('id', 'area-grad');
  grad.setAttribute('x1', '0');
  grad.setAttribute('y1', '0');
  grad.setAttribute('x2', '0');
  grad.setAttribute('y2', '1');

  const stop1 = document.createElementNS(svgNS, 'stop');
  stop1.setAttribute('offset', '0%');
  stop1.setAttribute('stop-color', 'var(--accent-blue)');
  stop1.setAttribute('stop-opacity', '0.3');

  const stop2 = document.createElementNS(svgNS, 'stop');
  stop2.setAttribute('offset', '100%');
  stop2.setAttribute('stop-color', 'var(--accent-blue)');
  stop2.setAttribute('stop-opacity', '0.0');

  grad.appendChild(stop1);
  grad.appendChild(stop2);
  defs.appendChild(grad);
  svg.appendChild(defs);

  // Construction de la grille d'arrière-plan
  const gridCount = 4;
  for (let i = 0; i <= gridCount; i++) {
    const y = paddingY + (i / gridCount) * (height - paddingY * 2);
    const value = Math.round(maxVal - (i / gridCount) * maxVal);

    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', String(paddingX));
    line.setAttribute('y1', String(y));
    line.setAttribute('x2', String(width - paddingX));
    line.setAttribute('y2', String(y));
    line.setAttribute('stroke', 'var(--border-color)');
    line.setAttribute('stroke-width', '1');
    line.setAttribute('stroke-dasharray', '4,4');
    svg.appendChild(line);

    const text = document.createElementNS(svgNS, 'text');
    text.setAttribute('x', String(paddingX - 10));
    text.setAttribute('y', String(y + 4));
    text.setAttribute('fill', 'var(--color-text-muted)');
    text.setAttribute('font-size', '10');
    text.setAttribute('text-anchor', 'end');
    text.setAttribute('font-variant-numeric', 'tabular-nums');
    text.textContent = String(value);
    svg.appendChild(text);
  }

  // Génération des points et tracés
  let linePoints = [];
  let areaPointsStr = `${paddingX},${height - paddingY} `;

  trendData.forEach((d, idx) => {
    const x = paddingX + idx * stepX;
    const y = height - paddingY - ((d.total_runs / maxVal) * (height - paddingY * 2));
    linePoints.push({ x, y, date: d.day, val: d.total_runs });
    areaPointsStr += `${x},${y} `;
  });
  areaPointsStr += `${paddingX + (steps - 1) * stepX},${height - paddingY}`;

  const linePath = linePoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  // Remplissage dégradé de la surface
  const polygon = document.createElementNS(svgNS, 'polygon');
  polygon.setAttribute('points', areaPointsStr);
  polygon.setAttribute('fill', 'url(#area-grad)');
  svg.appendChild(polygon);

  // Tracé de la ligne principale
  const path = document.createElementNS(svgNS, 'path');
  path.setAttribute('d', linePath);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'var(--accent-blue)');
  path.setAttribute('stroke-width', '2.5');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(path);

  // Datelabels dates en bas
  const labelInterval = Math.max(1, Math.floor(steps / 5));
  trendData.forEach((d, idx) => {
    if (idx % labelInterval === 0 || idx === steps - 1) {
      const x = paddingX + idx * stepX;
      const parts = d.day.split('-');
      const label = parts.length === 3 ? `${parts[2]}/${parts[1]}` : d.day;
      
      const text = document.createElementNS(svgNS, 'text');
      text.setAttribute('x', String(x));
      text.setAttribute('y', String(height - 10));
      text.setAttribute('fill', 'var(--color-text-muted)');
      text.setAttribute('font-size', '10');
      text.setAttribute('text-anchor', 'middle');
      text.textContent = label;
      svg.appendChild(text);
    }
  });

  // Points (Dots) interactifs au-dessus du tracé
  linePoints.forEach((p) => {
    const circle = document.createElementNS(svgNS, 'circle');
    circle.setAttribute('cx', String(p.x));
    circle.setAttribute('cy', String(p.y));
    circle.setAttribute('r', '4');
    circle.setAttribute('fill', 'var(--accent-blue)');
    circle.setAttribute('stroke', 'var(--bg-main)');
    circle.setAttribute('stroke-width', '2');
    svg.appendChild(circle);

    const text = document.createElementNS(svgNS, 'text');
    text.setAttribute('x', String(p.x));
    text.setAttribute('y', String(p.y - 10));
    text.setAttribute('fill', 'var(--color-text-primary)');
    text.setAttribute('font-size', '10');
    text.setAttribute('font-weight', '600');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-variant-numeric', 'tabular-nums');
    text.textContent = String(p.val);
    svg.appendChild(text);
  });

  container.innerHTML = '';
  container.appendChild(svg);
}

// ── Rendu des Failure Modes (Anti-XSS par textContent) ──────────────────────
function renderFailureModes(modes) {
  const container = document.getElementById('failure-modes-box');
  if (!container) return;

  if (!modes || modes.length === 0) {
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--color-text-muted);font-size:13px;">Aucun incident à signaler sur cette période.</div>';
    return;
  }

  container.innerHTML = '';
  modes.forEach(mode => {
    const item = document.createElement('div');
    item.className = 'failure-item';
    
    const label = mode.failure_mode
      .replace('rejected_', 'Rejet : ')
      .replace('_', ' ');

    // Construction du DOM sécurisée contre les failles XSS
    const nameSpan = document.createElement('span');
    nameSpan.className = 'failure-name';
    nameSpan.textContent = label;

    const countBadge = document.createElement('span');
    countBadge.className = 'failure-count-badge tabular-nums';
    countBadge.textContent = `${mode.total} run(s)`;

    item.appendChild(nameSpan);
    item.appendChild(countBadge);
    container.appendChild(item);
  });
}

// ── Rendu du Journal des Événements Récents (Anti-XSS strict) ────────────────
function renderEventsTable(events) {
  const tbody = document.getElementById('events-table-body');
  if (!tbody) return;

  if (!events || events.length === 0) {
    tbody.innerHTML = '';
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 7;
    td.style.textAlign = 'center';
    td.style.color = 'var(--color-text-muted)';
    td.textContent = "Aucune donnée d'exécution disponible.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  tbody.innerHTML = '';
  events.forEach(e => {
    const tr = document.createElement('tr');
    
    // Déterminer la classe css de badge verdict
    let verdictClass = 'approved';
    let verdictLabel = 'Approved';
    if (e.overall_verdict.includes('rejected')) {
      verdictClass = 'rejected';
      verdictLabel = 'REJECTED';
    } else if (e.overall_verdict === 'approved_with_caveats') {
      verdictClass = 'approved_with_caveats';
      verdictLabel = 'APPROVED WITH CAVEATS';
    } else if (e.overall_verdict === 'failed_safe') {
      verdictClass = 'failed_safe';
      verdictLabel = 'FAILED SAFE';
    }

    // Horodatage sécurisé et harmonisé
    let dateStr = 'Horodatage inconnu';
    try {
      if (e.created_at) {
        const dateObj = new Date(e.created_at);
        if (!isNaN(dateObj.getTime())) {
          dateStr = dateObj.toLocaleDateString('fr-FR', { 
            day: '2-digit', 
            month: '2-digit', 
            hour: '2-digit', 
            minute: '2-digit' 
          });
        }
      }
    } catch (err) {
      console.error("[Dashboard] Date formatting crash:", err);
    }

    // ID
    const tdId = document.createElement('td');
    tdId.className = 'tabular-nums';
    tdId.style.fontWeight = '600';
    tdId.style.color = 'var(--color-text-muted)';
    tdId.textContent = e.id;
    tr.appendChild(tdId);

    // Session ID
    const tdSession = document.createElement('td');
    tdSession.style.color = 'var(--accent-blue)';
    tdSession.style.fontWeight = '500';
    tdSession.textContent = e.session_id;
    tr.appendChild(tdSession);

    // Verdict Badge
    const tdVerdict = document.createElement('td');
    const spanVerdict = document.createElement('span');
    spanVerdict.className = `verdict-tag ${verdictClass}`;
    spanVerdict.textContent = verdictLabel;
    tdVerdict.appendChild(spanVerdict);
    tr.appendChild(tdVerdict);

    // Latency
    const tdLatency = document.createElement('td');
    tdLatency.className = 'tabular-nums';
    tdLatency.textContent = `${e.latency_ms} ms`;
    tr.appendChild(tdLatency);

    // Critic Latency
    const tdCritic = document.createElement('td');
    tdCritic.className = 'tabular-nums';
    tdCritic.style.color = 'var(--accent-blue)';
    tdCritic.textContent = `${e.critic_latency_ms} ms`;
    tr.appendChild(tdCritic);

    // Sources (Web / Local)
    const tdSources = document.createElement('td');
    tdSources.className = 'tabular-nums';
    tdSources.style.color = 'var(--color-text-secondary)';

    tdSources.appendChild(document.createTextNode('Web : '));
    const strongWeb = document.createElement('strong');
    strongWeb.textContent = e.web_sources_count ?? 0;
    tdSources.appendChild(strongWeb);

    tdSources.appendChild(document.createTextNode(' / Local : '));
    const strongLocal = document.createElement('strong');
    strongLocal.textContent = e.local_sources_count ?? 0;
    tdSources.appendChild(strongLocal);
    
    tr.appendChild(tdSources);

    // Horodatage
    const tdTime = document.createElement('td');
    tdTime.className = 'tabular-nums';
    tdTime.style.color = 'var(--color-text-muted)';
    tdTime.textContent = dateStr;
    tr.appendChild(tdTime);

    tbody.appendChild(tr);
  });
}
