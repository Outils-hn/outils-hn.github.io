// Accueil : affichage des applis et des retours (idees & bugs).
import { APPLIS, BASE_KEY, BASE_URL, STATUTS, TYPES, compter, filtrerRetours, fmtDate, lireLien, termine } from "./core.js?v=1.1";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const couleur = (app) => APPLIS.find((a) => a.nom === app)?.couleur ?? "#5D6068";

// ---------- Acces a la base (projet Index) ----------
const ADMIN = "accueil-admin";
const VOTES = "accueil-moi-aussi";
let admin = null; // { token, email } quand un administrateur d'Index est connecte
try { const a = JSON.parse(sessionStorage.getItem(ADMIN) || "null"); if (a && a.expire > Date.now()) admin = a; } catch { /* stockage bloque */ }

async function api(chemin, { methode = "GET", corps, jeton } = {}) {
  const r = await fetch(BASE_URL + chemin, {
    method: methode,
    headers: { apikey: BASE_KEY, Authorization: `Bearer ${jeton || BASE_KEY}`, "Content-Type": "application/json" },
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
let retours = [];
let charge = false;
let erreurChargement = null;
const filtres = { type: "tous", app: "toutes", statut: "ouverts", q: "" };
const lien = lireLien(location.search);
let votes = new Set();
try { votes = new Set(JSON.parse(localStorage.getItem(VOTES) || "[]")); } catch { /* stockage bloque */ }

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
function vue() { return location.hash === "#retours" ? "retours" : "applis"; }

function rendre() {
  const v = vue();
  $("#applis").hidden = v !== "applis";
  $("#retours").hidden = v !== "retours";
  document.querySelectorAll("[data-nav]").forEach((a) => (a.dataset.nav === v ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  const c = compter(retours);
  $("#navCompte").textContent = charge && c.ouverts ? `· ${c.ouverts}` : "";
  document.title = v === "retours" ? "Idées & bugs — Accueil" : "Accueil — les outils du bureau d'études";
  rendreApplis();
  rendreRetours();
}

function rendreApplis() {
  $("#grille").innerHTML = APPLIS.map((a) => {
    const ouverts = retours.filter((r) => r.app === a.nom && !termine(r)).length;
    return `<li><a class="carte" href="${a.url}" style="--c:${a.couleur}">
      <span class="tete"><span class="pastille"></span><span class="nom">${esc(a.nom)}</span>${ouverts ? `<span class="signal" title="Idées et bugs en cours pour ${esc(a.nom)}">${ouverts} en cours</span>` : ""}</span>
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
  $("#resume").textContent = `${c.ouverts} en cours ou à venir (${c.bugs} bug${c.bugs > 1 ? "s" : ""}, ${c.idees} idée${c.idees > 1 ? "s" : ""}) · ${c.faits} fait${c.faits > 1 ? "s" : ""}${admin ? ` · connecté : ${admin.email}` : ""}`;
  const vis = filtrerRetours(retours, filtres);
  if (!vis.length) {
    liste.innerHTML = `<li class="vide">${retours.length ? "Aucun retour ne correspond à ces filtres." : "Aucun retour pour l'instant. Une idée, un bug ? Dites-le avec le bouton ci-dessus."}</li>`;
    return;
  }
  liste.innerHTML = vis.map((r) => {
    const vote = votes.has(r.id);
    return `<li class="retour panel ${termine(r) ? "termine" : ""}" data-id="${r.id}">
      <div class="meta">
        <span class="tag ${r.type}">${TYPES[r.type]}</span>
        <span class="tag" style="--c:${couleur(r.app)}"><span class="p"></span>${esc(r.app)}</span>
        <span>${fmtDate(r.created_at)}${r.nom ? ` · ${esc(r.nom)}` : ""}${r.version ? ` · v${esc(r.version)}` : ""}</span>
      </div>
      <p class="texte">${esc(r.texte)}</p>
      ${r.reponse ? `<p class="reponse"><strong>Réponse :</strong> ${esc(r.reponse)}</p>` : ""}
      <div class="droite">
        <span class="statut ${r.statut}">${STATUTS[r.statut]}</span>
        ${termine(r) ? (r.moi_aussi ? `<span class="aide">${r.moi_aussi} × moi aussi</span>` : "")
          : `<button type="button" class="moi-aussi" data-moi-aussi="${r.id}" aria-pressed="${vote}" ${vote ? "disabled" : ""} aria-label="Moi aussi : ${r.moi_aussi} personne(s)">Moi aussi${r.moi_aussi ? ` · ${r.moi_aussi}` : ""}</button>`}
        ${admin ? `<button type="button" class="lien-btn" data-traiter="${r.id}">Traiter</button>` : ""}
      </div>
    </li>`;
  }).join("");
}

// ---------- Filtres ----------
$("#fApp").insertAdjacentHTML("beforeend", APPLIS.map((a) => `<option value="${a.nom}">${a.nom}</option>`).join("") + `<option value="Accueil">Accueil</option>`);
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
$("#nApp").innerHTML = APPLIS.map((a) => `<option value="${a.nom}">${a.nom}</option>`).join("") + `<option value="Accueil">Accueil (cette page)</option>`;

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
  similaires(); contexte();
  dN.showModal();
  $("#nTexte").focus();
}
$("#nApp").addEventListener("change", () => { similaires(); contexte(); });
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

// ---------- Administration ----------
const dA = $("#dAdmin");
$("#adminBtn").addEventListener("click", () => {
  if (admin) { admin = null; try { sessionStorage.removeItem(ADMIN); } catch { /* bloque */ } majAdmin(); rendre(); toast("Déconnecté."); return; }
  $("#formAdmin").reset(); $("#aErreur").textContent = ""; dA.showModal();
});
function majAdmin() { $("#adminBtn").textContent = admin ? "Se déconnecter de l'administration" : "Administration"; }
$("#formAdmin").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  try {
    const s = await api("/auth/v1/token?grant_type=password", { methode: "POST", corps: { email: f.get("email"), password: f.get("mdp") } });
    const estAdmin = await rpc("is_admin", {}, s.access_token);
    if (!estAdmin) { $("#aErreur").textContent = "Ce compte n'est pas administrateur d'Index."; return; }
    admin = { token: s.access_token, email: s.user?.email ?? f.get("email"), expire: Date.now() + (s.expires_in ?? 3600) * 1000 - 60000 };
    try { sessionStorage.setItem(ADMIN, JSON.stringify(admin)); } catch { /* bloque */ }
    dA.close(); majAdmin();
    location.hash = "#retours"; rendre();
    toast("Administration ouverte : « Traiter » sur chaque retour.");
  } catch (err) {
    $("#aErreur").textContent = err.status === 400 ? "Email ou mot de passe incorrect." : horsLigne(err) ? "Base injoignable." : "Erreur : " + err.message;
  }
});

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
  if (!admin || admin.expire < Date.now()) { $("#tErreur").textContent = "Session expirée : reconnectez-vous (Administration, en bas de page)."; admin = null; majAdmin(); return false; }
  try {
    const r = await rpc(nom, args, admin.token);
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
  try { localStorage.setItem("accueil-theme", sombre ? "dark" : "light"); } catch { /* bloque */ }
});
window.addEventListener("hashchange", () => { rendre(); window.scrollTo(0, 0); });

majAdmin();
rendre();
charger().then(() => {
  // Arrivee depuis le bouton « Suggestion / bug » d'une appli : page Retours filtree, formulaire ouvert
  if (lien.ouvrir) {
    if (location.hash !== "#retours") history.replaceState(null, "", location.search + "#retours");
    if (lien.app) { filtres.app = lien.app; $("#fApp").value = lien.app; }
    rendre();
    ouvrirNouveau({ app: lien.app ?? undefined, type: lien.type ?? undefined });
  }
});
