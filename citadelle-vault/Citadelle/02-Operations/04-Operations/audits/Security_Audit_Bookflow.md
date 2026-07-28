# 🛡️ Audit Sécurité : Bookflow

**Date :** 09 Mai 2026
**Cible :** `projects/bookflow` (Frontend & Backend)
**Statut Global :** ⚠️ **Action Requise** (Maturité : 7/10)

## 1. Analyse des Dépendances (`npm audit`)

| Composant | Statut | Détails |
| :--- | :--- | :--- |
| **Backend** | ✅ Sain | 0 vulnérabilité détectée. |
| **Frontend** | ❌ Critique | **1 vulnérabilité High** détectée dans `axios`. |

> [!CAUTION]
> **Alerte Axios (High)** : Risque de *Prototype Pollution* et injection de credentials.  
> **Solution** : Mettre à jour `axios` vers la version la plus récente (>1.7.0).

---

## 2. Secrets & Gouvernance des Données

- **Secrets hardcodés :** Aucun détecté dans le code source.
- **Gestion .env :** Correctement configurée. `.env` est listé dans `.gitignore` pour le backend et le frontend.
- **Validation :** Les clés Stripe dans le scaffold sont des clés de test (`sk_test_...`).

---

## 3. Analyse Backend (Express.js)

### Points Forts
- **Validation Stripe :** Utilisation correcte de `stripe.webhooks.constructEvent` avec signature.
- **CORS :** Whitelist dynamique via variables d'environnement.

### Failles Détectées
- **Manque de Headers (Helmet) :** L'application n'utilise pas `helmet`. Elle est vulnérable au clickjacking, aux injections MIME et manque de HSTS.
- **Absence d'Authentification :** La route `POST /books` est ouverte à tous. N'importe qui peut injecter des données dans la base.
- **Fuites d'Information :** Les erreurs 500 renvoient directement `error.message`.

---

## 4. Analyse Frontend (React)

### Failles Détectées
- **Hardcoding :** L'URL de l'API est fixée sur `http://localhost:3001` dans `App.jsx`.
- **Manque de CSP :** Aucune Content Security Policy n'est définie.

---

## 🚀 Plan de Remédiation Prioritaire

### Immédiat (P0)
1. **Frontend :** `npm install axios@latest` pour corriger la faille de sécurité.
2. **Backend :** `npm install helmet` et ajout de `app.use(helmet())`.

### Court Terme (P1)
1. **Authentification :** Implémenter un middleware JWT simple pour protéger les routes d'écriture (`POST`, `PUT`, `DELETE`).
2. **Environnement :** Migrer l'URL de l'API frontend vers `import.meta.env.VITE_API_URL`.

### Moyen Terme (P2)
1. **CI/CD :** Créer un workflow GitHub Action pour exécuter `npm audit` à chaque PR.
2. **Logging :** Intégrer un logger (type `winston` ou `pino`) pour éviter les `console.log` en production.

---

## Verdict Technique
Bookflow est structurellement sain mais présente des **"portes ouvertes"** classiques de scaffold. La correction de la vulnérabilité `axios` et l'ajout de `helmet` le feront passer à une maturité de sécurité de 9/10.

---
*Rapport généré par Nexxus Citadel - Forge Audit Module*
