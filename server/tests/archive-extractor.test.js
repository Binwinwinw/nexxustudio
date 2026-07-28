import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import {
  isArchiveFile,
  extractArchiveToText,
} from "../src/services/document-analysis/archiveExtractor.js";

function buildStoredZip(files) {
  const chunks = [];
  for (const [name, content] of Object.entries(files)) {
    const nameBuf = Buffer.from(name, "utf8");
    const data = Buffer.from(content, "utf8");
    const header = Buffer.alloc(30 + nameBuf.length);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0, 6);
    header.writeUInt16LE(0, 8);
    header.writeUInt32LE(0, 10);
    header.writeUInt32LE(data.length, 14);
    header.writeUInt32LE(data.length, 18);
    header.writeUInt16LE(nameBuf.length, 26);
    header.writeUInt16LE(0, 28);
    nameBuf.copy(header, 30);
    chunks.push(header, data);
  }
  return Buffer.concat(chunks);
}

describe("archiveExtractor", () => {
  it("détecte les archives par extension et mime", () => {
    assert.equal(isArchiveFile("application/zip", "bundle.zip"), true);
    assert.equal(isArchiveFile("", "sources.tar.gz"), true);
    assert.equal(isArchiveFile("text/plain", "readme.md"), false);
  });

  it("extrait le texte d'une archive ZIP (stockage)", () => {
    const zipped = buildStoredZip({
      "docs/readme.md": "# Projet\nContenu de test.",
      "ignore.exe": "bad",
    });

    const result = extractArchiveToText(zipped, "projet.zip");
    assert.match(result.text, /ARCHIVE — projet\.zip/);
    assert.match(result.text, /readme\.md/);
    assert.match(result.text, /Contenu de test/);
    assert.equal(result.fileCount, 1);
  });

  it("rejette les symlinks TAR", () => {
    const linkTarget = "../../../etc/passwd";
    const header = Buffer.alloc(512, 0);
    header.write("escape.txt", 0, "escape.txt".length, "utf8");
    header.write(linkTarget.length.toString(8).padStart(11, "0"), 124, 11, "utf8");
    header[156] = "2".charCodeAt(0);
    header.write(linkTarget, 157, linkTarget.length, "utf8");

    const tar = Buffer.concat([header, Buffer.alloc(512, 0)]);
    const gzipped = gzipSync(tar);

    assert.throws(
      () => extractArchiveToText(gzipped, "evil.tar.gz"),
      /Aucun fichier texte exploitable/,
    );
  });

  it("extrait le texte d'un TAR.GZ", () => {
    const name = "note.txt";
    const content = Buffer.from("Ligne importante\n");
    const header = Buffer.alloc(512, 0);
    header.write(name, 0, name.length, "utf8");
    header.write(content.length.toString(8).padStart(11, "0"), 124, 11, "utf8");
    header[156] = "0".charCodeAt(0);

    const padded = Buffer.alloc(Math.ceil(content.length / 512) * 512);
    content.copy(padded);
    const tar = Buffer.concat([header, padded, Buffer.alloc(512, 0)]);
    const gzipped = gzipSync(tar);

    const result = extractArchiveToText(gzipped, "bundle.tar.gz");
    assert.match(result.text, /note\.txt/);
    assert.match(result.text, /Ligne importante/);
  });
});
