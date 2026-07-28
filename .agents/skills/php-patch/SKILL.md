---
name: php-patch
description: Génère un patch minimal PHP pour MonCoachScolaire (PSR-12, PDO sécurisé, variables globales, htmlspecialchars). Utiliser pour corriger un bug PHP, ajouter une fonctionnalité dans src/pages/ ou src/api/, ou sécuriser une entrée utilisateur. Fournit diff unified + commandes de test + rollback.
argument-hint: [fichier cible] [description du bug ou de la feature]
---

# Skill — PHP Patch Minimal

## Objectif

Produire un patch PHP minimal, sûr et compatible avec la base de code MonCoachScolaire.

## Conventions obligatoires

### PSR-12 + style projet

- Indentation : **4 espaces** (jamais de tabs)
- Namespace : `MonCoachScolaire\...` si applicable
- Accolades ouvrantes sur la même ligne (fonctions/classes)
- Pas de closing PHP tag `?>` en fin de fichier

### PDO — vérification explicite

```php
if (!isset($pdo) || !$pdo instanceof PDO) {
    http_response_code(500);
    echo json_encode(['error' => 'Connexion BDD indisponible', 'code' => 500]);
    exit;
}
```

### Variables globales d'état

```php
$is_admin     = function_exists('isAdmin') && isAdmin();
$is_logged_in = isset($_SESSION['user_id']);
$is_demo      = function_exists('isDemoUser') && isDemoUser();
$user_level   = $_SESSION['user_level'] ?? null;
```

### Entrées utilisateur — toujours assainies

```php
$input = htmlspecialchars(trim($_POST['field'] ?? ''), ENT_QUOTES, 'UTF-8');
$id    = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);
```

**Interdit :** `$_POST['field']` directement dans du HTML ou SQL.

### API endpoints — format retour standard

```php
// Succès
echo json_encode(['success' => true, 'data' => $result]);

// Erreur
http_response_code(400);
echo json_encode(['error' => 'Message descriptif', 'code' => 400]);
exit;
```

## Workflow de patch

### Étape 1 — Lire le fichier avant toute modification

```
Fichiers concernés : src/pages/system/*.php, src/api/*.php, src/includes/*.php
```

### Étape 2 — Produire le diff minimal

Format diff unified :

```diff
--- a/src/api/validate.php
+++ b/src/api/validate.php
@@ -12,6 +12,10 @@ require_once __DIR__ . '/../../src/config/config.php';
+if (!isset($pdo) || !$pdo instanceof PDO) {
+    http_response_code(500);
+    echo json_encode(['error' => 'PDO unavailable', 'code' => 500]);
+    exit;
+}

 $action = htmlspecialchars(trim($_POST['action'] ?? ''), ENT_QUOTES, 'UTF-8');
```

### Étape 3 — Hooks front (si HTML/CSS touché)

- Lister les `id`, `.class`, `data-*` impactés
- Dire "hooks conservés" OU "hooks modifiés + raison"
- Ne PAS renommer les sélecteurs utilisés par `public/assets/js/*.js`

### Étape 4 — Plan de test

```powershell
# Test smoke : vérifier que la page répond
Invoke-WebRequest -Uri "http://localhost/src/pages/system/cours.php" -UseBasicParsing

# Vérifier le JSON d'un endpoint API
Invoke-RestMethod -Uri "http://localhost/src/api/validate.php" -Method POST -Body @{id=1; action='check'}
```

### Étape 5 — Rollback

```powershell
# Annuler les modifications non committées
git checkout -- src/api/validate.php
```

## Checklist avant livraison

- [ ] Inputs assainis (`htmlspecialchars`, `filter_input`)
- [ ] PDO vérifié avant toute requête
- [ ] `$is_admin` vérifié avant output admin-only
- [ ] JSON retourné avec `exit` après erreur
- [ ] Diff minimal (ne touche pas l'existant inutilement)
- [ ] Hooks front conservés

## Sécurité OWASP (priorités projet)

| Risque                  | Mitigation                               |
| ----------------------- | ---------------------------------------- |
| Injection SQL           | PDO préparé, jamais d'interpolation      |
| XSS                     | `htmlspecialchars()` sur tous les inputs |
| Broken Access Control   | `$is_admin` gate avant données sensibles |
| Sensitive Data Exposure | Pas de credentials en sortie JSON        |
