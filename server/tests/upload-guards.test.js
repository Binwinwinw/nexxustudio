import test from "node:test";
import assert from "node:assert/strict";

import {
  detectDoubleExtension,
  validateDoubleExtension,
  UPLOAD_REJECTION_CODES,
} from "../../shared/uploadGuards.js";

test("uploadGuards: detects php.txt double extension trap", () => {
  const detected = detectDoubleExtension("physique_chimie_6eme_241_288.php.txt");
  assert.ok(detected);
  assert.equal(detected.label, ".php.txt");
  assert.equal(detected.inner, "php");
  assert.equal(detected.outer, "txt");
});

test("uploadGuards: rejects php.txt with DOUBLE_EXTENSION code", () => {
  const result = validateDoubleExtension("physique_chimie_6eme_241_288.php.txt");
  assert.equal(result.rejected, true);
  assert.equal(result.code, UPLOAD_REJECTION_CODES.DOUBLE_EXTENSION);
  assert.match(result.message, /Upload refusé \(sécurité\)/);
  assert.match(result.message, /Extension multiple détectée \(\.php\.txt\)/);
  assert.match(result.message, /ne sera pas transmis/);
});

test("uploadGuards: allows single .txt extension", () => {
  assert.equal(validateDoubleExtension("physique_chimie.txt").rejected, false);
  assert.equal(validateDoubleExtension("notes.txt").rejected, false);
});

test("uploadGuards: allows tar.gz archive naming", () => {
  assert.equal(validateDoubleExtension("backup.tar.gz").rejected, false);
});

test("uploadGuards: rejects exe.jpg disguise", () => {
  const result = validateDoubleExtension("setup.exe.jpg");
  assert.equal(result.rejected, true);
  assert.equal(result.code, UPLOAD_REJECTION_CODES.DOUBLE_EXTENSION);
});
