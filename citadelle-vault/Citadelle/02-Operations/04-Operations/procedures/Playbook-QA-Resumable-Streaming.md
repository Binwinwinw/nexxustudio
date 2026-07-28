# Playbook QA : Validation Manuelle Job Queue & Resumable Streaming

*Date : 25/05/2026*
*Objectif : Valider La Citadelle avant chaque déploiement sur les scénarios critiques (bypass, reprise réseau, kill-switch, complétude).*

## Mode Opératoire
Exécuter ces 5 requêtes dans l'ordre séquentiel. Pour chaque test, évaluer les 4 axes suivants :
- [ ] **Déclenchement** : le bypass se lance-t-il ?
- [ ] **Transport** : le flux tient-il ou reprend-il correctement ?
- [ ] **Contrôle** : le stop fonctionne-t-il vraiment ?
- [ ] **Sortie** : le contenu est-il complet et propre ?

---

## 1. Golden Test (L'Épreuve du Feu)
**Requête :**
> « Génère un fichier index.html complet pour un atelier de 20 slides sur Teams 365, avec sidebar, navigation, quiz interactif et tout le contenu rédigé en français, sans étape de planification. »

**But :** Valider le bypass Generator-First, la génération longue, la reprise résumable et la complétude finale.

- [ ] Log `Generator-First` visible.
- [ ] Le contenu avance sans blocage.
- [ ] **Action :** Provoquer une micro-coupure réseau de 5s. La coupure se rattrape sans perte (reprise sur offset).
- [ ] Le fichier final est complet et sans erreur.

---

## 2. Charge Intermédiaire
**Requête :**
> « Crée une page HTML d’une formation de 8 slides sur la cybersécurité en entreprise, avec menu latéral, exemples concrets, et un mini quiz final, sans étape de planification. »

**But :** Tester une génération suffisamment longue pour observer le comportement normal sans aller au maximum de charge.

- [ ] Bypass activé.
- [ ] Génération fluide de bout en bout.
- [ ] Sortie complète sans timeout.
- [ ] Quiz final présent et fonctionnel.

---

## 3. Reconnexion Réseau Massive
**Requête :**
> « Génère un guide HTML complet de 12 slides sur l’automatisation bureautique avec Office 365, sidebar, sections pédagogiques et exercices pratiques, sans étape de planification. »

**But :** Simuler une coupure réseau prolongée et vérifier la reprise robuste du flux `SSE`.

- [ ] **Action :** Couper le réseau pendant 15 à 30 secondes au milieu du flux.
- [ ] Le flux continue après reconnexion (buffer rejoué).
- [ ] Aucun trou dans le contenu généré.
- [ ] Le dernier événement repris correspond rigoureusement à l’offset précédent.

---

## 4. Kill-Switch (Arrêt d'Urgence)
**Requête :**
> « Rédige un document ultra détaillé de 50 chapitres sur l’histoire de Rome antique, avec structure claire, titres de chapitres, transitions et conclusion, sans étape de planification. »

**But :** Vérifier que l’arrêt d’urgence coupe réellement le job côté serveur, et pas seulement l'affichage client.

- [ ] Le flux s'annonce extrêmement long et continu.
- [ ] **Action :** Clic sur le bouton rouge `STOP`.
- [ ] L'interruption est immédiate côté frontend.
- [ ] Libération visible de la charge côté serveur (baisse VRAM, message d'interruption dans les logs `JobManager`).
- [ ] Aucune reprise "fantôme" après l'arrêt volontaire.

---

## 5. Complétude Stricte
**Requête :**
> « Rédige une fiche HTML exhaustive sur les bonnes pratiques de réunion, avec 6 sections, exemples, points d’attention et conclusion professionnelle, sans étape de planification. »

**But :** Valider que le système ne s’arrête pas prématurément sur une sortie partielle ou “presque finie”.

- [ ] Le document comporte bien les 6 sections demandées, y compris la conclusion.
- [ ] Aucune illusion de complétude (le texte ne s'arrête pas net).
- [ ] Aucune balise ou zone laissée en placeholder.
