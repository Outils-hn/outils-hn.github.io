// Check-up de l'Accueil dans un vrai navigateur, avec une base Supabase SIMULEE (aucune donnee reelle).
// Usage : node e2e/checkup.mjs <dossier de sortie> [adresse]   (axe-core facultatif)
import { chromium } from "playwright";
import { mesures, axe as axeLib, tabsJusqua, focusVisible, note, tenter, ecrire } from "./audit-lib.mjs";
import fs from "node:fs";

const out = process.argv[2] || "out";
const URL0 = process.argv[3] || "http://127.0.0.1:8091/";
const SB = "https://ngfzwfbraqkdcocdcmib.supabase.co";
fs.mkdirSync(out, { recursive: true });
const lignes = [];
const ok = (c, m) => { lignes.push(`${c ? "OK" : "ECHEC"} ${m}`); console.log(`${c ? "OK" : "ECHEC"} ${m}`); fs.writeFileSync(`${out}/checkup.txt`, lignes.join("\n") + "\n"); };
let AxeBuilder = null;
try { AxeBuilder = (await import("@axe-core/playwright")).default; } catch { /* pas d'axe en local */ }

const ADMIN = { email: "hugo@exemple.ch", mdp: "Motdepasse-admin", id: "11111111-1111-4111-8111-111111111111" };
const J = 86400000;
const etat = {
  retours: [
    { id: "r1", app: "Masse", type: "bug", texte: "Le total du PDF est coupé quand la liste est longue", nom: "Marc", page: "/listes", version: "2.0", navigateur: "", statut: "en_cours", reponse: "Corrigé dans la prochaine version.", moi_aussi: 2, created_at: new Date(Date.now() - 3 * J).toISOString() },
    { id: "r2", app: "Format", type: "idee", texte: "Pouvoir choisir l'aluminium anodisé dans les matériaux", nom: "", page: "", version: "", navigateur: "", statut: "nouveau", reponse: "", moi_aussi: 0, created_at: new Date(Date.now() - J).toISOString() },
    { id: "r3", app: "Linear", type: "idee", texte: "Export de la liste de coupe en Excel", nom: "Sarah", page: "", version: "", navigateur: "", statut: "fait", reponse: "", moi_aussi: 4, created_at: new Date(Date.now() - 20 * J).toISOString() },
  ],
  envois: [], admin: [],
};
async function brancher(ctx) {
  await ctx.route(`${SB}/**`, async (r) => {
    const req = r.request(); const u = new URL(req.url());
    const json = (b, s = 200) => r.fulfill({ status: s, contentType: "application/json", body: JSON.stringify(b) });
    const tok = (req.headers()["authorization"] || "").replace("Bearer ", "");
    const corps = req.postData() ? JSON.parse(req.postData()) : {};
    if (u.pathname === "/rest/v1/retours") return json(etat.retours);
    if (u.pathname === "/auth/v1/token") {
      if (corps.email !== ADMIN.email || corps.password !== ADMIN.mdp) return json({ error: "invalid_grant", error_description: "Invalid login credentials" }, 400);
      return json({ access_token: "tok-admin", expires_in: 3600, user: { id: ADMIN.id, email: ADMIN.email } });
    }
    if (u.pathname === "/rest/v1/rpc/is_admin") return json(tok === "tok-admin");
    if (u.pathname === "/rest/v1/rpc/retour_envoyer") {
      const p = corps.p; etat.envois.push(p);
      if ((p.texte || "").length < 5) return json({ ok: false, error: "Décrivez un peu plus (5 caractères au moins)." });
      const x = { id: `n${etat.envois.length}`, statut: "nouveau", reponse: "", moi_aussi: 0, created_at: new Date().toISOString(), ...p };
      etat.retours.unshift(x); return json({ ok: true, id: x.id });
    }
    if (u.pathname === "/rest/v1/rpc/retour_moi_aussi") { const x = etat.retours.find((y) => y.id === corps.p_id); if (x) x.moi_aussi++; return json({ ok: !!x }); }
    if (u.pathname === "/rest/v1/rpc/retour_traiter") {
      if (tok !== "tok-admin") return json({ ok: false, error: "Réservé aux administrateurs d'Index." });
      const x = etat.retours.find((y) => y.id === corps.p_id); Object.assign(x, { statut: corps.p_statut, reponse: corps.p_reponse }); etat.admin.push(corps); return json({ ok: true });
    }
    if (u.pathname === "/rest/v1/rpc/retour_supprimer") { etat.retours = etat.retours.filter((y) => y.id !== corps.p_id); return json({ ok: tok === "tok-admin" }); }
    return json([]);
  });
}
const b = await chromium.launch();
async function page({ dark = false } = {}) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  if (dark) await ctx.addInitScript(() => localStorage.setItem("accueil-theme", "dark"));
  await brancher(ctx);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => ok(false, `erreur JS : ${e.message}`));
  return p;
}

// ---------- Audit UX ----------
const txt = async (p, sel = "body") => (await p.locator(sel).first().innerText().catch(() => "")).replace(/\s+/g, " ");
const sh = async (p, n, full = true) => { await p.waitForTimeout(400); await p.screenshot({ path: `${out}/${n}.png`, fullPage: full }); };
const ouv = async (opts = {}, url = URL0, dims) => { const p = await page(opts); if (dims) await p.setViewportSize(dims); const t0 = Date.now(); await p.goto(url, { waitUntil: "networkidle" }); p._chargement = Date.now() - t0; await p.waitForTimeout(500); return p; };
await tenter("accueil", async () => { const p = await ouv(); await sh(p, "01-accueil"); await mesures(p, "accueil"); await axeLib(p, "accueil"); note("focus", await focusVisible(p)); note("accueil:texte", (await txt(p)).slice(0, 700)); note("tabs-jusqu-a-premiere-appli", await tabsJusqua(p, () => document.activeElement?.classList?.contains("carte"), 30)); });
await tenter("retours", async () => { const p = await ouv(); await p.getByRole("link", { name: /Idées & bugs/ }).click(); await p.waitForTimeout(400); await sh(p, "02-retours"); await mesures(p, "retours"); await axeLib(p, "retours"); note("retours:texte", (await txt(p)).slice(0, 600)); });
await tenter("formulaire", async () => {
  const p = await ouv({}, URL0 + "?app=Masse&v=2.4&page=%2Fmateriaux");
  await sh(p, "03-formulaire-depuis-appli", false);
  await p.getByRole("button", { name: "Envoyer" }).click(); await p.waitForTimeout(500); note("formulaire:vide", (await txt(p, "#dNouveau")).slice(0, 400)); await sh(p, "03b-formulaire-vide", false);
  await p.locator("#nTexte").fill("ok"); await p.getByRole("button", { name: "Envoyer" }).click(); await p.waitForTimeout(500); note("formulaire:trop-court", { envois: etat.envois.length, texte: (await txt(p, "#dNouveau")).slice(-250) });
  await p.locator("#nTexte").fill("x".repeat(5000)); await p.getByRole("button", { name: "Envoyer" }).click(); await p.waitForTimeout(600); note("formulaire:5000-caracteres", { envois: etat.envois.length, longueurEnvoyee: etat.envois.at(-1)?.texte?.length }); await sh(p, "03c-formulaire-long", false);
});
await tenter("hors-ligne", async () => { const c = await b.newContext({ viewport: { width: 1440, height: 900 } }); await c.route(/supabase\.co/, (r) => r.abort()); const p = await c.newPage(); await p.goto(URL0, { waitUntil: "load" }); await p.waitForTimeout(1500); await sh(p, "04-hors-ligne", false); note("hors-ligne:texte", (await txt(p)).slice(0, 500)); });
for (const [nom, w, h] of [["mobile", 390, 844], ["tablette", 768, 1024]]) await tenter(nom, async () => { const p = await ouv({}, URL0, { width: w, height: h }); await sh(p, `05-${nom}`); await mesures(p, nom); await axeLib(p, nom); });
await tenter("sombre", async () => { const p = await ouv({ dark: true }); await sh(p, "06-sombre", false); await axeLib(p, "sombre"); });
ecrire(); await b.close();
