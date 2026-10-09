# NumDocMan

## Déploiement sur Vercel

L'application nécessite une base PostgreSQL persistante en production. Le SQLite local
est réservé au développement : le système de fichiers d'une fonction Vercel est
éphémère et ne conserve pas les écritures entre les instances.

1. Créez une base PostgreSQL hébergée (par exemple Neon) et associez-la au projet Vercel.
2. Dans **Project Settings → Environment Variables**, configurez `DATABASE_URL` ou
	`POSTGRES_URL` avec l'URL de connexion PostgreSQL, pour Preview et Production.
	Les URL `postgres://` et `postgresql://` sont prises en charge.
3. Redéployez, puis vérifiez `/api/health` et testez une création suivie d'une lecture.

Sans ces variables, l'API échoue explicitement au démarrage sur Vercel au lieu de
retomber silencieusement sur une base SQLite locale non persistante.

Les fichiers téléversés utilisent actuellement le disque local. Ils ne sont donc pas
persistants sur Vercel ; configurez un stockage objet (S3 compatible) avant de compter
sur la conservation des pièces jointes en production.

## Développement local

Le backend utilise SQLite par défaut. Depuis la racine, activez l'environnement virtuel,
installez `backend/requirements.txt`, puis lancez l'application avec les scripts fournis.

Le compte superadministrateur de développement par défaut est créé par le backend ;
modifiez ses identifiants avant tout usage exposé publiquement.
