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
