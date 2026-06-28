# 🚀 Bulk Direct

**Premium B2B Marketplace** using Taste-Skill framework

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)]()
[![License](https://img.shields.io/badge/license-MIT-blue)]()

## 📋 Project Structure

This is a monorepo containing multiple apps and services:

```
bulk-direct/
├── apps/
│   ├── web/         📱 Next.js web application
│   └── mobile/      📲 React Native mobile app
├── landing/         🎨 Astro landing page
├── web/             🌐 Marketing website (Docusaurus)
└── .claude/         🤖 Claude Code configuration
```

## 🎯 What's Included

| Package | Tech | Purpose |
|---------|------|---------|
| `apps/web` | Next.js 14 | Main web application for B2B marketplace |
| `apps/mobile` | React Native | Mobile app for iOS/Android |
| `landing` | Astro | Fast, SEO-friendly landing page |
| `web` | Docusaurus | Documentation & marketing site |

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation
```bash
# Clone and install
git clone <repo>
cd bulk-direct
npm install

# Start development
npm run dev

# Build all
npm run build
```

## 🛠️ Development

### Commands
```bash
npm run dev          # Start all services
npm run build        # Build all packages
npm run test         # Run tests
npm run lint         # Lint code
npm run type-check   # TypeScript check
npm run format       # Format code
```

### Per-app Development
```bash
cd apps/web && npm run dev      # Web app only
cd apps/mobile && npm run dev   # Mobile app only
cd landing && npm run dev       # Landing only
cd web && npm run dev           # Docs only
```

## 🤖 Claude Code Integration

This project is optimized for **Claude Code** with:

- ✅ Plugin: `jeremylongshore/claude-code-plugins-plus-skills`
- ✅ MCP Server: `ruflo` (Claude Flow)
- ✅ Automated workflows & swarms
- ✅ Pre-configured settings

### Setup Claude Code
```bash
# Add ruflo MCP server
claude mcp add ruflo -- npx ruflo@latest mcp start

# Verify connection
claude mcp list
```

### Use Ruflo Swarms
```bash
# Build all
npx ruflo@latest swarm "build all apps" --topology hierarchical --max-agents 4

# Develop features
npx ruflo@latest swarm "implement marketplace feature" --topology hierarchical --max-agents 6

# Code review
npx ruflo@latest swarm "review code quality" --topology hierarchical --max-agents 4
```

📖 **See [CLAUDE_BUILD_GUIDE.md](./CLAUDE_BUILD_GUIDE.md) for full Claude Code setup**

## 📦 Workspaces

- `@bulk-direct/web` - Web application
- `@bulk-direct/mobile` - Mobile application
- `@bulk-direct/landing` - Landing page
- `@bulk-direct/site` - Marketing website

## 🧪 Testing

```bash
npm run test          # Run all tests
npm run test:watch   # Watch mode
npm run test:coverage # Coverage report
```

## 📚 Documentation

See [.claude/README.md](./.claude/README.md) and [CLAUDE_BUILD_GUIDE.md](./CLAUDE_BUILD_GUIDE.md)

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Run tests & lint
4. Commit & push
5. Create a pull request

## 📄 License

MIT
