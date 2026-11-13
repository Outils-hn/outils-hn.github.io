# Journal des versions — Accueil

Chaque version qui change quelque chose de visible pour l'équipe a une puce « Nouveauté : … », écrite en langage courant : c'est la seule phrase affichée sur la page « Nouveautés » de l'Accueil. Les versions sans cette puce (travail technique) n'y apparaissent pas.

## 2.38 — 13 novembre 2026

- Nouveauté : exemple d'identifiant « j.dupont », et 6 caractères minimum pour le mot de passe choisi à la première connexion.

## 2.37 — 13 novembre 2026

- Nouveauté : la fenêtre de connexion explique qu'il suffit de demander à Hugo pour avoir un identifiant, ou un mot de passe provisoire en cas d'oubli (même avec une adresse inventée).

## 2.36 — 13 novembre 2026

- Nouveauté : on peut se connecter avec un simple identifiant (ex. « jean.dupont ») ; à la première connexion avec un mot de passe provisoire, on choisit le sien. Mot de passe oublié : Hugo en donne un nouveau provisoire depuis le tableau de bord.
- Script `supabase/comptes-equipe.sql` (drapeau « mot de passe provisoire », fonctions de première connexion et de réinitialisation) ; `garde.js` renvoie vers l'Accueil tant que le mot de passe provisoire n'est pas changé.

## 2.35 — 11 novembre 2026

- Nouveauté : sur la page d'aperçu, la 3e étape devient simplement « Toutes les applis s'ouvrent ».

## 2.34 — 11 novembre 2026

- Nouveauté : les titres de groupe (Occasionnels, Autres outils…) n'ont plus de trait pointillé.

## 2.33 — 11 novembre 2026

- Nouveauté : le Tableau de bord du concepteur contient « Qui fait quoi », un tableau repliable des droits de chaque rôle.

## 2.32 — 11 novembre 2026

- Nouveauté : seul le concepteur traite les idées et bugs (statut, réponse, suppression), puisque c'est lui qui modifie les applis.

## 2.31 — 11 novembre 2026

- Nouveauté : dans le Tableau de bord, le concepteur valide ou refuse les nouvelles fiches et les nouveaux PDF proposés dans Index (avec « Voir le PDF »), signalés par la pastille du menu.
- Nouveauté : l'historique du Tableau de bord se replie avec une flèche (replié par défaut, le choix est retenu).

## 2.30 — 11 novembre 2026

- La sauvegarde des fichiers récupère les PDF d'Index avec le compte connecté (le dossier des fiches devient privé).

## 2.29 — 11 novembre 2026

- Nouveauté : les applis sont désormais réservées aux comptes de l'équipe. Sans compte, l'Accueil présente ce que fait chaque appli, avec la connexion et l'inscription.
- Nouveauté : un compte qui attend la validation d'un administrateur le voit clairement à l'Accueil.
- Nouveauté : après la connexion, on revient directement dans l'appli qu'on voulait ouvrir.
- Nouveauté : la page des applis est plus large sur grand écran.

## 2.28 — 11 novembre 2026

- Nouveauté : « Télécharger les fichiers » récupère bien les PDF d'Index (le zip arrivait vide).

## 2.27 — 11 novembre 2026

- Nouveauté : la sauvegarde récupère aussi les fichiers (PDF d'Index, images de Check) dans un zip, avec un second bouton dans le Tableau de bord.

## 2.26 — 10 novembre 2026

- Nouveauté : un bouton « Sauvegarde » dans le Tableau de bord (concepteur) télécharge d'un clic toutes les données des applis dans un fichier daté.
- Nouveauté : les logos des lignes « Occasionnels » et « Autres outils » sont alignés en colonnes, calés sur le quadrillage.

## 2.25 — 10 novembre 2026

- Nouveauté : l'Accueil a son logo, dans le même style que les applis (pastille sombre et quatre cases de couleur).
- Nouveauté : en haut à droite, le nom s'affiche (Prénom NOM) à la place de l'adresse mail.
- Nouveauté : un fondu doux quand on passe d'une appli à l'autre ou qu'on revient à l'Accueil (sur les navigateurs récents).

## 2.24 — 10 novembre 2026

- Nouveauté : nouveau style « plan » pour l'Accueil (feuille de dessin, cotations, coins qui s'ouvrent au survol), avec les chiffres de Check en grand.

## 2.23 — 10 novembre 2026

- Nouveauté : chaque appli a son logo sur l'Accueil, la carte Check est mieux remplie, et « De temps en temps » devient « Occasionnels ».

## 2.22 — 10 novembre 2026

- Nouveauté : nouvel Accueil : Check en grand, Index et Access à côté, puis les autres applis en simples lignes. Plus aéré et plus sobre.

## 2.21 — 10 novembre 2026

- Nouveauté : l'Accueil classe les applis selon l'usage : Check, Index et Access en grand, puis Trame, Linear et Format, puis les autres outils en petites pastilles.

## 2.20 — 10 novembre 2026

- Nouveauté : les cartes de l'Accueil sont plus légères : une seule phrase par appli.

## 2.19 — 10 novembre 2026

- Nouveauté : le bloc « Aujourd'hui » est retiré de l'Accueil, qui redevient plus léger.

## 2.18 — 10 novembre 2026

- Nouveauté : un bloc « Aujourd'hui » en haut de l'Accueil rassemble vos notes à traiter, vos derniers calculs partagés et le chantier en cours.

## 2.17 — 10 novembre 2026

- Nouveauté : les Statistiques montrent l'espace utilisé sur Supabase (base et fichiers) par rapport à l'offre gratuite.

## 2.16 — 10 novembre 2026

- Nouveauté : le dossier chantier liste les calculs partagés (Linear pour l'instant) et les ouvre directement.

## 2.15 — 10 novembre 2026

- Nouveauté : dans la recherche Ctrl+K et dans le dossier chantier, une fiche Index ou une note Check s'ouvre directement sur la bonne fiche ou la bonne note.

## 2.14 — 10 novembre 2026

- Nouveauté : une barre de recherche (Ctrl+K, ou le bouton « Rechercher ») qui cherche d'un coup une appli, un chantier, une fiche Index ou une note Check.

## 2.13 — 10 novembre 2026

- Nouveauté : le chantier choisi dans « Chantiers » est retenu pour Linear et Format, qui le proposent à l'ouverture d'un nouveau projet. Le message sans note est plus clair : « Pas de notes visibles : vous n'êtes pas membre du projet dans Check ».

## 2.12 — 10 novembre 2026

- Nouveauté : un nouvel onglet « Chantiers » : on choisit un chantier et on voit ses notes Check (en retard d'abord), ses fiches Index et des raccourcis vers les outils de calcul.

## 2.11 — 10 novembre 2026

- Nouveauté : sur la carte Check, une pastille « n pour moi » indique les notes qui vous sont confiées et pas encore réglées (quand vous êtes connecté).

## 2.10 — 9 novembre 2026

- Nouveauté : dans les statistiques, « Contenu par appli » compte aussi le catalogue de Membrane (produits et colles).

## 2.9 — 9 novembre 2026

- Nouveauté : le bouton « Administration » disparaît : connecté comme administrateur, tu vois directement « Traiter » sur chaque retour, sans autre connexion.

## 2.8 — 9 novembre 2026

- Nouveauté : le bouton « Administration » de l'Accueil s'ouvre directement quand tu es déjà connecté comme administrateur via Index ou le tableau de bord, sans te redemander ton mot de passe.

## 2.7 — 9 novembre 2026

- Nouveauté : dans l'historique du tableau de bord, le concepteur peut mettre une ligne à la corbeille (🗑), la restaurer, ou vider la corbeille ; les lignes y restent 30 jours au maximum.

## 2.6 — 9 novembre 2026

- Nouveauté : l'historique du tableau de bord est plus lisible : chaque modification montre champ par champ ce qui change (ancienne valeur barrée en rouge, nouvelle valeur en vert), avec une pastille de couleur pour Ajout, Modification ou Suppression.

## 2.5 — 9 novembre 2026

- Technique : les textes venus de la base (retours, comptes, historique) passent tous par le filtre anti-injection avant d'être affichés, y compris les champs que la base garantit déjà.

## 2.4 — 8 novembre 2026

- Nouveauté : toutes les données des applis sont maintenant hébergées en Suisse. Reconnecte-toi une fois avec ton e-mail et ton mot de passe habituels.

## 2.3 — 8 novembre 2026

- Nouveauté : un onglet « Tableau de bord » réunit la gestion des applis : comptes (valider, nommer un administrateur, retirer un accès), historique des modifications avec bouton « Annuler », et statistiques pour le concepteur. Chacun voit ce que son rôle permet ; le nombre de comptes en attente s'affiche dans le menu.

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
