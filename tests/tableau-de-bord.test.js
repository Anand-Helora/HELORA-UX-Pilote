import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { EQUIPEMENTS_FICTIFS } from "../src/donnees-fictives.js";
import {
  CATEGORIES,
  analyserHash,
  compterParCategorie,
  construireSections,
  formaterDateCourte,
  formaterDateLongue,
  informationCle,
  lireEtatSimule,
  trierSection,
  trouverEquipement,
  validerEquipements,
} from "../src/tableau-de-bord.js";

const eq = (id, categorie, extra = {}) => ({ id, categorie, echeance: null, priorite: null, ...extra });

describe("jeu de données fictif", () => {
  it("contient au moins 12 équipements, valides et à identifiants uniques", () => {
    assert.ok(EQUIPEMENTS_FICTIFS.length >= 12);
    assert.doesNotThrow(() => validerEquipements(EQUIPEMENTS_FICTIFS));
  });

  it("attribue à chaque équipement exactement une catégorie connue", () => {
    const cles = CATEGORIES.map((categorie) => categorie.cle);
    for (const equipement of EQUIPEMENTS_FICTIFS) {
      assert.equal(typeof equipement.categorie, "string");
      assert.ok(cles.includes(equipement.categorie), equipement.id);
    }
  });

  it("utilise uniquement des identifiants de démonstration", () => {
    for (const equipement of EQUIPEMENTS_FICTIFS) {
      assert.match(equipement.id, /^EQ-DEMO-\d{3}$/);
    }
  });

  it("alimente chacune des trois sections", () => {
    const compteurs = compterParCategorie(EQUIPEMENTS_FICTIFS);
    for (const categorie of CATEGORIES) {
      assert.ok(compteurs[categorie.cle] > 0, categorie.cle);
    }
  });
});

describe("compterParCategorie", () => {
  it("compte exactement les équipements du jeu fictif", () => {
    assert.deepEqual(compterParCategorie(EQUIPEMENTS_FICTIFS), {
      en_retard: 4,
      prioritaire: 4,
      a_controler: 5,
    });
  });

  it("renvoie 0 pour chaque catégorie sur un jeu vide", () => {
    assert.deepEqual(compterParCategorie([]), { en_retard: 0, prioritaire: 0, a_controler: 0 });
  });

  it("a une somme égale au nombre d'équipements (catégories sans chevauchement)", () => {
    const compteurs = compterParCategorie(EQUIPEMENTS_FICTIFS);
    const somme = Object.values(compteurs).reduce((total, n) => total + n, 0);
    assert.equal(somme, EQUIPEMENTS_FICTIFS.length);
  });

  it("est cohérent avec le nombre de cartes de chaque section", () => {
    const compteurs = compterParCategorie(EQUIPEMENTS_FICTIFS);
    for (const section of construireSections(EQUIPEMENTS_FICTIFS)) {
      assert.equal(section.equipements.length, compteurs[section.categorie.cle]);
    }
  });

  it("rejette une catégorie inconnue ou absente", () => {
    assert.throws(() => compterParCategorie([eq("A", "urgent")]), /Catégorie inconnue/);
    assert.throws(() => compterParCategorie([{ id: "A" }]), /Catégorie inconnue/);
    assert.throws(() => compterParCategorie([eq("A", ["en_retard", "prioritaire"])]), /Catégorie inconnue/);
  });

  it("rejette un identifiant en double ou manquant", () => {
    assert.throws(() => compterParCategorie([eq("A", "en_retard"), eq("A", "prioritaire")]), /double/);
    assert.throws(() => compterParCategorie([{ categorie: "en_retard" }]), TypeError);
    assert.throws(() => compterParCategorie("pas un tableau"), TypeError);
  });
});

describe("construireSections", () => {
  it("produit les trois sections dans l'ordre En retard, Prioritaires, À contrôler", () => {
    const titres = construireSections(EQUIPEMENTS_FICTIFS).map((section) => section.categorie.titre);
    assert.deepEqual(titres, ["En retard", "Prioritaires", "À contrôler"]);
  });

  it("place chaque équipement dans une seule section, celle de sa catégorie", () => {
    const vus = new Map();
    for (const section of construireSections(EQUIPEMENTS_FICTIFS)) {
      for (const equipement of section.equipements) {
        assert.equal(equipement.categorie, section.categorie.cle);
        vus.set(equipement.id, (vus.get(equipement.id) ?? 0) + 1);
      }
    }
    assert.equal(vus.size, EQUIPEMENTS_FICTIFS.length);
    assert.ok([...vus.values()].every((n) => n === 1));
  });

  it("garde trois sections vides sur un jeu vide", () => {
    const sections = construireSections([]);
    assert.equal(sections.length, 3);
    assert.ok(sections.every((section) => section.equipements.length === 0));
  });
});

describe("trierSection (ordre de démonstration)", () => {
  it("trie « En retard » par échéance la plus ancienne, puis par identifiant", () => {
    const ids = construireSections(EQUIPEMENTS_FICTIFS)[0].equipements.map((e) => e.id);
    assert.deepEqual(ids, ["EQ-DEMO-003", "EQ-DEMO-001", "EQ-DEMO-002", "EQ-DEMO-004"]);
  });

  it("trie « Prioritaires » par priorité 1 → 3, puis par identifiant", () => {
    const ids = construireSections(EQUIPEMENTS_FICTIFS)[1].equipements.map((e) => e.id);
    assert.deepEqual(ids, ["EQ-DEMO-005", "EQ-DEMO-007", "EQ-DEMO-006", "EQ-DEMO-008"]);
  });

  it("trie « À contrôler » par échéance la plus proche, puis par identifiant", () => {
    const ids = construireSections(EQUIPEMENTS_FICTIFS)[2].equipements.map((e) => e.id);
    assert.deepEqual(ids, ["EQ-DEMO-010", "EQ-DEMO-012", "EQ-DEMO-009", "EQ-DEMO-013", "EQ-DEMO-011"]);
  });

  it("donne le même ordre quel que soit l'ordre d'entrée", () => {
    const section = EQUIPEMENTS_FICTIFS.filter((e) => e.categorie === "a_controler");
    const attendu = trierSection(section, "a_controler").map((e) => e.id);
    assert.deepEqual(trierSection([...section].reverse(), "a_controler").map((e) => e.id), attendu);
  });

  it("place les valeurs manquantes en dernier", () => {
    const ids = trierSection(
      [eq("B", "prioritaire"), eq("A", "prioritaire", { priorite: 3 }), eq("C", "prioritaire", { priorite: 1 })],
      "prioritaire",
    ).map((e) => e.id);
    assert.deepEqual(ids, ["C", "A", "B"]);
  });

  it("ne modifie pas le tableau d'entrée", () => {
    const entree = [eq("B", "en_retard", { echeance: "2026-02-01" }), eq("A", "en_retard", { echeance: "2026-01-01" })];
    const copie = entree.map((e) => e.id);
    trierSection(entree, "en_retard");
    assert.deepEqual(entree.map((e) => e.id), copie);
  });

  it("rejette une catégorie inconnue", () => {
    assert.throws(() => trierSection([], "inconnue"), /Catégorie inconnue/);
  });
});

describe("fiche équipement", () => {
  it("retrouve un équipement par identifiant, ou renvoie null", () => {
    assert.equal(trouverEquipement(EQUIPEMENTS_FICTIFS, "EQ-DEMO-007").designation, "Ascenseur de démonstration");
    assert.equal(trouverEquipement(EQUIPEMENTS_FICTIFS, "EQ-999"), null);
  });

  it("affiche la priorité pour un équipement prioritaire, l'échéance sinon", () => {
    assert.deepEqual(informationCle(eq("A", "prioritaire", { priorite: 2 })), {
      libelle: "Priorité",
      valeur: "2",
      valeurLongue: "2",
      iso: null,
    });
    assert.deepEqual(informationCle(eq("B", "en_retard", { echeance: "2026-09-14" })), {
      libelle: "Échéance",
      valeur: "14/09/2026",
      valeurLongue: "14 septembre 2026",
      iso: "2026-09-14",
    });
  });

  it("explicite le sens de la priorité (1 = la plus haute)", () => {
    assert.equal(informationCle(eq("A", "prioritaire", { priorite: 1 })).valeur, "1 (la plus haute)");
    assert.equal(informationCle(eq("A", "prioritaire", { priorite: 3 })).valeur, "3 (la plus basse)");
    assert.equal(informationCle(eq("A", "prioritaire")).valeur, "Non renseignée");
  });

  it("formate les dates en français et signale une date absente ou invalide", () => {
    assert.equal(formaterDateCourte("2026-08-03"), "03/08/2026");
    assert.equal(formaterDateLongue("2026-08-03"), "3 août 2026");
    assert.equal(formaterDateCourte(null), "Non renseignée");
    assert.equal(formaterDateLongue("2026-13-01"), "Non renseignée");
  });
});

describe("analyserHash", () => {
  it("reconnaît le tableau de bord", () => {
    for (const hash of ["", "#", "#/"]) {
      assert.deepEqual(analyserHash(hash), { vue: "tableau" });
    }
  });

  it("reconnaît une fiche, y compris un identifiant encodé", () => {
    assert.deepEqual(analyserHash("#/equipement/EQ-DEMO-003"), { vue: "fiche", id: "EQ-DEMO-003" });
    assert.deepEqual(analyserHash("#/equipement/EQ%20X"), { vue: "fiche", id: "EQ X" });
    assert.deepEqual(analyserHash("#/equipement/%E0"), { vue: "fiche", id: "%E0" });
  });

  it("distingue les ancres de section des routes", () => {
    assert.deepEqual(analyserHash("#en-retard"), { vue: "tableau", section: "en-retard" });
    assert.deepEqual(analyserHash("#prioritaires"), { vue: "tableau", section: "prioritaires" });
    assert.deepEqual(analyserHash("#a-controler"), { vue: "tableau", section: "a-controler" });
  });

  it("renvoie au tableau de bord pour une route inconnue", () => {
    assert.deepEqual(analyserHash("#/autre"), { vue: "tableau" });
    assert.deepEqual(analyserHash("#contenu"), { vue: "tableau" });
  });
});

describe("lireEtatSimule", () => {
  it("lit les états simulés pris en charge", () => {
    assert.equal(lireEtatSimule("?etat=chargement"), "chargement");
    assert.equal(lireEtatSimule("?etat=vide"), "vide");
    assert.equal(lireEtatSimule("?etat=erreur"), "erreur");
  });

  it("ignore une valeur absente ou inconnue", () => {
    assert.equal(lireEtatSimule(""), null);
    assert.equal(lireEtatSimule("?etat=autre"), null);
    assert.equal(lireEtatSimule(undefined), null);
  });
});
