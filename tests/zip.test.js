import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { crc32, creerZip } from "../js/zip.js";

test("crc32 connu", () => { assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926); });
test("zip lisible par python, noms accentues compris", () => {
  const d = mkdtempSync(join(tmpdir(), "zip-"));
  const morceaux = creerZip([{ nom: "technical-sheets/fiche é.pdf", octets: new TextEncoder().encode("%PDF test") }, { nom: "check-images/a/b.png", octets: new Uint8Array([1, 2, 3]) }]);
  writeFileSync(join(d, "t.zip"), Buffer.concat(morceaux.map((m) => Buffer.from(m))));
  const sortie = execFileSync("python3", ["-c", "import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);print(z.testzip());print('|'.join(z.namelist()));print(z.read(z.namelist()[0]).decode())", join(d, "t.zip")]).toString().trim().split("\n");
  assert.deepEqual(sortie, ["None", "technical-sheets/fiche é.pdf|check-images/a/b.png", "%PDF test"]);
});
