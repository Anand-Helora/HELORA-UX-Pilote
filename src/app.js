/**
 * Rendu navigateur du tableau de bord fictif (Issue #1).
 * Aucune requête réseau, aucun stockage persistant : la carte d'origine d'une
 * fiche est portée par son entrée d'historique (history.state, voir
 * navigation.js) et survit donc à Précédent / Suivant et au rechargement.
 */
import { EQUIPEMENTS_FICTIFS } from "./donnees-fictives.js";
import {
  CATEGORIES,
  analyserHash,
  categorieParCle,
  compterParCategorie,
  construireSections,
  informationCle,
  lireEtatSimule,
  trouverEquipement,
} from "./tableau-de-bord.js";
import { choisirFocusTableau, creerEtatFiche, lireOrigine, retourParHistorique } from "./navigation.js";

const main = document.getElementById("contenu");
const annonce = document.getElementById("annonce");

/** Met à jour la région d'annonce persistante (après le rendu, pour être perçu comme un changement). */
function annoncer(texte) {
  annonce.textContent = "";
  window.setTimeout(() => {
    annonce.textContent = texte;
  }, 50);
}

let etatSimule = lireEtatSimule(window.location.search);
/**
 * Carte cliquée dont la fiche est en cours d'ouverture : transférée dans
 * history.state de l'entrée de la fiche dès son affichage.
 */
let carteCliquee = null;
/** Carte d'origine de la fiche affichée (lue dans history.state). */
let origineFicheAffichee = null;
/** Vrai entre history.back() et l'affichage suivant : évite un double retour. */
let retourEnCours = false;
let vueCourante = null;

function echapper(texte) {
  return String(texte)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function lienFiche(id) {
  return `#/equipement/${encodeURIComponent(id)}`;
}

function idDomCarte(id) {
  return `carte-${id.replace(/[^A-Za-z0-9_-]/g, "_")}`;
}

function donnees() {
  return etatSimule === "vide" ? [] : EQUIPEMENTS_FICTIFS;
}

function focaliser(element, { bloc = "start" } = {}) {
  if (!element) return;
  element.scrollIntoView({ block: bloc });
  element.focus({ preventScroll: true });
}

function badge(categorie) {
  return `<span class="badge"><span class="symbole" aria-hidden="true">${categorie.symbole}</span>${echapper(categorie.libelleCarte)}</span>`;
}

function htmlCompteurs(compteurs) {
  const elements = CATEGORIES.map((categorie) => {
    const nombre = compteurs ? compteurs[categorie.cle] : "–";
    const unite = compteurs && compteurs[categorie.cle] > 1 ? "équipements" : "équipement";
    const contenu = `
      <span class="compteur__nombre" aria-hidden="true"><span class="symbole compteur__symbole">${categorie.symbole}</span><span class="compteur__valeur">${nombre}</span></span>
      <span class="compteur__libelle" aria-hidden="true">${echapper(categorie.titre)}</span>
      <span class="visuellement-masque">${
        compteurs ? `${echapper(categorie.titre)} : ${nombre} ${unite}` : `${echapper(categorie.titre)} : en cours de chargement`
      }</span>`;
    return compteurs
      ? `<li><a class="compteur" href="#${categorie.ancre}" data-ancre="${categorie.ancre}">${contenu}</a></li>`
      : `<li><span class="compteur">${contenu}</span></li>`;
  }).join("");
  return `<nav aria-label="Résumé par catégorie"><ul class="compteurs">${elements}</ul></nav>`;
}

function htmlCarte(equipement, categorie) {
  const info = informationCle(equipement);
  const valeur = info.iso
    ? `<time datetime="${echapper(info.iso)}">${echapper(info.valeur)}</time>`
    : echapper(info.valeur);
  return `
    <li class="carte carte--${categorie.cle}" id="${idDomCarte(equipement.id)}">
      <h3 class="carte__titre">
        <a class="carte__lien" href="${lienFiche(equipement.id)}" data-id="${echapper(equipement.id)}" aria-describedby="${idDomCarte(equipement.id)}-meta">
          <span class="carte__id">${echapper(equipement.id)}</span>
          <span class="carte__designation">${echapper(equipement.designation)}</span>
        </a>
      </h3>
      <p class="carte__meta" id="${idDomCarte(equipement.id)}-meta">${badge(categorie)}<span>${info.libelle} : ${valeur}</span></p>
    </li>`;
}

function htmlSection({ categorie, equipements }) {
  const idTitre = `titre-${categorie.ancre}`;
  const contenu = equipements.length
    ? `<ul class="cartes">${equipements.map((equipement) => htmlCarte(equipement, categorie)).join("")}</ul>`
    : `<p class="section__vide">${echapper(categorie.messageVide)}</p>`;
  return `
    <section class="section" aria-labelledby="${idTitre}">
      <h2 class="section__titre" id="${categorie.ancre}" tabindex="-1">
        <span id="${idTitre}"><span class="symbole" aria-hidden="true">${categorie.symbole}</span> ${echapper(categorie.titre)} (${equipements.length})</span>
      </h2>
      <p class="section__tri">${echapper(categorie.tri)}</p>
      ${contenu}
    </section>`;
}

function rendreChargement() {
  document.title = "Chargement · Équipements fictifs · Démo";
  main.setAttribute("aria-busy", "true");
  main.innerHTML = `
    <h1 tabindex="-1">Tableau de bord</h1>
    ${htmlCompteurs(null)}
    <p class="message">Chargement des équipements…</p>`;
  annoncer("Chargement des équipements…");
}

function rendreErreur() {
  document.title = "Erreur · Équipements fictifs · Démo";
  main.setAttribute("aria-busy", "false");
  main.innerHTML = `
    <h1 tabindex="-1">Tableau de bord</h1>
    <div class="message message--erreur" role="alert">
      <strong>Impossible d'afficher les équipements.</strong>
      Erreur simulée pour la démonstration : aucune donnée n'a été perdue.
      <div><button type="button" class="bouton" data-action="reessayer">Réessayer</button></div>
    </div>`;
}

function rendreTableau() {
  const equipements = donnees();
  const compteurs = compterParCategorie(equipements);
  const sections = construireSections(equipements);
  document.title = "Tableau de bord · Équipements fictifs · Démo";
  main.setAttribute("aria-busy", "false");
  main.innerHTML = `
    <h1 tabindex="-1">Tableau de bord</h1>
    ${htmlCompteurs(compteurs)}
    ${
      equipements.length === 0
        ? `<p class="message">Aucun équipement à afficher : le jeu de données de démonstration est vide.</p>`
        : ""
    }
    <div class="sections">${sections.map(htmlSection).join("")}</div>`;
  annoncer(
    equipements.length === 0
      ? "Aucun équipement à afficher : le jeu de données de démonstration est vide."
      : `Tableau de bord affiché : ${CATEGORIES.map((c) => `${c.titre} ${compteurs[c.cle]}`).join(", ")}.`,
  );
}

function rendreFiche(id) {
  const equipement = trouverEquipement(donnees(), id);
  main.setAttribute("aria-busy", "false");
  const retour = `<a class="lien-retour" href="#/" data-action="retour"><span aria-hidden="true">←</span> Retour au tableau de bord</a>`;
  if (!equipement) {
    document.title = "Équipement introuvable · Démo";
    main.innerHTML = `
      <article class="fiche">
        ${retour}
        <h1 tabindex="-1">Équipement introuvable</h1>
        <p class="message">Aucun équipement fictif ne correspond à l'identifiant « ${echapper(id)} ».</p>
      </article>`;
    return;
  }
  const categorie = categorieParCle(equipement.categorie);
  const info = informationCle(equipement);
  const valeur = info.iso
    ? `<time datetime="${echapper(info.iso)}">${echapper(info.valeurLongue)}</time>`
    : echapper(info.valeurLongue);
  document.title = `${equipement.id} · Fiche équipement · Démo`;
  main.innerHTML = `
    <article class="fiche">
      ${retour}
      <p class="fiche__id">${echapper(equipement.id)}</p>
      <h1 tabindex="-1">${echapper(equipement.designation)}</h1>
      <dl class="fiche__details">
        <div class="fiche__ligne"><dt>Identifiant</dt><dd>${echapper(equipement.id)}</dd></div>
        <div class="fiche__ligne"><dt>Désignation</dt><dd>${echapper(equipement.designation)}</dd></div>
        <div class="fiche__ligne"><dt>Catégorie</dt><dd>${badge(categorie)}</dd></div>
        <div class="fiche__ligne"><dt>Statut</dt><dd>${echapper(equipement.statut)}</dd></div>
        <div class="fiche__ligne"><dt>${info.libelle}</dt><dd>${valeur}</dd></div>
        <div class="fiche__ligne"><dt>Zone</dt><dd>${echapper(equipement.zone)}</dd></div>
      </dl>
      <p class="fiche__note">Fiche en lecture seule. Données fictives de démonstration : la catégorie est imposée par le jeu d'essai et ne reflète aucune règle métier.</p>
    </article>`;
}

/**
 * Affiche la vue correspondant à l'URL et place le focus.
 * @param {{initial?: boolean}} options `initial` : premier affichage de la page
 */
function afficher({ initial = false } = {}) {
  retourEnCours = false;
  const route = analyserHash(window.location.hash);

  if (etatSimule === "chargement") {
    rendreChargement();
    vueCourante = "chargement";
    return;
  }
  if (etatSimule === "erreur") {
    rendreErreur();
    vueCourante = "erreur";
    return;
  }

  if (route.vue === "fiche") {
    if (carteCliquee) {
      // Mémoriser l'origine sur l'entrée d'historique de la fiche : elle reste
      // disponible après Précédent puis Suivant.
      history.replaceState(creerEtatFiche(carteCliquee), "");
      carteCliquee = null;
    }
    origineFicheAffichee = lireOrigine(history.state);
    rendreFiche(route.id);
    vueCourante = "fiche";
    if (!initial) focaliser(main.querySelector("h1"));
    return;
  }

  // Origine de la fiche que l'on quitte (Retour, Précédent ou Suivant).
  const origine = vueCourante === "fiche" ? origineFicheAffichee : null;
  origineFicheAffichee = null;
  carteCliquee = null;

  // Tableau de bord : ne pas reconstruire s'il est déjà affiché (simple ancre).
  if (vueCourante !== "tableau") {
    rendreTableau();
    vueCourante = "tableau";
  }

  const carte = origine && document.getElementById(idDomCarte(origine));
  const cible = choisirFocusTableau({ origine, carteExiste: Boolean(carte), section: route.section, initial });
  if (cible === "carte") {
    focaliser(carte.querySelector("a"), { bloc: "center" });
  } else if (cible === "section") {
    focaliser(document.getElementById(route.section));
  } else if (cible === "titre") {
    focaliser(main.querySelector("h1"));
  }
}

document.addEventListener("click", (evenement) => {
  if (evenement.defaultPrevented || evenement.button !== 0) return;
  if (evenement.metaKey || evenement.ctrlKey || evenement.shiftKey || evenement.altKey) return;
  const cible = evenement.target instanceof Element ? evenement.target : null;
  if (!cible) return;

  if (cible.closest("a.lien-evitement")) {
    // Lien d'évitement : déplacer le focus (visible) sans changer de vue.
    evenement.preventDefault();
    focaliser(main.querySelector("h1") ?? main);
    return;
  }

  const compteur = cible.closest("a.compteur[data-ancre]");
  if (compteur) {
    // Ancre interne : remplacer l'entrée d'historique pour que « Retour »
    // depuis une fiche revienne directement au tableau de bord.
    evenement.preventDefault();
    const ancre = compteur.dataset.ancre;
    history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${ancre}`);
    focaliser(document.getElementById(ancre));
    return;
  }

  const lienCarte = cible.closest("a.carte__lien[data-id]");
  if (lienCarte) {
    carteCliquee = lienCarte.dataset.id;
    return; // navigation par défaut vers #/equipement/<id>
  }

  const retour = cible.closest('a[data-action="retour"]');
  if (retour && (retourEnCours || retourParHistorique(history.state))) {
    // Revenir à l'entrée précédente évite d'empiler fiche → tableau → fiche.
    // history.back() est asynchrone : une seconde activation rapide (double
    // clic, Entrée maintenue) est ignorée pour ne pas reculer de deux entrées.
    evenement.preventDefault();
    if (retourEnCours) return;
    retourEnCours = true;
    history.back();
    return;
  }

  const reessayer = cible.closest('button[data-action="reessayer"]');
  if (reessayer) {
    etatSimule = null;
    vueCourante = null;
    history.replaceState(history.state, "", `${window.location.pathname}${window.location.hash}`);
    afficher();
  }
});

window.addEventListener("hashchange", () => afficher());

try {
  afficher({ initial: true });
} catch (erreur) {
  // Données invalides : afficher l'état d'erreur plutôt qu'une page blanche.
  console.error(erreur);
  rendreErreur();
}
