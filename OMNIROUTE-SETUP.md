# Lancer OmniRoute — correctifs nécessaires

OmniRoute (sous-module `omniroute/`, tiers : [diegosouzapw/omniroute](https://github.com/diegosouzapw/omniroute))
ne démarre pas avec un `pnpm install` seul au commit actuellement épinglé. Trois
blocages, vérifiés en local le 2026-08-28 jusqu'à obtenir `dashboard HTTP 200`.

Ces correctifs ne sont **pas** committés dans le sous-module : ce serait un
commit impossible à pousser en amont, et le pointeur du sous-module
référencerait alors un commit inexistant, cassant le repo pour tout clone.
D'où ce fichier.

## Les trois blocages

### 1. `playwright-core` non résolu depuis `open-sse/`

`open-sse` est un package du workspace pnpm à part entière. Il importe
`playwright-core` (dans `vendor/codex-chatgpt-web/`) mais ne le déclare pas :
l'installer à la racine ne suffit pas, pnpm isole les dépendances par package.

```bash
pnpm --filter @omniroute/open-sse add playwright-core
```

### 2. `remark-gfm` importé mais absent de `package.json`

Utilisé par `src/app/(dashboard)/dashboard/playground/components/MarkdownMessage.tsx`,
déclaré nulle part. Dépendance manquante en amont.

```bash
pnpm add -w remark-gfm
```

### 3. Verrou de dev laissé par un process tué

```bash
rm -rf .build/next/dev/lock
```

`distDir` vaut `.build/next` (voir `next.config.mjs`), pas `.next` — chercher le
verrou au mauvais endroit fait perdre du temps.

## Le symptôme qui induit en erreur

En dev Next, **un seul module non résolu fait tomber toutes les routes en 500**,
y compris `/api/auth/login`. Le message d'erreur affiché parle du module
manquant, mais il est enfoui dans le HTML de la page d'erreur : le `curl` de
base ne montre qu'`Internal Server Error`. Pour extraire la vraie cause :

```bash
curl -s -X POST http://127.0.0.1:20128/api/auth/login \
  -H 'Content-Type: application/json' -d '{"password":"..."}' \
  | grep -o '"message":"[^"]*"' | head -1
```

Autre piège rencontré : un serveur orphelin dont la ligne de commande est
réduite à `node` (invisible à `pkill -f next` / `pkill -f run-next`) peut garder
le port et continuer à servir des 500 avec l'ancien graphe de modules, pendant
qu'on croit tester une relance. Le retrouver par sa taille mémoire :

```bash
ps -eo pid,rss,cmd | awk '$2>500000 && $3=="node"{print $1}'
```

## Séquence complète

```bash
cd omniroute
pnpm install
pnpm --filter @omniroute/open-sse add playwright-core
pnpm add -w remark-gfm

cp .env.example .env
# Renseigner au minimum : JWT_SECRET, API_KEY_SECRET, STORAGE_ENCRYPTION_KEY
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# INITIAL_PASSWORD sert de mot de passe au dashboard.
# .env est déjà dans le .gitignore d'OmniRoute — ne jamais le committer.

pnpm dev     # → http://localhost:20128
```

Vérification :

```bash
curl -s -X POST http://localhost:20128/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"password":"<INITIAL_PASSWORD>"}' -c cookies.txt
# attendu : {"success":true}

curl -s -b cookies.txt http://localhost:20128/api/monitoring/health
# attendu : status "healthy"
```

## Ce qui reste manuel

Connecter un abonnement (Claude Code, Codex…) demande le trousseau de la
machine ou un flux OAuth navigateur — impossible depuis un conteneur sans
interface. Cela se fait depuis le dashboard, sur ta propre machine.

⚠️ OmniRoute marque lui-même ces providers `subscriptionRisk: true`
(`src/shared/constants/providers/oauth.ts`) : router des identifiants
d'abonnement par un proxy tiers sort du cadre d'usage prévu et expose le compte
à une suspension. 17 providers sont concernés, dont Claude Code, Codex et
Cursor.
