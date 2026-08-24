/**
 * intentGuards.js
 * Sentinelle de routage : empêche une FAQ/document statique
 * d'écraser une vraie demande de capacité / permission / modification.
 */

import { isIdentityIntent } from "./identityIntentGuards.js";

function normalizeText(input = "") {
  return String(input)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const CAPABILITY_PATTERNS = [
  /\bes[-\s]?tu en capacite de\b/,
  /\bes[-\s]?tu capable de\b/,
  /\bpeux[-\s]?tu\b/,
  /\bpouvez[-\s]?vous\b/,
  /\bas[-\s]?tu la possibilite de\b/,
  /\bas[-\s]?tu la capacit[eé]r?\b/,
  /\btu as la capacit[eé]r?\b/,
  /\best[-\s]?ce que tu peux\b/,
  /\best[-\s]?ce que vous pouvez\b/,
  /\bsais[-\s]?tu (?:dechiffrer|déchiffrer|analyser|lire)\b/,
  /\bcan you\b/,
  /\bare you able to\b/
];

const PERMISSION_PATTERNS = [
  /\bas[-\s]?tu acces a\b/,
  /\bavez[-\s]?vous acces a\b/,
  /\bpeux[-\s]?tu acceder a\b/,
  /\best[-\s]?ce que tu as acces a\b/,
  /\bdo you have access to\b/,
  /\bcan you access\b/
];

const SELF_MODIFICATION_PATTERNS = [
  /\bmodifier\b/,
  /\bmodifie[rs]?\b/,
  /\bchanger\b/,
  /\bchang[ée]r?\b/,
  /\bcorriger\b/,
  /\bediter\b/,
  /\breparer\b/,
  /\bpatcher\b/,
  /\bmettre a jour\b/,
  /\btoucher a\b/,
  /\bintervenir sur\b/,
  /\bwrite\b/,
  /\bedit\b/,
  /\bmodify\b/,
  /\bupdate\b/,
  /\bpatch\b/,
  /\bfix\b/
];

const INTERNAL_SYSTEM_PATTERNS = [
  /\bfichier(s)?\b/,
  /\btes fichiers\b/,
  /\btes composants\b/,
  /\bce qui te compose\b/,
  /\bce qui te composent\b/,
  /\bfichiers qui te composent\b/,
  /\bfichiers qui me composent\b/,
  /\bsystempromptbuilder\b/,
  /\bagentpipeline\b/,
  /\btextguards\b/,
  /\bintentguards\b/,
  /\bprompt\b/,
  /\bconfiguration\b/,
  /\bmodule\b/,
  /\bpipeline\b/,
  /\bsource\b/,
  /\bcode\b/,
  /\binternal files\b/,
  /\bsystem files\b/,
  /\byour files\b/,
  /\byour components\b/
];

function matchesAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

export function isCapabilityQuery(input = "") {
  const text = normalizeText(input);
  return matchesAny(text, CAPABILITY_PATTERNS);
}

export function isPermissionQuery(input = "") {
  const text = normalizeText(input);
  return matchesAny(text, PERMISSION_PATTERNS);
}

const EXTERNAL_FILE_TARGET_PATTERNS = [
  /\bprojects\//,
  /\bforge\//,
  /\bserver\/data\//,
  /\b\.(js|ts|tsx|jsx|py|php|rb|go|rs|java|cs|json|md|yml|yaml)\b/,
];

export function isSelfModificationQuery(input = "") {
  const text = normalizeText(input);
  if (matchesAny(text, EXTERNAL_FILE_TARGET_PATTERNS)) {
    return false;
  }
  return (
    matchesAny(text, SELF_MODIFICATION_PATTERNS) &&
    matchesAny(text, INTERNAL_SYSTEM_PATTERNS)
  );
}

export function isIdentityOnlyQuery(input = "") {
  return isIdentityIntent(input);
}

export function shouldBypassGovernedDirectAnswer(input = "") {
  const text = normalizeText(input);

  const capability = isCapabilityQuery(text);
  const permission = isPermissionQuery(text);
  const selfModification = isSelfModificationQuery(text);
  const identityOnly = isIdentityOnlyQuery(text);

  const isDocumentationTask = text.includes("rapport") || text.includes(".md") || text.includes("documentation") || text.includes("materialise");

  if ((capability || permission || selfModification) && !isDocumentationTask) {
    return true;
  }

  if (identityOnly) {
    return false;
  }

  return false;
}

export function detectCavemanLevel(input = "") {
  const text = normalizeText(input);
  if (text.includes("mode caveman ultra") || text.includes("caveman:ultra") || text.includes("compression ultra")) return "ULTRA";
  if (text.includes("mode caveman dense") || text.includes("caveman:dense") || text.includes("compression dense") || text.includes("style dense")) return "DENSE";
  if (text.includes("mode caveman lite") || text.includes("caveman:lite") || text.includes("compression lite") || text.includes("style concis")) return "LITE";
  if (text.includes("mode wenyan") || text.includes("style wenyan") || text.includes("caveman:wenyan")) return "WENYAN";
  return "NORMAL";
}

export function classifyIntentGuard(input = "") {
  const text = normalizeText(input);

  const result = {
    normalized: text,
    capability: isCapabilityQuery(text),
    permission: isPermissionQuery(text),
    selfModification: isSelfModificationQuery(text),
    identityOnly: isIdentityOnlyQuery(text),
    cavemanLevel: detectCavemanLevel(text),
    bypassGovernedDirectAnswer: false,
    label: "unknown"
  };

  result.bypassGovernedDirectAnswer =
    result.capability || result.permission || result.selfModification;

  if (result.selfModification) {
    result.label = "self_modification_query";
  } else if (result.permission) {
    result.label = "permission_check";
  } else if (result.capability) {
    result.label = "capability_check";
  } else if (result.identityOnly) {
    result.label = "identity_query";
  } else if (result.cavemanLevel !== "NORMAL") {
    result.label = `caveman_${result.cavemanLevel.toLowerCase()}`;
  }

  return result;
}
