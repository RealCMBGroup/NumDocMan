# Matrice des permissions

Cette matrice décrit les contrôles actuellement appliqués par le backend. Elle a
été vérifiée dans les routes et leurs fonctions d'autorisation. Elle ne représente
pas une politique cible : lorsqu'une route ne vérifie que l'authentification, cela
est signalé explicitement au lieu de supposer une restriction par rôle.

## Rôles et portée

- **Administrateur global** : utilisateur avec `is_superadmin = true`. Il contourne
  les vérifications d'appartenance prévues pour les organisations et projets.
- **Utilisateur standard** : utilisateur avec `is_superadmin = false`. Ses droits
  dépendent parfois de son appartenance à une organisation (`OrgMember`) ou à un
  projet (`ProjectMember`). Les rôles `admin`, `manager` et `member` d'une
  organisation, ainsi que `role_code` d'un projet, ne sont pas équivalents au rôle
  d'administrateur global.
- **Authentifié** : utilisateur disposant d'une session valide. La plupart des
  routes métier requièrent une authentification, mais cela ne garantit pas à lui
  seul l'accès à une ressource précise.

## Matrice effective

| Action | Administrateur global | Utilisateur standard | Contrôle actuellement appliqué |
|---|---|---|---|
| Consulter la liste des organisations | Oui, toutes | Oui, ses organisations membres | Les organisations d'un utilisateur standard sont filtrées par appartenance. |
| Créer une organisation | Oui | Oui | Toute personne authentifiée peut créer une organisation; le créateur devient membre `admin`. |
| Consulter une organisation ou ses membres/rôles | Oui | Selon appartenance à l'organisation | L'appartenance est vérifiée. |
| Modifier une organisation | Oui | Si rôle d'organisation `admin` ou `manager` | Vérification du rôle d'organisation. |
| Créer/modifier/supprimer les définitions de rôles d'organisation | Oui | Si rôle d'organisation `admin` ou `manager` | Vérification du rôle d'organisation. |
| Consulter tous les projets | Oui | Non | L'utilisateur standard ne voit que les projets auxquels il appartient. |
| Créer un projet | Oui | Si membre de l'organisation cible | Le créateur devient membre du projet avec `role_code = admin`. |
| Modifier/supprimer un projet | Oui | Si membre du projet | La route vérifie l'appartenance au projet, mais pas le `role_code`. |
| Consulter les types de documents, workflows et règle d'identifiant d'un projet | Oui | Si membre du projet | Appartenance au projet requise. |
| Créer/modifier/supprimer les types de documents, workflows et règle d'identifiant | Oui | Si membre du projet | L'appartenance suffit; aucun contrôle distinct du rôle de projet n'est appliqué. |
| Consulter la liste des documents | Tous les projets | Documents de ses projets | La liste est filtrée par appartenance au projet pour les utilisateurs standards. |
| Créer un document | Oui | Si membre du projet cible | Appartenance au projet requise. |
| Consulter, modifier, supprimer, téléverser ou télécharger un document | Oui | Oui, pour tout document dont l'identifiant est connu | Ces routes exigent une authentification, mais ne vérifient pas l'appartenance au projet. |
| Effectuer une transition, consulter l'historique ou les signatures d'un document, ajouter une signature | Oui | Oui, pour tout document dont l'identifiant est connu | Authentification seule. Une transition vérifie l'état cible et le commentaire obligatoire, mais pas `required_roles`. |
| Ajouter un membre à une organisation | Oui | Non | Réservé à l'administrateur global. |
| Ajouter un membre à un projet et choisir son `role_code` | Oui | Oui, si membre du projet | La route vérifie l'appartenance au projet, mais pas un rôle d'administrateur. |
| Lister les utilisateurs | Tous les utilisateurs | Utilisateurs partageant au moins une de ses organisations | Résultats filtrés selon `is_superadmin` et les appartenances d'organisation. |
| Créer ou supprimer un compte utilisateur | Oui | Non | Réservé à l'administrateur global. |
| Modifier un compte utilisateur | Tous les comptes | Son propre compte | L'utilisateur peut mettre à jour son propre compte. La route accepte aussi `is_superadmin` et `is_active` dans ces modifications. |
| Consulter/créer/modifier/supprimer une configuration de stockage | Oui | Oui | Les routes exigent une authentification, sans contrôle d'appartenance à l'organisation ni de rôle. |
| Consulter les KPI | KPI de tous les projets | KPI de ses projets | Les vues `overview` et `by-project` sont filtrées par appartenance aux projets. Les configurations KPI vérifient uniquement l'authentification. |

## Limites importantes à corriger dans l'application des droits

Les points suivants sont le résultat de la validation des routes, et non des
permissions recommandées :

1. La mise à jour d'un compte autorise son propriétaire à modifier `is_superadmin`
   et `is_active`. L'attribution d'un rôle global n'est donc pas réservée au seul
   administrateur global par cette route.
2. Plusieurs opérations documentaires (lecture directe, modification, suppression,
   fichiers, transitions et signatures) n'effectuent pas de vérification
   d'appartenance au projet ou de permission métier.
3. La gestion des membres de projet autorise tout membre du projet à ajouter un
   autre membre et à fournir son `role_code`.
4. Les routes de stockage et de configuration KPI ne vérifient pas les droits sur
   l'organisation ciblée.
5. Les permissions enregistrées dans `Role.permissions` et les rôles requis par
   les transitions ne sont pas utilisés uniformément comme contrôles d'accès dans
   les routes examinées.

En conséquence, les formulations « selon droits » ou « attribution des rôles :
administrateur global uniquement » ne sont garanties que pour les routes
explicitement indiquées dans la matrice. Les contrôles doivent être renforcés côté
backend avant de considérer ces restrictions comme effectives.

## Sources vérifiées

- `backend/auth_utils.py` — authentification des routes.
- `backend/routers/admin.py` — gestion des comptes et appartenance aux organisations.
- `backend/routers/projects.py` — contrôles d'organisation, de projet, rôles et membres.
- `backend/routers/documents.py` — documents, fichiers, transitions, historique et signatures.
- `backend/routers/storage.py` — configurations de stockage.
- `backend/routers/kpi.py` — portée des KPI.
