// Accueil : donnees et logique sans affichage (testees par « node --test »).

export const BASE_URL = "https://dtxgvwaqjmmffiiohika.supabase.co";
// Cle publique (« anon ») du projet Index : lecture des retours et envoi par les fonctions controlees.
export const BASE_KEY =
  "sb_publishable_yEWGxFFSLTE1lJRXnFUmpg_dMwa6LxW";

/** Les applis de la famille, dans l'ordre alphabetique (meme liste que les selecteurs).
 *  apercu: true = appli en preparation, visible seulement pour le concepteur (voir « apercu » dans app.js). */
export const APPLIS = [
  { nom: "Access", role: "Annuaire fournisseurs", url: "https://outils-hn.github.io/Access/", couleur: "#C2255C",
    texte: "Sites des fournisseurs, par domaine.", points: ["Liens vers les sites et portails CAO des fournisseurs", "Classés par domaine", "Identifiants du bureau ou perso à portée de clic"] },
  { nom: "Check", role: "Notes & tâches", url: "https://outils-hn.github.io/Check/", couleur: "#4338CA",
    texte: "Notes et tâches, perso ou d'équipe.", points: ["Notes perso et notes de projet partagées", "Tâches confiées à un collègue, avec échéance", "Photos jointes, corbeille de 30 jours"] },
  { nom: "Format", role: "Débit de panneaux", url: "https://outils-hn.github.io/Format/", couleur: "#FF4D00",
    texte: "Calepinage de panneaux pour estimer la matière.", points: ["Calepinage sur les formats des fournisseurs", "Estimation de la matière à commander", "Bibliothèque de matériaux commune"] },
  { nom: "Index", role: "Fiches techniques", url: "https://outils-hn.github.io/Index/", couleur: "#6D4AFF",
    texte: "Fiches techniques fournisseurs.", points: ["Fiches techniques PDF par fournisseur et famille", "Recherche instantanée et comparaison", "Fiches reliées aux chantiers"] },
  { nom: "Joint", role: "Dilatation et joints", url: "https://outils-hn.github.io/Joint/", couleur: "#0B7285",
    texte: "Espace à laisser entre deux éléments selon la dilatation.", points: ["Espace à laisser selon la dilatation", "Par matériau et écart de température"] },
  { nom: "Linear", role: "Mise en barre", url: "https://outils-hn.github.io/Linear/", couleur: "#2B50FF",
    texte: "Débit de profilés en barres, avec le minimum de chutes.", points: ["Mise en barre avec le minimum de chutes", "Longueurs du commerce et stock de barres", "Liste de débit prête à imprimer"] },
  { nom: "Masse", role: "Poids des éléments", url: "https://outils-hn.github.io/Masse/", couleur: "#9A4A3A",
    texte: "Poids des éléments de façade à partir de leurs composants.", points: ["Poids d'un élément à partir de ses composants", "Bibliothèque de matériaux commune", "Listes de livraison avec poids total"] },
  { nom: "Membrane", role: "Étanchéité", url: "https://outils-hn.github.io/Membrane/", couleur: "#B45309",
    texte: "Membranes d'étanchéité en tronçons, avec bon de commande.", points: ["Membranes découpées en tronçons", "Quantités de colle", "Bon de commande"] },
  { nom: "Strate", role: "Épaisseurs d'isolation", url: "https://outils-hn.github.io/Strate/", couleur: "#D4A20B",
    texte: "Combinaisons de panneaux isolants pour l'épaisseur voulue.", points: ["Combinaisons de panneaux isolants", "Pour atteindre l'épaisseur dessinée", "Catalogue commun"] },
  { nom: "Trame", role: "Répartition de perçages", url: "https://outils-hn.github.io/Trame/", couleur: "#0E9F6E",
    texte: "Répartition des perçages : intervalles, entraxe fixe ou maximal.", points: ["Nombre d'intervalles, entraxe fixe ou maximal", "Cotes prêtes à reporter sur le plan"] },
];

/** Accueil : les applis classees par frequence d'usage (decision d'Hugo). */
export const NIVEAUX = [
  { cle: "jour", titre: "Au quotidien", noms: ["Check", "Index", "Access"] },
  { cle: "parfois", titre: "Occasionnels", noms: ["Trame", "Linear", "Format"] },
  { cle: "rare", titre: "Autres outils", noms: ["Joint", "Masse", "Membrane", "Strate"] },
];

export const TYPES = { idee: "Idée", bug: "Bug" };
export const STATUTS = { nouveau: "Nouveau", prevu: "Prévu", en_cours: "En cours", fait: "Fait", refuse: "Pas retenu" };
const ORDRE_STATUT = { en_cours: 0, prevu: 1, nouveau: 2, fait: 3, refuse: 4 };
export const termine = (r) => r.statut === "fait" || r.statut === "refuse";

export const sansAccents = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Filtre et trie les retours. f = { type: "tous"|"idee"|"bug", app: "toutes"|nom, statut: "ouverts"|"tous"|cle, q }.
 * Ouverts d'abord (en cours, prevu, nouveau), puis les plus demandes (« moi aussi »), puis les plus recents.
 */
export function filtrerRetours(liste, f) {
  const mots = sansAccents(f.q).split(/\s+/).filter(Boolean);
  return liste
    .filter((r) => (f.type === "tous" || r.type === f.type)
      && (f.app === "toutes" || r.app === f.app)
      && (f.statut === "tous" ? true : f.statut === "ouverts" ? !termine(r) : r.statut === f.statut)
      && mots.every((m) => sansAccents(`${r.texte} ${r.app} ${r.nom} ${r.reponse}`).includes(m)))
    .sort((a, b) => ORDRE_STATUT[a.statut] - ORDRE_STATUT[b.statut] || b.moi_aussi - a.moi_aussi || b.created_at.localeCompare(a.created_at));
}

/** Compteurs pour l'en-tete de la page Retours. */
export function compter(liste) {
  const ouverts = liste.filter((r) => !termine(r));
  return { ouverts: ouverts.length, bugs: ouverts.filter((r) => r.type === "bug").length, idees: ouverts.filter((r) => r.type === "idee").length, faits: liste.filter((r) => r.statut === "fait").length };
}

export function fmtDate(iso, maintenant = new Date()) {
  const d = new Date(iso);
  const jours = Math.floor((maintenant - d) / 86400000);
  if (jours < 1 && d.getDate() === maintenant.getDate()) return "aujourd'hui";
  if (jours < 2) return "hier";
  if (jours < 7) return `il y a ${jours} jours`;
  return d.toLocaleDateString("fr-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Lien depuis une appli (« Suggestion / bug » dans son pied de page) :
 * ?app=Masse&v=2.0&page=/materiaux ouvre la page Retours filtree sur l'appli, formulaire pre-rempli.
 */
export function lireLien(search) {
  const p = new URLSearchParams(search);
  const app = APPLIS.some((a) => a.nom === p.get("app")) ? p.get("app") : null;
  const type = p.get("type") === "bug" || p.get("type") === "idee" ? p.get("type") : null;
  const version = (p.get("v") ?? "").slice(0, 20);
  const page = (p.get("page") ?? "").slice(0, 300);
  return { app, type, version, page, ouvrir: p.has("nouveau") || !!app };
}

// ---------- Nouveautes : lecture des CHANGELOG des applis ----------
const MOIS = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];

/** Adresse du CHANGELOG d'une appli : le depot porte le nom de l'appli en minuscules, sur la branche main. */
export const adresseJournal = (nom) => `https://raw.githubusercontent.com/Outils-hn/${nom.toLowerCase()}/main/CHANGELOG.md`;

/** « 31 octobre 2026 » -> « 2026-10-31 » (null si le texte n'est pas une date). */
export function lireDate(texte) {
  const m = sansAccents(texte).match(/(\d{1,2})(?:er)?\s+([a-z]+)\s+(\d{4})/);
  const mois = m ? MOIS.indexOf(m[2]) : -1;
  if (mois < 0) return null;
  return `${m[3]}-${String(mois + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

/**
 * Lit un CHANGELOG au format « ## 2.4 — 31 octobre 2026 » suivi de puces.
 * Renvoie les versions dans l'ordre du fichier (la plus recente d'abord) :
 * { version, date, dateTexte, notes[], nouveaute } ; « nouveaute » = la phrase de la puce « Nouveauté : … »
 * (ecrite en langage courant, c'est la seule chose que la page Nouveautes affiche), ou "" s'il n'y en a pas.
 */
export function lireJournal(md) {
  const entrees = []; let cur = null;
  for (const l of String(md ?? "").split(/\r?\n/)) {
    const h = l.match(/^##\s+v?(\d+(?:\.\d+)*)\s*(?:[—–-]\s*(.+?))?\s*$/);
    if (h) { cur = { version: h[1], date: lireDate(h[2]), dateTexte: h[2] ?? "", notes: [], nouveaute: "" }; entrees.push(cur); continue; }
    if (!cur) continue;
    if (/^\s*[-*]\s+/.test(l)) {
      const note = l.replace(/^\s*[-*]\s+/, "").trim();
      const n = note.match(/^nouveaut[eé]\s*:\s*(.+)$/i);
      if (n) cur.nouveaute = n[1].trim(); else cur.notes.push(note);
    } else if (cur.notes.length && /^\s{2,}\S/.test(l)) cur.notes[cur.notes.length - 1] += " " + l.trim(); // suite d'une puce
  }
  return entrees;
}

/**
 * Toutes les versions de toutes les applis en une liste : les plus recentes d'abord
 * (les versions sans date a la fin) ; a date egale, la derniere version de chaque appli passe avant les precedentes. journaux = { nom d'appli: entrees[] }.
 */
export function fusionnerJournaux(journaux, app = "toutes") {
  const tout = [];
  for (const [nom, entrees] of Object.entries(journaux)) {
    if (app !== "toutes" && nom !== app) continue;
    // Seules les versions avec une phrase « Nouveauté : … » concernent les utilisateurs
    entrees.forEach((e, i) => { if (e.nouveaute) tout.push({ app: nom, rang: i, ...e }); });
  }
  return tout.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || a.rang - b.rang || a.app.localeCompare(b.app));
}

/** Texte du compteur sous la description : milliers a la suisse (2'000), identique dans tous les navigateurs. */
const milliers = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
export const texteCompteur = (n, max) => `${milliers(n)} / ${milliers(max)}`;

// ---------- Dossier chantier ----------
const norm = (s) => String(s ?? "").trim().toLowerCase();

/** Projets de Check qui correspondent a un chantier d'Index : meme numero, ou a defaut meme nom. */
export function projetsCheckDuChantier(chantier, projetsCheck) {
  if (!chantier) return [];
  const num = norm(chantier.numero), nom = norm(chantier.nom);
  const parNumero = projetsCheck.filter((p) => num && norm(p.numero) === num);
  if (parNumero.length) return parNumero;
  return projetsCheck.filter((p) => nom && norm(p.nom) === nom);
}

/** Notes ouvertes d'un chantier : en retard d'abord, puis urgentes, puis par echeance. `jour` = AAAA-MM-JJ. */
export function trierNotes(notes, jour) {
  const retard = (n) => (n.echeance && n.echeance < jour ? 1 : 0);
  return [...notes].sort((a, b) => retard(b) - retard(a) || (b.flash ? 1 : 0) - (a.flash ? 1 : 0) || String(a.echeance ?? "9").localeCompare(String(b.echeance ?? "9")));
}

/** Compteurs de l'en-tete du dossier. */
export function resumeChantier(notes, fiches, jour) {
  return { retard: notes.filter((n) => n.echeance && n.echeance < jour).length, urgentes: notes.filter((n) => n.flash).length, notes: notes.length, fiches: fiches.length };
}

/** « Prénom NOM » d'apres les infos du compte (prenom et nom saisis a la creation), sinon vide : on affiche alors l'email. */
export function nomAffiche(u) {
  const m = (u && u.user_metadata) || {};
  const txt = (v) => (typeof v === "string" ? v.trim() : "");
  const maj = (s) => s.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_x, a, b) => a + b.toUpperCase());
  let prenom = txt(m.first_name), nom = txt(m.last_name);
  if (!prenom || !nom) {
    const mots = txt(m.display_name).split(/\s+/).filter(Boolean);
    if (mots.length >= 2) { prenom = mots.slice(0, -1).join(" "); nom = mots[mots.length - 1]; }
  }
  return prenom && nom ? `${maj(prenom)} ${nom.toLocaleUpperCase("fr")}` : "";
}
