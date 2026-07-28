# Checklist : Egress Security

- [ ] URL cible validée (pas localhost / metadata / IP privée) ?
- [ ] Résultat web scanné avant injection contexte ?
- [ ] Patterns injection indirecte détectés et neutralisés ?
- [ ] Refus explicite si egress interdit ?
- [ ] Log audit : source, décision, longueur contenu ?
- [ ] Pas d'exécution de consigne embarquée dans snippet web ?
