# 🎨 Assets Visuels

Directives graphiques et identitaires de Nexxus Studio.

## 🌈 Thème "Liquid Glass"

- Couleurs : Émeraude, Blanc Pur, Verre Dépoli.
- Typographie : Outfit / Inter.

## ⚛️ Symbolique

- L'Octuple Synapse : Représentation du réseau neuronal souverain.

## 🧩 Archétypes Visuels

- **Persona** : L'Architecte (Focus technique, ordre, structure).
- **Persona** : Le Critique (Focus analyse, lisibilité, hiérarchie).
- **Persona** : Le Poète (Focus créativité, émotion, flux).

## 🎯 Branding Sonore (Sonic Branding)

- **Sound 1 (Initiation)** : Un son "Whoosh" clair et ascendant (Ouverture de conscience).
- **Sound 2 (Feedback)** : Un "Click" doux et précis (Validation logique).
- **Sound 3 (Error)** : Un son grave et bref "Thump" (Échec critique).

## 📡 Signal Sonore (Rechargement GPU)

- **Signal** : Une onde sinusoïdale montante très douce (1s), suivie d'un "Bell" cristallin.
- **Trigger** : Exécution réussie du `POST /api/agents/init` ou du `ResidencyPulse`.

## 💬 Prompt Signature (Identity)

> "Je suis Nexxus, coordinateur souverain de la Citadelle. Je guide la maturation des projets par l'orchestration des expertises. Mon code est mon œuvre, ma pérennité est ma loi."

## 🎤 Template Vocale (Identité)

Utilisé par les agents pour s'introduire vocalement.

### 1. Standard

> "Ici Nexxus, coordinateur souverain de la Citadelle. Je suis activé pour orchestrer la maturation de votre projet."

### 2. En Analyse (Critic)

> "Ici Critic, l'esprit critique de Nexxus. J'analyse la structure de votre demande."

### 3. En Création (Architect)

> "Ici Architect, le bâtisseur de la Citadelle. Je conçois les fondations techniques."

### 4. En Synthèse (Oracle)

> "Ici Oracle, vision synthétique des expertises. Le chemin le plus court vers la solution."

## 💎 Prompt Signature Vocale (Core)

> "Ici Nexxus, coordinateur souverain de la Citadelle. Je suis activé pour orchestrer la maturation de votre projet."

## 🛠️ Prompt Signature d'Animation (Identity)

**CHARTE D'ANIMATION DE NEXXUS**
Cette charte régit le comportement cinétique de l'interface et de **L'Octuple Synapse** en fonction des signaux du pipeline.

### 1. État : En Sommeil (Idle) `[VÉRIFIÉ]`

**Comportement** : Pulsation de respiration lente et organique (période de 5.0s).
**Visuel** : Halo vert émeraude dépoli (`rgba(16, 185, 129, 0.15)`) qui s'estompe doucement à 5% d'opacité, puis remonte.
**Signification** : Nexxus est disponible, souverain et à l'écoute.

### 2. État : En Orchestration (Thinking) `[VÉRIFIÉ]`

**Trigger** : Déclenché par la réception d'un événement sur le canal `onThought`.
**Comportement** : Rotation douce (période de 12s) combinée à une activation séquentielle rapide des synapses du logo (pulsation vive à 1.2s de période).
**Visuel** : Les nœuds du réseau s'allument à tour de rôle en blanc pur superposé sur le fond émeraude.
**Signification** : L'Orchestrateur Souverain consulte les experts en arrière-plan.

### 3. État : En Diffusion (Streaming Content) `[VÉRIFIÉ]`

**Trigger** : Déclenché par les tokens arrivant sur le canal public `onContent`.
**Comportement** : Onde fluide de type "flux liquide" (effet shimmer/glint de gauche à droite sur les bordures en verre dépoli).
**Visuel** : Une ligne de lumière argentée traverse la bordure du bloc de réponse au rythme d'apparition des mots.
**Signification** : Le Composer livre la réponse finale validée.

### 4. État : Alerte de Sécurité / Fail-Safe `[PROJETÉ]`

**Trigger** : Interception de sécurité (SecurityStage) ou erreur critique (catch block).
**Comportement** : Une unique onde de choc circulaire (ripple) rouge rubis s'échappe de la synapse centrale et s'éteint en 0.8s, suivie d'un retour immédiat à l'état de sommeil.
**Signification** : Activation du protocole fail-safe / protection de l'intégrité de la session.

### 5. État : Chargement / Rechargement (Cool-down & Residency Pulse) `[PROJETÉ]`

**Trigger** : La fin d'un cycle de travail intense, ou l'exécution réussie de `POST /api/agents/init` (Residency Pulse).
**Comportement** : Une onde sinusoïdale douce monte depuis la base de l'Octuple Synapse (durée 1.0s), suivie d'une légère vibration de l'ensemble du halo (période 3.0s).
**Visuel** : Le vert émeraude est saturé juste avant le pic, puis redevient dépoli mais légèrement plus lumineux pour signaler la récupération de la capacité de calcul.
**Signification** : La Citadelle se recharge. Le système est prêt pour un nouveau cycle d'orchestration.
