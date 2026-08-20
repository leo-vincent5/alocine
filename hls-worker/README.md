# Relais HLS Cloudflare Worker

Ce Worker relaie uniquement `https://free.finepulfe.xyz`. Il réécrit les URL
des manifestes HLS afin que les playlists, pistes audio et segments passent par
le même relais CORS.

```bash
cd hls-worker
npm install
npx wrangler login
npm run deploy
```

Après le déploiement, copier l'URL `https://knockturn-hls.<compte>.workers.dev`
dans la variable GitHub Actions `HLS_PROXY_URL`, puis relancer le workflow de
déploiement. En local, laisser `VITE_HLS_PROXY_URL` vide conserve le lecteur
stable sans relais.
