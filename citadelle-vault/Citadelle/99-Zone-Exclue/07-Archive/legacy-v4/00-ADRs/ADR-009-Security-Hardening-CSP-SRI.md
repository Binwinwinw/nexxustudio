# ADR-009 : Security Hardening (CSP & SRI)

**Statut** : Actif
**Version** : 1.0

## Contexte

L'audit SOTA n°1 a révélé une exposition critique aux injections XSS et aux attaques de supply chain dues à l'absence de politiques de sécurité des contenus (CSP) et d'intégrité des sous-ressources (SRI).

## Décision

**Content Security Policy (CSP)** : Chaque livrable HTML doit inclure une balise `<meta>` CSP limitant les sources de scripts aux domaines autorisés et interdisant les *inline scripts* non-négociés.

**Subresource Integrity (SRI)** : Tout script ou style chargé via un CDN tiers doit impérativement inclure un attribut `integrity` avec son hash SHA-384/512.

## Conséquences

**Protection accrue** contre les attaques XSS.

**Garantie de l'intégrité du code** front-end.

**Maintenance accrue** (nécessite la mise à jour des hashes lors du changement de version des bibliothèques).

---

### 🔗 Liens de Parenté

- [[Wiki/Wiki-ADRs-Index|🧬 Retour à l'Atlas des ADRs]]
- [[Bienvenue|⬅ Retour à l'Index Central]]
