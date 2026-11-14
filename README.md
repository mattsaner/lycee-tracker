# Lycée Tracker

Suivi des notes pour les élèves du **Lycée cantonal de Porrentruy** (maturité gymnasiale, 3 ans).

👉 **https://mattsaner.github.io/lycee-tracker/**

## Fonctionnalités

- **Profil** : filière (maturité ou bilingue FR-DE), langue 2, langue 3, discipline artistique, option spécifique (OS) et option complémentaire (OC, qui peut rester « pas encore choisie » pendant la 1re année). Les règles de choix du lycée sont appliquées (incompatibilités OS/OC, langues, etc.).
- **Notes de tests** : note de 1 à 6 au dixième ou au quart de point, poids 1 par défaut et modifiable.
- **Notes composées** : plusieurs petites notes (vocabulaire, quiz…) qui forment une seule note : moyenne simple des sous-notes, arrondie au dixième, au quart ou non arrondie, puis comptée une fois avec son propre poids. Les sous-notes peuvent s'étaler sur toute l'année.
- **Moyennes** : la note de l’année est la moyenne pondérée de **tous les tests de l’année**, arrondie au demi-point (x.25 et x.75 vers le haut) ; les moyennes S1 et S2 sont indicatives. Pour les OS à plusieurs branches (biologie-chimie, physique-applications des maths), moyenne des branches pondérée par la dotation. La note annuelle réelle du bulletin peut être saisie et remplace la note calculée.
- **Note nécessaire** : la note à obtenir au prochain test pour atteindre 4, 4.5, 5…
- **Promotion** : double compensation, maximum 4 notes insuffisantes, aucune note sous 2, avec le détail des points.
- **Maturité** : notes d’école reprises de la dernière année d’enseignement de chaque discipline, saisie des examens et du travail de maturité, vérification des 4 conditions d’obtention.
- **Plusieurs années** (redoublement compris) et plusieurs profils par navigateur.

## Données et confidentialité

Pas de compte et pas de serveur : toutes les données restent dans le navigateur (`localStorage`). La page *Sauvegarde* permet d’exporter et d’importer un fichier JSON (pour changer d’appareil ou garder une copie). Un bandeau rappelle d’exporter quand des modifications n’ont pas été sauvegardées depuis un certain temps (chaque semaine par défaut ; réglable : jour, semaine, deux semaines, mois ou jamais). Ce fichier contient des notes personnelles, ne le publie pas.

## Règles appliquées

| Règle | Source |
|---|---|
| Notes semestrielles de 1 à 6 au demi-point ; disciplines à plusieurs branches pondérées par la dotation ; x.25 et x.75 arrondis vers le haut | [RSJU 412.311.1](https://rsju.jura.ch/fr/viewdocument.html?idn=20073&id=34584), art. 29 |
| Promotion sur la note de l’année (moyenne de tous les tests de l’année ; le bulletin du 1er semestre est indicatif), pour toutes les disciplines fondamentales, l’OS, l’OC et l’éducation physique | art. 14, 30 et pratique du lycée |
| Promotion : 2 × Σ(écarts sous 4) ≤ Σ(écarts au-dessus de 4), au plus 4 notes < 4, aucune note < 2 | art. 31 |
| Note d’école = moyenne de la dernière année d’enseignement ; note de maturité = moyenne école/examen arrondie au demi-point | [RSJU 412.351](https://rsju.jura.ch/fr/viewdocument.html?idn=20073&id=37948), art. 14 |
| Maturité : mêmes 3 conditions + français + langue 2 + maths + OS ≥ 16 ; EPS hors calcul | art. 8a, 16a |
| Grille horaire (dotations par année, OS BC/PM, filière bilingue) | [grille-horaire-def.pdf](https://www.lycee.ch/images/documents/grille-horaire-def.pdf) |

⚠️ Outil **non officiel**. Les textes réglementaires consultés datent de 2015-2016 ; seuls le bulletin et les décisions du lycée font foi. La répartition des branches dans les OS biologie-chimie et physique-applications des maths n’est pas publiée : elles comptent à parts égales.

Le format des données est versionné et migré automatiquement : une ancienne sauvegarde reste importable dans les versions suivantes (voir [docs/data-format.md](docs/data-format.md)).

## Mettre à jour le programme

Tout le programme (disciplines, dotations, choix, rôle à la maturité) se trouve dans [`src/data/curriculum.ts`](src/data/curriculum.ts) et les règles de choix dans [`src/domain/choices.ts`](src/domain/choices.ts). Une correction ? Ouvre une issue ou une pull request.

## Développement

```sh
npm install
npm run dev      # http://localhost:5173/lycee-tracker/
npm test         # tests des règles de calcul et de l'interface
npm run build
```

Stack : Vite, React, TypeScript, Zustand, Vitest. Déploiement automatique sur GitHub Pages à chaque push sur `main` (`.github/workflows/deploy.yml`).
