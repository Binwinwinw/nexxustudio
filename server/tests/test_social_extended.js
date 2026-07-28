const queries = [
  "comment tu vas",
  "ça va bien ?",
  "tu vas bien en ce moment ?",
  "ca va bien ?"
];

const regex = /(comment\s+(ça|ca)\s+va|(?:^|\s)(ça|ca)\s+va|comment\s+tu\s+vas|comment\s+vas[- ]?tu|(?:^|\s)(etat|état)\s+de\s+sant(e|é)|comment\s+te\s+sens[- ]?tu|comment\s+tu\s+te\s+sens|tu\s+vas\s+bien)/i;

for (const q of queries) {
  console.log(`Query: "${q}" -> Matched: ${regex.test(q)}`);
}
