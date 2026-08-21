# Knockturn Alley — React + FastAPI

Application de catalogue et de lecture développée avec React/Vite, FastAPI et SQLite.

## Fonctionnalités

### Catalogue et découverte

- page d'accueil avec sélection mise en avant, nouveautés, films et séries ;
- page **Explorer** avec catégories, filtres et tris ;
- recherche instantanée dans une modale après un court délai de saisie ;
- fiches détaillées avec affiche, résumé, genres, durée, saisons et épisodes ;
- interface responsive adaptée aux ordinateurs, téléphones, tablettes et téléviseurs ;
- messages de chargement aléatoires inspirés de l'univers magique de Knockturn Alley.

### Lecteur vidéo

- lecture des flux HLS (`master.m3u8` et playlists de qualité) avec détection de la variante annoncée dans le master ;
- prise en charge des variantes 720p, 1080p et des chemins contenant `/hd/` ;
- choix VF ou VO depuis les réglages du lecteur lorsque les pistes existent ;
- boutons de lecture externe en 720p, 1080p, HD ou via le master lorsque la lecture intégrée est bloquée ;
- lecteur responsive en portrait, paysage et plein écran ;
- commandes qui disparaissent automatiquement après quelques secondes d'inactivité ;
- retour automatique en plein écran lors du passage à l'épisode suivant lorsque le navigateur l'autorise ;
- réglage du délai avant le prochain épisode, globalement dans le profil ou individuellement par série ;
- animation et compte à rebours avant le passage automatique à l'épisode suivant ;
- reprise de lecture et indication du temps auquel revenir pour une lecture ouverte dans un nouvel onglet.

> Certains hébergeurs vidéo appliquent des restrictions Cloudflare différentes selon l'adresse IP ou le domaine. Un flux peut donc fonctionner directement en local ou dans un nouvel onglet tout en étant refusé depuis un serveur public.

### Comptes et profils

- inscription et connexion sécurisées par mot de passe ;
- accès au site sur invitation ;
- création automatique d'un premier profil lorsqu'un nouveau compte n'en possède pas ;
- écran « Qui regarde ? » avec plusieurs profils par compte ;
- sélection et modification d'avatars illustrés ;
- langue de lecture préférée enregistrée par profil ;
- délai par défaut du prochain épisode enregistré par profil ;
- sessions conservées localement et vérifiées régulièrement auprès de l'API.

### Historique et progression

- sauvegarde de la position, de la durée et de l'état de chaque film ou épisode ;
- reprise au dernier temps enregistré ;
- historique présenté dans une modale avec barre de progression ;
- distinction entre films terminés, épisodes terminés et épisodes en cours ;
- épisode marqué comme terminé lors d'un passage automatique au suivant ;
- accès rapide au dernier épisode regardé d'une série.

### Amis et recommandations

- recherche d'un membre par adresse email ou pseudonyme ;
- demandes d'amis avec acceptation ou refus ;
- suppression d'un ami ;
- recommandation d'un film ou d'une série à un ami ;
- liste des recommandations reçues ;
- autorisation facultative permettant à un ami de consulter l'historique ;
- historique privé par défaut.

### Invitations et superadministration

- page d'accès protégée permettant de demander une invitation ;
- notification de l'administrateur par email lors d'une nouvelle demande ;
- validation ou refus des demandes d'accès ;
- création de codes d'invitation avec destinataire facultatif, durée de validité et nombre d'utilisations ;
- envoi du code d'invitation par email via SMTP ;
- inscriptions directes à l'aide d'un code valide ;
- liste des membres et possibilité de bloquer ou débloquer un compte ;
- tableau de bord avec nombre de membres, utilisateurs actifs et temps de visionnage ;
- statistiques par membre : films et épisodes terminés, épisodes en cours, séries suivies et filleuls ;
- suivi du parrain ayant invité chaque membre.

### Architecture

- frontend React construit avec Vite ;
- API REST FastAPI ;
- base SQLite créée et migrée automatiquement au démarrage ;
- authentification par jeton signé ;
- configuration locale et production par variables d'environnement ;
- déploiement léger sans Docker compatible avec Nginx, systemd et GitHub Actions.

## Prérequis

- Git
- Python 3.11 ou plus récent
- Node.js 20 ou plus récent
- npm

Sous Windows, vérifiez les installations avec :

```powershell
py --version
node --version
npm --version
```

## 1. Récupérer le projet

```bash
git clone https://github.com/leo-vincent5/alocine.git
cd alocine
```

## 2. Configurer et lancer le backend

### Windows PowerShell

```powershell
cd backend
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8091
```

Si PowerShell interdit l'activation du venv, lancez Python directement :

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8091
```

### Linux/macOS

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8091
```

L'API est ensuite disponible sur :

- API : http://localhost:8091
- documentation interactive : http://localhost:8091/docs
- test de santé : http://localhost:8091/api/health

## 3. Variables du backend

Modifiez `backend/.env` avec vos propres valeurs :

```dotenv
PURSTREAM_URL=https://api.purstream.store/api/v1/catalog/movies
UPSTREAM_TIMEOUT=20

CORS_ORIGINS=http://localhost:5173
PUBLIC_URL=http://localhost:5173
DATABASE_PATH=alocine.db

AUTH_SECRET=remplacez-par-une-longue-valeur-aleatoire
INVITE_ONLY=true
SUPERADMIN_EMAIL=admin@example.com

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=adresse@gmail.com
SMTP_PASSWORD=mot-de-passe-application-google
SMTP_FROM="Knockturn Alley <adresse@gmail.com>"
SMTP_STARTTLS=true
SMTP_SSL=false
ADMIN_NOTIFICATION_EMAIL=admin@example.com
```

Rôle des variables principales :

- `AUTH_SECRET` signe les sessions. Utilisez une valeur longue et secrète.
- `INVITE_ONLY=true` bloque les inscriptions sans code d'invitation.
- `SUPERADMIN_EMAIL` désigne le compte ayant accès au panneau superadmin.
- `ADMIN_NOTIFICATION_EMAIL` reçoit les nouvelles demandes d'accès.
- `CORS_ORIGINS` contient les frontends autorisés, séparés par des virgules.
- `DATABASE_PATH` définit l'emplacement de la base SQLite locale.

Pour générer un secret :

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Ne commitez jamais le fichier `.env`. Seul `.env.example` doit rester dans Git.

## 4. Configurer Gmail SMTP

Le mot de passe Gmail habituel ne fonctionne pas avec SMTP. Il faut :

1. Activer la validation en deux étapes sur le compte Google.
2. Dans les paramètres du compte Google, rechercher **Mots de passe des applications**.
3. Créer un mot de passe d'application pour Knockturn Alley.
4. Copier ses 16 caractères dans `SMTP_PASSWORD`.

Google affiche parfois ce mot de passe en quatre groupes. Vous pouvez retirer les espaces ; le backend accepte également la valeur avec les espaces.

Configuration Gmail recommandée : port `587`, `SMTP_STARTTLS=true` et `SMTP_SSL=false`.

Après une modification du `.env`, redémarrez toujours le backend.

## 5. Créer le premier superadmin

1. Choisissez votre adresse dans `SUPERADMIN_EMAIL`.
2. Démarrez ou redémarrez le backend.
3. Depuis l'application, ouvrez la connexion puis l'inscription.
4. Inscrivez-vous avec **exactement la même adresse email**.

Le premier superadmin n'a pas besoin de code d'invitation. Si le compte existait déjà, le redémarrage du backend lui attribue automatiquement les droits lorsque son email correspond à `SUPERADMIN_EMAIL`.

Le mot de passe du superadmin est celui choisi dans le formulaire d'inscription : il n'existe pas de mot de passe administrateur prédéfini dans le `.env`.

## 6. Configurer et lancer le frontend

Ouvrez un second terminal depuis la racine du projet.

### Windows PowerShell

```powershell
cd frontend
Copy-Item .env.example .env
npm install
npm run dev
```

Si PowerShell bloque `npm.ps1`, utilisez :

```powershell
npm.cmd install
npm.cmd run dev
```

### Linux/macOS

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Le fichier `frontend/.env` doit contenir :

```dotenv
VITE_API_URL=http://localhost:8091
VITE_HLS_PROXY_URL=
```

Ouvrez ensuite http://localhost:5173.

## 7. Mettre le projet à jour

```bash
git pull origin main
```

Si les dépendances ont changé :

```bash
cd backend
python -m pip install -r requirements.txt

cd ../frontend
npm install
```

Redémarrez ensuite le backend et le frontend.

## Dépannage rapide

- `python3` est introuvable sous Windows : utilisez `py -3` ou `python`.
- `source` est introuvable sous PowerShell : utilisez `.\.venv\Scripts\Activate.ps1`.
- erreur CORS : vérifiez que `CORS_ORIGINS` contient exactement `http://localhost:5173`.
- les emails ne partent pas : vérifiez le mot de passe d'application Google et redémarrez FastAPI.
- erreur `502` sur le catalogue : vérifiez `PURSTREAM_URL` et l'accès au service distant.
- pour réinitialiser la base locale, arrêtez le backend et supprimez `backend/alocine.db` uniquement si vous acceptez de perdre les comptes et historiques locaux.

## Déploiement sans Docker

En production, servez `frontend/dist` avec Nginx et exécutez FastAPI avec un service systemd. Configurez notamment :

```dotenv
CORS_ORIGINS=https://alocine.example.com
PUBLIC_URL=https://alocine.example.com
```

Le frontend doit être construit avec l'URL publique de l'API dans `VITE_API_URL` :

```bash
cd frontend
npm ci
npm run build
```
