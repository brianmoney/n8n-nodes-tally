---
applyTo: '**'
---
# Using @n8n/node-cli in this repo

This repository is already set up with @n8n/node-cli for local development, hot‑reload, linting, building, and releasing.

## Prerequisites

- Node.js >= 20.19 (use the provided `.nvmrc`)
- pnpm (via corepack)

Install dependencies:

```bash
pnpm install
```

## Run n8n dev with hot reload

Start the local n8n instance with this node linked and watch for changes:

```bash
pnpm dev
```

What happens:
- TypeScript builds in watch mode
- n8n starts on http://localhost:5678
- Editing files under `src/` triggers rebuild and live reload in n8n

## Using an external n8n instance

If you want to run n8n yourself (e.g., Docker/remote) and only watch/build here:

```bash
pnpm exec n8n-node dev --external-n8n
```

Then, in your n8n environment, set:

```bash
export N8N_DEV_RELOAD=true
```

## Build, lint, release

Build distributable (outputs to `dist/` and updates the manifest paths):

```bash
pnpm build
```

Lint and autofix:

```bash
pnpm lint
pnpm lint:fix
```

Cut a release (uses release‑it configuration from the CLI):

```bash
pnpm run release
```

## Troubleshooting

- Dev seems to “freeze” after TypeScript watch starts:
  - Ensure n8n is actually starting; look for n8n logs after the build line
  - Check that the `@n8n/node-cli` package is installed and scripts point to `n8n-node`
  - Verify `node -v` (>= 20.19) and `pnpm -v` match the versions in `package.json#packageManager`
  - If running with `--external-n8n`, set `N8N_DEV_RELOAD=true` in the n8n environment
  - Remove stale data in `~/.n8n-node-cli/` if needed and retry

If issues persist, run with verbose logs and share output:

```bash
DEBUG=* pnpm dev
```
