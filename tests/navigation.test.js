import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { choisirFocusTableau, creerEtatFiche, lireOrigine, retourParHistorique } from "../src/navigation.js";

describe("état d'historique d'une fiche", () => {
  it("mémorise la carte d'origine et la relit", () => {
    const etat = creerEtatFiche("EQ-DEMO-010");
    assert.equal(lireOrigine(etat), "EQ-DEMO-010");
  });

  it("survit à une copie structurée (Précédent / Suivant, rechargement)", () => {
    // Le navigateur stocke history.state par clonage structuré.
    const copie = structuredClone(creerEtatFiche("EQ-DEMO-005"));
    assert.equal(lireOrigine(copie), "EQ-DEMO-005");
    assert.equal(retourParHistorique(copie), true);
  });

  it("ignore un état absent, étranger ou mal formé (lien direct)", () => {
    for (const etat of [null, undefined, "EQ-DEMO-001", {}, { origine: "EQ-DEMO-001" }, { type: "autre", origine: "X" }, { type: creerEtatFiche("A").type, origine: 3 }, { type: creerEtatFiche("A").type, origine: "" }]) {
      assert.equal(lireOrigine(etat), null, JSON.stringify(etat));
      assert.equal(retourParHistorique(etat), false);
    }
  });

  it("refuse un identifiant d'origine vide ou non textuel", () => {
    assert.throws(() => creerEtatFiche(""), TypeError);
    assert.throws(() => creerEtatFiche(null), TypeError);
  });
});

describe("choisirFocusTableau", () => {
  it("revient sur la carte d'origine si elle est affichée", () => {
    assert.equal(choisirFocusTableau({ origine: "EQ-DEMO-010", carteExiste: true }), "carte");
    assert.equal(choisirFocusTableau({ origine: "EQ-DEMO-010", carteExiste: true, section: "prioritaires" }), "carte");
  });

  it("se rabat sur la section ou le titre si la carte n'existe plus", () => {
    assert.equal(choisirFocusTableau({ origine: "EQ-X", carteExiste: false, section: "en-retard" }), "section");
    assert.equal(choisirFocusTableau({ origine: "EQ-X", carteExiste: false }), "titre");
  });

  it("place le focus sur le titre après un lien direct puis Retour", () => {
    assert.equal(choisirFocusTableau({ origine: null }), "titre");
  });

  it("laisse le focus naturel au premier affichage sans ancre", () => {
    assert.equal(choisirFocusTableau({ initial: true }), null);
    assert.equal(choisirFocusTableau({ initial: true, section: "a-controler" }), "section");
  });
});
