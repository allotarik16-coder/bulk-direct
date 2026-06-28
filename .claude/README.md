# Bulk Direct - Claude Code Setup

## 🎯 Project Structure

```
bulk-direct/
├── apps/
│   ├── web/         # Next.js web application
│   └── mobile/      # React Native mobile app (Expo)
├── landing/         # Astro landing page
├── web/             # Marketing website (Docusaurus)
└── .claude/         # Claude Code configuration
```

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Add ruflo MCP Server
```bash
claude mcp add ruflo -- npx ruflo@latest mcp start
```

### 3. Verify Setup
```bash
claude mcp list
# ruflo should show as "connected"
```

## 📋 Available Commands

### Development
```bash
npm run dev          # Start all services in parallel
npm run build        # Build all apps
npm run test         # Run tests
npm run lint         # Lint all code
npm run type-check   # TypeScript check
```

### Per Package
```bash
cd apps/web && npm run dev      # Run web app
cd apps/mobile && npm run dev   # Run mobile app
cd landing && npm run dev       # Run landing page
cd web && npm run dev           # Run website
```

## 🤖 Using Ruflo Swarms

### Build all apps
```bash
npx ruflo@latest swarm "build all apps and landing page, ensure quality" \
  --topology hierarchical \
  --max-agents 4
```

### Develop features
```bash
npx ruflo@latest swarm "implement marketplace feature with full stack" \
  --topology hierarchical \
  --max-agents 6
```

### Code review
```bash
npx ruflo@latest swarm "review code quality and suggest optimizations" \
  --topology hierarchical \
  --max-agents 4
```

## 📦 Workspace Structure

This is a monorepo using npm workspaces. Each package can be developed independently:

- **@bulk-direct/web** - Next.js application
- **@bulk-direct/mobile** - React Native with Expo
- **@bulk-direct/landing** - Astro landing page
- **@bulk-direct/site** - Marketing website

## 🔌 Claude Code Plugins

- `jeremylongshore/claude-code-plugins-plus-skills` - Enhanced skills and capabilities

## 📖 Next Steps

1. Run `npm install` on your machine (desktop/CLI)
2. Add ruflo MCP with the command above
3. Start development: `npm run dev`
4. Use ruflo swarms for complex tasks
