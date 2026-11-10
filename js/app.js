// Accueil : affichage des applis et des retours (idees & bugs).
import { projetsCheckDuChantier, resumeChantier, trierNotes, APPLIS, BASE_KEY, BASE_URL, STATUTS, TYPES, adresseJournal, compter, filtrerRetours, fmtDate, fusionnerJournaux, lireJournal, lireLien, termine, texteCompteur } from "./core.js?v=2.4";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const couleur = (app) => APPLIS.find((a) => a.nom === app)?.couleur ?? "#5D6068";

// ---------- Acces a la base (projet Index) ----------
const VOTES = "accueil-moi-aussi";

async function api(chemin, { methode = "GET", corps, jeton } = {}) {
  const r = await fetch(BASE_URL + chemin, {
    method: methode,
    headers: { apikey: BASE_KEY, ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}), "Content-Type": "application/json" },
    body: corps ? JSON.stringify(corps) : undefined,
  });
  const texte = await r.text();
  const data = texte ? JSON.parse(texte) : null;
  if (!r.ok) throw Object.assign(new Error(data?.message || data?.error_description || data?.msg || `Erreur ${r.status}`), { status: r.status, data });
  return data;
}
const rpc = (nom, args, jeton) => api(`/rest/v1/rpc/${nom}`, { methode: "POST", corps: args, jeton });
const horsLigne = (e) => /fetch|network|Load failed/i.test(e?.message ?? "");

// ---------- Etat ----------
let stats = null; // totaux reserves au concepteur (null = bloc cache)
let role = null; // « dessinateur », « administrateur », « concepteur » ; null = pas de compte valide (onglet cache)
let comptes = []; // liste des comptes (administrateurs) ; vide sinon
let historique = []; // dernieres modifications des donnees communes
let histErreur = false;
const filtreHist = { tbl: "", corbeille: false };
const estAdmin = () => role === "administrateur" || role === "concepteur";
/** Un administrateur connecte (session commune avec Index) peut traiter les retours : plus de connexion separee. */
const admin = () => (estAdmin() ? { email: lireSession()?.user?.email ?? "" } : null);
// Applis en apercu (aucune pour l'instant ; champ « apercu: true » dans core.js) : visibles seulement pour le concepteur. Le drapeau est garde dans le navigateur
// (meme site pour toutes les applis) pour que leurs menus montrent aussi l'appli ; il est remis a jour a chaque visite de l'Accueil.
const CLE_APERCU = "outils-apercu";
let apercu = false;
try { apercu = localStorage.getItem(CLE_APERCU) === "1"; } catch { /* stockage bloque */ }
const visibles = () => APPLIS.filter((a) => !a.apercu || apercu);
let retours = [];
let charge = false;
let erreurChargement = null;
const filtres = { type: "tous", app: "toutes", statut: "ouverts", q: "" };
const lien = lireLien(location.search);
let votes = new Set();
try { votes = new Set(JSON.parse(localStorage.getItem(VOTES) || "[]")); } catch { /* stockage bloque */ }

// Journaux des versions (CHANGELOG de chaque appli) : { nom: entrees[] } ; indisponibles = applis dont la lecture a echoue
let journaux = {};
let indisponibles = [];
let journauxCharges = false;
let nbAffiches = 30;
const filtreJournal = { app: "toutes" };

async function chargerJournaux() {
  const liste = visibles();
  const lots = await Promise.allSettled(liste.map(async (a) => {
    const r = await fetch(adresseJournal(a.nom));
    if (!r.ok) throw new Error(String(r.status));
    return [a.nom, lireJournal(await r.text())];
  }));
  journaux = {}; indisponibles = [];
  lots.forEach((l, i) => {
    if (l.status === "fulfilled" && l.value[1].length) journaux[l.value[0]] = l.value[1];
    else indisponibles.push(liste[i].nom);
  });
  journauxCharges = true;
  rendre();
}

async function charger() {
  try {
    retours = await api("/rest/v1/retours?select=*&order=created_at.desc&limit=500");
    erreurChargement = null;
  } catch (e) {
    erreurChargement = /retours|does not exist|PGRST205|42P01/i.test(e.message) ? "pas-prete" : "injoignable";
  }
  charge = true;
  rendre();
}

// ---------- Toast ----------
let minuteur;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(minuteur); minuteur = setTimeout(() => (t.hidden = true), 3200);
}

// ---------- Vues ----------
function vue() { if (location.hash.startsWith("#chantiers") && role) return "chantiers"; return (location.hash === "#tableau" || location.hash === "#statistiques") && role ? "tableau" : location.hash === "#retours" ? "retours" : location.hash === "#nouveautes" ? "nouveautes" : "applis"; }

function rendre() {
  const v = vue();
  $("#applis").hidden = v !== "applis";
  $("#retours").hidden = v !== "retours";
  $("#tableau").hidden = v !== "tableau";
  $("#chantiers").hidden = v !== "chantiers";
  $("#navTableau").hidden = !role;
  $("#navChantiers").hidden = !role;
  const attente = comptes.filter((c) => !c.approved).length;
  $("#navAttente").textContent = estAdmin() && attente ? `· ${attente}` : "";
  $("#nouveautes").hidden = v !== "nouveautes";
  document.querySelectorAll("[data-nav]").forEach((a) => (a.dataset.nav === v ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  const c = compter(retours);
  $("#navCompte").textContent = charge && c.ouverts ? `· ${c.ouverts}` : "";
  document.title = v === "retours" ? "Idées & bugs — Accueil" : v === "nouveautes" ? "Nouveautés — Accueil" : "Accueil — les outils du bureau d'études";
  document.title = v === "chantiers" ? "Chantiers — Accueil" : document.title;
  document.title = v === "tableau" ? "Tableau de bord — Accueil" : document.title;
  if (v === "chantiers") chargerChantiers();
  rendreApplis();
  rendreStats();
  rendreGestion();
  rendreRetours();
  rendreNouveautes();
}

/** Jeton encore valable : sinon on le renouvelle avec le jeton de renouvellement (la session est partagee avec Index, qui le fait aussi). */
async function sessionFraiche() {
  let s = lireSession();
  if (!s) return null;
  if (s.refresh_token && (s.expires_at ?? 0) < Math.floor(Date.now() / 1000) + 60) {
    try {
      const n = await api("/auth/v1/token?grant_type=refresh_token", { methode: "POST", corps: { refresh_token: s.refresh_token } });
      s = { ...s, ...n, expires_at: n.expires_at ?? Math.floor(Date.now() / 1000) + (n.expires_in ?? 3600) };
      ecrireSession(s);
    } catch { s = lireSession(); /* Index l'a peut-etre deja renouvele */ }
  }
  return s;
}
/** Notes de Check confiees a la personne connectee, pas reglees : la pastille « pour moi » de la carte Check. */
let pourMoi = 0;
async function chargerPourMoi(s) {
  let n = 0;
  try {
    if (s?.user?.id) n = (await api(`/rest/v1/check_notes?select=id&pour=eq.${encodeURIComponent(s.user.id)}&statut=neq.done&archive=eq.false&supprime_le=is.null&limit=99`, { jeton: s.access_token }))?.length ?? 0;
  } catch { n = 0; /* base injoignable ou Check pas active : pas de pastille */ }
  if (n !== pourMoi) { pourMoi = n; rendreApplis(); }
}
async function chargerStats() {
  const s = await sessionFraiche();
  chargerPourMoi(s);
  const avant = !!stats;
  const avantRole = role;
  try { role = s ? (await rpc("mon_role", {}, s.access_token)) || null : null; } catch { role = null; }
  try { stats = s && role === "concepteur" ? await rpc("stats_accueil", {}, s.access_token) : null; } catch { stats = null; }
  const avantApercu = apercu;
  apercu = !!stats;
  try { if (apercu) localStorage.setItem(CLE_APERCU, "1"); else localStorage.removeItem(CLE_APERCU); } catch { /* bloque */ }
  if (avantApercu !== apercu) { remplirListes(); if (apercu && journauxCharges) chargerJournaux(); }
  if (role) chargerGestion(); else { comptes = []; historique = []; }
  if (avant !== !!stats || avantRole !== role || stats) rendre();
}

// ---------- Tableau de bord : comptes et historique (fonctions de la base, droits verifies cote base) ----------
const TABLES = {
  products: "Fiche", categories: "Famille", suppliers: "Fournisseur", access_domaines: "Access · domaine", access_fournisseurs: "Access · fournisseur",
  format_materiaux: "Format · matériau", strate_catalogue: "Strate · catalogue", membrane_catalogue: "Membrane · catalogue",
  materials: "Masse · matériau", elements: "Masse · élément", lists: "Masse · liste",
};
const ACTIONS = { INSERT: "Ajout", UPDATE: "Modification", DELETE: "Suppression" };
const nomCompte = (c) => c.display_name || c.email || "Compte sans nom";
const quand = (d) => new Date(d).toLocaleString("fr-CH", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
// Historique lisible : une ligne par champ change, ancienne valeur barree -> nouvelle valeur
const CHAMPS = {
  name: "Nom", note: "Note", notes: "Notes", url: "Lien", tags: "Mots-clés", category: "Famille", supplier: "Fournisseur", icon: "Icône",
  pdf_filename: "PDF", pdf_path: "PDF", verified_at: "Vérifiée le", domain: "Domaine", website: "Site", cad_website: "Site CAO",
  contact_name: "Contact", contact_email: "E-mail", contact_phone: "Téléphone", mode: "Mode", value: "Valeur", source: "Source",
  description: "Description", height_mm: "Hauteur (mm)", length_mm: "Longueur (mm)", markup_pct: "Majoration (%)", deleted_at: "Supprimée le",
};
const CHAMPS_TECHNIQUES = new Set(["id", "created_at", "created_by", "updated_at"]);
const champNom = (k) => CHAMPS[k] ?? k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const valeur = (k, v) => {
  if (v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length)) return null;
  let t = Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v);
  if (k === "pdf_path") t = t.split("/").pop();
  if (/_at$/.test(k) && !isNaN(Date.parse(t))) t = fmtDate(t);
  return t.length > 120 ? t.slice(0, 120) + "…" : t;
};
const puce = (k, v, cls) => { const t = valeur(k, v); return t === null ? `<span class="val vide ${cls}">(vide)</span>` : `<span class="val ${cls}">${esc(t)}</span>`; };
function changements(h) {
  let champs = h.diff ? Object.entries(h.diff).filter(([k, p]) => !CHAMPS_TECHNIQUES.has(k) && Array.isArray(p)) : [];
  if (champs.some(([k]) => k === "pdf_filename")) champs = champs.filter(([k]) => k !== "pdf_path"); // meme info : on garde le nom du fichier
  champs = champs.filter(([k, [a, b]]) => JSON.stringify(a) !== JSON.stringify(b));
  if (!champs.length) return "";
  return `<ul class="chg">${champs.map(([k, [a, b]]) => `<li><span class="champ-nom">${esc(champNom(k))}</span>${puce(k, a, "avant")}<span class="fleche" aria-label="devient">→</span>${puce(k, b, "apres")}</li>`).join("")}</ul>`;
}

async function chargerGestion() {
  const sess = await sessionFraiche();
  if (!sess) return;
  const jeton = sess.access_token;
  const [c, h] = await Promise.allSettled([
    estAdmin() ? rpc("list_accounts", {}, jeton) : Promise.resolve([]),
    rpc("historique_lire", { _tbl: filtreHist.tbl || null, _limite: 100, ...(filtreHist.corbeille ? { _corbeille: true } : {}) }, jeton),
  ]);
  comptes = c.status === "fulfilled" ? c.value ?? [] : [];
  histErreur = h.status !== "fulfilled";
  historique = h.status === "fulfilled" ? h.value ?? [] : [];
  rendre();
}

function rendreGestion() {
  $("#blocStats").hidden = !stats;
  $("#blocComptes").hidden = !estAdmin();
  if (!role) return;
  const moi = lireSession()?.user?.id;
  const conc = role === "concepteur";
  const att = comptes.filter((c) => !c.approved).length;
  $("#resumeComptes").textContent = att ? `${att} en attente de validation` : "";
  $("#listeComptes").innerHTML = comptes.map((c) => {
    const etiquette = c.role === "concepteur" ? "Concepteur" : c.is_admin ? "Administrateur" : "Dessinateur";
    const boutons = !c.approved ? `<button type="button" class="btn primaire" data-valider="${esc(c.id)}">Valider</button>`
      : c.id === moi || c.role === "concepteur" ? ""
      : `${conc ? `<button type="button" class="btn" data-admin="${esc(c.id)}">${c.is_admin ? "Retirer admin" : "Nommer admin"}</button>` : ""}<button type="button" class="btn danger" data-retirer="${esc(c.id)}">Retirer l'accès</button>`;
    return `<li><div class="corps"><div class="l1">${esc(nomCompte(c))}</div>
      <div class="l2">${c.email ? esc(c.email) + " · " : ""}${c.approved ? etiquette : "En attente"} · créé le ${esc(fmtDate(c.created_at))}</div></div>
      <div class="boutons">${boutons}</div></li>`;
  }).join("") || `<li class="vide">Aucun compte.</li>`;

  const sel = $("#hTbl");
  if (!sel.options.length) sel.innerHTML = `<option value="">Tout</option>` + Object.entries(TABLES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
  $("#listeHist").innerHTML = histErreur
    ? `<li class="vide">L'historique n'est pas encore installé dans la base (script « historique » à exécuter dans Supabase).</li>`
    : historique.map((h) => {
      const type = h.est_annulation ? `Annulation (${ACTIONS[h.action].toLowerCase()})` : ACTIONS[h.action];
      return `<li class="h-${String(h.action).toLowerCase()}${h.annule ? " fait" : ""}"><div class="corps">
        <div class="l1"><span class="badge-h">${esc(type)}</span> <b>${esc(h.libelle || "(sans nom)")}</b>${h.annule ? ` <span class="aide">annulée</span>` : ""}</div>
        ${changements(h)}
        <div class="l2">${esc(TABLES[h.tbl] ?? h.tbl)} · ${esc(h.auteur_nom)} · ${esc(quand(h.at))}</div></div>
        <div class="boutons">${filtreHist.corbeille ? `<button type="button" class="btn" data-restaurer="${h.id}">Restaurer</button>`
          : `${h.peut_annuler ? `<button type="button" class="btn" data-annuler="${h.id}">Annuler</button>` : ""}${role === "concepteur" ? `<button type="button" class="btn icone-sup" data-masquer="${h.id}" aria-label="Mettre cette ligne à la corbeille" title="Mettre à la corbeille">🗑</button>` : ""}`}</div></li>`;
    }).join("") || `<li class="vide">${filtreHist.corbeille ? "La corbeille est vide." : "Rien à afficher."}</li>`;
  const conc2 = role === "concepteur";
  $("#hCorbeille").hidden = !conc2;
  $("#hCorbeille").textContent = filtreHist.corbeille ? "← Retour à l'historique" : "Corbeille";
  $("#hCorbeille").setAttribute("aria-pressed", String(filtreHist.corbeille));
  $("#hVider").hidden = !(conc2 && filtreHist.corbeille && historique.length);
  $("#blocHist h3 .aide").textContent = filtreHist.corbeille ? "supprimées définitivement après 30 jours" : "90 derniers jours";
}

// Fenetre de confirmation maison (remplace confirm() du navigateur)
function confirmer(titre, texte, bouton) {
  return new Promise((resolve) => {
    const d = $("#dConfirm");
    $("#dq-titre").textContent = titre; $("#dq-texte").textContent = texte; $("#dq-ok").textContent = bouton;
    d.returnValue = "";
    d.addEventListener("close", () => resolve(d.returnValue === "ok"), { once: true });
    d.showModal();
  });
}
async function actionGestion(nom, args, message) {
  const sess = await sessionFraiche();
  try { await rpc(nom, args, sess?.access_token); toast(message); await chargerGestion(); }
  catch (err) { toast(horsLigne(err) ? "Base injoignable." : err.message); }
}
$("#listeComptes").addEventListener("click", async (e) => {
  const b = e.target.closest("button"); if (!b) return;
  const id = b.dataset.valider || b.dataset.admin || b.dataset.retirer;
  const c = comptes.find((x) => x.id === id); if (!c) return;
  if (b.dataset.valider) return actionGestion("set_account_approved", { _id: id, _approved: true }, "Compte validé.");
  if (b.dataset.retirer) {
    if (await confirmer(`Retirer l'accès de ${nomCompte(c)} ?`, "Le compte pourra encore consulter les applis, mais plus rien modifier.", "Retirer l'accès")) actionGestion("set_account_approved", { _id: id, _approved: false }, "Accès retiré.");
  } else if (b.dataset.admin) {
    const retirer = c.is_admin;
    if (await confirmer(retirer ? `Retirer le rôle d'administrateur de ${nomCompte(c)} ?` : `Nommer ${nomCompte(c)} administrateur ?`,
      retirer ? "Le compte reste validé : il pourra toujours modifier des données." : "Il pourra valider des comptes et retirer des accès.", retirer ? "Retirer le rôle" : "Nommer administrateur"))
      actionGestion("set_account_admin", { _id: id, _admin: !retirer }, retirer ? "Rôle d'administrateur retiré." : "Administrateur ajouté.");
  }
});
$("#listeHist").addEventListener("click", async (e) => {
  const m = e.target.closest("[data-masquer], [data-restaurer]");
  if (m) return actionGestion("historique_masquer", { _id: Number(m.dataset.masquer || m.dataset.restaurer), _masquer: !!m.dataset.masquer },
    m.dataset.masquer ? "Ligne mise à la corbeille." : "Ligne restaurée.");
  const b = e.target.closest("[data-annuler]"); if (!b) return;
  const h = historique.find((x) => String(x.id) === b.dataset.annuler); if (!h) return;
  if (await confirmer(`Annuler cette modification de « ${h.libelle || "(sans nom)"} » ?`, "La ligne revient comme elle était avant. L'annulation s'inscrit aussi dans l'historique.", "Annuler la modification"))
    actionGestion("historique_annuler", { _id: h.id }, "Modification annulée.");
});
$("#hCorbeille").addEventListener("click", () => { filtreHist.corbeille = !filtreHist.corbeille; chargerGestion(); });
$("#hVider").addEventListener("click", async () => {
  if (await confirmer("Vider la corbeille ?", "Les lignes de la corbeille sont supprimées définitivement. Cela ne touche pas aux données des applis.", "Vider la corbeille"))
    actionGestion("historique_vider_corbeille", {}, "Corbeille vidée.");
});
$("#hTbl").addEventListener("change", (e) => { filtreHist.tbl = e.target.value; chargerGestion(); });
function rendreStats() {
  if (!stats) { $("#statsContenu").innerHTML = ""; return; }
  const c = stats.comptes, r = stats.retours, n = (x) => Number(x).toLocaleString("fr-CH");
  const idx = stats.applis.find((a) => a.nom === "Index");
  const haut = [
    ["Comptes", n(c.total), `${n(c.valides)} validé${c.valides > 1 ? "s" : ""}, ${n(c.attente)} en attente`],
    ["Fiches Index", n(idx?.total ?? 0), `${n(idx?.a_verifier ?? 0)} à vérifier ou périmée${(idx?.a_verifier ?? 0) > 1 ? "s" : ""}`],
    ["Fournisseurs Access", n(stats.applis.find((a) => a.nom === "Access")?.total ?? 0), "dans l'annuaire"],
    ["Retours (idées & bugs)", n(r.total), `${n(r.nouveaux)} pas encore lu${r.nouveaux > 1 ? "s" : ""}`],
  ].map(([l, v, d]) => `<div class="stat"><span class="lib">${esc(l)}</span><span class="val">${esc(v)}</span><span class="det">${esc(d)}</span></div>`).join("");
  const objets = { Index: "fiches techniques", Access: "fournisseurs", Check: "notes", Masse: "matériaux et éléments", Format: "matériaux de la bibliothèque", Strate: "produits du catalogue", Membrane: "produits et colles du catalogue" };
  const lignes = stats.applis.map((a) => `<tr><td><span class="pastille-c" style="--c:${couleur(a.nom)}"></span><b>${esc(a.nom)}</b></td><td>${esc(objets[a.nom] ?? "")}</td><td class="num">${n(a.total)}</td><td class="num">${a.mois > 0 ? "+" : ""}${n(a.mois)}</td></tr>`).join("");
  const max = Math.max(1, c.concepteur, c.administrateur, c.dessinateur);
  const barres = [["Concepteur", c.concepteur], ["Administrateur", c.administrateur], ["Dessinateur", c.dessinateur]]
    .map(([l, v]) => `<div class="barre"><div class="l"><span>${l}</span><span>${n(v)}</span></div><div class="f"><i style="width:${Math.round(v / max * 100)}%"></i></div></div>`).join("");
  const derniers = stats.derniers.map((d) => `<div class="derniers"><span>${esc(d.email ?? "")}</span><span>${esc(fmtDate(d.le))}</span></div>`).join("") || `<p class="det">Aucun compte.</p>`;
  $("#statsContenu").innerHTML = `<div class="stats-haut">${haut}</div>
    <div class="stats-bas">
      <div class="bloc tableau"><h3>Contenu par appli</h3><table><thead><tr><th>Appli</th><th>Ce qu'on compte</th><th class="num">Total</th><th class="num">Sur 30 jours</th></tr></thead><tbody>${lignes}</tbody></table></div>
      <div class="lateral"><div class="bloc"><h3>Comptes par rôle</h3>${barres}</div><div class="bloc"><h3>Derniers comptes</h3>${derniers}</div></div>
    </div>
    <p class="stats-note">Pas de suivi de connexions ni d'usage pour l'instant : seulement ce qui est déjà enregistré.</p>`;
}

function rendreApplis() {
  $("#grille").innerHTML = visibles().map((a) => {
    const ouverts = retours.filter((r) => r.app === a.nom && !termine(r)).length;
    return `<li><a class="carte" href="${a.url}" style="--c:${a.couleur}">
      <span class="tete"><span class="pastille"></span><span class="nom">${esc(a.nom)}</span>${journaux[a.nom] ? `<span class="version" title="Version actuelle de ${esc(a.nom)}">v${esc(journaux[a.nom][0].version)}</span>` : ""}${ouverts ? `<span class="signal" title="Idées et bugs en cours pour ${esc(a.nom)}">${ouverts} en cours</span>` : ""}${a.nom === "Check" && pourMoi ? `<span class="signal moi" title="Notes qui vous sont confiées, à traiter dans Check">${pourMoi} pour moi</span>` : ""}</span>
      <span class="role">${esc(a.role)}</span>
      <p class="texte">${esc(a.texte)}</p>
      <span class="ouvrir">Ouvrir ${esc(a.nom)} →</span>
    </a></li>`;
  }).join("");
}

function rendreRetours() {
  const liste = $("#liste");
  if (!charge) { liste.innerHTML = `<li class="vide">Chargement…</li>`; return; }
  if (erreurChargement) {
    $("#resume").textContent = "";
    liste.innerHTML = `<li class="vide">${erreurChargement === "pas-prete"
      ? "La base n'est pas encore préparée : lancer <code>supabase/retours.sql</code> dans le projet Supabase d'Index."
      : "Base injoignable : vérifiez la connexion puis rechargez la page."}</li>`;
    return;
  }
  const c = compter(retours);
  $("#resume").textContent = `${c.ouverts} en cours ou à venir (${c.bugs} bug${c.bugs > 1 ? "s" : ""}, ${c.idees} idée${c.idees > 1 ? "s" : ""}) · ${c.faits} fait${c.faits > 1 ? "s" : ""}${admin() ? ` · connecté : ${admin().email}` : ""}`;
  const vis = filtrerRetours(retours, filtres);
  if (!vis.length) {
    liste.innerHTML = `<li class="vide">${retours.length ? "Aucun retour ne correspond à ces filtres." : "Aucun retour pour l'instant. Une idée, un bug ? Dites-le avec le bouton ci-dessus."}</li>`;
    return;
  }
  liste.innerHTML = vis.map((r) => {
    const vote = votes.has(r.id);
    return `<li class="retour panel ${termine(r) ? "termine" : ""}" data-id="${esc(r.id)}">
      <div class="meta">
        <span class="tag ${esc(r.type)}">${esc(TYPES[r.type])}</span>
        <span class="tag" style="--c:${couleur(r.app)}"><span class="p"></span>${esc(r.app)}</span>
        <span>${esc(fmtDate(r.created_at))}${r.nom ? ` · ${esc(r.nom)}` : ""}${r.version ? ` · v${esc(r.version)}` : ""}</span>
      </div>
      <p class="texte">${esc(r.texte)}</p>
      ${r.reponse ? `<p class="reponse"><strong>Réponse :</strong> ${esc(r.reponse)}</p>` : ""}
      <div class="droite">
        <span class="statut ${esc(r.statut)}">${esc(STATUTS[r.statut])}</span>
        ${termine(r) ? (r.moi_aussi ? `<span class="aide">${esc(r.moi_aussi)} × moi aussi</span>` : "")
          : `<button type="button" class="moi-aussi" data-moi-aussi="${esc(r.id)}" aria-pressed="${vote}" ${vote ? "disabled" : ""} aria-label="Moi aussi : ${esc(r.moi_aussi)} personne(s)">Moi aussi${r.moi_aussi ? ` · ${esc(r.moi_aussi)}` : ""}</button>`}
        ${admin() ? `<button type="button" class="lien-btn" data-traiter="${esc(r.id)}">Traiter</button>` : ""}
      </div>
    </li>`;
  }).join("");
}

function rendreNouveautes() {
  const liste = $("#listeNouveautes");
  if (!journauxCharges) { liste.innerHTML = `<li class="vide">Chargement…</li>`; return; }
  const tout = fusionnerJournaux(journaux, filtreJournal.app);
  const manque = indisponibles.length ? `Journal indisponible pour : ${indisponibles.join(", ")}.` : "";
  $("#resumeNouveautes").textContent = tout.length ? `Ce qui a changé dans les applis, du plus récent au plus ancien.${manque ? " " + manque : ""}` : manque;
  if (!tout.length) {
    liste.innerHTML = `<li class="vide">${filtreJournal.app === "toutes" ? "Rien de nouveau pour l'instant." : `Rien de nouveau pour ${esc(filtreJournal.app)} pour l'instant.`} Les prochains changements visibles seront annoncés ici.</li>`;
    $("#plusNouveautes").hidden = true; return;
  }
  liste.innerHTML = tout.slice(0, nbAffiches).map((e) => `<li class="nouveaute panel">
    <div class="meta">
      <span class="tag" style="--c:${couleur(e.app)}"><span class="p"></span>${esc(e.app)}</span>
      <strong>v${esc(e.version)}</strong>${e.dateTexte ? `<span>${esc(e.dateTexte)}</span>` : ""}
    </div>
    <p class="phrase">${esc(e.nouveaute.charAt(0).toUpperCase() + e.nouveaute.slice(1))}</p>
  </li>`).join("");
  $("#plusNouveautes").hidden = tout.length <= nbAffiches;
}
$("#fAppNouveautes").addEventListener("change", (e) => { filtreJournal.app = e.target.value; nbAffiches = 30; rendreNouveautes(); });
$("#plusNouveautes").addEventListener("click", () => { nbAffiches += 30; rendreNouveautes(); });

// ---------- Filtres ----------
// Listes d'applis (filtres et formulaire) : refaites quand le drapeau « apercu » change
const optionsApplis = () => visibles().map((a) => `<option value="${a.nom}">${a.nom}</option>`).join("");
function remplirListes() {
  for (const [id, debut, fin] of [["#fAppNouveautes", 1, ""], ["#fApp", 1, `<option value="Accueil">Accueil</option>`], ["#nApp", 0, `<option value="Accueil">Accueil (cette page)</option>`]]) {
    const el = $(id), v = el.value;
    while (el.options.length > debut) el.remove(el.options.length - 1);
    el.insertAdjacentHTML("beforeend", optionsApplis() + fin);
    if ([...el.options].some((o) => o.value === v)) el.value = v;
  }
}
$("#fType").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-v]"); if (!b) return;
  filtres.type = b.dataset.v;
  $("#fType").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  rendreRetours();
});
$("#fApp").addEventListener("change", (e) => { filtres.app = e.target.value; rendreRetours(); });
$("#fStatut").addEventListener("change", (e) => { filtres.statut = e.target.value; rendreRetours(); });
$("#fQ").addEventListener("input", (e) => { filtres.q = e.target.value; rendreRetours(); });

// ---------- Moi aussi / Traiter ----------
$("#liste").addEventListener("click", async (e) => {
  const m = e.target.closest("[data-moi-aussi]");
  if (m) {
    const id = m.dataset.moiAussi;
    m.disabled = true;
    try {
      const r = await rpc("retour_moi_aussi", { p_id: id });
      if (r?.ok) {
        votes.add(id);
        try { localStorage.setItem(VOTES, JSON.stringify([...votes])); } catch { /* stockage bloque */ }
        const x = retours.find((y) => y.id === id); if (x) x.moi_aussi++;
        rendreRetours();
      }
    } catch (err) { m.disabled = false; toast(horsLigne(err) ? "Base injoignable." : "Erreur : " + err.message); }
    return;
  }
  const t = e.target.closest("[data-traiter]");
  if (t) ouvrirTraiter(t.dataset.traiter);
});

// ---------- Nouveau retour ----------
const dN = $("#dNouveau");
remplirListes();

function similaires() {
  const app = $("#nApp").value;
  const ouverts = retours.filter((r) => r.app === app && !termine(r)).sort((a, b) => b.moi_aussi - a.moi_aussi).slice(0, 4);
  const bloc = $("#similaires");
  bloc.hidden = !ouverts.length;
  bloc.innerHTML = ouverts.length ? `<p>Déjà signalé pour ${esc(app)} : si c'est la même chose, cliquez plutôt sur « Moi aussi ».</p><ul>${ouverts.map((r) => `<li>${TYPES[r.type]} · ${esc(r.texte.length > 90 ? r.texte.slice(0, 90) + "…" : r.texte)}</li>`).join("")}</ul>` : "";
}
function contexte() {
  const app = $("#nApp").value;
  const depuis = lien.app === app ? [lien.version && `v${lien.version}`, lien.page && `page ${lien.page}`].filter(Boolean).join(" · ") : "";
  $("#nContexte").textContent = depuis ? `Envoyé avec : ${app} ${depuis}` : "";
}
function ouvrirNouveau({ app, type } = {}) {
  $("#formNouveau").reset();
  $("#nErreur").textContent = "";
  try { $("#nNom").value = localStorage.getItem("accueil-prenom") || ""; } catch { /* stockage bloque */ }
  if (app) $("#nApp").value = app;
  if (type) dN.querySelector(`input[name=type][value=${type}]`).checked = true;
  similaires(); contexte(); compteur();
  dN.showModal();
  $("#nTexte").focus();
}
$("#nApp").addEventListener("change", () => { similaires(); contexte(); });

// Compteur de caracteres sous la description : devient visible pres de la limite
function compteur() {
  const t = $("#nTexte"), n = t.value.length, max = t.maxLength;
  $("#nCompteur").textContent = texteCompteur(n, max);
  $("#nCompteur").classList.toggle("proche", n >= max * 0.9);
}
$("#nTexte").addEventListener("input", () => { compteur(); $("#nErreur").textContent = ""; });
// Description trop courte : message sous le formulaire (au lieu de la seule bulle du navigateur)
$("#nTexte").addEventListener("invalid", (e) => {
  e.preventDefault();
  $("#nErreur").textContent = `Décrivez un peu plus : au moins ${e.target.minLength} caractères.`;
  e.target.focus();
});
$("#nouveauBtn").addEventListener("click", () => ouvrirNouveau({ app: filtres.app !== "toutes" ? filtres.app : undefined }));
$("#formNouveau").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  if (f.get("site")) { dN.close(); return; } // robot : on fait comme si
  const app = String(f.get("app"));
  const corps = {
    app, type: f.get("type"), texte: String(f.get("texte")).trim(), nom: String(f.get("nom")).trim(),
    version: lien.app === app ? lien.version : "", page: lien.app === app ? lien.page : "",
    navigateur: navigator.userAgent.replace(/^Mozilla\/5\.0 /, "").slice(0, 200),
  };
  $("#nEnvoyer").disabled = true;
  try {
    const r = await rpc("retour_envoyer", { p: corps });
    if (!r?.ok) { $("#nErreur").textContent = r?.error || "Envoi refusé."; return; }
    try { localStorage.setItem("accueil-prenom", corps.nom); } catch { /* stockage bloque */ }
    dN.close();
    toast("Merci ! Votre retour est enregistré.");
    filtres.app = app; $("#fApp").value = app;
    await charger();
  } catch (err) {
    $("#nErreur").textContent = horsLigne(err) ? "Base injoignable : vérifiez la connexion, rien n'a été envoyé." : "Erreur : " + err.message;
  } finally { $("#nEnvoyer").disabled = false; }
});

// ---------- Compte Index (connexion partagee avec toutes les applis : meme site, meme cle de stockage) ----------
const CLE_SESSION = "sb-dtxgvwaqjmmffiiohika-auth-token";
function lireSession() { try { const s = JSON.parse(localStorage.getItem(CLE_SESSION)); return s && s.access_token ? s : null; } catch { return null; } }
function ecrireSession(s) { try { if (s) localStorage.setItem(CLE_SESSION, JSON.stringify(s)); else localStorage.removeItem(CLE_SESSION); } catch { /* bloque */ } }
function majCompte() {
  const s = lireSession();
  $("#etatCompte").textContent = s ? (s.user?.email ?? "") : "Lecture seule";
  $("#etatCompte").classList.toggle("on", !!s);
  $("#compteBtn").textContent = s ? "Se déconnecter" : "Se connecter";
  chargerStats();
}
const dC = $("#dConnexion");
$("#compteBtn").addEventListener("click", () => {
  if (lireSession()) { ecrireSession(null); majCompte(); toast("Déconnecté."); return; }
  $("#formConnexion").reset(); $("#cErreur").textContent = ""; dC.showModal();
});
$("#formConnexion").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  try {
    const s = await api("/auth/v1/token?grant_type=password", { methode: "POST", corps: { email: String(f.get("email")).trim(), password: f.get("mdp") } });
    ecrireSession({ ...s, expires_at: s.expires_at ?? Math.floor(Date.now() / 1000) + (s.expires_in ?? 3600) });
    $("#cErreur").textContent = ""; dC.close(); majCompte();
  } catch (err) {
    $("#cErreur").textContent = err.status === 400 ? "Email ou mot de passe incorrect." : horsLigne(err) ? "Base injoignable." : "Erreur : " + err.message;
  }
});
// Connexion ou deconnexion faite dans une autre appli / un autre onglet
window.addEventListener("storage", (e) => { if (e.key === CLE_SESSION) majCompte(); });

// ---------- Traiter les retours (reserve aux administrateurs connectes) ----------
const dT = $("#dTraiter");
let enCours = null;
$("#tStatut").innerHTML = Object.entries(STATUTS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
function ouvrirTraiter(id) {
  enCours = retours.find((r) => r.id === id); if (!enCours) return;
  $("#tTexte").textContent = `${enCours.app} · ${TYPES[enCours.type]} — ${enCours.texte}`;
  $("#tStatut").value = enCours.statut; $("#tReponse").value = enCours.reponse; $("#tErreur").textContent = "";
  dT.showModal();
}
async function actionAdmin(nom, args) {
  const sess = admin() ? await sessionFraiche() : null;
  if (!sess) { $("#tErreur").textContent = "Session expirée : reconnecte-toi (bouton « Se connecter » en haut de page)."; return false; }
  try {
    const r = await rpc(nom, args, sess.access_token);
    if (!r?.ok) { $("#tErreur").textContent = r?.error || "Refusé."; return false; }
    return true;
  } catch (err) { $("#tErreur").textContent = horsLigne(err) ? "Base injoignable." : "Erreur : " + err.message; return false; }
}
$("#formTraiter").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (await actionAdmin("retour_traiter", { p_id: enCours.id, p_statut: $("#tStatut").value, p_reponse: $("#tReponse").value.trim() })) { dT.close(); toast("Retour mis à jour."); charger(); }
});
$("#tSupprimer").addEventListener("click", async () => {
  if (!confirmerSuppression) { confirmerSuppression = true; $("#tSupprimer").textContent = "Confirmer la suppression"; return; }
  if (await actionAdmin("retour_supprimer", { p_id: enCours.id })) { dT.close(); toast("Retour supprimé."); charger(); }
});
let confirmerSuppression = false;
dT.addEventListener("close", () => { confirmerSuppression = false; $("#tSupprimer").textContent = "Supprimer (spam)"; });

// ---------- Divers ----------
document.querySelectorAll("[data-fermer]").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));
$("#aproposBtn").addEventListener("click", () => $("#dApropos").showModal());
$("#themeBtn").addEventListener("click", () => {
  const sombre = document.documentElement.classList.toggle("dark");
  // « outils-theme » : reglage commun a toutes les applis (meme site) ; « accueil-theme » : l'ancienne cle, gardee
  try { localStorage.setItem("accueil-theme", sombre ? "dark" : "light"); localStorage.setItem("outils-theme", sombre ? "dark" : "light"); } catch { /* bloque */ }
});
window.addEventListener("hashchange", () => { rendre(); window.scrollTo(0, 0); if (vue() === "tableau") chargerGestion(); });

majCompte();
rendre();
chargerJournaux();
charger().then(() => {
  // Arrivee depuis le bouton « Suggestion / bug » d'une appli : page Retours filtree, formulaire ouvert
  if (lien.ouvrir) {
    if (location.hash !== "#retours") history.replaceState(null, "", location.search + "#retours");
    if (lien.app) { filtres.app = lien.app; $("#fApp").value = lien.app; }
    rendre();
    ouvrirNouveau({ app: lien.app ?? undefined, type: lien.type ?? undefined });
  }
});


// ---------- Dossier chantier : tout ce qui touche a un chantier (liste des chantiers = celle d'Index) ----------
let chantiers = null; // liste des chantiers d'Index (null = pas encore chargee)
let dossier = null; // { id, notes, fiches, erreur } du chantier affiche
const CLE_CHANTIER = "outils-chantier";
const idChantier = () => decodeURIComponent((location.hash.match(/^#chantiers\/(.+)$/) || [])[1] || "") || (() => { try { return localStorage.getItem(CLE_CHANTIER) || ""; } catch { return ""; } })();
const jourIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const lienApp = (nom) => APPLIS.find((a) => a.nom === nom)?.url ?? "#";

async function chargerChantiers() {
  const s = await sessionFraiche();
  if (!s) return;
  if (!chantiers) {
    try { chantiers = await api("/rest/v1/projects?select=id,numero,nom&order=numero.asc", { jeton: s.access_token }); } catch { chantiers = []; }
    const sel = $("#fChantier");
    sel.innerHTML = `<option value="">Choisir un chantier…</option>` + chantiers.map((c) => `<option value="${esc(c.id)}">${esc(c.numero)} · ${esc(c.nom)}</option>`).join("");
    sel.onchange = () => { try { localStorage.setItem(CLE_CHANTIER, sel.value); } catch { /* bloque */ } location.hash = sel.value ? `#chantiers/${encodeURIComponent(sel.value)}` : "#chantiers"; };
  }
  const id = idChantier();
  $("#fChantier").value = chantiers.some((c) => c.id === id) ? id : "";
  const c = chantiers.find((x) => x.id === id);
  if (!c) { dossier = null; rendreDossier(); return; }
  if (dossier?.id === id && !dossier.erreur) { rendreDossier(); return; }
  dossier = { id, notes: [], fiches: [], chargement: true };
  rendreDossier();
  try {
    const jeton = s.access_token;
    const [liens, projetsCheck] = await Promise.all([
      api(`/rest/v1/product_projects?select=product_id&project_id=eq.${encodeURIComponent(id)}&limit=200`, { jeton }),
      api("/rest/v1/check_projets?select=id,numero,nom&archive=eq.false", { jeton }).catch(() => []),
    ]);
    const ids = projetsCheckDuChantier(c, projetsCheck).map((p) => p.id);
    const prods = liens.map((l) => l.product_id);
    const [notes, fiches] = await Promise.all([
      ids.length ? api(`/rest/v1/check_notes?select=id,texte,statut,flash,echeance,pour&projet_id=in.(${ids.join(",")})&statut=neq.done&archive=eq.false&supprime_le=is.null&limit=200`, { jeton }).catch(() => []) : [],
      prods.length ? api(`/rest/v1/products?select=id,name,supplier,category&id=in.(${prods.join(",")})&deleted_at=is.null&order=supplier.asc,name.asc`, { jeton }) : [],
    ]);
    if (dossier?.id === id) dossier = { id, notes: trierNotes(notes, jourIso()), fiches, projetsCheck: ids.length };
  } catch (e) { if (dossier?.id === id) dossier = { id, notes: [], fiches: [], erreur: horsLigne(e) ? "Base injoignable : réessayez dans un instant." : "Lecture impossible." }; }
  rendreDossier();
}

function rendreDossier() {
  const c = chantiers?.find((x) => x.id === idChantier());
  const zone = $("#dossier");
  if (!c) { $("#resumeChantier").textContent = chantiers ? "Choisissez un chantier pour tout voir au même endroit." : "Chargement…"; zone.innerHTML = ""; return; }
  $("#resumeChantier").textContent = `${c.numero} · ${c.nom}`;
  if (dossier?.chargement) { zone.innerHTML = `<p class="aide">Chargement…</p>`; return; }
  if (dossier?.erreur) { zone.innerHTML = `<p class="erreur">${esc(dossier.erreur)}</p>`; return; }
  const jour = jourIso();
  const r = resumeChantier(dossier.notes, dossier.fiches, jour);
  const pastille = (n, mot, cls = "") => `<span class="pastille ${cls}">${n} ${mot}${n > 1 ? "s" : ""}</span>`;
  const noter = lienApp("Check") + "?noter=" + encodeURIComponent(`#${c.numero} `);
  const notes = dossier.notes.length
    ? dossier.notes.slice(0, 8).map((n) => `<li><span>${esc(n.texte)}</span><span class="aide">${n.echeance && n.echeance < jour ? "en retard · " : ""}${n.flash ? "urgent" : n.echeance ? esc(fmtDate(n.echeance)) : ""}</span></li>`).join("")
    : `<li class="aide">${dossier.projetsCheck ? "Aucune note ouverte." : "Aucun projet Check avec ce numéro de chantier."}</li>`;
  const fiches = dossier.fiches.length
    ? dossier.fiches.slice(0, 10).map((f) => `<li><span>${esc(f.supplier)} · ${esc(f.name)}</span><span class="aide">${esc(f.category)}</span></li>`).join("")
    : `<li class="aide">Aucune fiche liée à ce chantier.</li>`;
  const outils = ["Linear", "Format", "Membrane", "Masse", "Trame"].map((n) => `<a class="btn" href="${esc(lienApp(n))}">${n}</a>`).join("");
  zone.innerHTML = `
    <div class="pastilles">${pastille(r.retard, "note en retard", r.retard ? "rouge" : "")}${pastille(r.urgentes, "urgente", r.urgentes ? "orange" : "")}${pastille(r.notes, "note ouverte")}${pastille(r.fiches, "fiche")}</div>
    <div class="dossier-grille">
      <div class="panel"><h3 class="dossier-titre">Notes Check <span class="aide">${r.notes} ouverte${r.notes > 1 ? "s" : ""}</span></h3><ul class="gestion">${notes}</ul>
        <p class="dossier-actions"><a class="btn" href="${esc(noter)}">+ Noter dans Check</a><a class="btn" href="${esc(lienApp("Check"))}">Ouvrir Check</a></p></div>
      <div class="panel"><h3 class="dossier-titre">Fiches Index <span class="aide">${r.fiches}</span></h3><ul class="gestion">${fiches}</ul>
        <p class="dossier-actions"><a class="btn" href="${esc(lienApp("Index"))}">Ouvrir Index</a></p></div>
      <div class="panel dossier-large"><h3 class="dossier-titre">Calculer pour ce chantier</h3><p class="dossier-actions">${outils}</p></div>
    </div>`;
}
window.addEventListener("hashchange", () => { if (location.hash.startsWith("#chantiers")) rendre(); });
