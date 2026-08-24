import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateSpreadsheetRunnability,
  applyCodeDeliveryPreserveOrFail,
  extractCodeDeliverySourceText,
} from "../src/agent/policies/code/codeDeliveryRuntimeGuard.js";

const EXCEL_QUERY =
  "je veux créer un fichier excel avec un tableau de bord de gestion de rendez vous avec un calendrier affichant le jour et le nom de la personne";

const GOOD_SCRIPT = `
from datetime import date
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from openpyxl.utils import get_column_letter

NOM_PERSONNES = ["Alice", "Bob"]

def creer_dashboard():
    wb = Workbook()
    ws_cal = wb.active
    ws_cal.title = "Calendrier"
    ws_cal["A1"] = "Jour"
    ws_cal["B1"] = "Nom"
    for idx, nom in enumerate(NOM_PERSONNES, start=2):
        ws_cal.cell(row=idx, column=1, value=date.today().isoformat())
        ws_cal.cell(row=idx, column=2, value=nom)
        col = get_column_letter(idx)
        ws_cal[f"{col}1"] = nom
    fill = PatternFill(start_color="D9E2F3", end_color="D9E2F3")
    ws_cal["A1"].fill = fill
    ws_cal["A1"].font = Font(bold=True)
    return wb

if __name__ == "__main__":
    wb = creer_dashboard()
    wb.save("dashboard_rdv.xlsx")
`.trim();

const BROKEN_SCRIPT = `
from openpyxl import Workbook
from openpyxl.utils import get_column_letter

def creer_dashboard():
    wb = Workbook()
    nom = random.choice(NOM_PERSONNES)
    for idx in range(len(en_tete_tableau)):
        cell_ref = get_column_letter(idx + 1) + "A"
        ws_tab[cell_ref].font = header_font
    nom_fichier = "dashboard_rdv.xlsx"
    with open(nom_fichier, "wb") as f:
        wb.save(f)
    return wb
`.trim();

describe("codeDeliveryRuntimeGuard — runnabilité tableur", () => {
  it("accepte un script openpyxl complet avec wb.save(path)", () => {
    const r = evaluateSpreadsheetRunnability("```python\n" + GOOD_SCRIPT + "\n```");
    assert.equal(r.pass, true, r.reasons?.join("; "));
  });

  it("rejette stream binaire, cellules A, symboles fantômes", () => {
    const r = evaluateSpreadsheetRunnability("```python\n" + BROKEN_SCRIPT + "\n```");
    assert.equal(r.pass, false);
    const blob = (r.reasons || []).join(" | ");
    assert.match(blob, /wb\.save/);
    assert.match(blob, /référence cellule/);
    assert.match(blob, /NOM_PERSONNES|en_tete_tableau|header_font/);
  });
});

describe("codeDeliveryRuntimeGuard — preserve or fail", () => {
  it("préserve la source si le composer tronque", () => {
    const packet = {
      expert_outputs: [{ stage: "execution", content: "```python\n" + GOOD_SCRIPT + "\n```" }],
    };
    const composer =
      "Informations vérifiées à partir de sources récentes.\n```python\nfrom openpyxl import Workbook\nwb = Workbook()\n```";
    const out = applyCodeDeliveryPreserveOrFail({
      query: EXCEL_QUERY,
      packet,
      composerText: composer,
    });
    assert.equal(out.action, "preserved");
    assert.match(out.text, /wb\.save\("dashboard_rdv\.xlsx"\)/);
    assert.doesNotMatch(out.text, /sources récentes/);
  });

  it("bloque une source cassée plutôt que de laisser le composer réécrire", () => {
    const packet = {
      expert_outputs: [{ stage: "execution", content: "```python\n" + BROKEN_SCRIPT + "\n```" }],
    };
    const out = applyCodeDeliveryPreserveOrFail({
      query: EXCEL_QUERY,
      packet,
      composerText: "Voici une version plus jolie mais partielle.\n```python\nprint('ok')\n```",
    });
    assert.equal(out.action, "blocked");
    assert.match(out.text, /pas exécutable/);
  });

  it("extrait le plus long fence python d'exécution", () => {
    const packet = {
      expert_outputs: [
        { stage: "web_research", content: "```python\nprint(1)\n```" },
        { stage: "execution", content: "```python\n" + GOOD_SCRIPT + "\n```" },
      ],
    };
    const src = extractCodeDeliverySourceText(packet);
    assert.match(src, /creer_dashboard/);
    assert.doesNotMatch(src, /print\(1\)/);
  });
});
