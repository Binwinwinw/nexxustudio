# SKILL.md — Design UI/UX Pro (Tailwind, palettes réelles)

## Objectif
Créer des interfaces modernes, crédibles, inspirées de vraies apps (pas de couleurs IA génériques). Utiliser Tailwind CSS, palettes réelles, gradients variés, et patterns issus de sites de référence.

## Palettes & Gradients (sources réelles)
- **UI Colors – Tailwind CSS Color Generator**
  - https://uiuxshowcase.com/resources/ui-colors-tailwind-css-color-generator/
- **Shadcn Colors**
  - https://allutilitycss.com/tools/category/colors/
- **Tailscan Gradients**
  - https://tailscan.com/gradients
- **Octet Design Labs — 31 Gradient Palettes**
  - https://octet.design/colors/user-interfaces/gradient-based-ui-design/

### Exemples Tailwind (à utiliser ou adapter)
- `bg-gradient-to-br from-sky-50 via-blue-100 to-indigo-200`
- `bg-gradient-to-tr from-slate-900 via-gray-800 to-slate-700`
- `bg-gradient-to-r from-fuchsia-500 via-red-600 to-orange-400`
- `bg-gradient-to-bl from-emerald-200 via-emerald-400 to-cyan-400`

## Patterns par composant

### Topbar
- Structure : `flex items-center justify-between px-6 py-3 bg-gradient-to-r from-slate-900 via-gray-800 to-slate-700 shadow-lg`
- Accent : logo à gauche, actions à droite, bouton accent `bg-fuchsia-600 hover:bg-fuchsia-700`
- Inspiration : [TailwindUI Navbars](https://tailwindui.com/components/application-ui/navigation/navbars)

### Card
- Structure : `rounded-2xl shadow-lg bg-white/90 border border-slate-200 p-6 hover:shadow-xl transition`
- Gradient subtil en fond : `bg-gradient-to-br from-emerald-50 to-white`
- Accent : badge ou icône colorée, bouton accent `bg-indigo-600 hover:bg-indigo-700`
- Inspiration : [RefactoringUI Cards](https://refactoringui.com/book/)

### Dashboard
- Fond : `bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 min-h-screen`
- Widget : `rounded-xl bg-white/80 shadow p-4 border border-slate-100`
- Accent : `text-indigo-700`, `bg-fuchsia-100` pour les alertes
- Inspiration : [Medium Real-World UI/UX](https://medium.com/@stheodorejohn/10-real-world-ui-ux-designs-using-tailwind-css-decoding-real-world-examples-8bb945650dcd)

### Login
- Fond : `bg-gradient-to-tr from-indigo-200 via-fuchsia-100 to-white min-h-screen flex items-center justify-center`
- Card : `rounded-2xl shadow-xl bg-white/95 p-8 border border-indigo-100`
- Bouton : `bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg px-6 py-3`
- Inspiration : [Color Hunt Palettes](https://colorhunt.co/)

### Chat
- Bubble user : `bg-gradient-to-r from-fuchsia-100 to-indigo-100 rounded-2xl px-4 py-2 shadow`
- Bubble bot : `bg-gradient-to-r from-slate-100 to-white rounded-2xl px-4 py-2 shadow`
- Input : `border rounded-lg px-4 py-2 focus:ring-2 focus:ring-fuchsia-400`
- Inspiration : [Tailscan Gradients](https://tailscan.com/gradients)

### CRUD Table
- Table : `w-full rounded-xl overflow-hidden shadow bg-white/95`
- Header : `bg-gradient-to-r from-indigo-100 to-fuchsia-100 text-slate-700 font-bold`
- Row hover : `hover:bg-fuchsia-50 transition`
- Bouton action : `bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded px-3 py-1`

## Checklist anti-IA
- Jamais de bleu #3b82f6 seul, ni de gris #e5e7eb en fond principal
- Toujours valider le rendu sur https://tailwindui.com ou https://dribbble.com
- Utiliser au moins un gradient ou une palette issue d’une source réelle
- Tester l’accessibilité (contraste, lisibilité)
- Éviter les couleurs “flashy” ou “ternes” non utilisées dans des apps réelles

## Sources d’inspiration
- https://uiuxshowcase.com/resources/ui-colors-tailwind-css-color-generator/
- https://allutilitycss.com/tools/category/colors/
- https://tailscan.com/gradients
- https://octet.design/colors/user-interfaces/gradient-based-ui-design/
- https://medium.com/@stheodorejohn/10-real-world-ui-ux-designs-using-tailwind-css-decoding-real-world-examples-8bb945650dcd
- https://refactoringui.com/book/
- https://colorhunt.co/
- https://dribbble.com/
