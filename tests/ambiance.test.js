import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { BUDGETS, construireScene, doitRegenerer, estMobile, generateur } from "../src/ambiance.js";
import { CLE_PREFERENCE, THEMES } from "../src/themes.js";

const DESKTOP = { largeur: 1280, hauteur: 800 };
const MOBILE = { largeur: 360, hauteur: 640 };
const compter = (svg, classe) => (svg.match(new RegExp(`class="${classe}[" ]`, "g")) ?? []).length;

describe("construireScene : décor sûr", () => {
  for (const { cle } of THEMES) {
    for (const format of [DESKTOP, MOBILE]) {
      it(`${cle} ${format.largeur}px : SVG sans texte, sans lien ni élément interactif`, () => {
        const svg = construireScene(cle, format);
        assert.match(svg, /^<svg class="scene scene--/);
        assert.doesNotMatch(svg, /<(text|a|foreignObject|script|image)\b/i);
        assert.doesNotMatch(svg, /tabindex|onclick|href=/i);
        // Ni rouge ni ambre (pas de connotation d'alerte).
        assert.doesNotMatch(svg, /#(f00|ff0000|ffa500|ffb4a8|e53935)/i);
      });
    }
  }

  it("renvoie une chaîne vide pour un thème inconnu", () => {
    assert.equal(construireScene("inconnu", DESKTOP), "");
  });

  it("est déterministe : même écran, même scène", () => {
    for (const { cle } of THEMES) {
      assert.equal(construireScene(cle, DESKTOP), construireScene(cle, DESKTOP));
    }
  });
});

describe("construireScene : compositions réellement distinctes", () => {
  it("Neural = réseau sans planète ; Orbital = planète sans réseau ; Hybride = les deux", () => {
    const neural = construireScene("neural", DESKTOP);
    const orbital = construireScene("orbital", DESKTOP);
    const hybride = construireScene("hybride", DESKTOP);
    assert.ok(compter(neural, "n-noeud") > 0 && compter(neural, "o-planete") === 0);
    assert.ok(compter(orbital, "o-planete") === 1 && compter(orbital, "n-noeud") === 0);
    assert.ok(compter(hybride, "o-planete") === 1 && compter(hybride, "n-noeud") > 0);
    assert.ok(compter(hybride, "impulsion impulsion--tete impulsion--arrimage") >= 1, "impulsion d'arrimage");
  });

  it("Clair premium : décor fixe, aucun élément animé", () => {
    const clair = construireScene("clair", DESKTOP);
    assert.doesNotMatch(clair, /impulsion|o-satellite|n-lien--respire|--duree/);
  });

  it("les thèmes animés contiennent des éléments en mouvement dès le départ (délais ≤ 2,5 s)", () => {
    for (const cle of ["neural", "orbital", "hybride"]) {
      const svg = construireScene(cle, DESKTOP);
      const delais = [...svg.matchAll(/class="(?:impulsion impulsion--tete[^"]*|o-satellite[^"]*)"[^>]*--delai:(-?[\d.]+)s/g)].map((m) => Number(m[1]));
      assert.ok(delais.length >= 2, cle);
      assert.ok(delais.filter((d) => d <= 2.5).length >= 2, `${cle} : ${delais}`);
    }
  });
});

describe("construireScene : budgets (batterie, lisibilité)", () => {
  it("respecte les plafonds desktop et mobile", () => {
    for (const [format, cle] of [[DESKTOP, "desktop"], [MOBILE, "mobile"]]) {
      const neural = construireScene("neural", format);
      assert.ok(compter(neural, "n-noeud") <= BUDGETS.neural[cle].noeuds);
      assert.ok(compter(neural, "impulsion impulsion--tete") <= BUDGETS.neural[cle].impulsions);
      const orbital = construireScene("orbital", format);
      // Chaque satellite existe en deux copies (arrière / avant de la planète).
      assert.ok(compter(orbital, "o-satellite") / 2 <= BUDGETS.orbital[cle].satellites);
      const hybride = construireScene("hybride", format);
      assert.ok(compter(hybride, "n-noeud") <= BUDGETS.hybride[cle].noeuds);
      assert.ok(
        compter(hybride, "impulsion impulsion--tete") <= BUDGETS.hybride[cle].impulsions + BUDGETS.hybride[cle].arrimages,
      );
    }
  });

  it("allège nettement la scène sur mobile", () => {
    for (const cle of ["neural", "orbital", "hybride"]) {
      assert.ok(construireScene(cle, MOBILE).length < construireScene(cle, DESKTOP).length * 0.75, cle);
    }
    assert.ok(compter(construireScene("neural", MOBILE), "n-noeud") <= 12);
  });
});

describe("doitRegenerer / estMobile / generateur", () => {
  it("ignore les petites variations (barre d'adresse mobile)", () => {
    assert.equal(doitRegenerer({ largeur: 360, hauteur: 640 }, { largeur: 360, hauteur: 580 }), false);
    assert.equal(doitRegenerer({ largeur: 1280, hauteur: 800 }, { largeur: 1300, hauteur: 820 }), false);
  });

  it("régénère au premier rendu, au passage mobile ↔ desktop et aux grands écarts", () => {
    assert.equal(doitRegenerer(null, DESKTOP), true);
    assert.equal(doitRegenerer({ largeur: 620, hauteur: 800 }, { largeur: 590, hauteur: 800 }), true);
    assert.equal(doitRegenerer({ largeur: 1280, hauteur: 800 }, { largeur: 1920, hauteur: 1080 }), true);
  });

  it("classe 599 px en mobile et 600 px en desktop", () => {
    assert.equal(estMobile(599), true);
    assert.equal(estMobile(600), false);
  });

  it("produit une suite pseudo-aléatoire reproductible dans [0, 1[", () => {
    const a = generateur(42);
    const b = generateur(42);
    for (let i = 0; i < 50; i++) {
      const v = a();
      assert.equal(v, b());
      assert.ok(v >= 0 && v < 1);
    }
  });
});

describe("src/theme-initial.js (script de tête, sans module)", () => {
  it("utilise la même clé et la même liste blanche que src/themes.js", async () => {
    const source = await readFile(new URL("../src/theme-initial.js", import.meta.url), "utf8");
    assert.ok(source.includes(`"${CLE_PREFERENCE}"`));
    for (const theme of THEMES) {
      assert.match(source, new RegExp(`${theme.cle}: \\["${theme.schema}", "${theme.couleurNavigateur}"\\]`));
    }
    assert.match(source, /var theme = "hybride"/);
    assert.match(source, /try \{/);
  });
});
