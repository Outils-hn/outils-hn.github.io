// Check-up de l'Accueil dans un vrai navigateur, avec une base Supabase SIMULEE (aucune donnee reelle).
// Usage : node e2e/checkup.mjs <dossier de sortie> [adresse]   (axe-core facultatif)
import { chromium } from "playwright";
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
const shot = async (p, n) => { await p.waitForTimeout(400); await p.screenshot({ path: `${out}/${n}.png`, fullPage: true }); };
const axe = async (p, nom) => {
  if (!AxeBuilder) return;
  const a = await new AxeBuilder({ page: p }).withTags(["wcag2a", "wcag2aa"]).analyze();
  ok(a.violations.length === 0, `accessibilité ${nom} : ${a.violations.length} problème(s)${a.violations.map((v) => ` [${v.id}: ${v.nodes.length} ${v.nodes[0]?.target}]`).join("")}`);
};

try {
  const p = await page();
  await p.goto(URL0); await p.waitForLoadState("networkidle"); await p.waitForTimeout(400);
  ok((await p.locator(".carte").count()) === 8, "8 applis sur l'accueil");
  ok((await p.locator(".carte .nom").allTextContents()).join(",") === "Access,Check,Format,Index,Linear,Masse,Strate,Trame", "dans l'ordre alphabétique");
  ok(await p.locator(".carte", { hasText: "Masse" }).getByText("1 en cours").isVisible(), "carte Masse : « 1 en cours »");
  ok((await p.locator(".carte", { hasText: "Strate" }).getAttribute("href")) === "https://outils-hn.github.io/Strate/", "lien Strate");
  ok((await p.locator("#navCompte").textContent()).includes("2"), "menu : 2 retours ouverts");
  await shot(p, "01-accueil");
  await axe(p, "accueil");

  await p.getByRole("link", { name: /Idées & bugs/ }).click(); await p.waitForTimeout(300);
  ok((await p.locator(".retour").count()) === 2, "Retours : 2 ouverts par défaut (le fait est masqué)");
  ok((await p.locator(".retour").first().textContent()).includes("PDF est coupé"), "en cours d'abord");
  await p.locator("#fStatut").selectOption("tous");
  ok((await p.locator(".retour").count()) === 3, "« Tous les statuts » : 3");
  await p.getByRole("button", { name: "Bugs" }).click();
  ok((await p.locator(".retour").count()) === 1, "filtre Bugs");
  await p.getByRole("button", { name: "Tout" }).click();
  await p.locator("#fQ").fill("anodise");
  ok((await p.locator(".retour").count()) === 1, "recherche sans accents");
  await p.locator("#fQ").fill(""); await p.locator("#fStatut").selectOption("ouverts");
  await p.locator('[data-moi-aussi="r2"]').click(); await p.waitForTimeout(400);
  ok(etat.retours.find((x) => x.id === "r2").moi_aussi === 1 && await p.locator('[data-moi-aussi="r2"]').isDisabled(), "« Moi aussi » compté une fois");
  await shot(p, "02-retours");
  await axe(p, "retours");

  // Arrivee depuis une appli
  const p2 = await page();
  await p2.goto(URL0 + "?app=Masse&v=2.0&page=%2Fmateriaux"); await p2.waitForLoadState("networkidle"); await p2.waitForTimeout(600);
  ok(await p2.locator("#dNouveau").evaluate((d) => d.open), "depuis Masse : formulaire ouvert");
  ok((await p2.locator("#nApp").inputValue()) === "Masse", "appli pré-remplie");
  ok(await p2.locator("#similaires").getByText("Déjà signalé pour Masse").isVisible(), "retours déjà signalés pour Masse affichés");
  ok((await p2.locator("#nContexte").textContent()).includes("v2.0 · page /materiaux"), "version et page jointes");
  await p2.locator("#dNouveau .choix").getByText("Bug", { exact: true }).click();
  await p2.locator("#nTexte").fill("ok");
  await p2.getByRole("button", { name: "Envoyer" }).click(); await p2.waitForTimeout(400);
  ok(etat.envois.length === 0 && await p2.locator("#dNouveau").evaluate((d) => d.open), "texte trop court : rien n'est envoyé");
  await p2.locator("#nTexte").fill("La densité de l'acier inox ne s'enregistre pas");
  await p2.locator("#nNom").fill("Julie");
  await shot(p2, "03-formulaire");
  await p2.getByRole("button", { name: "Envoyer" }).click(); await p2.waitForTimeout(800);
  const env = etat.envois.at(-1);
  ok(env.app === "Masse" && env.type === "bug" && env.version === "2.0" && env.page === "/materiaux" && env.nom === "Julie", "envoyé avec appli, type, version, page et prénom");
  ok(await p2.getByText("Merci !").isVisible() && (await p2.locator(".retour", { hasText: "inox" }).count()) === 1, "merci + visible dans la liste");
  // Robot : champ piege rempli -> rien n'est envoye
  const n = etat.envois.length;
  await p2.getByRole("button", { name: "+ Nouvelle idée ou bug" }).click();
  await p2.locator("#nTexte").fill("Achetez des montres pas chères");
  await p2.locator("input[name=site]").evaluate((i) => (i.value = "http://spam"));
  await p2.getByRole("button", { name: "Envoyer" }).click(); await p2.waitForTimeout(400);
  ok(etat.envois.length === n, "champ piège : envoi d'un robot ignoré");

  // Administration
  await p.getByRole("button", { name: "Administration" }).click();
  await p.locator("#dAdmin input[name=email]").fill(ADMIN.email);
  await p.locator("#dAdmin input[name=mdp]").fill("faux");
  await p.locator("#dAdmin").getByRole("button", { name: "Se connecter" }).click(); await p.waitForTimeout(400);
  ok(await p.getByText("Email ou mot de passe incorrect.").isVisible(), "admin : mauvais mot de passe");
  await p.locator("#dAdmin input[name=mdp]").fill(ADMIN.mdp);
  await p.locator("#dAdmin").getByRole("button", { name: "Se connecter" }).click(); await p.waitForTimeout(600);
  ok((await p.locator("[data-traiter]").count()) > 0, "admin : bouton « Traiter » sur les retours");
  await p.locator('.retour[data-id="r2"] [data-traiter]').click();
  await p.locator("#tStatut").selectOption("prevu");
  await p.locator("#tReponse").fill("Prévu pour Format 2.1");
  await shot(p, "04-traiter");
  await p.locator("#dTraiter").getByRole("button", { name: "Enregistrer" }).click(); await p.waitForTimeout(800);
  ok(etat.admin.at(-1)?.p_statut === "prevu", "statut changé en « Prévu »");
  ok(await p.getByText("Prévu pour Format 2.1").isVisible(), "réponse visible par tous");

  const p3 = await page({ dark: true });
  await p3.goto(URL0 + "#retours"); await p3.waitForLoadState("networkidle"); await p3.waitForTimeout(400);
  await shot(p3, "05-sombre");
  await axe(p3, "sombre");
} catch (e) {
  ok(false, `arret du check-up : ${e.message.split("\n")[0]}`);
}
await b.close();
