/**
 * Logique pure du tableau de bord fictif (Issue #1), sans accès au DOM :
 * testable avec `node --test`.
 *
 * Rappel : les trois catégories et la catégorie unique par équipement sont
 * des contraintes du pilote UX/UI, pas des règles métier HELORA.
 */

/**
 * Catégories, dans l'ordre d'affichage des sections.
 * `tri` décrit l'ordre de DÉMONSTRATION (documenté, stable, non métier).
 */
export const CATEGORIES = Object.freeze([
  Object.freeze({
    cle: "en_retard",
    ancre: "en-retard",
    titre: "En retard",
    libelleCarte: "En retard",
    symbole: "!",
    tri: "Trié par échéance, la plus ancienne d'abord",
    messageVide: "Aucun équipement en retard.",
  }),
  Object.freeze({
    cle: "prioritaire",
    ancre: "prioritaires",
    titre: "Prioritaires",
    libelleCarte: "Prioritaire",
    symbole: "▲",
    tri: "Trié par priorité, de 1 (la plus haute) à 3",
    messageVide: "Aucun équipement prioritaire.",
  }),
  Object.freeze({
    cle: "a_controler",
    ancre: "a-controler",
    titre: "À contrôler",
    libelleCarte: "À contrôler",
    symbole: "○",
    tri: "Trié par échéance, la plus proche d'abord",
    messageVide: "Aucun équipement à contrôler.",
  }),
]);

const CLES = new Set(CATEGORIES.map((categorie) => categorie.cle));

/** Renvoie la définition d'une catégorie, ou `undefined` si inconnue. */
export function categorieParCle(cle) {
  return CATEGORIES.find((categorie) => categorie.cle === cle);
}

/**
 * Vérifie le jeu d'essai : identifiants uniques et une seule catégorie
 * connue par équipement. Lève une erreur explicite sinon.
 * @param {Array<object>} equipements
 * @returns {Array<object>} le même tableau, s'il est valide
 */
export function validerEquipements(equipements) {
  if (!Array.isArray(equipements)) {
    throw new TypeError("La liste des équipements doit être un tableau");
  }
  const ids = new Set();
  for (const equipement of equipements) {
    if (!equipement || typeof equipement.id !== "string" || equipement.id === "") {
      throw new TypeError("Chaque équipement doit avoir un identifiant");
    }
    if (ids.has(equipement.id)) {
      throw new Error(`Identifiant en double : ${equipement.id}`);
    }
    ids.add(equipement.id);
    if (typeof equipement.categorie !== "string" || !CLES.has(equipement.categorie)) {
      throw new Error(`Catégorie inconnue pour ${equipement.id} : ${String(equipement.categorie)}`);
    }
  }
  return equipements;
}

/**
 * Compte les équipements par catégorie. Chaque catégorie est présente,
 * même à zéro ; la somme est égale au nombre d'équipements valides.
 * @returns {{en_retard: number, prioritaire: number, a_controler: number}}
 */
export function compterParCategorie(equipements) {
  validerEquipements(equipements);
  const compteurs = Object.fromEntries(CATEGORIES.map((categorie) => [categorie.cle, 0]));
  for (const equipement of equipements) {
    compteurs[equipement.categorie] += 1;
  }
  return compteurs;
}

function comparerTexte(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** Valeur manquante triée en dernier. */
function comparerOptionnel(a, b) {
  const aAbsent = a === null || a === undefined;
  const bAbsent = b === null || b === undefined;
  if (aAbsent || bAbsent) return Number(aAbsent) - Number(bAbsent);
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Comparateurs de DÉMONSTRATION par catégorie (pas un tri métier) :
 * - en_retard   : échéance croissante (la plus ancienne d'abord) ;
 * - prioritaire : priorité croissante (1 = la plus haute) ;
 * - a_controler : échéance croissante (la plus proche d'abord).
 * Départage systématique par identifiant croissant : l'ordre est total,
 * donc identique quel que soit l'ordre d'entrée.
 */
const COMPARATEURS = {
  en_retard: (a, b) => comparerOptionnel(a.echeance, b.echeance),
  prioritaire: (a, b) => comparerOptionnel(a.priorite, b.priorite),
  a_controler: (a, b) => comparerOptionnel(a.echeance, b.echeance),
};

/**
 * Trie une section sans modifier le tableau d'entrée.
 * @param {Array<object>} equipements équipements d'une même catégorie
 * @param {string} cle clé de la catégorie
 */
export function trierSection(equipements, cle) {
  const comparer = COMPARATEURS[cle];
  if (!comparer) {
    throw new Error(`Catégorie inconnue : ${String(cle)}`);
  }
  return [...equipements].sort((a, b) => comparer(a, b) || comparerTexte(a.id, b.id));
}

/**
 * Répartit les équipements en sections triées, dans l'ordre de CATEGORIES.
 * @returns {Array<{categorie: object, equipements: Array<object>}>}
 */
export function construireSections(equipements) {
  validerEquipements(equipements);
  return CATEGORIES.map((categorie) => ({
    categorie,
    equipements: trierSection(
      equipements.filter((equipement) => equipement.categorie === categorie.cle),
      categorie.cle,
    ),
  }));
}

/** Retrouve un équipement par identifiant, ou `null`. */
export function trouverEquipement(equipements, id) {
  return equipements.find((equipement) => equipement.id === id) ?? null;
}

const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function decouperDateIso(iso) {
  const correspondance = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!correspondance) return null;
  const [, annee, mois, jour] = correspondance;
  const numeroMois = Number(mois);
  if (numeroMois < 1 || numeroMois > 12) return null;
  return { annee, mois, jour, numeroMois };
}

/** « 2026-09-14 » → « 14/09/2026 » (format court des cartes). */
export function formaterDateCourte(iso) {
  const date = decouperDateIso(iso);
  return date ? `${date.jour}/${date.mois}/${date.annee}` : "Non renseignée";
}

/** « 2026-09-14 » → « 14 septembre 2026 » (format long de la fiche). */
export function formaterDateLongue(iso) {
  const date = decouperDateIso(iso);
  return date ? `${Number(date.jour)} ${MOIS[date.numeroMois - 1]} ${date.annee}` : "Non renseignée";
}

/** Libellés explicites : « 1 sur 3 » pouvait se lire comme une note faible. */
const LIBELLES_PRIORITE = Object.freeze({
  1: "1 (la plus haute)",
  2: "2",
  3: "3 (la plus basse)",
});

/**
 * Information secondaire affichée selon la catégorie (hypothèse du pilote) :
 * la priorité pour « prioritaire », l'échéance sinon.
 * @returns {{libelle: string, valeur: string, valeurLongue: string, iso: string|null}}
 */
export function informationCle(equipement) {
  if (equipement.categorie === "prioritaire") {
    const valeur = LIBELLES_PRIORITE[equipement.priorite] ?? "Non renseignée";
    return { libelle: "Priorité", valeur, valeurLongue: valeur, iso: null };
  }
  return {
    libelle: "Échéance",
    valeur: formaterDateCourte(equipement.echeance),
    valeurLongue: formaterDateLongue(equipement.echeance),
    iso: decouperDateIso(equipement.echeance) ? equipement.echeance : null,
  };
}

/**
 * Interprète le fragment d'URL.
 * - « », « # », « #/ »             → tableau de bord ;
 * - « #/equipement/<id> »          → fiche ;
 * - ancre de section (#en-retard…) → tableau de bord + section ;
 * - toute autre route « #/… »      → tableau de bord (route inconnue).
 * @returns {{vue: "tableau"|"fiche", id?: string, section?: string}}
 */
export function analyserHash(hash) {
  const fragment = String(hash ?? "").replace(/^#/, "");
  if (fragment.startsWith("/equipement/")) {
    let id = fragment.slice("/equipement/".length);
    try {
      id = decodeURIComponent(id);
    } catch {
      // identifiant mal encodé : conservé tel quel, la fiche sera « introuvable »
    }
    return { vue: "fiche", id };
  }
  const section = CATEGORIES.find((categorie) => categorie.ancre === fragment);
  if (section) {
    return { vue: "tableau", section: section.ancre };
  }
  return { vue: "tableau" };
}

export const ETATS_SIMULES = Object.freeze(["chargement", "vide", "erreur"]);

/**
 * Lit l'état simulé dans la chaîne de requête (`?etat=chargement|vide|erreur`).
 * Toute autre valeur donne l'état normal (`null`).
 */
export function lireEtatSimule(recherche) {
  const etat = new URLSearchParams(String(recherche ?? "")).get("etat");
  return ETATS_SIMULES.includes(etat) ? etat : null;
}
