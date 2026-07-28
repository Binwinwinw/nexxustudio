/**
 * Fiches locales — pedagogy_soft_overview (lot #35).
 */
import { PEDAGOGY_SOFT_DOMAINS } from "../utils/pedagogySoftOverviewIntentGuards.js";

const TARGETING_SUFFIX =
  "Tu veux approfondir un angle précis (chronologie, cartes, exemples concrets, figures clés…) ?";

const CANONICAL_FICHES = {
  "revolution francaise": {
    domain: "history",
    reply: [
      "Voici l'**essentiel sur la Révolution française** :",
      "",
      "- **Contexte** : fin de l'Ancien Régime, crise financière, inégalités sociales et crise de légitimité monarchique (fin XVIIIe siècle).",
      "- **Grandes étapes** : États généraux (1789) → prise de la Bastille → abolition des privilèges → Déclaration des droits de l'homme → monarchie constitutionnelle → Terreur → Directoire → montée de Napoléon.",
      "- **Enjeux** : souveraineté nationale, égalité civile, laïcisation progressive de l'État, refonte administrative.",
      "- **Portée** : modèle politique exporté en Europe, rupture durable entre droit, nation et citoyenneté.",
      "",
      TARGETING_SUFFIX,
    ].join("\n"),
  },
  "geographie du canada": {
    domain: "geography",
    reply: [
      "Voici l'**essentiel sur la géographie du Canada** :",
      "",
      "- **Situation** : deuxième plus grand pays du monde, bordé par l'Atlantique, le Pacifique et l'océan Arctique ; frontière longue avec les États-Unis.",
      "- **Relief** : bouclier canadien (roches anciennes), plaines intérieures, Cordillère à l'ouest, archipel arctique.",
      "- **Climat** : très contrasté — arctique au nord, continental à l'intérieur, océanique/tempéré sur les littoraux est et ouest.",
      "- **Peuplement & villes** : forte concentration près de la frontière américaine (Toronto, Montréal, Vancouver, Ottawa).",
      "- **Ressources** : forêts, hydraulique, minerais, énergie fossile — enjeux environnementaux et autochtones majeurs.",
      "",
      TARGETING_SUFFIX,
    ].join("\n"),
  },
  volcans: {
    domain: "sciences",
    reply: [
      "Voici l'**essentiel sur les volcans** :",
      "",
      "- **Définition** : ouverture dans la croûte terrestre par laquelle remontent magma, gaz et cendres.",
      "- **Formation** : surtout aux limites de plaques tectoniques (subduction, dorsales) ; aussi points chauds (Hawaï).",
      "- **Types** : volcans effusifs (laves fluides, ex. Piton de la Fournaise) vs explosifs (viscosité forte, ex. Vésuve, Pinatubo).",
      "- **Risques** : coulées, nuées ardentes, chutes de cendres, lahars ; mais sols fertiles et géothermie.",
      "- **Surveillance** : sismologie, déformation du sol, gaz — pour anticiper les éruptions.",
      "",
      TARGETING_SUFFIX,
    ].join("\n"),
  },
};

/**
 * @param {object} task
 * @returns {string|null}
 */
export function resolvePedagogySoftCanonicalReply(task = {}) {
  if (!task?.subjectKey) return null;
  const direct = CANONICAL_FICHES[task.subjectKey];
  if (direct?.reply) return direct.reply;

  if (task.domain === PEDAGOGY_SOFT_DOMAINS.HISTORY && /revolution/.test(task.subjectKey)) {
    return CANONICAL_FICHES["revolution francaise"]?.reply || null;
  }
  if (task.domain === PEDAGOGY_SOFT_DOMAINS.GEOGRAPHY && /canada/.test(task.subjectKey)) {
    return CANONICAL_FICHES["geographie du canada"]?.reply || null;
  }
  if (task.domain === PEDAGOGY_SOFT_DOMAINS.SCIENCES && /volcan/.test(task.subjectKey)) {
    return CANONICAL_FICHES.volcans?.reply || null;
  }

  return null;
}

/**
 * @param {object} task
 * @returns {string}
 */
export function buildPedagogySoftOverviewSystemAddon(task = {}) {
  const subject = task.subjectLabel || task.subject || "le sujet demandé";
  const domain = task.domain || "general";

  const domainLines = {
    [PEDAGOGY_SOFT_DOMAINS.HISTORY]: [
      "1) **Contexte** — période, société, tension initiale.",
      "2) **Repères** — 3 à 5 dates ou étapes majeures.",
      "3) **Enjeux** — politiques, sociaux, économiques.",
      "4) **Portée** — pourquoi c'est encore utile aujourd'hui.",
    ],
    [PEDAGOGY_SOFT_DOMAINS.GEOGRAPHY]: [
      "1) **Situation** — localisation, échelle, voisinage.",
      "2) **Relief & climat** — grands traits, contrastes.",
      "3) **Peuplement & organisation** — villes, réseaux, fragilités.",
      "4) **Enjeux** — ressources, environnement, dynamiques actuelles.",
    ],
    [PEDAGOGY_SOFT_DOMAINS.SCIENCES]: [
      "1) **Définition accessible** — ce que c'est en une phrase claire.",
      "2) **Mécanismes** — comment ça fonctionne (2 à 4 idées).",
      "3) **Exemples concrets** — cas typiques ou familiers.",
      "4) **Applications / limites** — usages, risques, questions ouvertes.",
    ],
  };

  const format = domainLines[domain] || domainLines[PEDAGOGY_SOFT_DOMAINS.SCIENCES];

  return [
    "VARIANTE PEDAGOGY_SOFT_OVERVIEW (aperçu vague mais légitime — répondre d'abord) :",
    `- Domaine : **${domain}** · Sujet : **${subject}**.`,
    "FORMAT OBLIGATOIRE :",
    ...format,
    `5) Terminer par : « ${TARGETING_SUFFIX} »`,
    "INTERDIT :",
    "- Clarify-first quand le sujet est déjà nommé.",
    "- Menu d'options vide ou refus faute de contexte.",
    "- Réponse tronquée à 2 phrases.",
    "- Recherche web ou promesse de source non exécutée.",
  ].join("\n");
}
