// Garde commune a toutes les applis : sans compte valide, on part sur l'Accueil (page d'apercu + connexion),
// qui ramene ensuite a l'appli demandee. A inclure en tout premier dans le <head> de chaque appli :
//   <script src="https://outils-hn.github.io/garde.js"></script>
(function () {
  var CLE = "sb-dtxgvwaqjmmffiiohika-auth-token";
  var BASE = "https://dtxgvwaqjmmffiiohika.supabase.co";
  var CLE_PUBLIQUE = "sb_publishable_yEWGxFFSLTE1lJRXnFUmpg_dMwa6LxW";
  var ACCUEIL = "https://outils-hn.github.io/";
  var p = location.pathname, h = location.hash, q = location.search;
  if (location.hostname !== "outils-hn.github.io") return; // seulement sur le vrai site (tests locaux et apercus non concernes)

  // Pages libres : inscription / mot de passe oublie d'Index, et retour d'un lien recu par e-mail
  if (/\/Index\/(auth|nouveau-mot-de-passe)\/?$/i.test(p)) return;
  if (/access_token=|type=(recovery|signup|invite|magiclink|email_change)|error_description=/.test(h) || /[?&](code|token_hash)=/.test(q)) return;

  function versAccueil() {
    location.replace(ACCUEIL + "?retour=" + encodeURIComponent(p + q + h));
  }
  var s = null;
  try { s = JSON.parse(localStorage.getItem(CLE) || "null"); } catch (e) { s = null; }
  // Pas de session utilisable (ni jeton valide, ni de quoi le renouveler)
  if (!s || !s.access_token || !(s.refresh_token || (s.expires_at && s.expires_at * 1000 > Date.now()))) { versAccueil(); return; }

  // Compte connecte : on verifie qu'il est valide (sinon l'Accueil affiche « en attente »).
  // Jeton expire (401) ou base injoignable : on laisse l'appli faire (elle renouvelle la session ou affiche son erreur).
  fetch(BASE + "/rest/v1/rpc/mon_role", {
    method: "POST",
    headers: { apikey: CLE_PUBLIQUE, Authorization: "Bearer " + s.access_token, "Content-Type": "application/json" },
    body: "{}",
  }).then(function (r) { return r.ok ? r.json() : undefined; })
    .then(function (role) {
      if (role === null) { versAccueil(); return; }
      if (role === undefined) return;
      // Compte collegue avec un mot de passe provisoire : l'Accueil lui fait choisir le sien d'abord
      return fetch(BASE + "/rest/v1/rpc/mon_mdp_provisoire", {
        method: "POST",
        headers: { apikey: CLE_PUBLIQUE, Authorization: "Bearer " + s.access_token, "Content-Type": "application/json" },
        body: "{}",
      }).then(function (r) { return r.ok ? r.json() : false; })
        .then(function (provisoire) { if (provisoire === true) versAccueil(); });
    })
    .catch(function () { /* hors ligne : rien */ });
})();
