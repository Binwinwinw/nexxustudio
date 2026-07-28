/* src/components/MermaidDiagram.jsx */
import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

const ALLOWED_TAGS = new Set([
  'svg', 'g', 'path', 'line', 'marker', 'rect', 'circle', 'ellipse', 'polygon', 'polyline',
  'text', 'tspan', 'defs', 'linearGradient', 'radialGradient', 'stop', 'pattern', 'mask',
  'clipPath'
]);

const ALLOWED_ATTRS = new Set([
  'id', 'class', 'style', 'viewBox', 'width', 'height', 'x', 'y', 'x1', 'x2', 'y1', 'y2',
  'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points', 'transform', 'fill', 'stroke', 'stroke-width',
  'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset', 'opacity',
  'fill-opacity', 'stroke-opacity', 'font-family', 'font-size', 'font-weight', 'text-anchor',
  'dominant-baseline', 'marker-start', 'marker-mid', 'marker-end', 'preserveAspectRatio',
  'gradientUnits', 'gradientTransform', 'offset', 'stop-color', 'stop-opacity', 'xmlns',
  'xmlns:xlink', 'role', 'aria-roledescription', 'focusable'
]);

function sanitizeSvg(svgMarkup) {
  if (typeof window === 'undefined' || !svgMarkup) return '';

  const parser = new DOMParser();
  const doc = parser.parseFromString(svgMarkup, 'image/svg+xml');
  const root = doc.documentElement;

  if (!root || root.nodeName === 'parsererror') {
    throw new Error('SVG Mermaid invalide.');
  }

  const nodes = Array.from(doc.querySelectorAll('*'));
  for (const node of nodes) {
    if (!ALLOWED_TAGS.has(node.tagName)) {
      node.remove();
      continue;
    }

    for (const attr of Array.from(node.attributes)) {
      const name = attr.name;
      const value = attr.value || '';
      const lowerName = name.toLowerCase();
      const lowerValue = value.toLowerCase();
      const isEventHandler = lowerName.startsWith('on');
      const isAllowed = ALLOWED_ATTRS.has(name);
      const isUnsafeRef = lowerValue.includes('javascript:') || lowerValue.includes('<script');

      if (isEventHandler || !isAllowed || isUnsafeRef) {
        node.removeAttribute(name);
      }
    }
  }

  return new XMLSerializer().serializeToString(root);
}

// Configuration initiale sécurisée
mermaid.initialize({
  startOnLoad: false, // On contrôle manuellement le rendu
  theme: 'dark',
  securityLevel: 'strict',
  themeVariables: {
    fontFamily: 'Outfit, sans-serif',
    primaryColor: '#3b82f6',
    primaryTextColor: '#fff',
    primaryBorderColor: '#2563eb',
    lineColor: '#64748b',
    secondaryColor: '#1e293b',
    tertiaryColor: '#0f172a'
  }
});

const MermaidDiagram = ({ chart }) => {
  const ref = useRef(null);
  const [svg, setSvg] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    const renderDiagram = async () => {
      if (!chart || !ref.current) return;
      
      try {
        setError(null);
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const { svg: renderedSvg } = await mermaid.render(id, chart);
        setSvg(sanitizeSvg(renderedSvg));
      } catch (err) {
        console.error('[Mermaid:RenderError]', err);
        setError("Impossible de générer le diagramme. Vérifiez la syntaxe Mermaid.");
      }
    };

    renderDiagram();
  }, [chart]);

  if (error) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-[10px] font-mono whitespace-pre-wrap">
        ⚠️ {error}
        <pre className="mt-2 text-slate-500 text-[9px]">{chart}</pre>
      </div>
    );
  }

  return (
    <div 
      ref={ref} 
      className="mermaid-wrapper flex justify-center bg-slate-900/40 p-6 rounded-xl border border-white/5 overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};

export default MermaidDiagram;
