// Accueil : donnees et logique sans affichage (testees par « node --test »).

export const BASE_URL = "https://ngfzwfbraqkdcocdcmib.supabase.co";
// Cle publique (« anon ») du projet Index : lecture des retours et envoi par les fonctions controlees.
export const BASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nZnp3ZmJyYXFrZGNvY2RjbWliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2Mzg2NTcsImV4cCI6MjA5NTIxNDY1N30.Ikovcm4eWkLvPO_PvkI8C8DJebBT011Rz87k_EYFdbU";

/** Les applis de la famille, dans l'ordre alphabetique (meme liste que les selecteurs). */
export const APPLIS = [
  { nom: "Access", role: "Annuaire fournisseurs", url: "https://access-hn.lovable.app", couleur: "#C2255C",
    texte: "Sites et sites CAO des fournisseurs par domaine, avec les accès du bureau et les vôtres." },
  { nom: "Check", role: "Notes & tâches", url: "https://check-hn.lovable.app", couleur: "#4338CA",
    texte: "Notes perso et notes d'équipe par projet, échéances, « Pour moi » et rapport PDF." },
  { nom: "Format", role: "Débit de panneaux", url: "https://format-hn.lovable.app", couleur: "#FF4D00",
    texte: "Calepinage des panneaux dans les formats fournisseurs pour estimer la matière à commander." },
  { nom: "Index", role: "Fiches techniques", url: "https://index-hn.lovable.app", couleur: "#6D4AFF",
    texte: "Bibliothèque des fiches techniques fournisseurs, par catégorie et par chantier." },
  { nom: "Linear", role: "Mise en barre", url: "https://linear-hn.lovable.app", couleur: "#2B50FF",
    texte: "Débit des profilés en barres avec le minimum de chutes, liste de coupe en PDF." },
  { nom: "Masse", role: "Poids des éléments", url: "https://masse-hn.lovable.app", couleur: "#9A4A3A",
    texte: "Poids des éléments de façade à partir de leurs composants, fiches et listes de livraison." },
  { nom: "Strate", role: "Épaisseurs d'isolation", url: "https://hnaegellen-hub.github.io/Strate/", couleur: "#D4A20B",
    texte: "Combinaisons de panneaux isolants pour atteindre l'épaisseur dessinée, et commande." },
  { nom: "Trame", role: "Répartition de perçages", url: "https://trame-hn.lovable.app", couleur: "#0E9F6E",
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
