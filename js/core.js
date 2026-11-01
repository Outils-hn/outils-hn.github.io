// Accueil : donnees et logique sans affichage (testees par « node --test »).

export const BASE_URL = "https://ngfzwfbraqkdcocdcmib.supabase.co";
// Cle publique (« anon ») du projet Index : lecture des retours et envoi par les fonctions controlees.
export const BASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nZnp3ZmJyYXFrZGNvY2RjbWliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2Mzg2NTcsImV4cCI6MjA5NTIxNDY1N30.Ikovcm4eWkLvPO_PvkI8C8DJebBT011Rz87k_EYFdbU";

/** Les applis de la famille, dans l'ordre alphabetique (meme liste que les selecteurs). */
export const APPLIS = [
  { nom: "Access", role: "Annuaire fournisseurs", url: "https://outils-hn.github.io/Access/", couleur: "#C2255C",
    texte: "Sites et sites CAO des fournisseurs par domaine, avec les accès du bureau et les vôtres." },
  { nom: "Check", role: "Notes & tâches", url: "https://outils-hn.github.io/Check/", couleur: "#4338CA",
    texte: "Notes perso et notes d'équipe par projet, échéances, « Pour moi » et rapport PDF." },
  { nom: "Format", role: "Débit de panneaux", url: "https://outils-hn.github.io/Format/", couleur: "#FF4D00",
    texte: "Calepinage des panneaux dans les formats fournisseurs pour estimer la matière à commander." },
  { nom: "Index", role: "Fiches techniques", url: "https://outils-hn.github.io/Index/", couleur: "#6D4AFF",
    texte: "Bibliothèque des fiches techniques fournisseurs, par catégorie et par chantier." },
  { nom: "Linear", role: "Mise en barre", url: "https://outils-hn.github.io/Linear/", couleur: "#2B50FF",
    texte: "Débit des profilés en barres avec le minimum de chutes, liste de coupe en PDF." },
  { nom: "Masse", role: "Poids des éléments", url: "https://outils-hn.github.io/Masse/", couleur: "#9A4A3A",
    texte: "Poids des éléments de façade à partir de leurs composants, fiches et listes de livraison." },
  { nom: "Strate", role: "Épaisseurs d'isolation", url: "https://outils-hn.github.io/Strate/", couleur: "#D4A20B",
    texte: "Combinaisons de panneaux isolants pour atteindre l'épaisseur dessinée, et commande." },
  { nom: "Trame", role: "Répartition de perçages", url: "https://outils-hn.github.io/Trame/", couleur: "#0E9F6E",
    texte: "Entraxes et répartition des perçages : nombre d'intervalles, entraxe fixe ou maximal." },
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
