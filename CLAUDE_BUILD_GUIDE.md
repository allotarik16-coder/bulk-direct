# 🚀 Bulk Direct - Build Guide with Claude Code

## 📱 Project Overview

**Bulk Direct** est une marketplace B2B premium avec 3 composantes principales :

### 1. 📱 Application Web (`apps/web/`)
- **Tech**: Next.js 14 + React 18
- **Purpose**: Application métier pour les acheteurs/vendeurs
- **Features**: Dashboard, marketplace, transactions

### 2. 📲 Application Mobile (`apps/mobile/`)
- **Tech**: React Native + Expo
- **Purpose**: App mobile pour accès sur le terrain
- **Features**: Navigation, notifications, gestion d'accès

### 3. 🎨 Landing Page (`landing/`)
- **Tech**: Astro
- **Purpose**: Page de promotion & conversions
- **Features**: SEO-friendly, fast, convertissante

### 4. 🌐 Website (`web/`)
- **Tech**: Docusaurus
- **Purpose**: Documentation & ressources
- **Features**: Blog, guides, API docs

---

## 💻 Installation (sur votre ordinateur)

### Étape 1: Cloner & Setup
```bash
cd ~/bulk-direct
npm install
```

### Étape 2: Ajouter Claude Code MCP
```bash
# Option A: Via CLI Claude Code
claude mcp add ruflo -- npx ruflo@latest mcp start

# Option B: Manuel dans .claude/settings.json (déjà fait)
```

### Étape 3: Vérifier la connexion
```bash
claude mcp list
# Vous devriez voir ruflo "connected"
```

---

## 🎯 Commandes Rapides

### Démarrer tout en développement
```bash
npm run dev
```

### Builder tout
```bash
npm run build
```

### Tester qualité du code
```bash
npm run lint
npm run type-check
```

---

## 🤖 Utiliser Ruflo pour Automatiser

### 1. Builder Complet
```bash
npx ruflo@latest swarm "Build and test all apps: web, mobile, landing page. Ensure all tests pass and no TypeScript errors." \
  --topology hierarchical \
  --max-agents 6
```

### 2. Développer une Feature
```bash
npx ruflo@latest swarm "Implement user authentication across all apps (web, mobile). Use OAuth2, secure tokens, same session management." \
  --topology hierarchical \
  --max-agents 8
```

### 3. Refactoriser le Code
```bash
npx ruflo@latest swarm "Refactor all API calls to use a unified SDK. Extract common utilities. Test everything." \
  --topology hierarchical \
  --max-agents 6
```

### 4. Code Review
```bash
npx ruflo@latest swarm "Review all code for security, performance, and best practices. Suggest improvements." \
  --topology hierarchical \
  --max-agents 4
```

---

## 📚 Structure des Dossiers

```
bulk-direct/
├── apps/
│   ├── web/                 # Next.js app
│   │   ├── src/
│   │   ├── public/
│   │   └── package.json
│   └── mobile/              # React Native
│       ├── src/
│       ├── app.json
│       └── package.json
├── landing/                 # Astro landing
│   ├── src/
│   ├── public/
│   └── package.json
├── web/                     # Docusaurus site
│   ├── src/
│   ├── docs/
│   └── package.json
├── .claude/
│   ├── settings.json        # Configuration Claude Code
│   └── README.md
├── package.json             # Root workspace
└── README.md
```

---

## 🔧 Configuration Claude Code

Voir `.claude/settings.json` pour:
- Plugins installés
- MCP servers connectés
- Hooks automatisés
- Allowlist de commandes

---

## 🎓 Prochaines Étapes

1. **Sur votre ordi**: `npm install`
2. **Ajouter ruflo MCP**
3. **Lancer**: `npm run dev`
4. **Tester un swarm** pour voir la magie ✨

Prêt à coder ! 🚀
