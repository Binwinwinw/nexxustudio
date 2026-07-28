# Skill : PDF Extraction (v1.0)

## Triggers (activation)
- « extraire le texte de ce PDF », « analyser le document fichier.pdf »
- Pièce jointe `.pdf` + demande d'analyse (pas simple aperçu)

## doNotUseWhen
- Fichier > 50 Mo (mentionné dans la requête)
- PDF scanné / OCR requis — pas de promesse OCR sans pipeline dédié
- Utilisateur demande uniquement « prévisualiser » → pas ce skill

## Fallback
→ `skill-document-analysis` si exclusion ou extraction impossible (texte brut partiel).

## Mission
Extraire le texte exploitable d'un PDF **en local**, puis déléguer l'analyse au contrat DOCUMENT.

## Pipeline cible
1. Détecter MIME/extension PDF à l'upload.
2. Extraction texte (bibliothèque locale — pas cloud).
3. Si texte vide → déclarer limite (scan image) et proposer OCR futur ou export texte manuel.
4. Passer le texte extrait au briefing documentaire (comme `.txt`).

## Limites v1.0 (implémenté)

**Code** : `server/src/services/pdf-extractor.js` → `contextAgent.ingest()`

✅ **Fait :**
- Extraction texte PDF natif (`pdf-parse` si installé, sinon fallback local)
- Comptage pages + métadonnées basiques
- Rejet > 10 Mo (aligné multer)
- PDF scanné sans texte → `PDF_SCANNED_NO_TEXT` + message OCR non disponible
- `SKILLS_DISABLED=skill-pdf-extraction` → fallback

❌ **Pas encore :**
- OCR (tesseract) — skill seulement
- Tableaux / LaTeX préservés
- pdfjs-dist pour cas complexes

**Install dépendance** (réseau requis) :
```bash
cd server && npm install pdf-parse
```
