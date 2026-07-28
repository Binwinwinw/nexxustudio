/**
 * Base de connaissances paramétrable — modules par niveau, pas de fiches figées par phrase.
 */

/** @typedef {{ title: string, bullets: string[] }} PedagogicalSection */

/**
 * @typedef {Object} PedagogicalLevelModule
 * @property {string} levelLabel
 * @property {PedagogicalDepth} depth
 * @property {string} headlineQualifier
 * @property {PedagogicalSection[]} sections
 */

/** @typedef {'intro'|'standard'|'advanced'} PedagogicalDepth */

/**
 * @typedef {Object} PedagogicalTopicKnowledge
 * @property {string} topic
 * @property {string} matiere
 * @property {string} label
 * @property {Partial<Record<string, PedagogicalLevelModule>>} levelModules
 * @property {Partial<Record<PedagogicalDepth, string>>} defaultLevelByDepth
 * @property {string|null} [defaultLevel]
 */

/** @type {Record<string, PedagogicalTopicKnowledge>} */
export const PEDAGOGICAL_KNOWLEDGE_BASE = {
  fractions: {
    topic: "fractions",
    matiere: "maths",
    label: "fractions",
    defaultLevelByDepth: {
      intro: "6",
      advanced: "4",
    },
    defaultLevel: null,
    levelModules: {
      "6": {
        levelLabel: "6e",
        depth: "intro",
        headlineQualifier: "fractions simples",
        sections: [
          {
            title: "Vocabulaire",
            bullets: [
              "numérateur, dénominateur, fractions égales, fraction d'un tout",
            ],
          },
          {
            title: "Représentation",
            bullets: [
              "fractionner une figure, placer une fraction sur une droite graduée",
              "lier fraction et quotient (a ÷ b)",
            ],
          },
          {
            title: "Comparaison",
            bullets: [
              "comparer des fractions de même dénominateur",
              "puis avec dénominateurs simples (doubler, tripler…)",
            ],
          },
          {
            title: "Opérations introductives",
            bullets: [
              "addition et soustraction de fractions de même dénominateur",
              "simplifier une fraction visiblement (diviser numérateur et dénominateur par le même entier)",
            ],
          },
          {
            title: "Sens concret",
            bullets: [
              "prendre une fraction d'une quantité (« les 3/4 de… »)",
              "partager équitablement",
            ],
          },
        ],
      },
      "5": {
        levelLabel: "5e",
        depth: "standard",
        headlineQualifier: "fractions",
        sections: [
          {
            title: "Fractions équivalentes",
            bullets: [
              "amplification et réduction d'une fraction",
              "reconnaître des fractions égales sous des formes différentes",
            ],
          },
          {
            title: "Comparaison et rangement",
            bullets: [
              "comparer des fractions de dénominateurs différents (méthodes simples)",
              "encadrer une fraction entre deux entiers",
            ],
          },
          {
            title: "Opérations",
            bullets: [
              "addition et soustraction avec dénominateurs différents (cas simples)",
              "multiplication d'une fraction par un entier",
            ],
          },
          {
            title: "Lien nombres",
            bullets: [
              "passer d'une fraction à un nombre décimal (cas simples)",
              "introduire les pourcentages comme fractions de 100",
            ],
          },
        ],
      },
      "4": {
        levelLabel: "4e",
        depth: "advanced",
        headlineQualifier: "fractions (calculs et opérations)",
        sections: [
          {
            title: "Mise au même dénominateur",
            bullets: [
              "trouver un dénominateur commun (PPCM)",
              "additionner et soustraire des fractions de dénominateurs quelconques",
            ],
          },
          {
            title: "Multiplication et division",
            bullets: [
              "multiplier deux fractions (numérateur × numérateur, dénominateur × dénominateur)",
              "diviser par un entier, interpréter a ÷ b comme une fraction",
            ],
          },
          {
            title: "Simplification systématique",
            bullets: [
              "réduire une fraction avec le PGCD",
              "donner une écriture irréductible",
            ],
          },
          {
            title: "Priorités et expressions",
            bullets: [
              "enchaîner plusieurs opérations avec fractions",
              "respecter les priorités opératoires dans des calculs mixtes",
            ],
          },
          {
            title: "Proportionnalité et problèmes",
            bullets: [
              "modéliser une situation concrète avec des fractions",
              "fractions, nombres décimaux et pourcentages dans les mêmes problèmes",
            ],
          },
        ],
      },
      "3": {
        levelLabel: "3e",
        depth: "advanced",
        headlineQualifier: "fractions et calcul littéral",
        sections: [
          {
            title: "Maîtrise du calcul fractionnaire",
            bullets: [
              "toutes opérations sur fractions, y compris division de fractions",
              "fractions négatives et calculs avec relatifs",
            ],
          },
          {
            title: "Lien avec l'algèbre",
            bullets: [
              "fractions dans des expressions littérales simples",
              "résoudre des équations où apparaissent des fractions",
            ],
          },
          {
            title: "Proportionnalité avancée",
            bullets: [
              "coefficient de proportionnalité sous forme fractionnaire",
              "pourcentages d'évolution, problèmes à plusieurs étapes",
            ],
          },
        ],
      },
    },
  },
  geometrie: {
    topic: "geometrie",
    matiere: "maths",
    label: "géométrie",
    defaultLevelByDepth: {
      intro: "6",
      standard: "5",
      advanced: "4",
    },
    defaultLevel: null,
    levelModules: {
      "5": {
        levelLabel: "5e",
        depth: "standard",
        headlineQualifier: "géométrie plane",
        sections: [
          {
            title: "Vocabulaire et outils",
            bullets: [
              "segment, droite, demi-droite, plan, cercle",
              "constructions au compas, à la règle et à l'équerre",
            ],
          },
          {
            title: "Angles",
            bullets: [
              "angle aigu, droit, obtus, plat",
              "mesurer un angle au rapporteur, angles complémentaires et supplémentaires",
            ],
          },
          {
            title: "Parallélisme et perpendicularité",
            bullets: [
              "droites parallèles et perpendiculaires",
              "reconnaître et construire des angles droits et des parallèles",
            ],
          },
          {
            title: "Triangles",
            bullets: [
              "classification (quelconque, isocèle, équilatéral, rectangle)",
              "somme des angles d'un triangle (180°)",
              "constructibilité et propriétés simples",
            ],
          },
          {
            title: "Quadrilatères",
            bullets: [
              "parallélogramme, rectangle, losange, carré",
              "reconnaître leurs propriétés (côtés, angles, diagonales)",
            ],
          },
          {
            title: "Symétrie et aires",
            bullets: [
              "symétrie axiale (figure et coordonnées simples)",
              "aires du triangle, du parallélogramme et du disque (formules de base)",
            ],
          },
        ],
      },
    },
  },
};

/**
 * @param {string|null|undefined} topicKey
 * @returns {PedagogicalTopicKnowledge|null}
 */
export function getPedagogicalTopicKnowledge(topicKey) {
  if (!topicKey) return null;
  return PEDAGOGICAL_KNOWLEDGE_BASE[topicKey] || null;
}
