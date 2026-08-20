# Alocine React + FastAPI

Migration isolée de la page Laravel `/alocine`. Aucun fichier Laravel existant n'est modifié.

## Démarrage sans Docker

API (Python 3.11+) :

```bash
cd alocine-react/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8091
```

Frontend (dans un second terminal, Node 20+) :

```bash
cd alocine-react/frontend
cp .env.example .env
npm install
npm run dev
```

- Frontend : http://localhost:5173
- API : http://localhost:8091
- Documentation API : http://localhost:8091/docs

## Déploiement VPS

1. Faire tourner FastAPI avec `uvicorn` derrière Nginx (ou avec un service systemd).
2. Placer l'URL HTTPS publique de l'API dans `frontend/.env.production` :
   `VITE_API_URL=https://api.cinema.example.com`.
3. Exécuter `npm ci && npm run build` dans `frontend`.
4. Servir le dossier statique `frontend/dist` avec Nginx.
5. Régler `CORS_ORIGINS` côté API avec le domaine exact du frontend.

## Démarrage Docker optionnel

```bash
cd alocine-react
docker compose up -d --build
```

## Arrêt

```bash
docker compose down
```

L'API expose `/api/home`, `/api/catalog` et `/api/health`. La prochaine étape de migration pourra ajouter la fiche détaillée, l'historique et l'authentification avant toute redirection de la route Laravel.
