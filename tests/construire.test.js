import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, readdir, rm, appendFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { construire, nomHache } from "../scripts/construire.mjs";

const RACINE = fileURLToPath(new URL("../", import.meta.url));
let temp;

/** Copie index.html + src/ dans un dossier temporaire (les sources du dépôt restent intactes). */
async function copieDuSite(nom) {
  const dossier = join(temp, nom);
  await cp(join(RACINE, "index.html"), join(dossier, "index.html"));
  await cp(join(RACINE, "src"), join(dossier, "src"), { recursive: true });
  return dossier;
}

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
});
