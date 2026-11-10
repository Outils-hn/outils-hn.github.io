// Barre de recherche Ctrl+K : outils purs (testes), l'affichage est dans app.js.

/** Texte de recherche sans les caracteres qui casseraient un filtre de la base (virgule, parentheses, etoile, pourcent, guillemets). */
export function nettoyerRequete(q) {
  return String(q ?? "").replace(/[,()*%"'\\:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

const sansAccent = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Applis dont le nom, le role ou la description contient tous les mots tapes (sans tenir compte des accents). */
export function chercherApplis(q, applis) {
  const mots = sansAccent(nettoyerRequete(q)).split(" ").filter(Boolean);
  if (!mots.length) return [];
  return applis.filter((a) => { const t = sansAccent(`${a.nom} ${a.role} ${a.texte}`); return mots.every((m) => t.includes(m)); });
}

/** Chantiers dont le numero ou le nom contient tous les mots tapes. */
export function chercherChantiers(q, chantiers) {
  const mots = sansAccent(nettoyerRequete(q)).split(" ").filter(Boolean);
  if (!mots.length) return [];
  return chantiers.filter((c) => { const t = sansAccent(`${c.numero} ${c.nom}`); return mots.every((m) => t.includes(m)); });
}
