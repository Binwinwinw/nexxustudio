# FILE_CAPABILITY_V1 — politique interne fichiers

Source de vérité du **comportement upload / traitement fichier**. Pas une liste UX. Pas un protocole d’exécution.

Si un autre document (mémoire, plan, commentaire) contredit cette page : **cette page gagne**.

Runtime : `server/src/agent/policies/attachment/fileCapabilityPolicy.js`  
Preuve : `server/tests/file-capability-policy.test.js`

Contrats aval **inchangés** : [`FILE_ANALYSIS_V1`](../agents/file-analysis-contract.md), SQL déterministe, HTML documentaire, rail PDF extractif.

---

## Invariants

1. **Allowlist métier d’abord.** Seuls les types du métier Citadelle entrent. La denylist est une couche complémentaire, jamais la règle seule.
2. **Validation serveur en trois signaux** : extension + MIME déclaré + **signature réelle** (magic bytes). Un seul signal ne suffit pas.
3. **Ne pas faire confiance** au `Content-Type` client ni au nom de fichier (CWE-434, OWASP File Upload).
4. **Aucune exécution** d’un fichier uploadé. `capabilities.execute` est toujours `false`.
5. Distinguer quatre capacités : **analyse** · **extraction** · **rendu** · **exécution**. L’exécution est interdite. Le rendu n’est autorisé que pour les rasters (jpeg/png/webp/gif).
6. Archives et formats actifs sont des classes à part. Pas de traitement « comme un texte » par défaut.
7. Stockage, quarantaine et justification sont **internes**. L’UX ne montre pas la matrice. Message user : refus court déjà existant.
8. Deux portes : **name-gate** (multer, sans buffer) puis **buffer-gate** (signature). Multer `fileFilter` n’a pas le contenu.
9. Verdict déterministe interne, une seule phrase parmi :
   - `ce fichier est analysable`
   - `ce fichier est analysable sous contrainte`
   - `ce fichier va en quarantaine`
   - `ce fichier est refusé`
10. Cette politique **ne change pas** la tâche `doc_analyze` ni les rails FILE_ANALYSIS / SQL / HTML / PDF.

---

## Sources

| Source | Usage ici |
|--------|-----------|
| [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) | Allowlist d’extensions ; ne pas se fier au Content-Type ; valider le type réel ; taille ; stockage hors exécution |
| [OWASP Unrestricted File Upload](https://owasp.org/www-community/vulnerabilities/Unrestricted_File_Upload) | Upload d’un type dangereux → RCE / malware / XSS |
| [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) | Allowlist plutôt que denylist |
| [CWE-434](https://cwe.mitre.org/data/definitions/434.html) | Type dangereux ; filename / MIME non fiables |
| [CWE-79](https://cwe.mitre.org/data/definitions/79.html) | SVG / HTML actifs → XSS si rendus |
| [CWE-22](https://cwe.mitre.org/data/definitions/22.html) / [CWE-73](https://cwe.mitre.org/data/definitions/73.html) | Path / nom contrôlés (`..`, séparateurs, `%00`) |
| [CWE-409](https://cwe.mitre.org/data/definitions/409.html) | Zip bomb / amplification à la décompression |
| [NIST SP 800-53 Rev. 5](https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final) SI-3, SI-7, SI-10, SC-18 | Code malveillant, intégrité, validation d’entrée, contenu actif |
| [NIST SP 800-167](https://csrc.nist.gov/pubs/sp/800/167/final) | Principe d’allowlist (application whitelisting) |

La signature seule ne suffit pas (polyglots). Combiner allowlist + magic + isolation + **jamais exécuter**.

---

## Classes

| Classe | Statut typique | Verdict |
|--------|----------------|---------|
| `allowed_analyzable` | `accept` | analysable |
| `allowed_reinforced` | `accept` | analysable sous contrainte |
| `container` | `quarantine` (document) / `reject` (chat) | quarantaine / refusé |
| `unknown` | `reject` | refusé |
| `refused` | `reject` | refusé |

`manual_review` est un statut interne rare (télémétrie). Le verdict utilisateur interne reste « va en quarantaine ».

### Autorisée et analysable

| Ext | MIME attendus (indicatif) | Signature | Pipeline | Max | Spécial | Statut |
|-----|---------------------------|-----------|----------|-----|---------|--------|
| `txt` `md` `csv` `json` `yml` `yaml` `xml` `css` `sql` | `text/*` / json / xml / yaml | texte | FILE_ANALYSIS (`sql` + sources) ou DOCUMENT_EXTRACT | 10 Mo | lecture seule | accept |
| `pdf` | `application/pdf` | `%PDF-` | DOCUMENT_EXTRACT | 10 Mo | OCR si scan ; pas d’exécution | accept |
| `jpg` `jpeg` `png` `webp` `gif` | `image/jpeg` `png` `webp` `gif` | SOI / PNG / RIFF+WEBP / GIF8 | VISION | 10 Mo | rendu raster OK | accept |

`.sql` reste `fileKind=document` + rail FILE_ANALYSIS. Cette politique n’y touche pas.

### Autorisée, traitement renforcé

| Ext | Signature | Pipeline | Max | Spécial | Statut |
|-----|-----------|----------|-----|---------|--------|
| `js` `mjs` `cjs` `ts` `tsx` `jsx` `php` `py` | texte | FILE_ANALYSIS | 10 Mo | analyse source, **pas** `code_review` par défaut | accept |
| `html` `htm` | HTML ou texte | DOCUMENT_EXTRACT | 10 Mo | vues documentaires ; **pas de rendu** du fichier uploadé | accept |

Renforcé = format potentiellement actif. On **lit**. On n’exécute pas. On ne sert pas le fichier comme page.

### Conteneur / archive

| Ext | Signature | Pipeline | Max | Spécial | Statut |
|-----|-----------|----------|-----|---------|--------|
| `zip` | `PK` | ARCHIVE_EXTRACT | 10 Mo compressé | canal **document** seulement | quarantine |
| `gz` `tgz` `tar.gz` | `1F 8B` | ARCHIVE_EXTRACT | 10 Mo | mêmes bornes interne | quarantine |

Bornes extracteur (déjà en place) : 80 fichiers, 2 Mo / entrée, 10 Mo total, 100 k caractères. Imbrication interdite. Ratio décompression > 100:1 au-delà de 1 Mo non compressé → rejet (zip bomb).

### Refusée (denylist complémentaire)

Exécutables, scripts shell, binaires, archives Java, SVG, macros Office (`docm` `xlsm` `pptm` `doc` `xls` `ppt`), RTF, raccourcis, images disque, WASM.

Signature `MZ` / `ELF` / `OLE` / `SVG` → refus même si l’extension est allowlist.

**SVG — choix sécurité explicite.** Refus strict (`image/svg+xml`, extension `.svg`, magic `<svg`). Ce n’est pas un oubli d’allowlist : SVG est du contenu actif (script / XSS, CWE-79). Un besoin métier futur (icône, diagramme) = lot dédié, probablement `allowed_reinforced` avec `render=false` et `execute=false`, jamais un passage silencieux en allowlist.

### Inconnue

Pas d’extension, extension hors matrice, MIME seul. **Refus.** On n’invente pas un type.

---

## Scénarios malveillants

| Cas | Code | Statut |
|-----|------|--------|
| Double extension (`.php.txt`, `.exe.jpg`) | `FILE_CAP_DOUBLE_EXTENSION` | reject |
| MIME famille ≠ classe d’extension (`image/png` + `.pdf`) | `FILE_CAP_MIME_MISMATCH` | reject |
| Magic ≠ type (PDF nommé + `PK`, `.js` + `MZ`) | `FILE_CAP_SIGNATURE_MISMATCH` | reject |
| Archive dans une archive | `FILE_CAP_NESTED_ARCHIVE` | reject |
| Zip bomb (ratio / volume) | `FILE_CAP_ZIP_BOMB` | reject |
| SVG, macros, scripts binaires, exe | `FILE_CAP_ACTIVE_FORMAT` / `FILE_CAP_EXECUTABLE` | reject |
| `..`, `/`, `\`, `%00`, `<?php` dans le nom | `FILE_CAP_SUSPECT_PATH` | reject |
| Archive sur le canal chat | `FILE_CAP_CONTAINER_CHAT` | reject |

`application/octet-stream` et MIME vide = **non fiables**, pas un mismatch. La signature + l’extension tranchent.

---

## Capacités

| | analyze | extract | render | execute |
|--|---------|---------|--------|---------|
| Texte / SQL / JSON… | oui | oui | non | **non** |
| JS / PHP / Py | oui | oui | non | **non** |
| HTML | oui | oui | **non** | **non** |
| PDF | oui | oui | non | **non** |
| Raster | oui (vision) | non | oui | **non** |
| Archive (document) | non | oui (bornée) | non | **non** |
| Refus / inconnu | non | non | non | **non** |

---

## Portes pipeline

```
multer fileFilter          → isAdmittedAtNameGate (ext + nom + MIME famille + denylist)
                            pas de buffer → pas de magic
après réception buffer     → classifyFileCapability
  chat /api/stream         → reject|quarantine ⇒ stop avant agent.run
  document /upload         → reject ⇒ 403 ; quarantine archive ⇒ persist isolée + extract
agentPipeline DOCUMENT     → FILE_ANALYSIS_V1 / SQL / HTML / PDF inchangés
archiveExtractor           → evaluateArchiveConstraints (imbrication, bomb)
```

Vidéo MP4 : politique séparée (`videoUploadService`, magic `ftyp`). Hors cette matrice chat/document.

---

## Tests à prévoir / tenus

- Allowlist : `.js` `.sql` `.html` `.pdf` `.png` `.txt` → accept (js/html = contrainte).
- Chat : `.zip` refusé ; document : `.zip` + `PK` → quarantaine + extract.
- Double extension, path `../`, MIME incohérent, `MZ` sous `.txt`, PDF/`PK`, SVG, zip bomb, archive imbriquée.
- `capabilities.execute === false` pour toutes les classes.
- Régression : `isAdmittedAtNameGate` reste vrai pour les rails FILE_ANALYSIS déjà validés.

---

## Anti-divergence

Un changement de classe ou de statut met à jour **ce canon et** `fileCapabilityPolicy.js` **et** les tests dans le même geste.  
Les docs FILE_ANALYSIS / attachment **pointent** ici. Ils ne recopient pas la matrice.
