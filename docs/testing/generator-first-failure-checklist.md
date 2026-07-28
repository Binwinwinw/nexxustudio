# Checklist — Lecture d’un échec Generator-First

## 1. Le bypass s’est-il activé ?
- Le log visible `⚡ Mode Generator-First activé : Bypass PM & Architect pour sécuriser le timeout.` apparaît-il ?
- Si non : vérifier le classifier frontend, la feature flag, et le `projectGoal` réellement envoyé.

## 2. Le flux a-t-il sauté les phases bavardes ?
- Le rendu ou les logs montrent-ils `expert_pm`, `expert_architect`, "plan d’implémentation", "open questions" ou une reformulation longue ?
- Si oui : le routage Generator-First n’a pas court-circuité correctement la chaîne.

## 3. Le livrable a-t-il réellement commencé ?
- Observe-t-on rapidement des indices concrets de production : `index.html`, `<!DOCTYPE html>`, `<html`, `sidebar`, `Slide 1`, `Questions & Contacts` ?
- Si non : suspicion de blocage orchestral, prompt mal classé, ou attente silencieuse côté frontend/backend.

## 4. Le résultat final est-il complet ?
- Le contenu contient-il les extrémités attendues du livrable ?
- Y a-t-il des signes d’illusion de complétude : `...`, `TODO`, `placeholder`, `contenu à compléter`, `lorem ipsum` ?

## 5. Le problème vient-il de l’UI ou du moteur ?
- Dans la trace Playwright, regarder :
  - onglet **Actions** : où l’action ralentit ou casse ;
  - onglet **Console** : erreurs frontend ;
  - onglet **Network** : requête longue, échec HTTP, réponse tronquée ;
  - onglet **Errors** : assertion finale ou timeout ;
  - onglet **Metadata** : durée totale, navigateur, viewport. 

## 6. Le frontend a-t-il souffert ?
- Y a-t-il un freeze visible, une interaction impossible, un timeout de locator ou une page qui ne se met plus à jour ?
- Si oui : regarder si l’event loop ou le flux de rendu semble saturé.

## 7. Le backend a-t-il probablement atteint sa limite ?
- Le bypass Generator-First est actif, mais la génération reste tronquée ou timeout malgré tout.
- Dans ce cas, ouvrir la piste ADR-016 :
  - streaming par chunks,
  - continuité de génération,
  - flush progressif,
  - reprise contrôlée.

## 8. Classification finale de l’échec
- **Classifier failure** : le mode Generator-First ne s’active pas.
- **Routing failure** : PM/Architect apparaissent encore.
- **Execution failure** : la génération ne démarre pas ou reste vide.
- **Completeness failure** : sortie partielle ou illusion de fin.
- **Transport failure** : timeout, stream coupé, réponse tronquée.
- **Selector failure** : la spec ne trouve plus l’UI mais le produit fonctionne peut-être encore.
