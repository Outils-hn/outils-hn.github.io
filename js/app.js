// Accueil : affichage des applis et des retours (idees & bugs).
import { creerZip } from "./zip.js?v=1";
import { chercherApplis, chercherChantiers, nettoyerRequete } from "./recherche.js";
import { projetsCheckDuChantier, resumeChantier, trierNotes, APPLIS, NIVEAUX, BASE_KEY, BASE_URL, STATUTS, TYPES, adresseJournal, compter, filtrerRetours, fmtDate, fusionnerJournaux, lireJournal, lireLien, nomAffiche, termine, texteCompteur, adresseConnexion, identifiantEquipe, mdpProvisoire } from "./core.js?v=2.9";

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
let espace = null; // espace Supabase utilise (null = bloc cache)
let stats = null; // totaux reserves au concepteur (null = bloc cache)
let roleCharge = false; // le role du compte connecte a-t-il ete lu ? (evite d'afficher « en attente » trop tot)
let role = null; // « dessinateur », « administrateur », « concepteur » ; null = pas de compte valide (onglet cache)
let comptes = []; // liste des comptes (administrateurs) ; vide sinon
let historique = []; // dernieres modifications des donnees communes
let fiches = []; // fiches d'Index en attente de validation (concepteur) ; null = colonnes absentes (base pas encore a jour)
let histErreur = false;
const filtreHist = { tbl: "", corbeille: false };
const estAdmin = () => role === "administrateur" || role === "concepteur";
/** Seul le concepteur traite les idees et bugs (statut, reponse, suppression) : c'est lui qui modifie le code. */
const admin = () => (role === "concepteur" ? { email: lireSession()?.user?.email ?? "" } : null);
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
  const sess = await sessionFraiche();
  if (!sess) { retours = []; charge = true; rendre(); return; } // les retours sont reserves aux comptes
  try {
    retours = await api("/rest/v1/retours?select=*&order=created_at.desc&limit=500", { jeton: sess.access_token });
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

// ---------- Acces : compte obligatoire ----------
// « invite » = pas de session, « attente » = compte pas encore valide, « chargement » = role en cours de lecture, « ok » = compte valide
function etatAcces() {
  if (!lireSession()) return "invite";
  if (!roleCharge) return "chargement";
  return role ? "ok" : "attente";
}
// Retour vers l'appli demandee apres connexion (garde.js envoie ?retour=/Appli/...) : chemin du meme site seulement
function adresseRetour() {
  const r = new URLSearchParams(location.search).get("retour") || "";
  return /^\/(?!\/)/.test(r) && !/^\/?(\?|#|$)/.test(r) ? r : "";
}

// ---------- Vues ----------
function vue() { if (location.hash.startsWith("#chantiers") && role) return "chantiers"; return (location.hash === "#tableau" || location.hash === "#statistiques") && role ? "tableau" : location.hash === "#retours" ? "retours" : location.hash === "#nouveautes" ? "nouveautes" : "applis"; }

function rendre() {
  const acces = etatAcces();
  const ouvert = acces === "ok";
  $("#nav").hidden = !ouvert;
  $("#rechercheBtn").hidden = !ouvert;
  $("#apercu").hidden = acces !== "invite" && acces !== "attente";
  if (!ouvert) {
    for (const id of ["#applis", "#retours", "#tableau", "#chantiers", "#nouveautes"]) $(id).hidden = true;
    document.title = "Accueil — les outils du bureau d'études";
    rendreApercu(acces);
    return;
  }
  const v = vue();
  $("#applis").hidden = v !== "applis";
  $("#retours").hidden = v !== "retours";
  $("#tableau").hidden = v !== "tableau";
  $("#chantiers").hidden = v !== "chantiers";
  $("#navTableau").hidden = !role;
  $("#navChantiers").hidden = !role;
  const attente = comptes.filter((c) => !c.approved).length;
  const aValider = attente + (role === "concepteur" && fiches ? fiches.length : 0);
  $("#navAttente").textContent = estAdmin() && aValider ? `· ${aValider}` : "";
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
  await Promise.resolve(); // laisse finir l'initialisation du module avant de toucher aux constantes plus bas
  let notes = [];
  try {
    if (s?.user?.id) notes = (await api(`/rest/v1/check_notes?select=id&pour=eq.${encodeURIComponent(s.user.id)}&statut=neq.done&archive=eq.false&supprime_le=is.null&limit=99`, { jeton: s.access_token })) ?? [];
  } catch { notes = []; /* base injoignable ou Check pas active : pas de pastille */ }

  pourMoi = notes.length;
  rendreApplis();
}

async function chargerStats() {
  const s = await sessionFraiche();
  chargerPourMoi(s);
  const avant = !!stats;
  const avantRole = role;
  try { role = s ? (await rpc("mon_role", {}, s.access_token)) || null : null; roleCharge = true; } catch (e) { role = null; roleCharge = !horsLigne(e); }
  // Compte collègue avec un mot de passe provisoire : il choisit le sien avant d'aller plus loin
  let provisoire = false;
  try { provisoire = s ? (await rpc("mon_mdp_provisoire", {}, s.access_token)) === true : false; } catch { provisoire = false; /* base pas encore a jour */ }
  if (provisoire) { ouvrirPremiere(s); rendre(); return; }
  // Arrive ici depuis une appli (garde.js) : une fois le compte valide, on y retourne
  if (role && adresseRetour()) { location.replace(adresseRetour()); return; }
  try { stats = s && role === "concepteur" ? await rpc("stats_accueil", {}, s.access_token) : null; } catch { stats = null; }
  try { espace = stats ? await rpc("espace_utilise", {}, s.access_token) : null; } catch { espace = null; }
  const avantApercu = apercu;
  apercu = !!stats;
  try { if (apercu) localStorage.setItem(CLE_APERCU, "1"); else localStorage.removeItem(CLE_APERCU); } catch { /* bloque */ }
  if (avantApercu !== apercu) { remplirListes(); if (apercu && journauxCharges) chargerJournaux(); }
  if (role) chargerGestion(); else { comptes = []; historique = []; }
  rendre();
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
  // Fiches a valider (concepteur) : nouvelles fiches et nouveaux PDF proposes dans Index
  if (role === "concepteur") {
    try {
      fiches = await api("/rest/v1/products?select=id,name,supplier,category,pdf_path,pdf_filename,pdf_attente_path,pdf_attente_filename,statut,created_by,updated_at&deleted_at=is.null&or=(statut.eq.en_attente,pdf_attente_path.not.is.null)&order=updated_at.desc", { jeton });
    } catch { fiches = null; }
  } else fiches = [];
  histErreur = h.status !== "fulfilled";
  historique = h.status === "fulfilled" ? h.value ?? [] : [];
  rendre();
}

function rendreGestion() {
  $("#blocStats").hidden = !stats;
  $("#blocComptes").hidden = !estAdmin();
  $("#blocDroits").hidden = role !== "concepteur";
  rendreFiches();
  $("#blocSauvegarde").hidden = role !== "concepteur";
  if (role === "concepteur") { const d = lireDerniereSauvegarde(); $("#resumeSauvegarde").textContent = d ? `dernière : ${fmtDate(d)}` : "jamais faite"; }
  if (!role) return;
  const moi = lireSession()?.user?.id;
  const conc = role === "concepteur";
  const att = comptes.filter((c) => !c.approved).length;
  $("#resumeComptes").textContent = att ? `${att} en attente de validation` : "";
  $("#listeComptes").innerHTML = comptes.map((c) => {
    const etiquette = c.role === "concepteur" ? "Concepteur" : c.is_admin ? "Administrateur" : "Dessinateur";
    const mdp = conc && c.id !== moi && c.role !== "concepteur" ? `<button type="button" class="btn" data-mdp="${esc(c.id)}" title="Mot de passe oublié : en donner un provisoire">Mot de passe</button>` : "";
    const boutons = !c.approved ? `${mdp}<button type="button" class="btn primaire" data-valider="${esc(c.id)}">Valider</button>`
      : c.id === moi || c.role === "concepteur" ? ""
      : `${mdp}${conc ? `<button type="button" class="btn" data-admin="${esc(c.id)}">${c.is_admin ? "Retirer admin" : "Nommer admin"}</button>` : ""}<button type="button" class="btn danger" data-retirer="${esc(c.id)}">Retirer l'accès</button>`;
    const ident = identifiantEquipe(c.email);
    return `<li><div class="corps"><div class="l1">${esc(nomCompte(c))}</div>
      <div class="l2">${ident ? "identifiant " + esc(ident) + " · " : c.email ? esc(c.email) + " · " : ""}${c.approved ? etiquette : "En attente"} · créé le ${esc(fmtDate(c.created_at))}</div></div>
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
  $("#hNombre").textContent = historique.length ? `· ${historique.length} ligne${historique.length > 1 ? "s" : ""}` : "";
  $("#blocHist h3 .aide").textContent = filtreHist.corbeille ? "supprimées définitivement après 30 jours" : "90 derniers jours";
}

// Sauvegarde complete des donnees : un fichier JSON date, telecharge par le concepteur (fonction export_complet de supabase/sauvegarde.sql)
const CLE_SAUVEGARDE = "accueil-derniere-sauvegarde";
function lireDerniereSauvegarde() { try { return localStorage.getItem(CLE_SAUVEGARDE) || ""; } catch { return ""; } }
$("#sauvegarder").addEventListener("click", async (e) => {
  const b = e.currentTarget; b.disabled = true; const txt = b.textContent; b.textContent = "Préparation…";
  try {
    const sess = await sessionFraiche();
    const data = await rpc("export_complet", {}, sess?.access_token);
    const jour = new Date().toISOString().slice(0, 10);
    const lien = document.createElement("a");
    lien.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: "application/json" }));
    lien.download = `sauvegarde-outils-${jour}.json`;
    document.body.append(lien); lien.click(); lien.remove();
    setTimeout(() => URL.revokeObjectURL(lien.href), 10000);
    try { localStorage.setItem(CLE_SAUVEGARDE, new Date().toISOString()); } catch { /* sans stockage : pas de date affichee */ }
    $("#resumeSauvegarde").textContent = `dernière : ${fmtDate(new Date().toISOString())}`;
    toast(`Sauvegarde téléchargée (${Object.keys(data.tables ?? {}).length} tables).`);
  } catch (err) {
    toast(/export_complet|function/i.test(err.message) ? "Script « sauvegarde.sql » à lancer dans Supabase." : horsLigne(err) ? "Base injoignable." : err.message);
  } finally { b.disabled = false; b.textContent = txt; }
});

// Sauvegarde des fichiers : la liste vient de la fonction liste_fichiers (supabase/sauvegarde-fichiers.sql), puis chaque fichier est telecharge
// avec la session (tous les dossiers sont prives depuis le passage au compte obligatoire) et le zip assemble dans le navigateur.
// Repli sur l'adresse publique tant que le dossier des PDF n'est pas encore prive.
const adresseFichier = (seau, chemin, mode = "authenticated") => `${BASE_URL}/storage/v1/object/${mode}/${seau}/${chemin.split("/").map(encodeURIComponent).join("/")}`;
$("#sauvegarderFichiers").addEventListener("click", async (e) => {
  const b = e.currentTarget; b.disabled = true; const txt = b.textContent; b.textContent = "Liste des fichiers…";
  try {
    const jeton = (await sessionFraiche())?.access_token;
    let liste;
    try { liste = await rpc("liste_fichiers", {}, jeton); }
    catch (err) { throw new Error(/liste_fichiers|function/i.test(err.message) ? "Script « sauvegarde-fichiers.sql » à lancer dans Supabase." : err.message); }
    if (!liste?.length) { toast("Aucun fichier trouvé dans le stockage."); return; }
    const fichiers = [], rates = [];
    for (let i = 0; i < liste.length; i++) {
      const { seau, chemin } = liste[i];
      b.textContent = `Fichiers : ${i + 1} / ${liste.length}`;
      try {
        const entetes = { headers: { apikey: BASE_KEY, Authorization: `Bearer ${jeton}` } };
        let r = await fetch(adresseFichier(seau, chemin), entetes);
        if (!r.ok && seau === "technical-sheets") r = await fetch(adresseFichier(seau, chemin, "public"), entetes);
        if (!r.ok) throw new Error(String(r.status));
        fichiers.push({ nom: `${seau}/${chemin}`, octets: new Uint8Array(await r.arrayBuffer()) });
      } catch { rates.push(`${seau}/${chemin}`); }
    }
    if (rates.length) fichiers.push({ nom: "fichiers-non-recuperes.txt", octets: new TextEncoder().encode(rates.join("\n")) });
    const lien = document.createElement("a");
    lien.href = URL.createObjectURL(new Blob(creerZip(fichiers), { type: "application/zip" }));
    lien.download = `sauvegarde-fichiers-${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.append(lien); lien.click(); lien.remove();
    setTimeout(() => URL.revokeObjectURL(lien.href), 30000);
    toast(rates.length ? `Zip téléchargé : ${fichiers.length - 1} fichiers, ${rates.length} non récupérés (liste dans le zip).` : `Zip téléchargé : ${fichiers.length} fichiers.`);
  } catch (err) {
    toast(horsLigne(err) ? "Base injoignable." : err.message);
  } finally { b.disabled = false; b.textContent = txt; }
});

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
// ---------- Fiches a valider (concepteur) ----------
function rendreFiches() {
  const bloc = $("#blocFiches");
  bloc.hidden = role !== "concepteur" || fiches === null;
  if (bloc.hidden) return;
  const auteur = (id) => { const c = comptes.find((x) => x.id === id); return c ? nomCompte(c) : "un membre de l'équipe"; };
  $("#listeFiches").innerHTML = fiches.map((f) => {
    const nouvelle = f.statut === "en_attente";
    const pdf = nouvelle ? f.pdf_path : f.pdf_attente_path;
    const nomPdf = nouvelle ? f.pdf_filename : f.pdf_attente_filename;
    return `<li><div class="corps"><div class="l1"><span class="badge-h">${nouvelle ? "Nouvelle fiche" : "Nouveau PDF"}</span> <b>${esc(f.name)}</b></div>
      <div class="l2">${esc(f.supplier)} · ${esc(f.category)} · proposée par ${esc(auteur(f.created_by))} · ${esc(quand(f.updated_at))}${nomPdf ? ` · ${esc(nomPdf)}` : ""}</div></div>
      <div class="boutons">${pdf ? `<button type="button" class="btn" data-voir="${esc(pdf)}">Voir le PDF</button>` : ""}<button type="button" class="btn primaire" data-ok-fiche="${esc(f.id)}">Valider</button><button type="button" class="btn danger" data-non-fiche="${esc(f.id)}">Refuser</button></div></li>`;
  }).join("") || `<li class="vide">Rien à valider.</li>`;
}
// Le fichier ecarte (ancien PDF remplace, ou PDF refuse) est retire du stockage
async function retirerFichier(chemin, jeton) {
  if (!chemin) return;
  try { await api("/storage/v1/object/technical-sheets", { methode: "DELETE", corps: { prefixes: [chemin] }, jeton }); } catch { /* deja absent */ }
}
$("#listeFiches").addEventListener("click", async (e) => {
  const b = e.target.closest("button"); if (!b) return;
  const sess = await sessionFraiche(); const jeton = sess?.access_token;
  if (b.dataset.voir) {
    // Lien temporaire (le dossier des fiches est prive) ; onglet ouvert tout de suite pour ne pas etre bloque
    const onglet = window.open("about:blank", "_blank");
    try {
      const r = await api(`/storage/v1/object/sign/technical-sheets/${b.dataset.voir.split("/").map(encodeURIComponent).join("/")}`, { methode: "POST", corps: { expiresIn: 600 }, jeton });
      const url = `${BASE_URL}/storage/v1${r.signedURL ?? r.signedUrl}`;
      if (onglet) onglet.location.href = url; else window.open(url, "_blank", "noopener");
    } catch (err) { onglet?.close(); toast(horsLigne(err) ? "Base injoignable." : "PDF introuvable."); }
    return;
  }
  const id = b.dataset.okFiche || b.dataset.nonFiche; if (!id) return;
  const f = fiches.find((x) => x.id === id); if (!f) return;
  if (b.dataset.nonFiche && !(await confirmer(`Refuser « ${f.name} » ?`, f.statut === "en_attente" ? "La fiche et son PDF sont supprimés." : "Le nouveau PDF est supprimé ; la fiche garde son PDF actuel.", "Refuser"))) return;
  try {
    const r = await rpc(b.dataset.okFiche ? "fiche_valider" : "fiche_refuser", { _id: id }, jeton);
    await retirerFichier(r?.fichier, jeton);
    toast(b.dataset.okFiche ? `« ${f.name} » validée.` : `« ${f.name} » refusée.`);
    await chargerGestion();
  } catch (err) { toast(horsLigne(err) ? "Base injoignable." : err.message); }
});

// Historique replie par defaut (longue liste) ; le choix est retenu
const CLE_HIST = "accueil-historique-ouvert";
function majReplier() {
  let ouvert = false; try { ouvert = localStorage.getItem(CLE_HIST) === "1"; } catch { /* bloque */ }
  $("#blocHist").classList.toggle("replie", !ouvert);
  $("#hReplier").setAttribute("aria-expanded", String(ouvert));
}
$("#hReplier").addEventListener("click", () => {
  const ouvert = $("#hReplier").getAttribute("aria-expanded") !== "true";
  try { localStorage.setItem(CLE_HIST, ouvert ? "1" : "0"); } catch { /* bloque */ }
  majReplier();
});
majReplier();
// « Qui fait quoi » (concepteur) : replie par defaut, choix retenu
const CLE_DROITS = "accueil-droits-ouvert";
function majDroits() {
  let ouvert = false; try { ouvert = localStorage.getItem(CLE_DROITS) === "1"; } catch { /* bloque */ }
  $("#blocDroits").classList.toggle("replie", !ouvert);
  $("#dReplier").setAttribute("aria-expanded", String(ouvert));
}
$("#dReplier").addEventListener("click", () => {
  const ouvert = $("#dReplier").getAttribute("aria-expanded") !== "true";
  try { localStorage.setItem(CLE_DROITS, ouvert ? "1" : "0"); } catch { /* bloque */ }
  majDroits();
});
majDroits();

$("#listeComptes").addEventListener("click", async (e) => {
  const b = e.target.closest("button"); if (!b) return;
  const id = b.dataset.valider || b.dataset.admin || b.dataset.retirer || b.dataset.mdp;
  const c = comptes.find((x) => x.id === id); if (!c) return;
  if (b.dataset.mdp) return ouvrirMdp(c);
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
// Espace utilise sur l'offre gratuite de Supabase (500 Mo de base, 1 Go de fichiers)
const LIMITE_BASE = 500 * 1024 * 1024, LIMITE_STOCKAGE = 1024 * 1024 * 1024;
const mo = (o) => o >= 1024 * 1024 * 1024 ? `${(o / 1024 ** 3).toLocaleString("fr-CH", { maximumFractionDigits: 2 })} Go` : `${(o / 1024 ** 2).toLocaleString("fr-CH", { maximumFractionDigits: o < 10 * 1024 ** 2 ? 1 : 0 })} Mo`;
function rendreEspace(n) {
  if (!espace) return "";
  const ligne = (lib, v, lim) => { const p = Math.min(100, v / lim * 100); return `<div class="barre"><div class="l"><span>${lib}</span><span>${mo(v)} sur ${mo(lim)} · ${n(Math.round(p * 10) / 10)} %</span></div><div class="f"><i style="width:${Math.max(1, Math.round(p))}%${p >= 80 ? ";background:#c0392b" : ""}"></i></div></div>`; };
  return `<div class="bloc espace"><h3>Espace utilisé <span class="aide">offre gratuite de Supabase</span></h3>${ligne("Base de données", Number(espace.base), LIMITE_BASE)}${ligne("Fichiers", Number(espace.stockage), LIMITE_STOCKAGE)}<p class="det">Dont calculs partagés : ${mo(Number(espace.calculs))}. À surveiller seulement au-delà de 80 %.</p></div>`;
}
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
    ${rendreEspace(n)}
    <p class="stats-note">Pas de suivi de connexions ni d'usage pour l'instant : seulement ce qui est déjà enregistré.</p>`;
}

/** Pictogrammes des applis (traits blancs, grille 24). */
const PICTOS = {
  Check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  Index: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 16h5"/>',
  Access: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  Trame: '<g fill="#fff" stroke="none"><circle cx="6" cy="6" r="1.7"/><circle cx="12" cy="6" r="1.7"/><circle cx="18" cy="6" r="1.7"/><circle cx="6" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="18" cy="12" r="1.7"/><circle cx="6" cy="18" r="1.7"/><circle cx="12" cy="18" r="1.7"/><circle cx="18" cy="18" r="1.7"/></g>',
  Linear: '<rect x="3" y="9" width="18" height="6" rx="1"/><path d="M9 9v6M15 9v6"/>',
  Format: '<rect x="3.5" y="3.5" width="17" height="17" rx="1.5"/><path d="M3.5 11h17M12 11v9.5"/>',
  Joint: '<rect x="3" y="8" width="6.5" height="8" rx="1"/><rect x="14.5" y="8" width="6.5" height="8" rx="1"/>',
  Masse: '<path d="M6.5 9h11l2 11h-15z"/><circle cx="12" cy="5.8" r="2.3"/>',
  Membrane: '<path d="M3 8c3-3 6 3 9 0s6 3 9 0M3 15c3-3 6 3 9 0s6 3 9 0"/>',
  Strate: '<path d="M4 6h16M4 12h16M4 18h16"/>',
};

// Page d'apercu (sans compte ou en attente de validation)
const logoAppli = (a, cls) => `<span class="logo ${cls}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${PICTOS[a.nom] ?? ""}</svg></span>`;
function rendreApercu(acces) {
  if (acces !== "invite" && acces !== "attente") return;
  const s = lireSession();
  const attente = acces === "attente";
  $("#apercu").classList.toggle("attente", attente);
  $("#apLead").textContent = attente
    ? `Votre compte${s ? ` (${identifiantEquipe(s.user?.email) ?? s.user?.email ?? ""})` : ""} attend la validation d'un administrateur. Dès qu'il est validé, rechargez la page : toutes les applis s'ouvriront.`
    : "Fiches techniques, notes d'équipe, débits et calculs du quotidien, réunis au même endroit. L'accès se fait avec un compte de l'équipe.";
  $("#apActions").innerHTML = attente
    ? `<button type="button" class="btn primaire" data-ap="recharger">Recharger</button><button type="button" class="btn" data-ap="deconnexion">Se déconnecter</button>`
    : `<button type="button" class="btn primaire" data-ap="connexion">Se connecter</button><a class="btn" href="https://outils-hn.github.io/Index/auth">Créer un compte</a>`;
  $("#apEtapes").hidden = attente;
  // Par frequence d'usage, comme la page des applis : 3 + 3 + 4 cartes, chaque ligne remplie (grille de 12 colonnes)
  const carteAp = (a) => `<article class="ap-carte" style="--c:${a.couleur}">
    ${logoAppli(a, "petite")}
    <div class="ap-corps"><h3>${esc(a.nom)} <span class="ap-role">${esc(a.role)}</span></h3><p>${esc(a.texte)}</p>
    ${a.points?.length ? `<ul>${a.points.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}</div></article>`;
  $("#apGrille").innerHTML = NIVEAUX.map((n) => {
    const liste = n.noms.map((nom) => APPLIS.find((a) => a.nom === nom)).filter((a) => a && !a.apercu);
    return liste.length ? `<h3 class="niveau">${esc(n.titre)}</h3><div class="ap-rang n${liste.length}">${liste.map(carteAp).join("")}</div>` : "";
  }).join("");
}
$("#apercu").addEventListener("click", (e) => {
  const b = e.target.closest("[data-ap]"); if (!b) return;
  if (b.dataset.ap === "connexion") $("#compteBtn").click();
  else if (b.dataset.ap === "recharger") location.reload();
  else if (b.dataset.ap === "deconnexion") { ecrireSession(null); majCompte(); toast("Déconnecté."); }
});

function rendreApplis() {
  const vis = visibles();
  const trouver = (nom) => vis.find((a) => a.nom === nom);
  const signaux = (a) => {
    const ouverts = retours.filter((r) => r.app === a.nom && !termine(r)).length;
    return `${journaux[a.nom] ? `<span class="version" title="Version actuelle de ${esc(a.nom)}">v${esc(journaux[a.nom][0].version)}</span>` : ""}${ouverts ? `<span class="signal" title="Idées et bugs en cours pour ${esc(a.nom)}">${ouverts} en cours</span>` : ""}${a.nom === "Check" && pourMoi ? `<span class="signal moi" title="Notes qui vous sont confiées, à traiter dans Check">${pourMoi} pour moi</span>` : ""}`;
  };
  // Logo : pictogramme blanc sur une pastille de la couleur de l'appli
  const logo = (a, cls) => `<span class="logo ${cls}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${PICTOS[a.nom] ?? ""}</svg></span>`;
  // Les trois applis du quotidien : une grande carte (la premiere) et deux petites a cote
  const carte = (a, cls, rang) => {
    const moi = a.nom === "Check" && pourMoi ? `<span class="signal moi" title="Notes qui vous sont confiées, à traiter dans Check">${pourMoi} pour moi</span>` : "";
    const ver = journaux[a.nom] ? `<span class="version" title="Version actuelle de ${esc(a.nom)}">v${esc(journaux[a.nom][0].version)}</span>` : "";
    const ouverts = retours.filter((r) => r.app === a.nom && !termine(r)).length;
    const enCours = ouverts ? `<span class="signal" title="Idées et bugs en cours pour ${esc(a.nom)}">${ouverts} en cours</span>` : "";
    // Grande carte : les chiffres qui comptent, en grand (notes confiees, idees ou bugs en cours, version)
    const fait = (n, t, cls = "") => `<span class="fait ${cls}"><b${cls === "ver" ? ' class="version" title="Version actuelle de Check"' : ""}>${n}</b> <small>${t}</small></span>`;
    const faits = `<span class="faits">${pourMoi ? fait(pourMoi, "pour moi") : ""}${ouverts ? fait(ouverts, "en cours") : ""}${journaux[a.nom] ? fait("v" + esc(journaux[a.nom][0].version), "version", "ver") : ""}</span>`;
    // Style « plan » : numero d'usage (01 = le plus utilise) et ligne de cotation portant le role de l'appli
    return `<a class="carte ${cls}" href="${a.url}" style="--c:${a.couleur}">${logo(a, cls)}<span class="corps"><span class="rang" title="Classement d'usage">0${rang}</span><span class="tete"><span class="nom">${esc(a.nom)}</span>${cls === "grande" ? "" : ver + enCours + moi}</span><p class="texte">${esc(a.texte)}</p>${cls === "grande" ? faits : ""}<span class="cote"><i></i><b>${esc(a.role)}</b></span></span></a>`;
  };
  // Les autres : une simple ligne (logo, nom, version)
  const ligne = (a) => `<a class="carte lien" href="${a.url}" style="--c:${a.couleur}">${logo(a, "mini")}<span class="nom">${esc(a.nom)}</span>${signaux(a)}</a>`;
  const [jour, parfois, rare] = NIVEAUX.map((n) => n.noms.map(trouver).filter(Boolean));
  const groupe = (titre, liste) => liste.length ? `<h3 class="niveau">${titre}</h3><div class="lignes">${liste.map(ligne).join("")}</div>` : "";
  $("#grille").innerHTML = (jour.length ? `<div class="quotidien">${carte(jour[0], "grande", 1)}<div class="pile">${jour.slice(1).map((a, i) => carte(a, "petite", i + 2)).join("")}</div></div>` : "")
    + groupe(NIVEAUX[1].titre, parfois) + groupe(NIVEAUX[2].titre, rare);
  calerSurGrille();
}

// Cale les logos des lignes sur le quadrillage de 24 px du fond : on ajoute au titre de groupe juste l'espace qui manque.
const PAS = 24;
function calerSurGrille() {
  const zone = document.querySelector("#applis"); if (!zone) return;
  const origine = zone.getBoundingClientRect().top + zone.clientTop;
  for (const bloc of zone.querySelectorAll(".lignes")) {
    const titre = bloc.previousElementSibling, logo = bloc.querySelector(".logo");
    if (!titre || !logo) continue;
    titre.style.marginTop = "";
    const reste = (logo.getBoundingClientRect().top - origine) % PAS;
    const manque = (PAS - Math.round(reste)) % PAS;
    if (manque) titre.style.marginTop = `${parseFloat(getComputedStyle(titre).marginTop) + manque}px`;
  }
}
let minuterieCalage;
window.addEventListener("resize", () => { clearTimeout(minuterieCalage); minuterieCalage = setTimeout(calerSurGrille, 120); });
document.fonts?.ready.then(calerSurGrille);

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
      const r = await rpc("retour_moi_aussi", { p_id: id }, (await sessionFraiche())?.access_token);
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
    const r = await rpc("retour_envoyer", { p: corps }, (await sessionFraiche())?.access_token);
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
  $("#etatCompte").textContent = s ? (nomAffiche(s.user) || identifiantEquipe(s.user?.email) || (s.user?.email ?? "")) : "";
  $("#etatCompte").hidden = !s;
  $("#etatCompte").title = s ? (s.user?.email ?? "") : "";
  $("#etatCompte").classList.toggle("on", !!s);
  $("#compteBtn").textContent = s ? "Se déconnecter" : "Se connecter";
  roleCharge = false;
  rendre();
  chargerStats();
  if (s) charger();
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
    const s = await api("/auth/v1/token?grant_type=password", { methode: "POST", corps: { email: adresseConnexion(f.get("email")), password: f.get("mdp") } });
    ecrireSession({ ...s, expires_at: s.expires_at ?? Math.floor(Date.now() / 1000) + (s.expires_in ?? 3600) });
    $("#cErreur").textContent = ""; dC.close(); majCompte();
  } catch (err) {
    $("#cErreur").textContent = err.status === 400 ? "Identifiant ou mot de passe incorrect." : horsLigne(err) ? "Base injoignable." : "Erreur : " + err.message;
  }
});
// ---------- Premiere connexion d'un compte collegue : il choisit son mot de passe (et son nom) ----------
const dP = $("#dPremiere");
dP.addEventListener("cancel", (e) => e.preventDefault()); // Echap ne contourne pas l'etape
function ouvrirPremiere(s) {
  if (dP.open) return;
  const f = $("#formPremiere"); f.reset(); $("#pErreur").textContent = "";
  const m = s?.user?.user_metadata ?? {};
  f.prenom.value = m.first_name ?? ""; f.nom.value = m.last_name ?? "";
  if (dC.open) dC.close();
  dP.showModal();
}
$("#pDeconnexion").addEventListener("click", () => { dP.close(); ecrireSession(null); majCompte(); toast("Déconnecté."); });
$("#formPremiere").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target, err = $("#pErreur");
  const mdp = f.mdp.value, prenom = f.prenom.value.trim(), nom = f.nom.value.trim();
  if (mdp !== f.mdp2.value) { err.textContent = "Les deux mots de passe ne sont pas identiques."; return; }
  if (mdp.length < 8) { err.textContent = "8 caractères minimum."; return; }
  $("#pValider").disabled = true; err.textContent = "";
  try {
    const s = await sessionFraiche();
    const donnees = prenom || nom ? { first_name: prenom, last_name: nom, display_name: [prenom, nom].filter(Boolean).join(" ") } : undefined;
    const u = await api("/auth/v1/user", { methode: "PUT", corps: { password: mdp, ...(donnees ? { data: donnees } : {}) }, jeton: s.access_token });
    await rpc("premiere_connexion_faite", { _prenom: prenom, _nom: nom }, s.access_token);
    if (u?.id) ecrireSession({ ...lireSession(), user: u });
    dP.close(); toast("C'est fait ! Votre mot de passe est enregistré."); majCompte();
  } catch (x) {
    err.textContent = /same_password|different from the old/i.test(`${x.data?.error_code ?? ""} ${x.message}`) ? "Choisissez un mot de passe différent du provisoire."
      : /weak|short|characters/i.test(x.message) ? "Mot de passe trop simple : allongez-le ou ajoutez des chiffres."
      : horsLigne(x) ? "Base injoignable : réessayez dans un instant." : "Erreur : " + x.message;
  } finally { $("#pValider").disabled = false; }
});

// ---------- Mot de passe oublie : le concepteur remet un mot de passe provisoire ----------
const dM = $("#dMdp");
let compteMdp = null;
function ouvrirMdp(c) {
  compteMdp = c;
  const f = $("#formMdp"); f.reset(); $("#mErreur").textContent = "";
  const ident = identifiantEquipe(c.email);
  $("#mQui").textContent = `Pour ${nomCompte(c)}${ident ? ` (identifiant : ${ident})` : ""}.`;
  f.mdp.value = mdpProvisoire();
  dM.showModal(); f.mdp.select();
}
$("#formMdp").addEventListener("submit", async (e) => {
  e.preventDefault();
  const mdp = e.target.mdp.value.trim(), c = compteMdp; if (!c) return;
  if (mdp.length < 6) { $("#mErreur").textContent = "6 caractères minimum."; return; }
  try {
    await rpc("reinitialiser_mdp", { _id: c.id, _mdp: mdp }, (await sessionFraiche())?.access_token);
    dM.close(); toast(`Mot de passe provisoire de ${nomCompte(c)} : ${mdp}`);
  } catch (x) {
    $("#mErreur").textContent = /reinitialiser_mdp|PGRST202|does not exist/i.test(x.message) ? "La base n'est pas encore prête : lancez supabase/comptes-equipe.sql dans Supabase." : horsLigne(x) ? "Base injoignable." : x.message;
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
    const [notes, fiches, calculs] = await Promise.all([
      ids.length ? api(`/rest/v1/check_notes?select=id,texte,statut,flash,echeance,pour&projet_id=in.(${ids.join(",")})&statut=neq.done&archive=eq.false&supprime_le=is.null&limit=200`, { jeton }).catch(() => []) : [],
      prods.length ? api(`/rest/v1/products?select=id,name,supplier,category&id=in.(${prods.join(",")})&deleted_at=is.null&order=supplier.asc,name.asc`, { jeton }) : [],
      // Calculs partages (table facultative : absente tant que le script SQL n'est pas lance)
      api(`/rest/v1/calculs?select=id,app,nom,auteur_email,updated_at&chantier_numero=eq.${encodeURIComponent(c.numero)}&supprime_le=is.null&order=updated_at.desc&limit=30`, { jeton }).catch(() => []),
    ]);
    if (dossier?.id === id) dossier = { id, notes: trierNotes(notes, jourIso()), fiches, calculs, projetsCheck: ids.length };
  } catch (e) { if (dossier?.id === id) dossier = { id, notes: [], fiches: [], erreur: horsLigne(e) ? "Base injoignable : réessayez dans un instant." : "Lecture impossible." }; }
  rendreDossier();
}

function rendreDossier() {
  const c = chantiers?.find((x) => x.id === idChantier());
  const zone = $("#dossier");
  if (!c) { $("#resumeChantier").textContent = chantiers ? "Choisissez un chantier pour tout voir au même endroit." : "Chargement…"; zone.innerHTML = ""; return; }
  $("#resumeChantier").textContent = `${c.numero} · ${c.nom}`;
  try { localStorage.setItem("outils-chantier-info", JSON.stringify({ numero: c.numero, nom: c.nom })); } catch { /* stockage bloque */ }
  if (dossier?.chargement) { zone.innerHTML = `<p class="aide">Chargement…</p>`; return; }
  if (dossier?.erreur) { zone.innerHTML = `<p class="erreur">${esc(dossier.erreur)}</p>`; return; }
  const jour = jourIso();
  const r = resumeChantier(dossier.notes, dossier.fiches, jour);
  const pastille = (n, un, plur, cls = "") => `<span class="pastille ${cls}">${n} ${n > 1 ? plur : un}</span>`;
  const noter = lienApp("Check") + "?noter=" + encodeURIComponent(`#${c.numero} `);
  const notes = dossier.notes.length
    ? dossier.notes.slice(0, 8).map((n) => `<li><a class="lien-ligne" href="${esc(lienApp("Check"))}?note=${encodeURIComponent(n.id)}">${esc(n.texte)}</a><span class="aide">${n.echeance && n.echeance < jour ? "en retard · " : ""}${n.flash ? "urgent" : n.echeance ? esc(fmtDate(n.echeance)) : ""}</span></li>`).join("")
    : `<li class="aide">${dossier.projetsCheck ? "Aucune note ouverte." : "Pas de notes visibles : vous n’êtes pas membre du projet dans Check."}</li>`;
  const fiches = dossier.fiches.length
    ? dossier.fiches.slice(0, 10).map((f) => `<li><a class="lien-ligne" href="${esc(lienApp("Index"))}?fiche=${encodeURIComponent(f.id)}">${esc(f.supplier)} · ${esc(f.name)}</a><span class="aide">${esc(f.category)}</span></li>`).join("")
    : `<li class="aide">Aucune fiche liée à ce chantier.</li>`;
  const calculs = (dossier.calculs ?? []).length
    ? dossier.calculs.map((x) => { const a = x.app === "linear" ? "Linear" : x.app === "format" ? "Format" : "Trame"; return `<li><a class="lien-ligne" href="${esc(lienApp(a))}?calcul=${encodeURIComponent(x.id)}">${esc(x.nom || "Sans nom")}</a><span class="aide">${a} · ${esc(String(x.auteur_email).split("@")[0])} · ${esc(fmtDate(String(x.updated_at).slice(0, 10)))}</span></li>`; }).join("")
    : `<li class="aide">Aucun calcul partagé : dans l’appli, « Mes projets » puis l’icône Partager.</li>`;
  const outils = ["Linear", "Format", "Membrane", "Masse", "Trame"].map((n) => `<a class="btn" href="${esc(lienApp(n))}">${n}</a>`).join("");
  zone.innerHTML = `
    <div class="pastilles">${pastille(r.retard, "note en retard", "notes en retard", r.retard ? "rouge" : "")}${pastille(r.urgentes, "urgente", "urgentes", r.urgentes ? "orange" : "")}${pastille(r.notes, "note ouverte", "notes ouvertes")}${pastille(r.fiches, "fiche", "fiches")}</div>
    <div class="dossier-grille">
      <div class="panel"><h3 class="dossier-titre">Notes Check <span class="aide">${r.notes} ouverte${r.notes > 1 ? "s" : ""}</span></h3><ul class="gestion">${notes}</ul>
        <p class="dossier-actions"><a class="btn" href="${esc(noter)}">+ Noter dans Check</a><a class="btn" href="${esc(lienApp("Check"))}">Ouvrir Check</a></p></div>
      <div class="panel"><h3 class="dossier-titre">Fiches Index <span class="aide">${r.fiches}</span></h3><ul class="gestion">${fiches}</ul>
        <p class="dossier-actions"><a class="btn" href="${esc(lienApp("Index"))}">Ouvrir Index</a></p></div>
      <div class="panel dossier-large"><h3 class="dossier-titre">Calculs partagés <span class="aide">${(dossier.calculs ?? []).length}</span></h3><ul class="gestion">${calculs}</ul></div>
      <div class="panel dossier-large"><h3 class="dossier-titre">Calculer pour ce chantier</h3><p class="dossier-actions">${outils}</p></div>
    </div>`;
}
window.addEventListener("hashchange", () => { if (location.hash.startsWith("#chantiers")) rendre(); });


// ---------- Recherche Ctrl+K : applis, chantiers, fiches Index, notes Check ----------
const dR = $("#dRecherche"), rQ = $("#rQ"), rListe = $("#rListe");
let rResultats = []; // [{ groupe, titre, detail, href }]
let rActif = 0;
let rNo = 0; // pour ignorer les reponses d'une frappe depassee
let chantiersRecherche = null;

function rendreResultats() {
  const q = rQ.value.trim();
  $("#rAide").textContent = !q ? "Tapez pour chercher · ↑ ↓ pour choisir · Entrée pour ouvrir · Échap pour fermer" : rResultats.length ? `${rResultats.length} résultat${rResultats.length > 1 ? "s" : ""}` : "Aucun résultat.";
  let groupe = "";
  rListe.innerHTML = rResultats.map((r, i) => {
    const entete = r.groupe !== groupe ? `<li class="r-groupe" role="presentation">${esc(r.groupe)}</li>` : "";
    groupe = r.groupe;
    return `${entete}<li role="option" id="r${i}" data-i="${i}" aria-selected="${i === rActif}" class="r-ligne"><span>${esc(r.titre)}</span><span class="aide">${esc(r.detail ?? "")}</span></li>`;
  }).join("");
  rQ.setAttribute("aria-activedescendant", rResultats.length ? `r${rActif}` : "");
  rListe.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
}

async function lancerRecherche() {
  const q = nettoyerRequete(rQ.value);
  const no = ++rNo;
  if (!q) { rResultats = []; rActif = 0; rendreResultats(); return; }
  const locaux = chercherApplis(q, visibles()).map((a) => ({ groupe: "Applis", titre: a.nom, detail: a.role, href: a.url }));
  rResultats = locaux; rActif = 0; rendreResultats();
  const s = await sessionFraiche();
  if (!s || no !== rNo) return;
  const jeton = s.access_token, motif = encodeURIComponent(`*${q}*`);
  try {
    if (!chantiersRecherche) chantiersRecherche = await api("/rest/v1/projects?select=id,numero,nom&order=numero.asc", { jeton }).catch(() => []);
    const [fiches, notes] = await Promise.all([
      api(`/rest/v1/products?select=id,name,supplier&deleted_at=is.null&or=(name.ilike.${motif},supplier.ilike.${motif})&order=name.asc&limit=6`, { jeton }).catch(() => []),
      api(`/rest/v1/check_notes?select=id,texte&texte=ilike.${motif}&supprime_le=is.null&archive=eq.false&order=created_at.desc&limit=6`, { jeton }).catch(() => []),
    ]);
    if (no !== rNo) return;
    rResultats = [
      ...locaux,
      ...chercherChantiers(q, chantiersRecherche).slice(0, 6).map((c) => ({ groupe: "Chantiers", titre: `${c.numero} · ${c.nom}`, detail: "Dossier chantier", href: `#chantiers/${encodeURIComponent(c.id)}` })),
      ...fiches.map((f) => ({ groupe: "Fiches Index", titre: f.name, detail: f.supplier, href: `${lienApp("Index")}?fiche=${encodeURIComponent(f.id)}` })),
      ...notes.map((n) => ({ groupe: "Notes Check", titre: n.texte.length > 80 ? n.texte.slice(0, 80) + "…" : n.texte, detail: "", href: `${lienApp("Check")}?note=${encodeURIComponent(n.id)}` })),
    ];
    rendreResultats();
  } catch { /* base injoignable : on garde les applis */ }
}

function ouvrirRecherche() {
  if (!dR.open) dR.showModal();
  rQ.value = ""; rResultats = []; rActif = 0; rendreResultats(); rQ.focus();
}
function ouvrirResultat(i) {
  const r = rResultats[i];
  if (!r) return;
  dR.close();
  if (r.href.startsWith("#")) location.hash = r.href; else location.href = r.href;
}
let rMinuterie;
rQ.addEventListener("input", () => { clearTimeout(rMinuterie); rMinuterie = setTimeout(lancerRecherche, 180); });
rQ.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    if (rResultats.length) { rActif = (rActif + (e.key === "ArrowDown" ? 1 : -1) + rResultats.length) % rResultats.length; rendreResultats(); }
  } else if (e.key === "Enter") { e.preventDefault(); ouvrirResultat(rActif); }
});
rListe.addEventListener("click", (e) => { const li = e.target.closest("[data-i]"); if (li) ouvrirResultat(+li.dataset.i); });
dR.addEventListener("click", (e) => { if (e.target === dR) dR.close(); });
$("#rechercheBtn").addEventListener("click", ouvrirRecherche);
document.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k" && etatAcces() === "ok") { e.preventDefault(); ouvrirRecherche(); } });
// Arrivee depuis une autre appli (Ctrl+K) : « #recherche » ouvre la barre, puis on revient a l'adresse normale
if (location.hash === "#recherche") { history.replaceState(null, "", location.pathname + location.search); if (etatAcces() !== "invite") ouvrirRecherche(); }
