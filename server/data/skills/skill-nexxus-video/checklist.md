# Checklist : Nexxus Video

- [ ] La vidéo est MP4 et ≤ 10 minutes ?
- [ ] Le job est-il lancé en **asynchrone** (pas de réponse chat bloquante) ?
- [ ] `video.probe` a-t-il réussi (durée, audio, container) ?
- [ ] Les scènes ont-elles un score de confiance documenté ?
- [ ] Transcript / OCR absents → signalés dans `uncertainties` ?
- [ ] L'analyse cite-t-elle **uniquement** le evidence pack ?
- [ ] Artefacts JSON + Markdown persistés et visibles Cockpit ?
- [ ] `trace_id` / spans `video.*` présents dans les traces ?
- [ ] Refus explicite si objectif dépasse le signal disponible ?
