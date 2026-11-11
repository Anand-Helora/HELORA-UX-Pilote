# Consignes pour les agents IA (Codex, Claude Code…)

Ce fichier décrit le comportement attendu de tout agent travaillant dans ce dépôt.

## Flux de travail

- Ne jamais pousser directement sur `main`. Claude Code travaille sur une branche `claude/*` ; les autres agents utilisent une branche dédiée à la tâche.
- Toute modification passe par une pull request claire : objectif, fichiers modifiés, commandes testées, limites.
- Ne jamais fusionner une PR, ne jamais activer l'auto-merge, ne pas modifier les paramètres ni la visibilité du dépôt. La fusion est faite manuellement par un humain.
- Lancer `npm test` avant d'ouvrir ou de mettre à jour une PR. Ne jamais désactiver, masquer ou ignorer un test pour obtenir une CI verte.
- Ne pas modifier `.github/workflows/` sauf si la tâche le demande explicitement.
- Garder les changements limités à la tâche demandée ; pas de dépendance ni de configuration superflue.
- Appliquer le **protocole de changement minimal** ci-dessous à chaque tâche.

## Protocole de changement minimal

Valable pour Claude Code, Codex et tout autre agent. Il ne fixe pas de nombre de lignes maximal : les tests et les modifications réellement nécessaires restent acceptés.

1. **Avant toute édition** : lire les fichiers concernés, repérer les fonctions et modules utiles, décrire la cause du problème et le plan de modification, puis lister les fichiers qu'il faut réellement toucher.
2. **Par défaut, un patch ciblé** : préserver les fonctions, imports, mise en forme, commentaires, tests, style et API des zones non concernées. Ne pas reformater un fichier entier ni remplacer tout son contenu lorsqu'une modification locale suffit.
3. **Pas d'ajout superflu** : aucune librairie, dépendance, configuration, abstraction, design system ou architecture supplémentaire pour une correction locale, sauf justification vérifiable donnée dans la PR.
4. **Refactoring** : un refactoring local n'est admis que s'il est nécessaire à la tâche et explicitement justifié. Un refactoring transversal est **proposé à part** (Issue ou commentaire, avec gains et risques) et attend l'accord humain ; il n'est jamais glissé silencieusement dans une PR de correction.
5. **Contrôle avant PR** : inspecter `git diff`, `git diff --check`, `git diff --stat` et la liste des fichiers modifiés ; retirer tout bruit hors périmètre (fichiers temporaires, captures non demandées, reformatage, changements sans rapport).
6. **Description de PR** : consigner (1) la cause ou le problème, (2) les modifications exactes par fichier, (3) la justification de chaque fichier additionnel, (4) les non-régressions et tests exécutés, (5) les risques et limites. Aucun auto-merge.
7. **Proportionnalité UX** : lorsqu'un ticket demande une retouche technique précise, ni l'agent ni le designer UX ne proposent de refonte générale ; la revue UX se limite alors à la zone modifiée.

## Revues

- Les commentaires des relecteurs humains sont prioritaires.
- Les retours de Codex Code Review (ou d'un autre agent) sont des signaux à vérifier dans le code : les corriger s'ils sont fondés, expliquer brièvement dans la PR s'ils ne le sont pas.

## Sécurité et confidentialité

- Le dépôt est public : n'y mettre aucun secret, jeton, clé d'API, identifiant interne ni donnée réelle (patients, personnels, établissements…). Utiliser uniquement des données fictives.
- Ne pas publier de code HELORA protégé par droits d'auteur sans autorisation explicite.
- Aucun appel à une API d'IA, aucun déploiement automatique, aucun bot de fusion.
- **Exception autorisée par la personne propriétaire (dépôt pilote uniquement)** : le site GitHub Pages de ce dépôt est construit et publié par `.github/workflows/pages.yml` lors d'un push sur `main`, donc **après une fusion humaine**, si `npm test` et le build réussissent (relance manuelle possible depuis `main`). Restent interdits : la fusion ou l'auto-merge par un agent, la publication d'une branche de PR, et tout déploiement automatique d'un autre dépôt ou service non approuvé.

## Tests

- Code dans `src/`, tests dans `tests/` (fichiers `*.test.js`), exécutés avec `node --test` via `npm test` (après `npm ci`, qui installe les dépendances de build verrouillées).
- Aucune dépendance tierce tant qu'elle n'est pas nécessaire ; les tests navigateur (Playwright…) s'ajoutent au cas par cas.

## Conception et revue UX/UI (si interface concernée)

- Lire `docs/ux-ui-guidelines.md` et le brief de l'Issue **avant** de développer une interface, un écran ou un parcours.
- Demander une **proposition UX proactive** : parcours, écrans, états, alternative argumentée et critères d'acceptation. Faire valider les arbitrages importants par l'humain ; ne pas changer les règles métier sans accord.
- Si l'environnement Claude Code prend en charge les sous-agents de projet, déléguer la conception et la revue à `.claude/agents/ux-designer.md`. Sinon, appliquer ces mêmes règles directement ; l'existence du fichier ne garantit pas son invocation automatique.
- Après implémentation, effectuer une revue UX/UI distincte de la revue de code : vérifier les parcours, états, navigation, accessibilité et **rendu réel** lorsque disponible. Sans capture ou test navigateur : écrire explicitement « revue visuelle non effectuée ».
- Documenter les observations dans la PR (`.github/pull_request_template.md`). Les suggestions non validées restent des suggestions ; aucune fusion automatique.
