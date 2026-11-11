# HELORA-Template-MultiIA

Modèle de dépôt léger pour les petites applications web HELORA en **HTML / CSS / JavaScript**, pensé pour une collaboration entre humains et agents IA (Claude Code, Codex).

Il fournit uniquement un socle :

- une intégration continue GitHub Actions qui lance les tests unitaires à chaque pull request vers `main` ;
- un exemple minimal de code JavaScript (`src/slugify.js`) et ses tests (`tests/slugify.test.js`), **sans dépendance tierce**, à remplacer par le code de votre application ;
- des consignes de collaboration pour les agents IA (`AGENTS.md`, `CLAUDE.md`).

Il ne contient **aucune application métier**, aucun appel à une API d'IA, aucune clé ni aucun déploiement automatique.

## Structure

```
.github/workflows/ci.yml   Tests automatiques sur les pull requests vers main
src/slugify.js             Exemple de fonction pure (à remplacer)
tests/slugify.test.js      Tests unitaires de l'exemple (node --test)
package.json               Script « npm test », aucune dépendance
AGENTS.md / CLAUDE.md      Consignes pour les agents IA
.gitignore                 Fichiers à ne pas versionner
```

## Pilote UX/UI : tableau de bord fictif des équipements (Issue #1)

Démonstration **entièrement fictive** : aucune donnée, aucun lieu ni aucune règle métier HELORA réels. La répartition en trois catégories (`en_retard`, `prioritaire`, `a_controler`, une seule par équipement) est une contrainte du test, pas une règle métier.

| Fichier | Rôle |
| --- | --- |
| `index.html` | Page unique de l'application |
| `src/donnees-fictives.js` | 13 équipements fictifs (`EQ-DEMO-001` à `013`) |
| `src/tableau-de-bord.js` | Logique pure testée : compteurs, sections, tri, routes, états simulés |
| `src/app.js` | Rendu DOM, navigation et gestion du focus |
| `src/styles.css` | Styles mobile-first, profil « HELORA web » |
| `tests/tableau-de-bord.test.js` | Tests `node --test` |
| `docs/captures/issue-1/` | Captures navigateur de la démo |

### Ouvrir l'application localement

Les modules JavaScript ne se chargent pas depuis `file://` : servir le dossier avec un serveur statique, sans rien installer dans le dépôt.

```bash
python3 -m http.server 8000
```

Puis ouvrir <http://localhost:8000/>. Avec Node.js, `npx serve .` fonctionne aussi (télécharge l'outil à la demande).

### Essayer

- Toucher un compteur pour aller à sa section : le focus passe sur le titre de la section.
- Toucher une carte pour ouvrir sa fiche (lecture seule), puis « Retour au tableau de bord » ou le bouton retour du navigateur : le focus revient sur la carte d'origine.
- États simulés : `?etat=chargement`, `?etat=vide`, `?etat=erreur` (par exemple <http://localhost:8000/?etat=erreur>). Le bouton « Réessayer » de l'état d'erreur réaffiche les données.
- Fiche inconnue : <http://localhost:8000/#/equipement/EQ-999>.

### Tri de démonstration (non métier)

Ordre stable, avec départage par identifiant croissant :

- **En retard** : échéance la plus ancienne d'abord ;
- **Prioritaires** : priorité 1 (la plus haute) à 3 ;
- **À contrôler** : échéance la plus proche d'abord.

Les catégories sont fixées dans les données ; elles ne sont jamais recalculées à partir de la date du jour.

## Lancer les tests en local

Prérequis : [Node.js](https://nodejs.org/) 20 ou plus récent (version LTS recommandée). Aucune installation de paquet n'est nécessaire.

```bash
npm test
```

Cette commande exécute `node --test`, qui découvre automatiquement les fichiers `*.test.js`. Elle renvoie un code d'erreur si un test échoue ; la CI échoue alors de la même manière.

## Créer un nouveau projet à partir de ce modèle

1. Sur la page GitHub du dépôt, cliquer sur **Use this template** → **Create a new repository**.
2. Choisir le propriétaire, le nom et la visibilité du nouveau dépôt.
3. Cloner le nouveau dépôt, puis remplacer l'exemple : supprimer `src/slugify.js` et `tests/slugify.test.js`, ajouter votre code et vos propres tests.
4. Mettre à jour `name` et `description` dans `package.json`, ainsi que ce README.

### Étapes à reconfigurer sur le dépôt cible

Les paramètres GitHub et les intégrations **ne sont pas copiés** par « Use this template ». Sur chaque nouveau dépôt, il faut :

1. **Droits d'accès de Claude Code** : autoriser l'application GitHub Claude sur le nouveau dépôt (paramètres de l'installation GitHub App, ou connexion GitHub sur claude.ai).
2. **Codex Code Review** : activer la revue automatique pour ce dépôt dans les paramètres Codex, avec le déclenchement « on every push ». Sans cela, demander la revue manuellement en commentant `@codex review` dans la PR.
3. **Règles de branches** : protéger `main` (pull request obligatoire, vérification « CI » requise, pas de push direct ni de force-push). Laisser l'auto-merge désactivé.
4. **Test pilote** : ouvrir une première petite PR (par exemple une modification du README) pour vérifier que la CI se lance et passe au vert, et que Codex publie sa revue.
5. **Auto-fix** : la correction automatique des retours de CI ou de revue par Claude Code s'active **par session**, au cas par cas ; elle n'est pas configurée dans le dépôt.
6. **Déploiement (optionnel)** : aucun déploiement n'est fourni. Si l'application doit être publiée (GitHub Pages ou autre), l'ajouter explicitement dans le dépôt cible, après relecture.

## Confidentialité et droits

Ce dépôt modèle est **public**. Le fait qu'il soit public **n'autorise pas** à y publier, ni dans les dépôts qui en sont issus :

- du code HELORA protégé par le droit d'auteur ;
- des identifiants, jetons, clés d'API ou noms de serveurs internes ;
- des données confidentielles ou réelles (patients, personnels, établissements…).

Utiliser uniquement des données fictives. Aucune licence n'est choisie pour l'instant : en l'absence de licence, le code reste soumis au droit d'auteur par défaut.

## Limites

- La CI fournie ne couvre que du **JavaScript exécuté par Node.js** (`node --test`). Elle ne teste ni le rendu HTML/CSS ni le comportement dans un navigateur : des tests navigateur (Playwright, par exemple) pourront être ajoutés au cas par cas, quand une application en aura besoin.
- Pour d'autres langages ou environnements (Python, AutoLISP, Revit/Dynamo, etc.), le workflow et les tests doivent être **adaptés** à l'outil concerné, et non réutilisés à l'aveugle. Certains environnements (AutoCAD, Revit) ne sont pas disponibles sur les machines GitHub Actions : seules les parties testables hors logiciel peuvent y être vérifiées.
- GitHub Actions consomme des minutes de calcul ; les quotas dépendent du type de compte et de la visibilité du dépôt.

## Conception UX/UI assistée par agent

Le modèle propose désormais un **rôle de designer UX/UI proactif** en plus du développement Claude Code et de la revue technique Codex :

- `docs/ux-ui-guidelines.md` : principes ergonomiques et profil visuel initial « HELORA web » (non officiel et à ajuster selon le projet) ;
- `.claude/agents/ux-designer.md` : consignes du sous-agent de projet Claude Code pour proposer des écrans, challenger les choix et relire l'interface ;
- `.github/ISSUE_TEMPLATE/fonctionnalite-ux.md` : brief métier + conception **avant développement** ;
- `.github/pull_request_template.md` : liste de vérification UX **après développement**.

**Circuit recommandé :** brainstorming → Issue avec brief et proposition UX → validation des arbitrages → développement sur PR → tests automatiques + revue Codex → revue UX sur rendu réel si disponible → fusion manuelle.

Le designer propose également une alternative et des améliorations, mais ne modifie pas le périmètre métier sans accord. Les templates GitHub ne sont pas automatiquement intégrés aux Issues créées via une API : reprendre explicitement leurs sections dans la demande. Le sous-agent n'est pas exécuté par GitHub Actions et son activation dépend de l'environnement Claude Code. Aucune API ni nouveau secret n'est ajouté.

**Limite du socle :** le dépôt ne fournit toujours pas de test navigateur ni de validation visuelle automatique. Il faut une application exécutable et, le cas échéant, des tests Playwright et des captures fictives pour effectuer une vraie revue visuelle. Ne pas confondre « code revu » et « interface observée ».
