import criticAgent from '../../src/agent/utils/criticAgent.js';

async function runTest() {
  const result = await criticAgent.evaluateReflexionContract({
    user_query: "est il possible d'utiliser le fichier txt et créer une page web avec une page de présentation... ?",
    execution_contract: "Tu dois produire l'artefact technique demandé en extrayant et en utilisant exhaustivement les données du fichier fourni.",
    forbidden_flags: ["generic_tutorial_instead_of_artifact", "file_not_used", "work_pushed_back_to_user"],
    raw_answer: "Voici une approche structurée pour créer votre page web interactive à partir du fichier texte. Créez un fichier index.html avec le code suivant : <html><body><!-- slides ici --></body></html>. Assurez-vous d'extraire les titres de votre fichier .txt. Il vous suffit ensuite d'écrire un script JS pour lier les boutons."
  });

  console.log("--- TEST CRITIC AGENT ---");
  console.log(JSON.stringify(result, null, 2));
}

runTest();
