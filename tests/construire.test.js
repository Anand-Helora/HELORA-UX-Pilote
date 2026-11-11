import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { access, appendFile, cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { BASE_PAGES, construire, fichiers, nomHache, verifier } from "../scripts/construire.mjs";

const RACINE = fileURLToPath(new URL("../", import.meta.url));
let temp;

/** Copie index.html + src/ dans un dossier temporaire (les sources du dépôt restent intactes). */
async function copieDuSite(nom) {
  const dossier = join(temp, nom);
  await cp(join(RACINE, "index.html"), join(dossier, "index.html"));
  await cp(join(RACINE, "src"), join(dossier, "src"), { recursive: true });
  return dossier;
}

/** Mini-site de test : { "chemin": "contenu" } (index.html fourni par défaut). */
async function miniSite(nom, contenus) {
  const dossier = join(temp, nom);
  const tout = { "index.html": '<!doctype html><script type="module" src="src/app.js"></script>', ...contenus };
  for (const [chemin, contenu] of Object.entries(tout)) {
    await mkdir(join(dossier, chemin, ".."), { recursive: true });
    await writeFile(join(dossier, chemin), contenu);
  }
  return dossier;
}
const existe = (chemin) => access(chemin).then(() => true, () => false);

before(async () => {
  temp = await mkdtemp(join(tmpdir(), "construire-"));
});

after(async () => {
  await rm(temp, { recursive: true, force: true });
});

describe("construire (cache busting par hash de contenu)", () => {
  it("nomme le fichier avec l'empreinte avant l'extension", () => {
    assert.equal(nomHache("src/app.js", "abc123"), "src/app.abc123.js");
    assert.equal(nomHache("src/styles.css", "f00"), "src/styles.f00.css");
  });

  it("hache toutes les ressources de index.html et tout le graphe d'imports", async () => {
    const sortie = join(temp, "dist-complet");
    const manifeste = await construire(RACINE, sortie);
    for (const fichier of ["src/styles.css", "src/theme-initial.js", "src/app.js", "src/ambiance.js", "src/themes.js", "src/navigation.js", "src/tableau-de-bord.js", "src/donnees-fictives.js"]) {
      assert.match(manifeste[fichier] ?? "", /\.[0-9a-f]{10}\.(js|css)$/, fichier);
    }

    const html = await readFile(join(sortie, "index.html"), "utf8");
    assert.ok(html.includes(`href="${manifeste["src/styles.css"]}"`));
    assert.ok(html.includes(`src="${manifeste["src/theme-initial.js"]}"`));
    assert.ok(html.includes(`src="${manifeste["src/app.js"]}"`));
    assert.doesNotMatch(html, /(href|src)="src\/[^".]+\.(js|css)"/, "aucune référence non hachée");

    // Chaque import relatif publié pointe vers un fichier haché présent.
    const publies = new Set(await readdir(join(sortie, "src")));
    for (const fichier of publies) {
      if (!fichier.endsWith(".js")) continue;
      const code = await readFile(join(sortie, "src", fichier), "utf8");
      for (const [, cible] of code.matchAll(/from\s*["']\.\/([^"']+)["']/g)) {
        assert.match(cible, /\.[0-9a-f]{10}\.js$/, `${fichier} importe ${cible}`);
        assert.ok(publies.has(cible), `${fichier} → ${cible} absent`);
      }
    }
  });

  it("est déterministe : deux builds identiques produisent les mêmes URL", async () => {
    const a = await construire(RACINE, join(temp, "dist-a"));
    const b = await construire(RACINE, join(temp, "dist-b"));
    assert.deepEqual(a, b);
  });

  it("change l'URL de l'asset modifié et de ses importeurs transitifs, pas des autres", async () => {
    const avant = await construire(RACINE, join(temp, "dist-avant"));
    const source = await copieDuSite("site-modifie");
    await appendFile(join(source, "src", "ambiance.js"), "\n// modification ciblée de test\n");
    const apres = await construire(source, join(temp, "dist-apres"));

    assert.notEqual(apres["src/ambiance.js"], avant["src/ambiance.js"], "asset modifié");
    assert.notEqual(apres["src/app.js"], avant["src/app.js"], "importeur transitif");
    for (const inchange of ["src/styles.css", "src/theme-initial.js", "src/themes.js", "src/navigation.js", "src/tableau-de-bord.js", "src/donnees-fictives.js"]) {
      assert.equal(apres[inchange], avant[inchange], inchange);
    }
    const html = await readFile(join(temp, "dist-apres", "index.html"), "utf8");
    assert.ok(html.includes(apres["src/app.js"]));
    const app = await readFile(join(temp, "dist-apres", apres["src/app.js"]), "utf8");
    assert.ok(app.includes(apres["src/ambiance.js"].replace("src/", "./")));
  });

  it("échoue si un import pointe vers un fichier absent", async () => {
    const source = await copieDuSite("site-casse");
    await appendFile(join(source, "src", "app.js"), '\nimport "./inexistant.js";\n');
    await assert.rejects(construire(source, join(temp, "dist-casse")), /introuvable : src\/inexistant\.js/);
  });

  it("vérifie le site réel sous le chemin de base GitHub Pages et ne publie que les fichiers atteints", async () => {
    const sortie = join(temp, "dist-base");
    const manifeste = await construire(RACINE, sortie);
    assert.equal(BASE_PAGES, "/HELORA-UX-Pilote/");
    const atteints = await verifier(sortie);
    assert.deepEqual(atteints, ["index.html", ...Object.values(manifeste)].sort());
    assert.deepEqual(await fichiers(sortie), atteints, "aucun fichier orphelin ni manquant");
  });
});

describe("construire : analyse des imports (retours Codex PR #10)", () => {
  it("ignore les imports en commentaire ou dans une chaîne", async () => {
    const source = await miniSite("commentaires", {
      "src/app.js": '// import "./retire.js";\n/* import x from "./retire2.js"; */\nconst t = \'import "./retire3.js"\';\nimport { f } from "./reel.js";\nf(t);\n',
      "src/reel.js": "export const f = () => {};\n",
    });
    const manifeste = await construire(source, join(temp, "dist-commentaires"));
    assert.deepEqual(Object.keys(manifeste).sort(), ["src/app.js", "src/reel.js"]);
    const app = await readFile(join(temp, "dist-commentaires", manifeste["src/app.js"]), "utf8");
    assert.ok(app.includes('// import "./retire.js";'), "commentaire laissé intact");
    assert.ok(app.includes(`from "./${manifeste["src/reel.js"].slice(4)}"`));
  });

  it("suit un import avec commentaire intermédiaire et un import dynamique littéral", async () => {
    const source = await miniSite("commentaire-intermediaire", {
      "src/app.js": 'import /* commentaire */ "./enfant.js";\nexport /* x */ * from "./reexport.js";\nimport(/* paresseux */ "./dyn.js");\n',
      "src/enfant.js": "",
      "src/reexport.js": "export const a = 1;\n",
      "src/dyn.js": "",
    });
    const sortie = join(temp, "dist-intermediaire");
    const manifeste = await construire(source, sortie);
    assert.deepEqual(Object.keys(manifeste).sort(), ["src/app.js", "src/dyn.js", "src/enfant.js", "src/reexport.js"]);
    const app = await readFile(join(sortie, manifeste["src/app.js"]), "utf8");
    for (const f of ["enfant", "reexport", "dyn"]) assert.ok(app.includes(`"./${manifeste[`src/${f}.js`].slice(4)}"`), f);
    assert.doesNotMatch(app, /"\.\/(enfant|reexport|dyn)\.js"/);
  });

  it("parcourt le graphe .mjs : app.js → child.mjs → leaf.js", async () => {
    const source = await miniSite("mjs", {
      "src/app.js": 'import { c } from "./lib/child.mjs";\nc();\n',
      "src/lib/child.mjs": 'import { l } from "../leaf.js";\nexport const c = () => l();\n',
      "src/leaf.js": "export const l = () => 1;\n",
    });
    const sortie = join(temp, "dist-mjs");
    const avant = await construire(source, sortie);
    assert.deepEqual(Object.keys(avant).sort(), ["src/app.js", "src/leaf.js", "src/lib/child.mjs"]);
    assert.match(avant["src/lib/child.mjs"], /^src\/lib\/child\.[0-9a-f]{10}\.mjs$/);
    const child = await readFile(join(sortie, avant["src/lib/child.mjs"]), "utf8");
    assert.ok(child.includes(`from "../${avant["src/leaf.js"].slice(4)}"`), child);
    assert.deepEqual(await fichiers(sortie), ["index.html", ...Object.values(avant)].sort());

    // Modifier la feuille renomme toute la chaîne jusqu'au HTML.
    await appendFile(join(source, "src/leaf.js"), "// v2\n");
    const apres = await construire(source, join(temp, "dist-mjs-2"));
    for (const f of ["src/leaf.js", "src/lib/child.mjs", "src/app.js"]) assert.notEqual(apres[f], avant[f], f);
    const html = await readFile(join(temp, "dist-mjs-2", "index.html"), "utf8");
    assert.ok(html.includes(`src="${apres["src/app.js"]}"`));
  });

  it("ignore les commentaires HTML et laisse les URL externes et ancres intactes", async () => {
    const source = await miniSite("html", {
      "index.html": '<!-- <script src="src/ancien.js"></script> --><a href="#contenu"></a><link rel="preconnect" href="https://exemple.invalid"><script type="module" src="./src/app.js"></script>',
      "src/app.js": "",
    });
    const manifeste = await construire(source, join(temp, "dist-html"));
    const html = await readFile(join(temp, "dist-html", "index.html"), "utf8");
    assert.ok(html.includes('<!-- <script src="src/ancien.js"></script> -->'));
    assert.ok(html.includes('href="#contenu"') && html.includes('href="https://exemple.invalid"'));
    assert.ok(html.includes(`src="${manifeste["src/app.js"]}"`));
  });

  const refus = [
    ["import nu", { "src/app.js": 'import "lodash";\n' }, /« lodash » non pris en charge/],
    ["import absolu", { "src/app.js": 'import "/src/x.js";\n' }, /« \/src\/x\.js » non pris en charge/],
    ["import non module", { "src/app.js": 'import "./donnees.json";\n' }, /\.js ou \.mjs uniquement/],
    ["import dynamique non littéral", { "src/app.js": "const m = './x.js';\nimport(m);\n" }, /src\/app\.js:2 : import dynamique non littéral/],
    ["attributs d'import", { "src/app.js": 'import d from "./x.js" with { type: "json" };\n', "src/x.js": "" }, /attributs d'import/],
    ["import.meta", { "src/app.js": "new URL('./img.png', import.meta.url);\n" }, /import\.meta non pris en charge/],
    ["syntaxe invalide", { "src/app.js": "import {\n" }, /syntaxe JavaScript non analysable/],
    ["fichier absent", { "src/app.js": 'import "./absent.mjs";\n' }, /introuvable : src\/absent\.mjs/],
    ["import circulaire", { "src/app.js": 'import "./b.js";\n', "src/b.js": 'import "./app.js";\n' }, /circulaire/],
    ["ressource HTML non prise en charge", { "index.html": '<img src="logo.png">' }, /« logo\.png » non prise en charge/],
    ["chemin HTML absolu", { "index.html": '<script src="/src/app.js"></script>', "src/app.js": "" }, /chemin absolu/],
    ["script module en ligne", { "index.html": '<script type="module">import "./src/app.js";</script>' }, /script module en ligne/],
    ["CSS avec url()", { "index.html": '<link rel="stylesheet" href="s.css">', "s.css": "a{background:url(img.png)}" }, /@import\/url/],
  ];
  for (const [nom, contenus, attendu] of refus) {
    it(`refuse explicitement : ${nom}, sans laisser de dist/`, async () => {
      const source = await miniSite(`refus-${nom.replace(/\W+/g, "-")}`, contenus);
      const sortie = join(temp, `dist-refus-${nom.replace(/\W+/g, "-")}`);
      await mkdir(sortie, { recursive: true });
      await writeFile(join(sortie, "ancien.txt"), "build précédent");
      await assert.rejects(construire(source, sortie), attendu);
      assert.equal(await existe(sortie), false, "ancien dist/ supprimé");
      assert.equal(await existe(`${sortie}.construction`), false, "dossier temporaire supprimé");
    });
  }

  it("verifier détecte un import publié absent", async () => {
    const sortie = join(temp, "dist-casse-manuel");
    await construire(RACINE, sortie);
    const nom = (await readdir(join(sortie, "src"))).find((f) => f.startsWith("ambiance."));
    await rm(join(sortie, "src", nom));
    await assert.rejects(verifier(sortie), /absent du site construit/);
  });
});
