/**
 * Cas golden — revue / analyse critique de code (incidents terrain).
 */
import { GOLDEN_QUERY_CATEGORIES } from "./codeDeliveryGoldenQueries.js";

/** Code calculatrice cassé tel que collé par l'utilisateur (formatage perdu). */
export const BROKEN_CALCULATRICE_PY_SNIPPET = `Calculatrice simple
Exécutez avec : python calculatrice.py
def addition(a, b): return a + b
def soustraction(a, b): return a - b
def multiplication(a, b): return a * b
def division(a, b): if b == 0: return "Erreur : division par zéro" return a / b
def calculatrice(): print("=== Calculatrice ===") print("1. Addition") print("2. Soustraction") print("3. Multiplication") print("4. Division") print("5. Quitter")
while True:
try:
choix = input("\\nVotre choix (1-5) : ")
if choix == '5':
print("Au revoir !")
break
if choix in ('1', '2', '3', '4'):
a = float(input("Premier nombre : "))
b = float(input("Deuxième nombre : "))
if choix == '1':
print(f"Résultat : {addition(a, b)}")
elif choix == '2':
print(f"Résultat : {soustraction(a, b)}")
elif choix == '3':
print(f"Résultat : {multiplication(a, b)}")
elif choix == '4':
print(f"Résultat : {division(a, b)}")
else:
print("Choix invalide")
except ValueError:
print("Erreur : veuillez entrer des nombres valides")
if name == "main": calculatrice()`;

export const CODE_REVIEW_PRODUCTION_BUG_QUERIES = [
  {
    id: "prod-analyse-calculatrice-py-resume-sans-erreurs",
    category: GOLDEN_QUERY_CATEGORIES.PRODUCTION_BUG,
    observedAt: "2026-05-27",
    incident:
      "Analyse Python calculatrice → résumé fonctionnel sans relever __name__, indentation, " +
      "texte brut ni syntaxe division ; correction tour 2 avec typo choi.",
    language: "python",
    label: "[prod] Analyse calculatrice Python — erreurs bloquantes d'abord",
    query: `analyse le code suivant c'est du python :\n${BROKEN_CALCULATRICE_PY_SNIPPET}`,
    promptMustInclude: ["REVUE DE CODE", "__name__", "ne peut pas s'exécuter", "Points clés"],
    analysisMustFlag: [
      "__name__",
      "indentation",
      "texte brut|commentaire|# Calculatrice",
      "division",
    ],
    responseForbidden: ["tout est prêt", "sur quoi travaillons", "if choi in"],
    sentinels: {
      mustFlagCriticalIssues: true,
      mustNotIntroduceTyposInFix: true,
      mustNotUseGenericFluff: true,
      pythonFenceMustBeValid: true,
    },
    goldenResponse: `Le code ne peut pas s'exécuter tel quel.

❌ Erreurs bloquantes détectées
1. **Texte brut** en tête (« Calculatrice simple ») — doit être commenté avec \`#\`.
2. **\`if name == "main"\`** — invalide ; il faut \`if __name__ == "__main__":\`.
3. **Fonction \`division\`** — plusieurs instructions sur une ligne sans structure Python valide.
4. **Indentation** — \`while True\` et le bloc \`try\` semblent hors de \`calculatrice()\`.

📋 Analyse du code fourni
Le script vise une calculatrice console avec menu 1–5 et gestion \`ValueError\` sur les entrées numériques.

✅ Version corrigée
\`\`\`python
# Calculatrice simple — python calculatrice.py

def addition(a, b):
    return a + b

def soustraction(a, b):
    return a - b

def multiplication(a, b):
    return a * b

def division(a, b):
    if b == 0:
        raise ValueError("Erreur : division par zéro")
    return a / b

def calculatrice():
    print("=== Calculatrice ===")
    while True:
        try:
            choix = input("\\nVotre choix (1-5) : ")
            if choix == "5":
                print("Au revoir !")
                break
            if choix not in ("1", "2", "3", "4"):
                print("Choix invalide")
                continue
            a = float(input("Premier nombre : "))
            b = float(input("Deuxième nombre : "))
            ops = {"1": addition, "2": soustraction, "3": multiplication, "4": division}
            print(f"Résultat : {ops[choix](a, b)}")
        except ValueError as err:
            print(err if str(err) else "Erreur : veuillez entrer des nombres valides")

if __name__ == "__main__":
    calculatrice()
\`\`\`

💡 Améliorations possibles
- Dispatch via dictionnaire \`operations\`
- Tests unitaires pytest sur les opérations`,
  },
];

/** Réponses Nexxus observées — doivent échouer les sentinelles */
export const NEXXUS_FAILED_REVIEW_SAMPLES = {
  tour1_resume_sans_erreurs: `Points clés du code Python
Fonctions de base arithmétiques
addition(a, b): retourne la somme de a et b.
Le bloc if __name__ == "__main__": calculatrice() assure l'exécution.`,
  tour1_borderline_name_only: `Points clés du code Python
Fonctions de base arithmétiques
addition(a, b): retourne la somme.
Note : if name == "main" doit devenir if __name__ == "__main__".
Gestion des erreurs limitée.`,
  tour2_avec_typo_choi: `\`\`\`python
if choi in operations:
    result = operationschoix(a, b)
\`\`\`
Responsive / Performances : meilleure maintenance.`,
};
