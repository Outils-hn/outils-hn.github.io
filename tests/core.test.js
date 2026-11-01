import { test } from "node:test";
import assert from "node:assert/strict";
import { APPLIS, adresseJournal, compter, filtrerRetours, fmtDate, fusionnerJournaux, lireDate, lireJournal, lireLien, texteCompteur } from "../js/core.js";

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

const JOURNAL = `# Journal des versions — Masse

## 2.4 — 31 octobre 2026

- Nouveauté : une phrase simple pour tout le monde.
- Première puce avec \`code\`.
- Seconde puce
  qui continue sur la ligne suivante.

## 2.3 — 1er septembre 2026

- Nouveauté : l'ancienne version.

## 1.0

- Sans date.
`;
test("dates en francais", () => {
  assert.equal(lireDate("31 octobre 2026"), "2026-10-31");
  assert.equal(lireDate("1er février 2026"), "2026-02-01");
  assert.equal(lireDate("28 août 2026"), "2026-08-28");
  assert.equal(lireDate("pas une date"), null);
  assert.equal(lireDate(undefined), null);
});
test("lecture d'un CHANGELOG", () => {
  const j = lireJournal(JOURNAL);
  assert.deepEqual(j.map((e) => e.version), ["2.4", "2.3", "1.0"]);
  assert.equal(j[0].date, "2026-10-31");
  assert.equal(j[0].dateTexte, "31 octobre 2026");
  assert.deepEqual(j[0].notes, ["Première puce avec `code`.", "Seconde puce qui continue sur la ligne suivante."]);
  assert.equal(j[0].nouveaute, "une phrase simple pour tout le monde.");
  assert.equal(j[2].nouveaute, "");
  assert.equal(j[2].date, null);
  assert.deepEqual(lireJournal(""), []);
  assert.deepEqual(lireJournal("pas un journal"), []);
});
test("journaux fusionnes : seulement les versions avec une Nouveaute, recentes d'abord", () => {
  const j = { Masse: lireJournal(JOURNAL), Check: lireJournal("## 2.5 — 31 octobre 2026\n\n- Nouveauté : a\n\n## 2.4.1 — 25 octobre 2026\n\n- correctif technique\n\n## 2.4 — 20 octobre 2026\n\n- Nouveauté : b\n") };
  assert.deepEqual(fusionnerJournaux(j).map((e) => `${e.app} ${e.version}`), ["Check 2.5", "Masse 2.4", "Check 2.4", "Masse 2.3"]);
  assert.deepEqual(fusionnerJournaux(j, "Check").map((e) => e.version), ["2.5", "2.4"]);
  assert.deepEqual(fusionnerJournaux(j, "Index"), []);
});
test("adresse du journal et compteur", () => {
  assert.equal(adresseJournal("Masse"), "https://raw.githubusercontent.com/Outils-hn/masse/main/CHANGELOG.md");
  assert.equal(texteCompteur(0, 2000), "0 / 2'000");
  assert.equal(texteCompteur(1874, 2000), "1'874 / 2'000");
});
