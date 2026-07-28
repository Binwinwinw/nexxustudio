# Skill: Liquid Glass UI Design

## Purpose
Maintain and evolve the Nexxus Studio premium aesthetic based on the "Liquid Glass" and "Deep Space" theme.

## Design Tokens
- **Background**: Deep Space (#020617) with subtle radial gradients (Blue/Violet).
- **Surfaces**: High translucency (rgba(17, 25, 40, 0.6)), backdrop blur (12px), and subtle saturation.
- **Accents**: Blue (#3b82f6) with glows, Emerald (#10b981) for success.
- **Typography**: Inter (UI), Fira Code (Console).

## Interaction Rules
1. **Flow**: Smooth transitions (0.5s - 0.8s) for all state changes.
2. **Micro-animations**: Orbitals on active phases, scanning line on consoles, ping effects on status indicators.
3. **Responsiveness**: Support for multiple viewports from mobile to ultra-wide.

## Implementation
- Use Vanilla CSS variables in `src/styles/glass.css`.
- Avoid Tailwind utility classes for core design tokens to keep the style unique.
