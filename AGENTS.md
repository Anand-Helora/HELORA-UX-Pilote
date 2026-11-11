# Consignes pour les agents IA (Codex, Claude Code…)

Ce fichier décrit le comportement attendu de tout agent travaillant dans ce dépôt.

## Flux de travail

- Ne jamais pousser directement sur `main`. Claude Code travaille sur une branche `claude/*` ; les autres agents utilisent une branche dédiée à la tâche.
- Toute modification passe par une pull request claire : objectif, fichiers modifiés, commandes testées, limites.
- Ne jamais fusionner une PR, ne jamais activer l'auto-merge, ne pas modifier les paramètres ni la visibilité du dépôt. La fusion est faite manuellement par un humain.
- Lancer `npm test` avant d'ouvrir ou de mettre à jour une PR. Ne jamais désactiver, masquer ou ignorer un test pour obtenir une CI verte.
- Ne pas modifier `.github/workflows/` sauf si la tâche le demande explicitement.
- Garder les changements limités à la tâche demandée ; pas de dépendance ni de configuration superflue.

## Revues

- Les commentaires des relecteurs humains sont prioritaires.
- Les retours de Codex Code Review (ou d'un autre agent) sont des signaux à vérifier dans le code : les corriger s'ils sont fondés, expliquer brièvement dans la PR s'ils ne le sont pas.

## Sécurité et confidentialité

- Le dépôt est public : n'y mettre aucun secret, jeton, clé d'API, identifiant interne ni donnée réelle (patients, personnels, établissements…). Utiliser uniquement des données fictives.
- Ne pas publier de code HELORA protégé par droits d'auteur sans autorisation explicite.
- Aucun appel à une API d'IA, aucun déploiement automatique, aucun bot de fusion.

## Tests

- Code dans `src/`, tests dans `tests/` (fichiers `*.test.js`), exécutés avec `node --test` via `npm test`.
- Aucune dépendance tierce tant qu'elle n'est pas nécessaire ; les tests navigateur (Playwright…) s'ajoutent au cas par cas.

## Conception et revue UX/UI (si interface concernée)

- Lire `docs/ux-ui-guidelines.md` et le brief de l'Issue **avant** de développer une interface, un écran ou un parcours.
- Demander une **proposition UX proactive** : parcours, écrans, états, alternative argumentée et critères d'acceptation. Faire valider les arbitrages importants par l'humain ; ne pas changer les règles métier sans accord.
- Si l'environnement Claude Code prend en charge les sous-agents de projet, déléguer la conception et la revue à `.claude/agents/ux-designer.md`. Sinon, appliquer ces mêmes règles directement ; l'existence du fichier ne garantit pas son invocation automatique.
- Après implémentation, effectuer une revue UX/UI distincte de la revue de code : vérifier les parcours, états, navigation, accessibilité et **rendu réel** lorsque disponible. Sans capture ou test navigateur : écrire explicitement « revue visuelle non effectuée ».
- Documenter les observations dans la PR (`.github/pull_request_template.md`). Les suggestions non validées restent des suggestions ; aucune fusion automatique.
