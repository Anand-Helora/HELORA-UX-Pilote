/**
 * Construction du site statique pour GitHub Pages, sans dépendance.
 *
 *   npm run construire            → dist/
 *   node scripts/construire.mjs <source> <sortie>
 *
 * Chaque fichier CSS/JS référencé par index.html (et chaque module .js/.mjs
 * importé, transitivement) est copié sous un nom contenant le hash de son contenu :
 * src/app.js → src/app.3f2a9c1b04.js. Le hash d'un module est calculé APRÈS
 * réécriture de ses imports : modifier ambiance.js change donc aussi le nom de
 * app.js qui l'importe, puis la référence dans index.html. Une actualisation
 * normale suffit alors à charger un ensemble HTML + CSS + JS cohérent.
 * Les fichiers sources ne sont pas modifiés.
 *
 * Les imports sont repérés par es-module-lexer (analyseur ESM utilisé par Vite,
 * sans dépendance) : commentaires et chaînes sont ignorés, `import /* … *\/ "x"`
 * est bien suivi. index.html est analysé par parse5 (analyseur HTML conforme
 * au standard) : attributs espacés, non cités ou en majuscules et commentaires
 * sont traités comme par un navigateur. Toute forme non prise en charge (import nu ou absolu, import
 * dynamique non littéral, attributs d'import, import.meta, ressource HTML autre
 * que CSS/JS…) fait échouer le build avec un message explicite. Le site est
 * construit dans un dossier temporaire, vérifié (chaque référence publiée
 * existe et reste sous le chemin de base GitHub Pages), puis seulement
 * renommé en `sortie` : un échec ne laisse jamais de dist/ partiel.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, posix, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { init, parse } from "es-module-lexer";
import { parse as analyserHtml } from "parse5";

const RACINE_DEPOT = fileURLToPath(new URL("../", import.meta.url));

const MODULE = /\.m?js$/;
const AVEC_SCHEMA = /^[a-z][a-z0-9+.-]*:/i;
// Chemin de base du site publié : sert à vérifier qu'aucune référence n'en sort.
export const BASE_PAGES = "/HELORA-UX-Pilote/";

// Références CSS (insensibles à la casse, comme CSS). `url()` : la valeur est
// extraite (citée, non citée, espacée) avant d'admettre les seules exceptions
// sans fichier : fragment (`#id`) et URI `data:`.
const URL_CSS = /\burl\(\s*(?:"([^"]*)"|'([^']*)'|([^\s"')]*))\s*\)/gi;
const AUTRE_REFERENCE_CSS = /@import\b|\b(?:image-set|src)\s*\(/i;

/** Garde-fou : le build ne réécrit pas les références CSS, il les refuse. */
function verifierCss(css, ou) {
  const valeurs = [...css.matchAll(URL_CSS)].map((m) => (m[1] ?? m[2] ?? m[3]).trim());
  const appels = css.match(/\burl\(/gi)?.length ?? 0;
  if (AUTRE_REFERENCE_CSS.test(css) || valeurs.length !== appels || valeurs.some((v) => !/^(#|data:)/i.test(v))) {
    throw new Error(`${ou} référence d'autres fichiers (@import/url) : non pris en charge par le build.`);
  }
}

/**
 * Code JavaScript en ligne (script classique, gestionnaire on*, lien
 * javascript:) : refusé s'il importe un module, repéré par es-module-lexer
 * (commentaires compris). Un code qui contient « import » sans pouvoir être
 * analysé est refusé par prudence.
 */
function refuserImportEnLigne(code, ou) {
  if (!/\bimport\b/.test(code)) return;
  let imports;
  try {
    [imports] = parse(code);
  } catch {
    throw new Error(`index.html : ${ou} non analysable contenant « import », non pris en charge (utiliser un module avec src=).`);
  }
  if (imports.length) throw new Error(`index.html : ${ou} contenant un import, non pris en charge (utiliser un module avec src=).`);
}

// Types de <script> exécutés comme JavaScript classique.
const SCRIPT_CLASSIQUE = /^(|(text|application)\/(x-)?(java|ecma)script|text\/jscript|text\/livescript)$/;

/**
 * Références href/src de index.html à publier, repérées par parse5 :
 * [{ nom, chemin, debut, fin }] (positions de l'attribut entier dans le
 * source). Refuse explicitement les formes non prises en charge.
 */
function referencesHtml(html) {
  const references = [];
  const visiter = (noeud) => {
    const attributs = Object.fromEntries((noeud.attrs ?? []).map(({ name, value }) => [name, value]));
    if (noeud.tagName === "base") throw new Error("index.html : balise <base> non prise en charge (change la résolution des chemins).");
    if ("srcset" in attributs) throw new Error("index.html : srcset non pris en charge par le build.");
    if ("style" in attributs) verifierCss(attributs.style, "index.html (attribut style)");
    if (noeud.tagName === "style") verifierCss(noeud.childNodes.map((t) => t.value ?? "").join(""), "index.html (<style>)");
    const type = (attributs.type ?? "").trim().toLowerCase();
    if (noeud.tagName === "script" && type === "importmap") throw new Error("index.html : importmap non pris en charge (change la résolution des imports).");
    if (noeud.tagName === "script" && !("src" in attributs)) {
      if (type === "module") throw new Error("index.html : script module en ligne non pris en charge (utiliser src=).");
      if (SCRIPT_CLASSIQUE.test(type)) refuserImportEnLigne(noeud.childNodes.map((t) => t.value ?? "").join(""), "script en ligne");
    }
    for (const [nom, valeur] of Object.entries(attributs)) {
      if (nom.startsWith("on")) refuserImportEnLigne(valeur, `gestionnaire ${nom}`);
    }
    for (const nom of ["href", "src"]) {
      if (!(nom in attributs)) continue;
      if (/^\s*javascript:/i.test(attributs[nom])) refuserImportEnLigne(attributs[nom].replace(/^\s*javascript:/i, ""), "lien javascript:");
      const chemin = referenceHtml(attributs[nom]);
      if (chemin) {
        const { startOffset: debut, endOffset: fin } = noeud.sourceCodeLocation.attrs[nom];
        references.push({ nom, chemin, debut, fin });
      }
    }
    for (const enfant of noeud.childNodes ?? []) visiter(enfant);
    if (noeud.content) visiter(noeud.content); // <template>
  };
  visiter(analyserHtml(html, { sourceCodeLocationInfo: true }));
  return references;
}

/**
 * Référence locale de index.html à publier (CSS/JS/MJS relatif), `null` si
 * elle reste telle quelle (ancre, URL externe) ; erreur sinon.
 */
function referenceHtml(valeur) {
  if (valeur === "" || valeur.startsWith("#") || AVEC_SCHEMA.test(valeur)) return null; // ancre ou URL externe
  if (valeur.startsWith("/")) throw new Error(`index.html : chemin absolu « ${valeur} » non pris en charge (incompatible avec ${BASE_PAGES}).`);
  if (!/\.(css|m?js)$/.test(valeur)) throw new Error(`index.html : ressource « ${valeur} » non prise en charge par le build (CSS, JS ou MJS uniquement).`);
  return posix.normalize(valeur);
}

/**
 * Imports d'un module, repérés par es-module-lexer. Renvoie
 * [{ debut, fin, specifiant, dynamique }] pour les imports relatifs ;
 * ignore les URL complètes ; erreur explicite pour le reste.
 */
function importsRelatifs(code, chemin) {
  let imports;
  try {
    [imports] = parse(code, chemin);
  } catch (erreur) {
    throw new Error(`${chemin} : syntaxe JavaScript non analysable (${erreur.message}).`);
  }
  const relatifs = [];
  for (const { n: specifiant, s: debut, e: fin, d, a } of imports) {
    const ligne = code.slice(0, debut).split("\n").length;
    const ou = `${chemin}:${ligne}`;
    if (d === -2) throw new Error(`${ou} : import.meta non pris en charge (référence non hachée).`);
    if (specifiant === undefined) throw new Error(`${ou} : import dynamique non littéral non pris en charge.`);
    if (a > -1) throw new Error(`${ou} : attributs d'import (with/assert) non pris en charge.`);
    if (AVEC_SCHEMA.test(specifiant)) continue; // URL complète : publiée telle quelle
    if (!specifiant.startsWith("./") && !specifiant.startsWith("../")) {
      throw new Error(`${ou} : import « ${specifiant} » non pris en charge (relatif « ./ » ou « ../ » uniquement).`);
    }
    if (!MODULE.test(specifiant)) throw new Error(`${ou} : import « ${specifiant} » non pris en charge (.js ou .mjs uniquement).`);
    relatifs.push({ debut, fin, specifiant, dynamique: d > -1 });
  }
  return relatifs;
}

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
  const destination = resolve(sortie);
  const construction = `${destination}.construction`; // renommé en `destination` après vérification
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

    if (MODULE.test(cheminRelatif)) {
      const dossier = posix.dirname(cheminRelatif);
      const imports = importsRelatifs(contenu, cheminRelatif);
      // Réécriture de la fin vers le début : les positions restent valides.
      for (const imp of imports) {
        imp.cible = await traiter(posix.normalize(posix.join(dossier, imp.specifiant)), cheminRelatif);
      }
      for (const { debut, fin, dynamique, cible } of imports.reverse()) {
        let rel = posix.relative(dossier, cible);
        if (!rel.startsWith(".")) rel = `./${rel}`;
        contenu = contenu.slice(0, debut) + (dynamique ? JSON.stringify(rel) : rel) + contenu.slice(fin);
      }
    } else {
      // Garde-fou : ces références ne sont pas réécrites ; échouer plutôt
      // que publier une ressource dont le cache ne serait pas invalidé.
      verifierCss(contenu, cheminRelatif);
    }

    const cheminHache = nomHache(cheminRelatif, hash(contenu));
    await mkdir(dirname(join(construction, cheminHache)), { recursive: true });
    await writeFile(join(construction, cheminHache), contenu);
    enCours.delete(cheminRelatif);
    manifeste.set(cheminRelatif, cheminHache);
    return cheminHache;
  }

  await init;
  await rm(destination, { recursive: true, force: true });
  await rm(construction, { recursive: true, force: true });
  await mkdir(construction, { recursive: true });

  try {
    let html = await readFile(join(racine, "index.html"), "utf8");
    const references = referencesHtml(html);
    for (const ref of references) ref.cible = await traiter(ref.chemin, "index.html");
    // Seul l'attribut concerné est réécrit, de la fin vers le début.
    for (const { nom, cible, debut, fin } of references.reverse()) {
      html = `${html.slice(0, debut)}${nom}="${cible.replaceAll("&", "&amp;").replaceAll('"', "&quot;")}"${html.slice(fin)}`;
    }
    await writeFile(join(construction, "index.html"), html);
    await verifier(construction);
    await rename(construction, destination);
  } catch (erreur) {
    await rm(construction, { recursive: true, force: true });
    throw erreur;
  }

  return Object.fromEntries(manifeste);
}

/**
 * Contrôle d'un site construit : chaque référence de index.html et chaque
 * import des modules publiés pointe vers un fichier présent, et reste sous
 * BASE_PAGES une fois résolu depuis la page. Renvoie la liste des fichiers
 * atteints depuis index.html ; erreur au premier défaut.
 */
export async function verifier(dossier) {
  await init;
  const page = new URL(`https://pages.invalid${BASE_PAGES}index.html`);
  const atteints = new Set(["index.html"]);
  const aVisiter = [];
  const exiger = (reference, depuis) => {
    const url = new URL(reference, new URL(depuis, page));
    if (url.origin !== page.origin || !url.pathname.startsWith(BASE_PAGES)) throw new Error(`Vérification : ${depuis} → ${reference} sort de ${BASE_PAGES}.`);
    const chemin = decodeURIComponent(url.pathname.slice(BASE_PAGES.length));
    if (!atteints.has(chemin)) {
      atteints.add(chemin);
      aVisiter.push(chemin);
    }
  };
  const html = await readFile(join(dossier, "index.html"), "utf8");
  for (const { chemin } of referencesHtml(html)) exiger(chemin, "index.html");
  while (aVisiter.length) {
    const chemin = aVisiter.pop();
    let contenu;
    try {
      contenu = await readFile(join(dossier, chemin), "utf8");
    } catch {
      throw new Error(`Vérification : ${chemin} référencé mais absent du site construit.`);
    }
    if (MODULE.test(chemin)) for (const { specifiant } of importsRelatifs(contenu, chemin)) exiger(specifiant, chemin);
    else verifierCss(contenu, chemin);
  }
  return [...atteints].sort();
}

/** Liste récursive des fichiers d'un dossier (chemins posix relatifs). */
export async function fichiers(dossier) {
  const entrees = await readdir(dossier, { recursive: true, withFileTypes: true });
  return entrees.filter((e) => e.isFile()).map((e) => versPosix(relative(dossier, join(e.parentPath ?? e.path, e.name)))).sort();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [source, sortie] = process.argv.slice(2);
  const destination = sortie ? resolve(sortie) : join(RACINE_DEPOT, "dist");
  const manifeste = await construire(source ? resolve(source) : RACINE_DEPOT, destination);
  for (const [original, hache] of Object.entries(manifeste)) console.log(`${original} → ${hache}`);
  console.log(`Site construit dans ${versPosix(relative(process.cwd(), destination)) || "."}`);
}
