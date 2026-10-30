import { test } from "node:test";
import assert from "node:assert/strict";
import { APPLIS, compter, filtrerRetours, fmtDate, lireLien } from "../js/core.js";

const r = (o) => ({ id: "x", app: "Masse", type: "idee", texte: "", nom: "", reponse: "", statut: "nouveau", moi_aussi: 0, created_at: "2026-10-20T08:00:00Z", ...o });
const liste = [
  r({ id: "a", type: "bug", texte: "Le PDF coupe le total", statut: "fait" }),
  r({ id: "b", texte: "Ajouter l'aluminium anodisé", moi_aussi: 3, app: "Format" }),
  r({ id: "c", type: "bug", texte: "Accent manquant dans Échéance", statut: "en_cours", app: "Check" }),
  r({ id: "d", texte: "Export Excel", created_at: "2026-10-28T08:00:00Z" }),
  r({ id: "e", texte: "Spam", statut: "refuse" }),
];
const F = { type: "tous", app: "toutes", statut: "ouverts", q: "" };
const ids = (l) => l.map((x) => x.id);

test("8 applis dans l'ordre alphabetique", () => {
  assert.equal(APPLIS.length, 8);
  assert.deepEqual(APPLIS.map((a) => a.nom), [...APPLIS.map((a) => a.nom)].sort());
});
test("ouverts : en cours, puis les plus demandes, puis les plus recents", () => assert.deepEqual(ids(filtrerRetours(liste, F)), ["c", "b", "d"]));
test("filtres type, appli, statut", () => {
  assert.deepEqual(ids(filtrerRetours(liste, { ...F, type: "bug", statut: "tous" })), ["c", "a"]);
  assert.deepEqual(ids(filtrerRetours(liste, { ...F, app: "Format" })), ["b"]);
  assert.deepEqual(ids(filtrerRetours(liste, { ...F, statut: "fait" })), ["a"]);
});
test("recherche sans accents", () => {
  assert.deepEqual(ids(filtrerRetours(liste, { ...F, q: "anodise" })), ["b"]);
  assert.deepEqual(ids(filtrerRetours(liste, { ...F, q: "echeance check" })), ["c"]);
});
test("compteurs", () => assert.deepEqual(compter(liste), { ouverts: 3, bugs: 1, idees: 2, faits: 1 }));
test("dates relatives", () => {
  const now = new Date("2026-10-30T12:00:00");
  assert.equal(fmtDate("2026-10-30T09:00:00", now), "aujourd'hui");
  assert.equal(fmtDate("2026-10-29T09:00:00", now), "hier");
  assert.equal(fmtDate("2026-10-26T09:00:00", now), "il y a 4 jours");
  assert.equal(fmtDate("2026-09-01T09:00:00", now), "01.09.2026");
});
test("lien depuis une appli", () => {
  assert.deepEqual(lireLien("?app=Masse&type=bug&v=2.0&page=/materiaux"), { app: "Masse", type: "bug", version: "2.0", page: "/materiaux", ouvrir: true });
  assert.deepEqual(lireLien("?app=Inconnue"), { app: null, type: null, version: "", page: "", ouvrir: false });
  assert.deepEqual(lireLien("?nouveau"), { app: null, type: null, version: "", page: "", ouvrir: true });
});
