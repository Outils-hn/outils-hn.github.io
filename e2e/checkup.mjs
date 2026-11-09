// Check-up de l'Accueil dans un vrai navigateur, avec une base Supabase SIMULEE (aucune donnee reelle).
// Usage : node e2e/checkup.mjs <dossier de sortie> [adresse]   (axe-core facultatif)
import { chromium } from "playwright";
import fs from "node:fs";

const out = process.argv[2] || "out";
const URL0 = process.argv[3] || "http://127.0.0.1:8091/";
const SB = "https://dtxgvwaqjmmffiiohika.supabase.co";
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
  envois: [], admin: [], actions: [],
  comptes: [
    { id: ADMIN.id, email: ADMIN.email, display_name: "Hugo", approved: true, is_admin: true, role: "concepteur", created_at: new Date().toISOString() },
    { id: "c2", email: "sarah@exemple.ch", display_name: "Sarah", approved: false, is_admin: false, role: "dessinateur", created_at: new Date().toISOString() },
    { id: "c3", email: "marc@exemple.ch", display_name: "Marc", approved: true, is_admin: false, role: "dessinateur", created_at: new Date().toISOString() },
  ],
  histo: [
    { id: 12, at: new Date().toISOString(), tbl: "membrane_catalogue", ligne: "unisb", action: "UPDATE", libelle: "SikaMembran Universal SB", auteur_nom: "Marc", diff: { sd: [60, 50] }, annule: false, est_annulation: false, peut_annuler: true },
    { id: 11, at: new Date().toISOString(), tbl: "products", ligne: "p1", action: "UPDATE", libelle: "Fiche test", auteur_nom: "Sarah", diff: { pdf_filename: ["fiche-v1.pdf", "fiche-v2.pdf"], pdf_path: ["a/fiche-v1.pdf", "a/fiche-v2.pdf"], updated_at: ["2026-11-01", "2026-11-09"] }, annule: false, est_annulation: false, peut_annuler: false },
  ],
};
// CHANGELOG simules des applis (Strate n'en a pas : 404, pour verifier que la page n'en souffre pas)
const JOURNAUX = {
  masse: "# Journal\n\n## 2.4 — 31 octobre 2026\n\n- Nouveauté : les valeurs impossibles sont refusées avec un message clair.\n- Détail technique pour le développeur.\n\n## 2.3 — 20 octobre 2026\n\n- Changement technique sans phrase pour l'équipe.\n",
  check: "# Journal\n\n## 2.5 — 31 octobre 2026\n\n- Nouveauté : dernière version de Check.\n",
};
async function brancher(ctx) {
  await ctx.route("https://raw.githubusercontent.com/**", async (r) => {
    const nom = new URL(r.request().url()).pathname.split("/")[2];
    if (!JOURNAUX[nom]) return r.fulfill({ status: 404, contentType: "text/plain", body: "404: Not Found" });
    return r.fulfill({ status: 200, contentType: "text/plain", headers: { "access-control-allow-origin": "*" }, body: JOURNAUX[nom] });
  });
  await ctx.route(`${SB}/**`, async (r) => {
    const req = r.request(); const u = new URL(req.url());
    const json = (b, s = 200) => r.fulfill({ status: s, contentType: "application/json", body: JSON.stringify(b) });
    const tok = (req.headers()["authorization"] || "").replace("Bearer ", "");
    const corps = req.postData() ? JSON.parse(req.postData()) : {};
    if (u.pathname === "/rest/v1/retours") return json(etat.retours);
    if (u.pathname === "/auth/v1/token" && u.searchParams.get("grant_type") === "refresh_token") {
      return corps.refresh_token === "ref-ok" ? json({ access_token: "tok-admin", refresh_token: "ref-ok", expires_in: 3600, user: { id: ADMIN.id, email: ADMIN.email } }) : json({ error: "invalid_grant" }, 400);
    }
    if (u.pathname === "/auth/v1/token") {
      if (corps.email !== ADMIN.email || corps.password !== ADMIN.mdp) return json({ error: "invalid_grant", error_description: "Invalid login credentials" }, 400);
      return json({ access_token: "tok-admin", expires_in: 3600, user: { id: ADMIN.id, email: ADMIN.email } });
    }
    if (u.pathname === "/rest/v1/rpc/stats_accueil") {
      if (tok !== "tok-admin") return json({ message: "Reserve au concepteur" }, 400);
      return json({ comptes: { total: 14, valides: 12, attente: 2, concepteur: 1, administrateur: 2, dessinateur: 9 },
        derniers: [{ email: "a@exemple.ch", le: new Date().toISOString() }],
        retours: { total: 6, nouveaux: 2 },
        applis: [{ nom: "Index", total: 312, mois: 18, a_verifier: 41 }, { nom: "Access", total: 58, mois: 7 }, { nom: "Check", total: 240, mois: 64 }, { nom: "Masse", total: 95, mois: 11 }, { nom: "Format", total: 34, mois: 2 }, { nom: "Strate", total: 120, mois: 0 }] });
    }
    if (u.pathname === "/rest/v1/rpc/mon_role") return json(tok === "tok-admin" ? "concepteur" : null);
    if (u.pathname === "/rest/v1/rpc/list_accounts") return json(tok === "tok-admin" ? etat.comptes : [], tok === "tok-admin" ? 200 : 200);
    if (u.pathname === "/rest/v1/rpc/set_account_approved") { const c = etat.comptes.find((x) => x.id === corps._id); if (c) c.approved = corps._approved; etat.actions.push(["approved", corps]); return json(null); }
    if (u.pathname === "/rest/v1/rpc/set_account_admin") { const c = etat.comptes.find((x) => x.id === corps._id); if (c) c.is_admin = corps._admin; etat.actions.push(["admin", corps]); return json(null); }
    if (u.pathname === "/rest/v1/rpc/historique_lire") return json(tok === "tok-admin" ? etat.histo.filter((h) => !corps._tbl || h.tbl === corps._tbl) : []);
    if (u.pathname === "/rest/v1/rpc/historique_annuler") { const h = etat.histo.find((x) => x.id === corps._id); if (h) { h.annule = true; h.peut_annuler = false; } etat.actions.push(["annuler", corps]); return json(null); }
    if (u.pathname === "/rest/v1/rpc/is_approved") return json(true);
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
  ok((await p.locator(".carte").count()) === 10, "10 applis sur l'accueil");
  ok((await p.locator(".carte .nom").allTextContents()).join(",") === "Access,Check,Format,Index,Joint,Linear,Masse,Membrane,Strate,Trame", "dans l'ordre alphabétique");
  ok(await p.locator(".carte", { hasText: "Masse" }).getByText("1 en cours").isVisible(), "carte Masse : « 1 en cours »");
  ok((await p.locator(".carte", { hasText: "Strate" }).getAttribute("href")) === "https://outils-hn.github.io/Strate/", "lien Strate");
  ok((await p.locator("#navCompte").textContent()).includes("2"), "menu : 2 retours ouverts");
  ok((await p.locator(".carte", { hasText: "Masse" }).locator(".version").textContent()) === "v2.4", "carte Masse : version v2.4 lue dans son CHANGELOG");
  ok((await p.locator(".carte .version").count()) === 2, "seules les applis avec un CHANGELOG affichent une version (Strate : aucune, sans erreur)");
  await shot(p, "01-accueil");
  await axe(p, "accueil");

  // Nouveautes
  await p.getByRole("link", { name: "Nouveautés" }).click(); await p.waitForTimeout(400);
  ok((await p.locator(".nouveaute").count()) === 2, "Nouveautés : 2 versions (Check 2.5, Masse 2.4) ; Masse 2.3, sans phrase « Nouveauté », est masquée");
  ok(!(await p.locator("#listeNouveautes").textContent()).includes("technique"), "Nouveautés : aucun détail technique affiché");
  ok((await p.locator(".nouveaute .phrase").first().textContent()).startsWith("Dernière version de Check"), "Nouveautés : la phrase commence par une majuscule");
  ok((await p.locator(".nouveaute").first().textContent()).includes("Check") && (await p.locator(".nouveaute").nth(1).textContent()).includes("Masse"), "Nouveautés : les plus récentes d'abord");
  ok((await p.locator("#resumeNouveautes").textContent()).includes("indisponible"), "Nouveautés : les applis sans journal sont signalées");
  await shot(p, "06-nouveautes");
  await axe(p, "nouveautés");
  await p.locator("#fAppNouveautes").selectOption("Masse");
  ok((await p.locator(".nouveaute").count()) === 1, "Nouveautés : filtre par appli");
  await p.locator("#fAppNouveautes").selectOption("Access");
  ok((await p.locator("#listeNouveautes").textContent()).includes("Rien de nouveau pour Access"), "Nouveautés : message clair quand une appli n'a rien de nouveau");
  await p.locator("#fAppNouveautes").selectOption("toutes");

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
  ok((await p2.locator("#nCompteur").textContent()) === "0 / 2'000", "compteur de caractères à zéro");
  await p2.locator("#nTexte").fill("ok");
  ok((await p2.locator("#nCompteur").textContent()) === "2 / 2'000", "compteur : 2 / 2'000");
  await p2.getByRole("button", { name: "Envoyer" }).click(); await p2.waitForTimeout(400);
  ok(etat.envois.length === 0 && await p2.locator("#dNouveau").evaluate((d) => d.open), "texte trop court : rien n'est envoyé");
  ok((await p2.locator("#nErreur").textContent()).includes("au moins 5 caractères"), "texte trop court : message « au moins 5 caractères » sous le formulaire");
  await p2.locator("#nTexte").fill("x".repeat(1900));
  ok((await p2.locator("#nCompteur").getAttribute("class")).includes("proche"), "compteur : mis en évidence près de la limite");
  await p2.locator("#nTexte").fill("y".repeat(2500));
  ok((await p2.locator("#nTexte").inputValue()).length === 2000 || (await p2.locator("#nCompteur").textContent()) === "2'000 / 2'000", "limite de 2'000 caractères");
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

  // Compte Index : « Se connecter » en haut de page, connexion partagee (cle de stockage d'Index)
  ok((await p.locator("#etatCompte").innerText()) === "Lecture seule" && (await p.locator("#compteBtn").innerText()) === "Se connecter", "Bandeau : « Lecture seule » + Se connecter");
  await p.locator("#compteBtn").click();
  await p.locator("#formConnexion [name=email]").fill(ADMIN.email); await p.locator("#formConnexion [name=mdp]").fill("mauvais");
  await p.locator("#formConnexion button[type=submit]").click(); await p.waitForTimeout(400);
  ok(/incorrect/.test(await p.locator("#cErreur").innerText()), "Connexion : mauvais mot de passe refuse avec un message clair");
  await p.locator("#formConnexion [name=mdp]").fill(ADMIN.mdp);
  await p.locator("#formConnexion button[type=submit]").click(); await p.waitForTimeout(400);
  ok((await p.locator("#etatCompte").innerText()) === `${ADMIN.email}`, "Connexion : email seul en haut de page");
  ok(!!(await p.evaluate(() => localStorage.getItem("sb-dtxgvwaqjmmffiiohika-auth-token"))), "Connexion : session rangee sous la cle commune a toutes les applis");
  // Statistiques : onglet visible apres connexion du concepteur (la fonction repond), cache sinon
  await p.waitForTimeout(400);
  ok(await p.locator("#navTableau").isVisible(), "Tableau de bord : onglet visible pour un compte valide");
  ok((await p.locator("#navAttente").innerText()).includes("1"), "Tableau de bord : 1 compte en attente signalé dans le menu");
  await p.locator("#navTableau").click(); await p.waitForTimeout(500);
  ok((await p.locator("#statsContenu").innerText()).includes("312") && (await p.locator("#statsContenu").innerText()).includes("Comptes par rôle"), "Tableau de bord : statistiques affichées (concepteur)");
  ok((await p.locator("#listeComptes li").count()) === 3, "Tableau de bord : 3 comptes listés");
  await shot(p, "06b-tableau");
  await axe(p, "tableau de bord");
  await p.locator("[data-valider=c2]").click(); await p.waitForTimeout(500);
  ok(etat.actions.some((a) => a[0] === "approved" && a[1]._id === "c2" && a[1]._approved === true), "Comptes : Valider appelle la base");
  await p.locator("[data-admin=c3]").click(); await p.locator("#dq-ok").click(); await p.waitForTimeout(500);
  ok(etat.actions.some((a) => a[0] === "admin" && a[1]._id === "c3" && a[1]._admin === true), "Comptes : Nommer admin (concepteur) appelle la base");
  await p.locator("[data-retirer=c3]").click(); await p.locator("#dq-ok").click(); await p.waitForTimeout(500);
  ok(etat.actions.some((a) => a[0] === "approved" && a[1]._id === "c3" && a[1]._approved === false), "Comptes : Retirer l'accès demande confirmation puis appelle la base");
  ok((await p.locator("#listeHist > li").count()) === 2 && (await p.locator("#listeHist").innerText()).includes("60"), "Historique : 2 lignes");
  ok((await p.locator("#listeHist .chg .avant").first().innerText()).length > 0 && (await p.locator("#listeHist > li", { hasText: "Fiche test" }).locator(".chg li").count()) === 1 && (await p.locator("#listeHist > li", { hasText: "Fiche test" }).locator(".apres").innerText()) === "fiche-v2.pdf", "Historique : un PDF modifié = une seule ligne « PDF : ancien → nouveau », sans champs techniques");
  ok((await p.locator("[data-annuler]").count()) === 1, "Historique : bouton Annuler seulement quand c'est permis");
  await p.locator("[data-annuler='12']").click(); await p.locator("#dq-ok").click(); await p.waitForTimeout(500);
  ok(etat.actions.some((a) => a[0] === "annuler" && a[1]._id === 12), "Historique : Annuler appelle la base");
  await p.locator("#hTbl").selectOption("products"); await p.waitForTimeout(400);
  ok((await p.locator("#listeHist > li").count()) === 1, "Historique : filtre par type");
  await p.getByRole("link", { name: "Applis" }).click(); await p.waitForTimeout(200);
  await p.locator("#compteBtn").click(); await p.waitForTimeout(200);
  ok((await p.locator("#etatCompte").innerText()) === "Lecture seule", "Deconnexion : retour en lecture seule");
  ok(!(await p.locator("#navTableau").isVisible()), "Tableau de bord : onglet cache sans connexion");
  // Joint (en preparation) : visible seulement pour le concepteur, et le drapeau partage avec les menus des applis retombe a la deconnexion
  ok((await p.locator(".carte .nom").allTextContents()).join(",") === "Access,Check,Format,Index,Joint,Linear,Masse,Membrane,Strate,Trame", "Joint et Membrane : cartes visibles sans compte");
  ok(!(await p.evaluate(() => localStorage.getItem("outils-apercu"))), "Joint : drapeau d'apercu absent sans compte concepteur");
  // Session perimee (plus d'une heure) : l'Accueil la renouvelle et l'onglet apparait quand meme
  await p.evaluate((u) => localStorage.setItem("sb-dtxgvwaqjmmffiiohika-auth-token", JSON.stringify({ access_token: "tok-vieux", refresh_token: "ref-ok", expires_at: 1000, user: u })), { id: ADMIN.id, email: ADMIN.email });
  await p.reload(); await p.waitForTimeout(800);
  ok(await p.locator("#navTableau").isVisible(), "Tableau de bord : session expirée renouvelée, onglet visible");
  ok((await p.locator(".carte .nom").allTextContents()).join(",") === "Access,Check,Format,Index,Joint,Linear,Masse,Membrane,Strate,Trame", "Joint et Membrane : cartes visibles aussi pour le concepteur");
  ok((await p.evaluate(() => localStorage.getItem("outils-apercu"))) === "1", "Joint : drapeau d'apercu pose pour les menus des autres applis");
  ok((await p.locator("#nApp option").allTextContents()).includes("Joint"), "Joint : proposé dans le formulaire de retour");
  await p.evaluate(() => localStorage.removeItem("sb-dtxgvwaqjmmffiiohika-auth-token")); await p.reload(); await p.waitForTimeout(400);

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

  await p.locator("#themeBtn").click();
  ok(await p.evaluate(() => localStorage.getItem("outils-theme")) === "dark", "thème : le choix est écrit dans le réglage commun « outils-theme »");

  const p3 = await page({ dark: true });
  await p3.goto(URL0 + "#retours"); await p3.waitForLoadState("networkidle"); await p3.waitForTimeout(400);
  await shot(p3, "05-sombre");
  await axe(p3, "sombre");
} catch (e) {
  ok(false, `arret du check-up : ${e.message.split("\n")[0]}`);
}
await b.close();
