---
name: debug
description: Génère un script CLI de debug (PHP ou Node) pour inspecter une réponse d'endpoint API MonCoachScolaire. Utiliser quand un endpoint renvoie un résultat inattendu, un JSON malformé, ou un champ manquant. Fournit args --baseUrl/--id, affiche HTTP status + extrait brut, et indique "NON TROUVÉ" si le champ cible est absent.
argument-hint: [endpoint] [--id <id>] [--baseUrl <url>]
---

# Skill — Debug Script CLI

## Objectif

Écrire un script CLI (PHP et/ou Node.js) pour inspecter précisément la réponse d'un endpoint API de MonCoachScolaire.

## Quand utiliser

- Un endpoint `src/api/*.php` renvoie un résultat inattendu
- Un champ JSON est absent ou malformé
- Un quiz/exercice n'est pas validé correctement
- Un diagnostic de progression est suspect

## Workflow

### Étape 1 — Identifier l'endpoint cible

Checker dans `src/api/` :

- `validate.php` — validation de réponse exercice
- `diagnostic.php` — résultat quiz diagnostique
- `progression.php` — suivi utilisateur

### Étape 2 — Générer le script

**Template PHP :**

```php
<?php
// debug_api.php — usage: php debug_api.php --id=<id> [--baseUrl=<url>] [--action=<action>]

$opts = getopt("", ["id:", "baseUrl:", "action:"]);
$id      = $opts['id']      ?? 1;
$baseUrl = $opts['baseUrl'] ?? 'http://localhost';
$action  = $opts['action']  ?? 'get';

$url = "{$baseUrl}/src/api/validate.php?id={$id}&action={$action}";

$ctx = stream_context_create(['http' => ['ignore_errors' => true]]);
$raw = file_get_contents($url, false, $ctx);
$status = $http_response_header[0] ?? 'UNKNOWN';

echo "HTTP: {$status}\n";
echo "RAW: {$raw}\n\n";

$json = json_decode($raw, true);
if (json_last_error() !== JSON_ERROR_NONE) {
    echo "JSON invalide: " . json_last_error_msg() . "\n";
    exit(1);
}

// Extraire les champs critiques
$fields = ['success', 'data', 'error', 'code'];
foreach ($fields as $field) {
    $val = $json[$field] ?? 'NON TROUVÉ';
    echo "{$field}: " . json_encode($val, JSON_UNESCAPED_UNICODE) . "\n";
}
```

**Template Node.js :**

```js
// debug_api.js — usage: node debug_api.js --id=<id> [--baseUrl=<url>]
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")),
);
const id = args.id ?? "1";
const baseUrl = args.baseUrl ?? "http://localhost";
const url = `${baseUrl}/src/api/validate.php?id=${id}`;

fetch(url).then(async (res) => {
  console.log("HTTP:", res.status, res.statusText);
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    ["success", "data", "error", "code"].forEach((k) =>
      console.log(`${k}:`, json[k] ?? "NON TROUVÉ"),
    );
  } catch (e) {
    console.log("JSON invalide:", e.message);
    console.log("RAW:", text.slice(0, 500));
  }
});
```

### Étape 3 — Commandes d'exécution (PowerShell)

```powershell
# PHP
php debug_api.php --id=1 --baseUrl=http://localhost --action=validate

# Node (si disponible)
node debug_api.js --id=1 --baseUrl=http://localhost
```

### Étape 4 — Interprétation

| Résultat                         | Action                                              |
| -------------------------------- | --------------------------------------------------- |
| `success: true` + `data` présent | Endpoint fonctionnel                                |
| `error` non vide                 | Lire le message d'erreur, vérifier PDO              |
| `JSON invalide`                  | Chercher output PHP parasite (var_dump, echo debug) |
| HTTP 500                         | Vérifier logs PHP, droits fichier, PDO connecté     |
| Champ `NON TROUVÉ`               | Vérifier structure JSON retournée vs schéma attendu |

## Contraintes de sécurité

- Ne jamais afficher ni loguer les credentials (`$_SESSION`, tokens)
- Utiliser uniquement sur environnement local ou de dev
- Ne pas committer les scripts de debug avec des URLs de prod codées en dur
