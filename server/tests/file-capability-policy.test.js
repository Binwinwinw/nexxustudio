import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  FILE_CAPABILITY_POLICY_ID,
  FILE_CAPABILITY_CLASSES,
  FILE_CAPABILITY_STATUSES,
  classifyFileCapability,
  isAdmittedAtNameGate,
  shouldBlockFileCapability,
  sniffFileSignature,
  evaluateArchiveConstraints,
  isNestedArchiveEntry,
  FILE_CAPABILITY_CODES,
} from "../src/agent/policies/attachment/fileCapabilityPolicy.js";

const jsText = Buffer.from("export function ping() { return 1; }\n", "utf8");
const sqlText = Buffer.from(
  "CREATE TABLE users (id INT PRIMARY KEY);\n",
  "utf8",
);
const htmlText = Buffer.from(
  "<!DOCTYPE html><html><body>ok</body></html>",
  "utf8",
);
const pdfBuf = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n", "utf8");
const pngBuf = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
]);
const jpegBuf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const zipBuf = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
const mzBuf = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);
const svgBuf = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>', "utf8");

describe("FILE_CAPABILITY_V1", () => {
  it("rails validés restent admis (js sql html pdf)", () => {
    const cases = [
      { originalname: "app.js", mimetype: "text/javascript", buffer: jsText },
      { originalname: "schema.sql", mimetype: "text/plain", buffer: sqlText },
      { originalname: "page.html", mimetype: "text/html", buffer: htmlText },
      { originalname: "doc.pdf", mimetype: "application/pdf", buffer: pdfBuf },
    ];
    for (const file of cases) {
      assert.equal(isAdmittedAtNameGate(file, { channel: "chat" }), true, file.originalname);
      const cap = classifyFileCapability(file, { channel: "chat" });
      assert.equal(cap.policyId, FILE_CAPABILITY_POLICY_ID);
      assert.equal(cap.status, FILE_CAPABILITY_STATUSES.ACCEPT, file.originalname);
      assert.equal(cap.capabilities.execute, false);
      assert.equal(shouldBlockFileCapability(cap, "chat"), false, file.originalname);
    }
  });

  it("js/html = analysable sous contrainte ; sql/pdf = analysable", () => {
    const js = classifyFileCapability(
      { originalname: "app.js", mimetype: "application/octet-stream", buffer: jsText },
      { channel: "chat" },
    );
    assert.equal(js.class, FILE_CAPABILITY_CLASSES.ALLOWED_REINFORCED);
    assert.equal(js.verdict, "ce fichier est analysable sous contrainte");
    assert.equal(js.capabilities.analyze, true);
    assert.equal(js.capabilities.render, false);

    const html = classifyFileCapability(
      { originalname: "a.html", mimetype: "text/html", buffer: htmlText },
      { channel: "chat" },
    );
    assert.equal(html.verdict, "ce fichier est analysable sous contrainte");
    assert.equal(html.capabilities.render, false);

    const sql = classifyFileCapability(
      { originalname: "a.sql", mimetype: "text/plain", buffer: sqlText },
      { channel: "chat" },
    );
    assert.equal(sql.class, FILE_CAPABILITY_CLASSES.ALLOWED_ANALYZABLE);
    assert.equal(sql.verdict, "ce fichier est analysable");

    const pdf = classifyFileCapability(
      { originalname: "a.pdf", mimetype: "application/pdf", buffer: pdfBuf },
      { channel: "chat" },
    );
    assert.equal(pdf.verdict, "ce fichier est analysable");
    assert.equal(pdf.capabilities.extract, true);
  });

  it("png vision : rendu raster OK, pas d'exécution", () => {
    const cap = classifyFileCapability(
      { originalname: "pic.png", mimetype: "image/png", buffer: pngBuf },
      { channel: "chat" },
    );
    assert.equal(cap.status, FILE_CAPABILITY_STATUSES.ACCEPT);
    assert.equal(cap.capabilities.render, true);
    assert.equal(cap.capabilities.execute, false);
    assert.equal(cap.pipeline, "VISION");
  });

  it("zip chat refusé ; zip document → quarantaine extract", () => {
    const chat = classifyFileCapability(
      { originalname: "bundle.zip", mimetype: "application/zip", buffer: zipBuf },
      { channel: "chat" },
    );
    assert.equal(chat.status, FILE_CAPABILITY_STATUSES.REJECT);
    assert.equal(chat.verdict, "ce fichier est refusé");
    assert.ok(chat.codes.includes(FILE_CAPABILITY_CODES.CONTAINER_CHAT));

    const doc = classifyFileCapability(
      { originalname: "bundle.zip", mimetype: "application/zip", buffer: zipBuf },
      { channel: "document" },
    );
    assert.equal(doc.class, FILE_CAPABILITY_CLASSES.CONTAINER);
    assert.equal(doc.status, FILE_CAPABILITY_STATUSES.QUARANTINE);
    assert.equal(doc.verdict, "ce fichier va en quarantaine");
    assert.equal(doc.capabilities.extract, true);
    assert.equal(doc.capabilities.execute, false);
    assert.equal(doc.pipeline, "ARCHIVE_EXTRACT");
    assert.equal(shouldBlockFileCapability(doc, "document"), false);
  });

  it("double extension refusée", () => {
    const cap = classifyFileCapability(
      { originalname: "payload.php.txt", mimetype: "text/plain", buffer: Buffer.from("x") },
      { channel: "chat" },
    );
    assert.equal(cap.status, FILE_CAPABILITY_STATUSES.REJECT);
    assert.ok(cap.codes.includes(FILE_CAPABILITY_CODES.DOUBLE_EXTENSION));
    assert.match(cap.userSafeMessage, /Extension multiple/);
  });

  it("MIME incohérent refusé", () => {
    const cap = classifyFileCapability(
      { originalname: "doc.pdf", mimetype: "image/png", buffer: pdfBuf },
      { channel: "chat" },
    );
    assert.equal(cap.status, FILE_CAPABILITY_STATUSES.REJECT);
    assert.ok(cap.codes.includes(FILE_CAPABILITY_CODES.MIME_MISMATCH));
  });

  it("octet-stream n'est pas un mismatch", () => {
    const cap = classifyFileCapability(
      { originalname: "app.js", mimetype: "application/octet-stream", buffer: jsText },
      { channel: "chat" },
    );
    assert.equal(cap.status, FILE_CAPABILITY_STATUSES.ACCEPT);
  });

  it("signature incohérente : PDF nommé + PK", () => {
    const cap = classifyFileCapability(
      { originalname: "doc.pdf", mimetype: "application/pdf", buffer: zipBuf },
      { channel: "chat" },
    );
    assert.equal(cap.status, FILE_CAPABILITY_STATUSES.REJECT);
    assert.ok(cap.codes.includes(FILE_CAPABILITY_CODES.SIGNATURE_MISMATCH));
    assert.equal(cap.verdict, "ce fichier est refusé");
  });

  it("MZ sous .txt refusé (exécutable déguisé)", () => {
    const cap = classifyFileCapability(
      { originalname: "notes.txt", mimetype: "text/plain", buffer: mzBuf },
      { channel: "chat" },
    );
    assert.equal(cap.status, FILE_CAPABILITY_STATUSES.REJECT);
    assert.ok(cap.codes.includes(FILE_CAPABILITY_CODES.EXECUTABLE));
  });

  it("SVG refusé (contenu actif / XSS)", () => {
    assert.equal(
      isAdmittedAtNameGate({ originalname: "icon.svg", mimetype: "image/svg+xml" }),
      false,
    );
    const cap = classifyFileCapability(
      { originalname: "page.html", mimetype: "text/html", buffer: svgBuf },
      { channel: "chat" },
    );
    assert.equal(cap.status, FILE_CAPABILITY_STATUSES.REJECT);
    assert.ok(cap.codes.includes(FILE_CAPABILITY_CODES.ACTIVE_FORMAT));
  });

  it("exe / unknown refusés — denylist complémentaire, pas seule", () => {
    const exe = classifyFileCapability(
      { originalname: "setup.exe", mimetype: "application/x-msdownload", buffer: mzBuf },
      { channel: "chat" },
    );
    assert.equal(exe.class, FILE_CAPABILITY_CLASSES.REFUSED);
    assert.equal(exe.status, FILE_CAPABILITY_STATUSES.REJECT);

    const unk = classifyFileCapability(
      { originalname: "blob.dat", mimetype: "application/octet-stream", buffer: jsText },
      { channel: "chat" },
    );
    assert.equal(unk.class, FILE_CAPABILITY_CLASSES.UNKNOWN);
    assert.equal(unk.status, FILE_CAPABILITY_STATUSES.REJECT);
    assert.ok(unk.codes.includes(FILE_CAPABILITY_CODES.UNKNOWN));
  });

  it("nom/chemin suspect", () => {
    const cap = classifyFileCapability(
      { originalname: "../etc/passwd.txt", mimetype: "text/plain" },
      { channel: "chat" },
    );
    assert.equal(cap.status, FILE_CAPABILITY_STATUSES.REJECT);
    assert.ok(cap.codes.includes(FILE_CAPABILITY_CODES.SUSPECT_PATH));
  });

  it("archive imbriquée et zip bomb", () => {
    assert.equal(isNestedArchiveEntry("docs/inner.zip"), true);
    assert.equal(isNestedArchiveEntry("readme.md"), false);

    const nested = evaluateArchiveConstraints({ nestedDepth: 1 });
    assert.equal(nested.status, FILE_CAPABILITY_STATUSES.REJECT);
    assert.ok(nested.codes.includes(FILE_CAPABILITY_CODES.NESTED_ARCHIVE));

    const bomb = evaluateArchiveConstraints({
      compressedBytes: 1024,
      uncompressedBytes: 2 * 1024 * 1024,
    });
    assert.equal(bomb.status, FILE_CAPABILITY_STATUSES.REJECT);
    assert.ok(bomb.codes.includes(FILE_CAPABILITY_CODES.ZIP_BOMB));

    const ok = evaluateArchiveConstraints({
      nestedDepth: 0,
      compressedBytes: 1000,
      uncompressedBytes: 2000,
      fileCount: 2,
    });
    assert.equal(ok.status, FILE_CAPABILITY_STATUSES.ACCEPT);
  });

  it("sniff signatures de base", () => {
    assert.equal(sniffFileSignature(pdfBuf).kind, "pdf");
    assert.equal(sniffFileSignature(pngBuf).kind, "png");
    assert.equal(sniffFileSignature(jpegBuf).kind, "jpeg");
    assert.equal(sniffFileSignature(zipBuf).kind, "zip");
    assert.equal(sniffFileSignature(mzBuf).kind, "exe");
    assert.equal(sniffFileSignature(svgBuf).kind, "svg");
    assert.equal(sniffFileSignature(jsText).kind, "text");
  });

  it("execute jamais true", () => {
    const files = [
      { originalname: "a.js", buffer: jsText, mimetype: "text/javascript" },
      { originalname: "a.png", buffer: pngBuf, mimetype: "image/png" },
      { originalname: "a.zip", buffer: zipBuf, mimetype: "application/zip" },
      { originalname: "a.exe", buffer: mzBuf, mimetype: "application/octet-stream" },
    ];
    for (const file of files) {
      const cap = classifyFileCapability(file, { channel: "document" });
      assert.equal(cap.capabilities.execute, false, file.originalname);
    }
  });

  it("canon gouvernance présent et non-UX", () => {
    const canon = readFileSync(
      path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../docs/governance/file-capability-policy.md",
      ),
      "utf8",
    );
    assert.match(canon, /FILE_CAPABILITY_V1/);
    assert.match(canon, /Allowlist métier/);
    assert.match(canon, /CWE-434/);
    assert.doesNotMatch(canon, /formats? acceptés pour l'utilisateur/i);
  });
});
