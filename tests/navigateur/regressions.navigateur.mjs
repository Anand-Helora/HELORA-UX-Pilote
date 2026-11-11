/**
 * Tests de non-régression NAVIGATEUR (optionnels, hors `npm test` et hors CI).
 *
 *   npm run test:navigateur
 *
 * Prérequis : Playwright et Chromium disponibles localement ; ils ne sont PAS
 * des dépendances du dépôt (par exemple `npx playwright install chromium`
 * après `npm install --no-save playwright`). Le script sert lui-même le dossier
 * du dépôt sur un port local libre, sans appel réseau externe.
 *
 * Ce nom de fichier ne correspond à aucun motif de `node --test` par défaut :
 * `npm test` (et donc la CI) ne l'exécute pas.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  console.error("Playwright est introuvable : installer-le localement (non versionné) pour lancer ces tests.");
  process.exit(1);
}

const RACINE = fileURLToPath(new URL("../../", import.meta.url));
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };
const MOBILE = { width: 360, height: 640 };

let serveur;
let navigateur;
let base;

before(async () => {
  serveur = createServer(async (requete, reponse) => {
    const chemin = decodeURIComponent(new URL(requete.url, "http://localhost").pathname);
    const fichier = normalize(join(RACINE, chemin === "/" ? "index.html" : chemin));
    if (!fichier.startsWith(RACINE.endsWith(sep) ? RACINE : RACINE + sep)) {
      reponse.writeHead(403).end();
      return;
    }
    try {
      const contenu = await readFile(fichier);
      reponse.writeHead(200, { "Content-Type": TYPES[extname(fichier)] ?? "application/octet-stream" }).end(contenu);
    } catch {
      reponse.writeHead(404).end();
    }
  });
  await new Promise((resoudre) => serveur.listen(0, "127.0.0.1", resoudre));
  base = `http://127.0.0.1:${serveur.address().port}/index.html`;
  navigateur = await chromium.launch();
});

after(async () => {
  await navigateur?.close();
  await new Promise((resoudre) => serveur?.close(resoudre));
});

async function nouvellePage(viewport = MOBILE) {
  const page = await navigateur.newPage({ viewport });
  const erreurs = [];
  page.on("pageerror", (erreur) => erreurs.push(String(erreur)));
  page.on("console", (message) => message.type() === "error" && erreurs.push(message.text()));
  return { page, erreurs };
}

const focusActuel = (page) =>
  page.evaluate(() => document.activeElement.dataset.id ?? document.activeElement.id ?? document.activeElement.tagName);
const debordement = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

describe("historique : Précédent puis Suivant (retour Codex n° 1)", () => {
  it("garde le comportement de « Retour » après Précédent puis Suivant", async () => {
    const { page, erreurs } = await nouvellePage();
    await page.goto(`${base}#/`);
    await page.waitForSelector(".sections");
    await page.click('a.carte__lien[data-id="EQ-DEMO-010"]');
    await page.waitForSelector(".fiche");
    await page.goBack();
    await page.waitForSelector(".sections");
    await page.goForward();
    await page.waitForSelector(".fiche");
    const longueur = await page.evaluate(() => history.length);

    await page.click('a[data-action="retour"]');
    await page.waitForSelector(".sections");
    assert.equal(await page.evaluate(() => history.length), longueur, "« Retour » ne doit pas empiler d'entrée");
    assert.equal(await focusActuel(page), "EQ-DEMO-010", "focus sur la carte d'origine");

    // Précédent ne doit pas rouvrir la fiche quittée.
    await page.goBack();
    await page.waitForTimeout(200);
    assert.notEqual(await page.evaluate(() => location.hash), "#/equipement/EQ-DEMO-010");
    assert.deepEqual(erreurs, []);
    await page.close();
  });

  it("rend le focus à la carte avec Précédent du navigateur après Suivant", async () => {
    const { page } = await nouvellePage();
    await page.goto(`${base}#/`);
    await page.waitForSelector(".sections");
    await page.click('a.carte__lien[data-id="EQ-DEMO-005"]');
    await page.waitForSelector(".fiche");
    await page.goBack();
    await page.waitForSelector(".sections");
    assert.equal(await focusActuel(page), "EQ-DEMO-005");
    await page.goForward();
    await page.waitForSelector(".fiche");
    assert.equal(await page.evaluate(() => document.activeElement.tagName), "H1");
    await page.goBack();
    await page.waitForSelector(".sections");
    assert.equal(await focusActuel(page), "EQ-DEMO-005");
    await page.close();
  });

  it("conserve l'origine après rechargement de la fiche", async () => {
    const { page } = await nouvellePage();
    await page.goto(`${base}#/`);
    await page.waitForSelector(".sections");
    await page.click('a.carte__lien[data-id="EQ-DEMO-007"]');
    await page.waitForSelector(".fiche");
    await page.reload();
    await page.waitForSelector(".fiche");
    const longueur = await page.evaluate(() => history.length);
    await page.click('a[data-action="retour"]');
    await page.waitForSelector(".sections");
    assert.equal(await page.evaluate(() => history.length), longueur);
    await page.close();
  });

  it("ignore une double activation rapide de « Retour » (pas de double recul)", async () => {
    const { page } = await nouvellePage();
    await page.goto(`${base}#/`);
    await page.waitForSelector(".sections");
    await page.click('a.carte__lien[data-id="EQ-DEMO-010"]');
    await page.waitForSelector(".fiche");
    await page.dblclick('a[data-action="retour"]');
    await page.waitForSelector(".sections");
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => location.hash), "#/");
    assert.equal(await focusActuel(page), "EQ-DEMO-010");
    await page.close();
  });

  it("lien direct vers une fiche puis « Retour » : tableau avec focus sur le titre", async () => {
    const { page } = await nouvellePage();
    await page.goto(`${base}#/equipement/EQ-DEMO-002`);
    await page.waitForSelector(".fiche");
    await page.click('a[data-action="retour"]');
    await page.waitForSelector(".sections");
    assert.equal(await page.evaluate(() => document.activeElement.tagName), "H1");
    assert.equal(await page.evaluate(() => location.hash), "#/");
    await page.close();
  });

  it("compteur → focus sur le titre de section, puis carte → fiche → Retour → carte", async () => {
    const { page } = await nouvellePage();
    await page.goto(`${base}#/`);
    await page.waitForSelector(".sections");
    await page.focus('a.compteur[data-ancre="a-controler"]');
    await page.keyboard.press("Enter");
    assert.equal(await focusActuel(page), "a-controler");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await page.waitForSelector(".fiche");
    await page.click('a[data-action="retour"]');
    await page.waitForSelector(".sections");
    assert.equal(await focusActuel(page), "EQ-DEMO-010");
    await page.close();
  });
});

describe("texte agrandi à 200 % en 360 px (retour Codex n° 2)", () => {
  const ids = Array.from({ length: 13 }, (_, i) => `EQ-DEMO-${String(i + 1).padStart(3, "0")}`);

  for (const route of [...ids.map((id) => `#/equipement/${id}`), "#/equipement/EQ-999", "#/"]) {
    it(`aucun défilement horizontal : ${route}`, async () => {
      const { page } = await nouvellePage();
      await page.goto(`${base}${route}`);
      await page.waitForSelector(route === "#/" ? ".sections" : ".fiche");
      await page.addStyleTag({ content: "html { font-size: 200%; }" });
      assert.ok((await debordement(page)) <= 0, `débordement de ${await debordement(page)} px`);
      // Chaque valeur de la fiche reste dans la carte de détails.
      const horsCadre = await page.$$eval(".fiche__details dd", (dds) =>
        dds.filter((dd) => dd.getBoundingClientRect().right > dd.closest("dl").getBoundingClientRect().right + 0.5).length,
      );
      assert.equal(horsCadre, 0);
      await page.close();
    });
  }

  for (const largeur of [960, 1280]) {
    it(`desktop ${largeur} px à 200 % : rien ne déborde ni ne se chevauche dans les compteurs (retour Codex PR #4)`, async () => {
      const { page } = await nouvellePage({ width: largeur, height: 800 });
      await page.goto(`${base}#/`);
      await page.waitForSelector(".sections");
      await page.addStyleTag({ content: "html { font-size: 200%; }" });
      assert.ok((await debordement(page)) <= 0, `débordement de ${await debordement(page)} px`);
      const defauts = await page.$$eval("a.compteur", (compteurs) =>
        compteurs.flatMap((compteur) => {
          const boite = compteur.getBoundingClientRect();
          const parties = [".compteur__nombre", ".compteur__libelle", ".compteur__invite"]
            .map((s) => compteur.querySelector(s))
            .filter((e) => e && getComputedStyle(e).display !== "none")
            .map((e) => [e.className, e.getBoundingClientRect()]);
          const erreurs = [];
          for (const [nom, r] of parties) {
            if (r.left < boite.left - 0.5 || r.right > boite.right + 0.5 || r.bottom > boite.bottom + 0.5) erreurs.push(`${nom} hors du compteur`);
          }
          for (let i = 0; i < parties.length; i++) for (let j = i + 1; j < parties.length; j++) {
            const [na, a] = parties[i], [nb, b] = parties[j];
            if (!(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom)) erreurs.push(`${na} chevauche ${nb}`);
          }
          return erreurs;
        }),
      );
      assert.deepEqual(defauts, []);
      await page.close();
    });
  }

  it("la fiche garde libellé et valeur côte à côte à taille normale", async () => {
    const { page } = await nouvellePage();
    await page.goto(`${base}#/equipement/EQ-DEMO-010`);
    await page.waitForSelector(".fiche");
    const memeLigne = await page.$$eval(".fiche__ligne", (lignes) =>
      lignes.every((l) => Math.abs(l.querySelector("dt").getBoundingClientRect().top - l.querySelector("dd").getBoundingClientRect().top) < 2),
    );
    assert.ok(memeLigne);
    await page.close();
  });
});

describe("ambiance animée décorative (Issue #3)", () => {
  const etatsAmbiance = (page) =>
    page.evaluate(() => document.querySelector(".ambiance").getAnimations({ subtree: true }).map((a) => a.playState));

  it("est non interactive, masquée aux technologies d'assistance et animée par défaut", async () => {
    const { page, erreurs } = await nouvellePage({ width: 1280, height: 800 });
    await page.goto(`${base}#/`);
    await page.waitForSelector(".sections");
    const calque = await page.evaluate(() => {
      const a = document.querySelector(".ambiance");
      return { hidden: a.getAttribute("aria-hidden"), pe: getComputedStyle(a).pointerEvents, focalisables: a.querySelectorAll("a, button, [tabindex]").length };
    });
    assert.deepEqual(calque, { hidden: "true", pe: "none", focalisables: 0 });
    const etats = await etatsAmbiance(page);
    assert.ok(etats.length >= 2 && etats.every((e) => e === "running"), String(etats));
    assert.deepEqual(erreurs, []);
    await page.close();
  });

  it("se met en pause et repart au clavier avec l'interrupteur « Fond animé »", async () => {
    const { page } = await nouvellePage();
    await page.goto(`${base}#/`);
    await page.waitForSelector(".sections");
    const bouton = page.locator('button[data-action="ambiance"]');
    assert.equal(await bouton.getAttribute("aria-pressed"), "true");
    await bouton.focus();
    await page.keyboard.press("Enter");
    assert.equal(await bouton.getAttribute("aria-pressed"), "false");
    assert.ok((await etatsAmbiance(page)).every((e) => e === "paused"));
    // L'état survit à la navigation interne (bouton hors de <main>).
    await page.click('a.carte__lien[data-id="EQ-DEMO-003"]');
    await page.waitForSelector(".fiche");
    assert.ok((await etatsAmbiance(page)).every((e) => e === "paused"));
    await page.keyboard.press("Shift+Tab"); // revient dans le bandeau
    await bouton.focus();
    await page.keyboard.press("Space");
    assert.equal(await bouton.getAttribute("aria-pressed"), "true");
    assert.ok((await etatsAmbiance(page)).every((e) => e === "running"));
    await page.close();
  });

  it("en mouvement réduit : aucune animation et interrupteur masqué", async () => {
    const contexte = await navigateur.newContext({ viewport: MOBILE, reducedMotion: "reduce" });
    const page = await contexte.newPage();
    await page.goto(`${base}#/`);
    await page.waitForSelector(".sections");
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
    assert.equal(await page.locator('button[data-action="ambiance"]').isVisible(), false);
    await contexte.close();
  });
});

describe("V4 : quatre ambiances visuelles (Issue #5)", () => {
  const DESKTOP = { width: 1280, height: 800 };
  const CLE = "helora-demo:theme";
  const theme = (page) => page.evaluate(() => document.documentElement.dataset.theme);
  const animationsAmbiance = (page) =>
    page.evaluate(() => document.querySelector(".ambiance").getAnimations({ subtree: true }).map((a) => a.playState));
  const attendreTheme = (page, cle) => page.waitForFunction((c) => document.documentElement.dataset.theme === c, cle);

  async function pageAvecTheme(cle, viewport = DESKTOP, options = {}) {
    const contexte = await navigateur.newContext({ viewport, ...options });
    if (cle) await contexte.addInitScript(([k, v]) => localStorage.setItem(k, v), [CLE, cle]);
    const page = await contexte.newPage();
    const erreurs = [];
    page.on("pageerror", (erreur) => erreurs.push(String(erreur)));
    page.on("console", (message) => message.type() === "error" && erreurs.push(message.text()));
    return { contexte, page, erreurs };
  }

  it("Hybride par défaut, sélecteur synchronisé, décor généré", async () => {
    const { contexte, page, erreurs } = await pageAvecTheme(null);
    await page.goto(`${base}#/`);
    await page.waitForSelector(".sections");
    assert.equal(await theme(page), "hybride");
    assert.equal(await page.locator('input[name="theme"]:checked').getAttribute("value"), "hybride");
    assert.ok((await page.locator(".ambiance svg.scene--hybride").count()) === 1);
    assert.deepEqual(erreurs, []);
    await contexte.close();
  });

  it("change de thème au clavier sans perdre fiche, focus ni historique ; préférence conservée", async () => {
    const { contexte, page, erreurs } = await pageAvecTheme(null);
    await page.goto(`${base}#/`);
    await page.waitForSelector(".sections");
    await page.click('a.carte__lien[data-id="EQ-DEMO-005"]');
    await page.waitForSelector(".fiche");
    const avant = await page.evaluate(() => ({ hash: location.hash, longueur: history.length }));
    await page.focus('input[name="theme"][value="hybride"]');
    for (const [touche, attendu] of [["ArrowLeft", "orbital"], ["ArrowLeft", "neural"], ["ArrowLeft", "clair"], ["ArrowRight", "neural"]]) {
      await page.keyboard.press(touche);
      await attendreTheme(page, attendu);
      const etat = await page.evaluate(() => ({
        hash: location.hash,
        longueur: history.length,
        focus: document.activeElement.value,
        fiche: Boolean(document.querySelector(".fiche h1")),
      }));
      assert.deepEqual(etat, { ...avant, focus: attendu, fiche: true }, `après ${touche} → ${attendu}`);
      assert.equal(await page.evaluate(() => document.querySelector(".ambiance svg").classList[1]), `scene--${attendu}`);
    }
    assert.equal(await page.evaluate((k) => localStorage.getItem(k), CLE), "neural");
    await page.reload();
    await page.waitForSelector(".fiche");
    assert.equal(await theme(page), "neural");
    // « Retour » fonctionne toujours (focus sur la carte d'origine).
    await page.click('a[data-action="retour"]');
    await page.waitForSelector(".sections");
    assert.equal(await focusActuel(page), "EQ-DEMO-005");
    assert.deepEqual(erreurs, []);
    await contexte.close();
  });

  it("changer de thème ne modifie pas la position de défilement", async () => {
    const { contexte, page } = await pageAvecTheme(null, { width: 1280, height: 500 });
    await page.goto(`${base}#/equipement/EQ-DEMO-005`);
    await page.waitForSelector(".fiche");
    await page.evaluate(() => window.scrollTo({ top: 200, behavior: "instant" }));
    await page.waitForTimeout(100);
    for (const cle of ["orbital", "neural", "clair", "hybride"]) {
      await page.evaluate((c) => document.querySelector(`input[name="theme"][value="${c}"]`).click(), cle);
      await attendreTheme(page, cle);
      await page.waitForTimeout(150);
      assert.equal(await page.evaluate(() => scrollY), 200, cle);
    }
    await contexte.close();
  });

  it("stockage local interdit : Hybride appliqué, changement possible, aucune erreur", async () => {
    const contexte = await navigateur.newContext({ viewport: MOBILE });
    await contexte.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new DOMException("refusé", "SecurityError");
        },
      });
    });
    const page = await contexte.newPage();
    const erreurs = [];
    page.on("pageerror", (erreur) => erreurs.push(String(erreur)));
    await page.goto(`${base}#/`);
    await page.waitForSelector(".sections");
    assert.equal(await theme(page), "hybride");
    await page.click('label:has(input[value="orbital"])');
    await attendreTheme(page, "orbital");
    assert.deepEqual(erreurs, []);
    await contexte.close();
  });

  it("préférence corrompue : repli sur Hybride", async () => {
    const { contexte, page } = await pageAvecTheme("<script>");
    await page.goto(`${base}#/`);
    await page.waitForSelector(".sections");
    assert.equal(await theme(page), "hybride");
    await contexte.close();
  });

  for (const cle of ["neural", "orbital", "hybride"]) {
    it(`${cle} : mouvement réellement perceptible dès les premières secondes`, async () => {
      const { contexte, page } = await pageAvecTheme(cle);
      await page.goto(`${base}#/`);
      await page.waitForSelector(".sections");
      const etats = await animationsAmbiance(page);
      assert.ok(etats.length >= 8 && etats.every((e) => e === "running"), String(etats.length));
      const positions = () =>
        page.evaluate(() =>
          [...document.querySelectorAll(".impulsion--tete, .o-satellite")].map((e) => parseFloat(getComputedStyle(e).strokeDashoffset)),
        );
      await page.waitForTimeout(300);
      const t0 = await positions();
      await page.waitForTimeout(1500);
      const t1 = await positions();
      // Avancées le long des chemins (pathLength 100) entre 0,3 s et 1,8 s.
      const bouges = t0.filter((v, i) => Math.abs(v - t1[i]) > 3).length;
      assert.ok(bouges >= 2, `${bouges} élément(s) en mouvement`);
      await contexte.close();
    });
  }

  it("Clair premium : décor fixe, aucune animation d'ambiance, Pause masquée sans décaler le sélecteur", async () => {
    const { contexte, page } = await pageAvecTheme("hybride");
    await page.goto(`${base}#/`);
    await page.waitForSelector(".sections");
    const positionAvant = await page.locator('label:has(input[value="clair"])').boundingBox();
    await page.click('label:has(input[value="clair"])');
    await attendreTheme(page, "clair");
    await page.waitForTimeout(400);
    assert.deepEqual(await animationsAmbiance(page), []);
    assert.equal(await page.locator('button[data-action="ambiance"]').isVisible(), false);
    assert.ok((await page.locator(".ambiance svg.scene--clair > *").count()) > 0, "décor fixe présent");
    assert.deepEqual(await page.locator('label:has(input[value="clair"])').boundingBox(), positionAvant);
    await contexte.close();
  });

  it("la pause est indépendante du thème", async () => {
    const { contexte, page } = await pageAvecTheme("neural");
    await page.goto(`${base}#/`);
    await page.waitForSelector(".sections");
    await page.click('button[data-action="ambiance"]');
    assert.ok((await animationsAmbiance(page)).every((e) => e === "paused"));
    // La lumière du filet du bandeau est aussi mise en pause.
    const filet = () =>
      page.evaluate(() => document.getAnimations().filter((a) => a.animationName === "filet-lumiere").map((a) => a.playState));
    assert.deepEqual(await filet(), ["paused"]);
    await page.click('label:has(input[value="orbital"])');
    await attendreTheme(page, "orbital");
    const etats = await animationsAmbiance(page);
    assert.ok(etats.length > 0 && etats.every((e) => e === "paused"), String(etats));
    assert.equal(await page.locator('button[data-action="ambiance"]').getAttribute("aria-pressed"), "false");
    await page.click('button[data-action="ambiance"]');
    assert.ok((await animationsAmbiance(page)).every((e) => e === "running"));
    await contexte.close();
  });

  for (const cle of ["clair", "neural", "orbital", "hybride"]) {
    it(`mouvement réduit (${cle}) : zéro animation, scène statique complète, sélecteur utilisable`, async () => {
      const { contexte, page } = await pageAvecTheme(cle, MOBILE, { reducedMotion: "reduce" });
      await page.goto(`${base}#/`);
      await page.waitForSelector(".sections");
      await page.waitForTimeout(300);
      assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
      assert.ok((await page.locator(".ambiance svg > *").count()) > 0, "scène non vide");
      assert.equal(await page.locator('button[data-action="ambiance"]').isVisible(), false);
      if (cle !== "clair") {
        // Impulsions retirées (pas de trait figé en plein vol) ; structure
        // conservée : nœud allumé ou satellite figé sur son orbite.
        const etat = await page.evaluate(() => ({
          impulsionsVisibles: [...document.querySelectorAll(".impulsion")].filter((e) => getComputedStyle(e).visibility !== "hidden").length,
          reperes:
            [...document.querySelectorAll(".eclat--fixe")].filter((e) => parseFloat(getComputedStyle(e).opacity) > 0.5).length +
            [...document.querySelectorAll(".o-satellite")].filter((e) => {
              const o = parseFloat(getComputedStyle(e).strokeDashoffset);
              return o < 0 && o > -100;
            }).length,
        }));
        assert.equal(etat.impulsionsVisibles, 0);
        assert.ok(etat.reperes >= 1, "scène statique avec repères lumineux");
      }
      const autre = cle === "neural" ? "orbital" : "neural";
      await page.click(`label:has(input[value="${autre}"])`);
      await attendreTheme(page, autre);
      assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
      await contexte.close();
    });
  }

  it("verre dépoli effectif : aucune animation d'entrée maintenue sur les blocs de <main>", async () => {
    // Une animation d'opacité maintenue (fill: both) crée une racine
    // d'arrière-plan : le backdrop-filter ne flouterait plus le décor.
    const { contexte, page } = await pageAvecTheme("hybride");
    await page.goto(`${base}#/`);
    await page.waitForSelector(".sections");
    await page.waitForTimeout(600);
    const maintenues = await page.evaluate(() =>
      [...document.querySelectorAll("main > *")].flatMap((e) => e.getAnimations()).length,
    );
    assert.equal(maintenues, 0);
    assert.match(await page.evaluate(() => getComputedStyle(document.querySelector(".compteur")).backdropFilter), /blur/);
    await contexte.close();
  });

  for (const viewport of [DESKTOP, MOBILE]) {
    it(`lumière du bandeau : aucun débordement horizontal à aucun instant (${viewport.width} px, retour Codex PR #6)`, async () => {
      const { contexte, page } = await pageAvecTheme("hybride", viewport);
      await page.goto(`${base}#/`);
      await page.waitForSelector(".sections");
      for (const progression of [0, 0.25, 0.5, 0.59, 0.8, 0.99]) {
        const ecart = await page.evaluate((t) => {
          const animation = document.getAnimations().find((a) => a.animationName === "filet-lumiere");
          animation.pause();
          animation.currentTime = 400 + 6000 * t;
          return document.documentElement.scrollWidth - window.innerWidth;
        }, progression);
        assert.ok(ecart <= 0, `débordement de ${ecart} px à ${progression * 100} % du cycle`);
      }
      await contexte.close();
    });
  }

  it("cibles tactiles ≥ 44 px sur mobile (sélecteur, pause, retour)", async () => {
    const { contexte, page } = await pageAvecTheme("hybride", MOBILE);
    await page.goto(`${base}#/equipement/EQ-DEMO-001`);
    await page.waitForSelector(".fiche");
    const tailles = await page.$$eval('.option-theme, button[data-action="ambiance"], a[data-action="retour"]', (els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect();
        return [e.className, Math.round(r.width), Math.round(r.height)];
      }),
    );
    for (const [nom, l, h] of tailles) assert.ok(l >= 44 && h >= 44, `${nom} : ${l}×${h}`);
    await contexte.close();
  });

  it("mobile : en ouvrant une fiche depuis une carte, la barre « Retour » est visible et le titre a le focus (revue UX B1)", async () => {
    const { contexte, page } = await pageAvecTheme("hybride", MOBILE);
    await page.goto(`${base}#/`);
    await page.waitForSelector(".sections");
    for (const mode of ["clic", "clavier"]) {
      const carte = page.locator('a.carte__lien[data-id="EQ-DEMO-009"]');
      if (mode === "clic") await carte.click();
      else {
        await carte.focus();
        await page.keyboard.press("Enter");
      }
      await page.waitForSelector(".fiche");
      const etat = await page.evaluate(() => ({
        hautRetour: document.querySelector(".lien-retour").getBoundingClientRect().top,
        focus: document.activeElement.tagName,
      }));
      assert.ok(etat.hautRetour >= 0, `${mode} : Retour hors écran (${etat.hautRetour})`);
      assert.equal(etat.focus, "H1");
      await page.click('a[data-action="retour"]');
      await page.waitForSelector(".sections");
      assert.equal(await focusActuel(page), "EQ-DEMO-009");
    }
    await contexte.close();
  });

  it("titre focalisé après un clic souris : pas de cadre de focus (revue UX I1)", async () => {
    const { contexte, page } = await pageAvecTheme("neural");
    await page.goto(`${base}#/`);
    await page.waitForSelector(".sections");
    await page.click('a.carte__lien[data-id="EQ-DEMO-001"]');
    await page.waitForSelector(".fiche");
    const style = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
    assert.equal(style, "none");
    await contexte.close();
  });

  it("desktop : « Retour » unique, dans la barre contextuelle alignée sur la colonne de la fiche", async () => {
    for (const route of ["#/equipement/EQ-DEMO-004", "#/equipement/EQ-999"]) {
      const { contexte, page } = await pageAvecTheme("hybride");
      await page.goto(`${base}${route}`);
      await page.waitForSelector(".fiche");
      assert.equal(await page.locator('a[data-action="retour"]').count(), 1);
      const geo = await page.evaluate(() => {
        const r = (s) => document.querySelector(s).getBoundingClientRect();
        return { retour: r(".lien-retour"), barre: r(".fiche__barre"), fiche: r(".fiche"), titre: r(".fiche h1"), contexte: r(".fiche__contexte") };
      });
      assert.ok(Math.abs(geo.retour.left - geo.fiche.left) < 1, "aligné sur la colonne");
      assert.ok(geo.retour.bottom <= geo.titre.top, "au-dessus du titre, dans l'en-tête");
      assert.ok(Math.abs(geo.barre.right - geo.fiche.right) < 1);
      assert.ok(Math.abs(geo.contexte.top + geo.contexte.height / 2 - (geo.retour.top + geo.retour.height / 2)) < 6, "même ligne");
      assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector(".lien-retour")).position), "static");
      await contexte.close();
    }
  });

  for (const [nom, viewport] of [["mobile 360 px", MOBILE], ["desktop 1280 px", DESKTOP], ["desktop 960 px", { width: 960, height: 800 }]]) {
    it(`texte à 200 % (${nom}) : bandeau et sélecteur sans débordement, dans chaque thème`, async () => {
      const { contexte, page } = await pageAvecTheme(null, viewport);
      await page.goto(`${base}#/equipement/EQ-DEMO-008`);
      await page.waitForSelector(".fiche");
      await page.addStyleTag({ content: "html { font-size: 200%; }" });
      for (const cle of ["clair", "neural", "orbital", "hybride"]) {
        await page.click(`label:has(input[value="${cle}"])`);
        await attendreTheme(page, cle);
        assert.ok((await debordement(page)) <= 0, `${cle} : débordement de ${await debordement(page)} px`);
        const horsBandeau = await page.$$eval(".option-theme, .bascule-ambiance, .lien-retour", (els) =>
          els.filter((e) => e.getBoundingClientRect().right > document.documentElement.clientWidth + 0.5).length,
        );
        assert.equal(horsBandeau, 0);
      }
      await contexte.close();
    });
  }
});
