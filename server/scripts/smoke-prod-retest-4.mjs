import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";

const QUERIES = [
  {
    label: "G41.1 identité+capabilities",
    q: "bonjour comment t'appelles tu et quelles sont tes fonctionnalités phares ?",
  },
  {
    label: "G41 capabilities",
    q: "si tu pouvais énumérer tes fonctionnalités plus en détails, cela m'aiderait ?",
  },
  {
    label: "G40.4 div",
    q: "pourrais-tu faire un résumé du rôle de <div> en HTML?",
  },
  {
    label: "G42 attaquer d'autres",
    q: "non merci qu'est ce que tu pourrais proposer d'attaquer d'autres ?",
  },
];

for (const { label, q } of QUERIES) {
  const hit = await runConversationShortCircuit(q);
  console.log("---");
  console.log(label);
  console.log("path:", hit?.path);
  console.log("deferToLlm:", hit?.deferToLlm);
  console.log("glossaryDirect:", hit?.glossaryDirect);
  console.log("reply:", (hit?.reply || "").slice(0, 140) + "...");
}
