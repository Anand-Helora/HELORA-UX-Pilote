# Référentiel UX/UI — template multi-IA

Ce document est un **point de départ modifiable**, non une charte graphique officielle. Il est destiné aux petites applications web HTML/CSS/JavaScript créées à partir de ce modèle. Les demandes fonctionnelles, les contraintes métier et les décisions humaines priment.

## 1. Brief à renseigner pour chaque application

Avant le développement, consigner dans l'Issue (voir `.github/ISSUE_TEMPLATE/fonctionnalite-ux.md`) :
- **Public et contexte** : technicien sur chantier, gestionnaire sur bureau, utilisateur occasionnel, etc. (sans données personnelles).
- **Support principal** : mobile tactile, tablette, PC ; usage hors réseau, gants, luminosité forte, etc., si pertinent.
- **Tâche principale** : ce que l'utilisateur doit réussir avec le minimum d'étapes.
- **Écrans et données** : entrées, sorties, parcours nominal, cas d'erreur et état vide.
- **Identité graphique** : profil « HELORA web » ci-dessous, variante explicitement approuvée ou identité propre au projet.
- **Critères de réussite** : observables et testables, sans inventer des exigences non demandées.

Si une information manque, le designer peut proposer une **hypothèse explicite**, mais ne la transforme pas en décision métier.

## 2. Profil visuel de départ « HELORA web » (à valider par le projet)

| Usage | Proposition initiale |
| --- | --- |
| Primaire / navigation | `#044550` (vert profond) |
| Accent / éléments secondaires | `#009E99` (turquoise) |
| Fond de mise en évidence | `#E6F5F5` |
| Texte et fonds neutres | Couleurs neutres à définir selon le contraste réel |
| Typographie | Police système lisible ; ne pas imposer une police externe |
| Ton éditorial | Français clair, libellés explicites, termes métier compréhensibles |

Ces couleurs sont des **préférences initiales proposées**, pas une certification de conformité ni une preuve d'identité officielle. Vérifier les contrastes sur les vraies combinaisons : le turquoise `#009E99` ne doit pas servir par défaut de texte fin sur fond blanc. Prévoir les états hover/focus/disabled/error sans dépendre de la couleur seule. Ne jamais déduire du nom HELORA que toutes les applications doivent avoir la même ergonomie.

**Profils d'usage** :
- **Terrain / mobile** : actions primaires larges, saisie limitée, confirmation après scan ou modification, erreurs récupérables, accès rapide aux tâches fréquentes.
- **Bureau / desktop** : filtres et tableaux lisibles, recherche, navigation clavier, actions groupées explicites avec confirmation si destructives.
- **ARIA / interfaces spécialisées** : identité à préciser dans le brief, sans copier automatiquement la palette du profil HELORA.
- **Revit / AutoCAD / DLL** : le présent template est web ; s'inspirer des principes UX, mais utiliser les conventions du logiciel hôte et des contrôles natifs. Ne pas appliquer un style CSS à une interface native.

## 3. Principes ergonomiques à vérifier

1. **Priorité au parcours** : une action principale évidente par écran ; navigation cohérente, retour et annulation prévisibles.
2. **Lisibilité** : hiérarchie titre/contenu/action, libellés persistants, unités et formats explicites, pas d'information essentielle cachée derrière une icône seule.
3. **Accessibilité** : viser WCAG 2.2 niveau AA lorsque applicable ; clavier, focus visible, noms accessibles, contrastes mesurés, erreurs identifiables. Sur mobile, préférer des cibles tactiles d'environ 44–48 px quand l'espace le permet.
4. **États complets** : initial, chargement, vide, succès, échec, hors connexion si concerné ; blocage et solution visibles.
5. **Prévention des erreurs** : validation pertinente, conservation de la saisie après erreur, confirmation pour opérations sensibles, aucune suppression silencieuse.
6. **Responsive** : définir le viewport principal puis vérifier au minimum un format étroit et un format desktop si l'application cible les deux.
7. **Cohérence** : mêmes intitulés, composants, espacements et conventions partout ; éviter les animations gratuites, les dépendances externes et la complexité visuelle superflue.
8. **Sobriété technique** : pas de framework, package, police distante ou librairie ajoutée sans justification et accord sur le coût de maintenance.

## 4. Intervention du designer — deux points de contrôle

### A. Avant d'écrire le code (conception)

Lire l'Issue, le brief et ce référentiel. Produire :
- le **parcours cible** en quelques étapes, les écrans et leurs états ;
- une **proposition d'interface** (schéma textuel ou wireframe si possible), avec composants clés ;
- **une alternative** argumentée et les compromis ;
- une liste des risques et questions qui changeraient réellement le besoin ;
- des **critères d'acceptation UX** concrets à intégrer à l'Issue.

L'agent est autorisé à challenger et simplifier l'interface, **pas** à inventer ou modifier des règles métier. Les grandes décisions de design doivent être validées par l'humain avant de devenir contraignantes.

### B. Après développement, avant fusion (revue)

Comparer l'implémentation au brief et aux critères UX. Examiner, quand disponibles :
- captures d'écran du **rendu réel** (mobile et bureau) et éventuellement états vides/erreurs ;
- parcours testé au clavier et au tactile/souris ;
- ergonomie, contraste, lisibilité, cohérence et messages.

La revue produit des remarques triées : **bloquant**, **important**, **suggestion**, avec observation, impact, correction recommandée et façon de vérifier. Ne jamais conclure « validé visuellement » si aucun rendu réel n'a été examiné.

**Important** : une capture ou un test Playwright n'est pas fourni par ce dépôt de base. Le projet cible doit disposer d'une page testable et ajouter ses tests navigateur si utiles. Le contrôle de code seul ne remplace pas l'essai humain.

## 5. Rapport attendu dans la Pull Request

- Proposition UX retenue, alternative étudiée et arbitrages.
- Écrans et états effectivement livrés.
- Vérifications effectuées (tests, navigateurs, tailles d'écran, accessibilité) **ou** clairement non effectuées.
- Liens vers captures/artefacts si disponibles, avec uniquement des données fictives.
- Écarts restants, limites et améliorations proposées pour une prochaine Issue.

Aucun contrôle UX ne doit fusionner automatiquement une PR, déclencher des corrections sans garde-fous ou contourner la revue Codex et la validation humaine.

## 6. Confidentialité

Ne jamais placer dans les Issues, captures, exemples, prompts ou artefacts des informations patient, des plans réels, des identifiants internes, des adresses d'infrastructure ou des secrets. Utiliser des maquettes et données entièrement fictives.
