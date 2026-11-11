/**
 * Construction du site statique pour GitHub Pages, sans dépendance.
 *
 *   npm run construire            → dist/
 *   node scripts/construire.mjs <source> <sortie>
 *
 * Chaque fichier CSS/JS référencé par index.html (et chaque module importé,
 * transitivement) est copié sous un nom contenant le hash de son contenu :
 * src/app.js → src/app.3f2a9c1b04.js. Le hash d'un module est calculé APRÈS
 * réécriture de ses imports : modifier ambiance.js change donc aussi le nom de
 * app.js qui l'importe, puis la référence dans index.html. Une actualisation
 * normale suffit alors à charger un ensemble HTML + CSS + JS cohérent.
 * Les fichiers sources ne sont pas modifiés.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, posix, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE_DEPOT = fileURLToPath(new URL("../", import.meta.url));

// Imports statiques (`import … from "x"`, `export … from "x"`, `import "x"`)
// et dynamiques à chaîne littérale (`import("x")`), limités aux chemins relatifs.
const MOTIF_IMPORT = /(\bfrom\s*|\bimport\s*\(?\s*)(["'])(\.{1,2}\/[^"']+)\2/g;
// Attributs href/src locaux de index.html pointant vers un .css ou un .js.
const MOTIF_HTML = /(\b(?:href|src)=)(["'])(?![a-z][a-z0-9+.-]*:|\/|#)([^"']+\.(?:css|js))\2/gi;

const hash = (contenu) => createHash("sha256").update(contenu).digest("hex").slice(0, 10);
const versPosix = (chemin) => chemin.split(sep).join(posix.sep);

/** Nom haché : "src/app.js" + "abc" → "src/app.abc.js". */
export function nomHache(chemin, empreinte) {
  const point = chemin.lastIndexOf(".");
  return `${chemin.slice(0, point)}.${empreinte}${chemin.slice(point)}`;
}

/**
 * Construit le site de `source` vers `sortie`.
 * Renvoie la table { "src/app.js": "src/app.<hash>.js", … }.
 */
export async function construire(source = RACINE_DEPOT, sortie = join(RACINE_DEPOT, "dist")) {
  const racine = resolve(source);
  const manifeste = new Map(); // chemin relatif posix → chemin haché
  const enCours = new Set();

  async function traiter(cheminRelatif, depuis) {
    if (manifeste.has(cheminRelatif)) return manifeste.get(cheminRelatif);
    if (enCours.has(cheminRelatif)) throw new Error(`Import circulaire non pris en charge : ${cheminRelatif}`);
    if (cheminRelatif.startsWith("..")) throw new Error(`Ressource hors du site : ${cheminRelatif} (depuis ${depuis})`);
    enCours.add(cheminRelatif);

    let contenu;
    try {
      contenu = await readFile(join(racine, cheminRelatif), "utf8");
    } catch {
      throw new Error(`Ressource introuvable : ${cheminRelatif} (référencée par ${depuis})`);
    }

    if (cheminRelatif.endsWith(".js")) {
      const dossier = posix.dirname(cheminRelatif);
      const cibles = new Map();
      for (const [, , , specifiant] of contenu.matchAll(MOTIF_IMPORT)) {
        const cible = posix.normalize(posix.join(dossier, specifiant));
        cibles.set(specifiant, await traiter(cible, cheminRelatif));
      }
      contenu = contenu.replace(MOTIF_IMPORT, (_, avant, guillemet, specifiant) => {
        let rel = posix.relative(dossier, cibles.get(specifiant));
        if (!rel.startsWith(".")) rel = `./${rel}`;
        return `${avant}${guillemet}${rel}${guillemet}`;
      });
    } else if (/@import|url\(\s*["']?(?!#|data:)/.test(contenu)) {
      // Garde-fou : ces références ne sont pas réécrites ; échouer plutôt
      // que publier une ressource dont le cache ne serait pas invalidé.
      throw new Error(`${cheminRelatif} référence d'autres fichiers (@import/url) : non pris en charge par le build.`);
    }

    const cheminHache = nomHache(cheminRelatif, hash(contenu));
    await mkdir(dirname(join(sortie, cheminHache)), { recursive: true });
    await writeFile(join(sortie, cheminHache), contenu);
    enCours.delete(cheminRelatif);
    manifeste.set(cheminRelatif, cheminHache);
    return cheminHache;
  }

  await rm(sortie, { recursive: true, force: true });
  await mkdir(sortie, { recursive: true });

  let html = await readFile(join(racine, "index.html"), "utf8");
  const references = new Map();
  for (const [, , , chemin] of html.matchAll(MOTIF_HTML)) {
    references.set(chemin, await traiter(posix.normalize(chemin), "index.html"));
  }
  html = html.replace(MOTIF_HTML, (_, attribut, guillemet, chemin) => `${attribut}${guillemet}${references.get(chemin)}${guillemet}`);
  await writeFile(join(sortie, "index.html"), html);

  return Object.fromEntries(manifeste);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [source, sortie] = process.argv.slice(2);
  const destination = sortie ? resolve(sortie) : join(RACINE_DEPOT, "dist");
  const manifeste = await construire(source ? resolve(source) : RACINE_DEPOT, destination);
  for (const [original, hache] of Object.entries(manifeste)) console.log(`${original} → ${hache}`);
  console.log(`Site construit dans ${versPosix(relative(process.cwd(), destination)) || "."}`);
}
