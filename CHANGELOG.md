# Journal des versions — Accueil

Chaque version qui change quelque chose de visible pour l'équipe a une puce « Nouveauté : … », écrite en langage courant : c'est la seule phrase affichée sur la page « Nouveautés » de l'Accueil. Les versions sans cette puce (travail technique) n'y apparaissent pas.

## 2.2 — 7 novembre 2026

- Correction : le texte de l'écran de connexion est raccourci pour tenir sur une ligne.

## 2.1 — 7 novembre 2026

- Nouveauté : Joint (espace à laisser entre deux éléments) et Membrane (colle et rouleaux d'étanchéité) rejoignent la liste des applis, visibles pour toute l'équipe.
- Les cartes sont réorganisées sur 5 colonnes (2 rangées de 5), 2 colonnes sur les écrans moyens.

## 2.0 — 6 novembre 2026

- Joint (espace à laisser entre deux éléments) est ajouté à la liste des applis, mais reste en préparation : sa carte, son nom dans les menus et ses nouveautés ne s'affichent que pour le concepteur. Aucune Nouveauté à annoncer à l'équipe pour l'instant.

## 1.9 — 5 novembre 2026

- Nouveauté : l'onglet « Statistiques » s'affiche aussi quand la connexion date de plus d'une heure : l'Accueil renouvelle tout seul la connexion, comme les autres applis.

## 1.8 — 5 novembre 2026

- Nouveauté : un onglet « Statistiques » apparaît pour le concepteur seulement : nombre de comptes (par rôle, en attente), de fiches Index à vérifier, de fournisseurs, de notes, et ce qui a été ajouté sur 30 jours dans chaque appli. Ce sont de simples totaux, aucun contenu n'est montré.
- Un script SQL est à lancer une fois dans Supabase (`supabase/stats-accueil.sql`) : sans lui, l'onglet reste caché.

## 1.7 — 4 novembre 2026

- Nouveauté : textes raccourcis sur les cartes Access et Format de l'Accueil, pour que toutes les cartes aient la même hauteur.

## 1.6 — 4 novembre 2026

- Nouveauté : le bandeau affiche seulement l'adresse email quand on est connecté (sans « Connecté · »), comme dans toutes les autres applis.

## 1.5 — 4 novembre 2026

- Nouveauté : « Se connecter » est maintenant en haut de la page d'accueil, comme dans Index ; se connecter dans une appli connecte toutes les autres.

## 1.4.1 — 1er novembre 2026

- Page « Nouveautés » : la phrase de chaque version commence par une majuscule (correction d'affichage, aucune Nouveauté à annoncer).

## 1.4 — 1er novembre 2026

- Nouveauté : le mode clair ou sombre que tu choisis dans une appli est repris dans toutes les autres.
- La page « Nouveautés » n'affiche plus que cette phrase pour chaque version, au lieu du détail technique ; les versions sans changement visible n'y figurent plus.
- Le réglage du thème est partagé avec les autres applis (clé `outils-theme`, ancienne clé `accueil-theme` conservée).

## 1.3 — 1er novembre 2026

- Nouvelle page « Nouveautés » : les versions de toutes les applis au même endroit, de la plus récente à la plus ancienne, avec un filtre par appli. Elle lit le `CHANGELOG.md` de chaque appli.
- Cartes des applis : la version actuelle s'affiche en petit à côté du nom.
- Formulaire de retour : compteur de caractères sous la description (limite de 2 000), et message « au moins 5 caractères » sous le formulaire quand la description est trop courte.

## 1.2 — 31 octobre 2026

- Cartes des applis : toutes pointent vers GitHub Pages (`https://outils-hn.github.io/<Appli>/`) à la place des adresses Lovable.

## 1.1 — 31 octobre 2026

- Le site est publié à la racine de GitHub Pages : `https://outils-hn.github.io/` (dépôt renommé `outils-hn.github.io` après le renommage du compte en `outils-hn`).
- Adresses mises à jour dans la liste des applis : Strate (`https://outils-hn.github.io/Strate/`) et Trame (`https://outils-hn.github.io/Trame/`, désormais publiée sur GitHub Pages).

- Numéro de version dans les adresses de `styles.css`, `app.js` et `core.js` : le navigateur recharge les fichiers à chaque nouvelle version (à mettre à jour avec le numéro de version).

## 1.0

- Première version : page d'entrée des applis et page « Idées & bugs ».
