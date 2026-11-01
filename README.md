# Accueil

Point d'entrée des outils du bureau d'études façade (Access, Check, Format, Index, Linear, Masse, Strate, Trame)
et page « Idées & bugs » où l'équipe signale ses idées et les bugs.

- Site statique (HTML, CSS, JavaScript sans dépendance) publié par GitHub Pages.
- Les retours sont rangés dans le projet Supabase d'**Index** : lancer une fois `supabase/retours.sql` dans le SQL Editor.
- Les statuts et réponses se gèrent avec un compte **administrateur d'Index** (« Administration » en bas de page).
- Les versions affichées sur les cartes et la page « Nouveautés » viennent du `CHANGELOG.md` de chaque appli (dépôts publics, branche `main`, format `## 2.4 — 31 octobre 2026`). La page Nouveautés n'affiche que la puce `- Nouveauté : …` de chaque version, écrite en langage courant.
- Tests : `npm test` · check-up dans un navigateur : `e2e/checkup.mjs` (base simulée).
