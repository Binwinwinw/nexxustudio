# Lot : `<nom-du-lot>`

> Copier ce fichier ou remplir inline dans le chat. Une fiche = un lot autonome.

## Objectif

<!-- Une phrase : quel rouge / quelle feature, quel comportement attendu -->

## Plan

| Étape | Action | Fichiers / tests | Critère de succès |
|-------|--------|------------------|-------------------|
| 1 | | | |
| 2 | | | |

**Hors périmètre (ne pas toucher)** :

- 

## Exécution

- [ ] Modifs code
- [ ] Tests ciblés lancés
- [ ] Linter / smoke si pertinent

## Preuves

### Tests

```
<!-- Coller la sortie exacte : pass/fail, suites, durée -->
```

### Commits

| Hash | Message | Fichiers |
|------|---------|----------|
| | | |

### Rapports / logs

- Chemin :
- Extrait :

## Vérification

- [ ] Plan ↔ diff cohérents
- [ ] Tous les tests annoncés passent (sortie collée)
- [ ] Pas de mélange de lots
- [ ] Rouges hors scope laissés documentés, pas « réparés » par accident

## Statut

- [ ] **Done** — preuves validées, commit(s) posé(s) si demandé
- [ ] **Bloqué** — raison :
- [ ] **Partiel** — ce qui reste :

---

## Exemple minimal (chantier B — familiarity)

**Objectif** : `lexicon_explain_light` ne gagne plus sur `familiarity_domain_overview` pour « Tu connais la politique française ? ».

**Preuve tests** :

```
ℹ tests 7
ℹ pass 7
ℹ fail 0
```

**Commit proposé** (code seul) :

```
fix(agent/routing): defer lexicon to familiarity domain overview
```

**Statut** : done code + verif ; commit en attente demande utilisateur.
