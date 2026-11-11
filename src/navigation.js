/**
 * État de navigation porté par l'entrée d'historique (history.state).
 *
 * Quand une fiche est ouverte depuis une carte du tableau de bord, son entrée
 * d'historique mémorise l'identifiant de la carte d'origine. L'information
 * survit ainsi aux boutons Précédent / Suivant du navigateur (et au
 * rechargement), contrairement à une variable en mémoire. Aucun stockage
 * persistant (localStorage…) n'est utilisé.
 */

const TYPE_FICHE_DEPUIS_TABLEAU = "demo/fiche-depuis-tableau";

/** État à associer à l'entrée d'historique d'une fiche ouverte depuis une carte. */
export function creerEtatFiche(idOrigine) {
  if (typeof idOrigine !== "string" || idOrigine === "") {
    throw new TypeError("L'identifiant de la carte d'origine doit être une chaîne non vide");
  }
  return { type: TYPE_FICHE_DEPUIS_TABLEAU, origine: idOrigine };
}

/**
 * Identifiant de la carte d'origine mémorisé dans un état d'historique,
 * ou `null` (fiche ouverte par lien direct, état absent ou inconnu).
 */
export function lireOrigine(etat) {
  if (
    etat &&
    typeof etat === "object" &&
    etat.type === TYPE_FICHE_DEPUIS_TABLEAU &&
    typeof etat.origine === "string" &&
    etat.origine !== ""
  ) {
    return etat.origine;
  }
  return null;
}

/**
 * « Retour au tableau de bord » doit-il revenir à l'entrée précédente
 * (history.back) plutôt qu'empiler une nouvelle entrée ? Oui seulement si la
 * fiche courante a été ouverte depuis le tableau de bord.
 */
export function retourParHistorique(etat) {
  return lireOrigine(etat) !== null;
}

/**
 * Élément à focaliser à l'affichage du tableau de bord :
 * - « carte »   : retour depuis une fiche ouverte par une carte encore affichée ;
 * - « section » : arrivée sur une ancre de section ;
 * - « titre »   : autre changement de vue (lien direct puis retour…) ;
 * - `null`      : premier affichage sans ancre (focus naturel du navigateur).
 */
export function choisirFocusTableau({ origine = null, carteExiste = false, section = null, initial = false } = {}) {
  if (origine && carteExiste) return "carte";
  if (section) return "section";
  if (!initial) return "titre";
  return null;
}
