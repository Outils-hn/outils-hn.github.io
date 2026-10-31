// Ouvre les applis publiees sur GitHub Pages, fait une capture de chaque page
// et note les erreurs (console, chargement, liens). Resultats dans le dossier passe en argument.
import { chromium } from "playwright";
import fs from "node:fs";

const out = process.argv[2] ?? "out";
fs.mkdirSync(out, { recursive: true });
const B = "https://outils-hn.github.io";
const pages = [
  ["accueil", `${B}/`],
  ["strate", `${B}/Strate/`],
  ["trame", `${B}/Trame/`],
  ["trame-404", `${B}/Trame/adresse-inconnue`],
  ["access", `${B}/Access/`],
  ["check", `${B}/Check/`],
  ["format", `${B}/Format/`],
  ["format-bibliotheque", `${B}/Format/bibliotheque`],
  ["index", `${B}/Index/`],
  ["index-auth", `${B}/Index/auth`],
  ["linear", `${B}/Linear/`],
  ["masse", `${B}/Masse/`],
  ["masse-listes", `${B}/Masse/listes`],
];

const browser = await chromium.launch();
const rapport = [];
for (const [nom, url] of pages) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "fr-CH" });
  const p = await ctx.newPage();
  const erreurs = [];
  p.on("console", (m) => { if (m.type() === "error") erreurs.push("console: " + m.text().slice(0, 200)); });
  p.on("pageerror", (e) => erreurs.push("page: " + String(e).slice(0, 200)));
  p.on("requestfailed", (r) => erreurs.push("echec: " + r.url().slice(0, 150)));
  p.on("response", (r) => { if (r.status() >= 400 && !r.url().endsWith("/adresse-inconnue")) erreurs.push(`HTTP ${r.status()}: ${r.url().slice(0, 150)}`); });
  let statut = "?";
  try {
    const rep = await p.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    statut = rep ? rep.status() : "?";
    await p.waitForTimeout(1500);
  } catch (e) { erreurs.push("goto: " + String(e).slice(0, 200)); }
  const titre = await p.title().catch(() => "");
  const pied = (await p.locator("footer").first().innerText().catch(() => "")).replace(/\s+/g, " ").trim();
  const retour = await p.getByRole("link", { name: "Suggestion / bug" }).first().getAttribute("href").catch(() => null);
  const menu = await p.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => a.href).filter((h) => /lovable\.app|hnaegellen/.test(h))).catch(() => []);
  await p.screenshot({ path: `${out}/${nom}.png` }).catch(() => {});
  rapport.push(`## ${nom}\nURL : ${url}\nHTTP : ${statut} · Titre : ${titre}\nPied : ${pied || "(aucun)"}\nSuggestion / bug : ${retour ?? "(absent)"}\nAnciens liens restants : ${menu.length ? menu.join(" , ") : "aucun"}\nErreurs : ${erreurs.length ? "\n- " + erreurs.join("\n- ") : "aucune"}\n`);
  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${out}/rapport.md`, rapport.join("\n"));
console.log(rapport.join("\n"));
