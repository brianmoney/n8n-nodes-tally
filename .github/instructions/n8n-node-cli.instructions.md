---
applyTo: '**'
---
# System Prompt: Convert `n8n-nodes-tally` to `@n8n/node-cli`

> **Role:** You are a focused engineering assistant. Migrate the repository at `https://github.com/brianmoney/n8n-nodes-tally` to use the official **n8n node CLI** with **Node.js ≥ 20.19** and **pnpm**. Keep public node/credential names and behavior stable.

---

## Hard requirements

* **Runtime:** Node.js **≥ 20.19** (enforce in `package.json#engines.node`).
* **Package manager:** **pnpm** (use `corepack`; add `packageManager: "pnpm@>=9"`).
* **CLI:** Adopt **`@n8n/node-cli`** workflow (`pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm run release`).

## Outcome (acceptance criteria)

* Repo builds and runs with `pnpm dev` (n8n at `http://localhost:5678`, node appears & hot‑reloads).
* `pnpm build` outputs a distributable with correct `n8n` manifest paths to `dist/...` files.
* No breaking changes to node display name, operations, parameters, or credentials.

---

## Migration plan (do, then commit in logical steps)

### 1) Prep & branch

```bash
# prerequisites
node -v   # must be >= v20.19
corepack enable && corepack prepare pnpm@latest --activate
pnpm -v

# clone & branch
git clone https://github.com/brianmoney/n8n-nodes-tally.git
cd n8n-nodes-tally
git switch -c feat/node-cli-migration
```

### 2) Scaffold a CLI project (in a temp folder)

> We scaffold to a temp dir, then transplant files to avoid overwriting the repo.

```bash
mkdir .cli-migrate && cd .cli-migrate
pnpm create @n8n/node@latest n8n-nodes-tally -- --template declarative/custom
cd n8n-nodes-tally
```

This generates:

```
src/
  credentials/
  nodes/
    Example/
      Example.node.ts
      Example.node.json
package.json (with n8n manifest, scripts, engines, lint)
tsconfig.json, eslint config, etc.
```

### 3) Transplant existing code

* Move **credentials** to `src/credentials/` (e.g., `TallyApi.credentials.ts`).
* Move **node** files to `src/nodes/Tally/` and rename main file to `Tally.node.ts`.
* If you have a codex JSON, rename to `Tally.node.json` (filename must match `*.node.ts`).
* Port any **icon** assets referenced by the node.

### 4) Merge package metadata

Open the scaffold’s `package.json` and apply:

* `name`: keep `n8n-nodes-tally` (or current scope).
* `version`, `description`, `author`, `license` → merge from original.
* `keywords`: include `"n8n-community-node-package"`.
* `engines.node`: `">=20.19.0"`.
* `packageManager`: `"pnpm@>=9"`.
* Ensure `n8n` manifest points to **dist** files, e.g.:

```json
"n8n": {
  "n8nNodesApiVersion": 1,
  "nodes": ["dist/nodes/Tally/Tally.node.js"],
  "credentials": ["dist/credentials/TallyApi.credentials.js"]
}
```

> Keep the scaffold’s scripts: `dev`, `build`, `lint`, `lint:fix`, `release` (they call `n8n-node`).

### 5) TypeScript & lint

* Retain scaffold `tsconfig.json` and ESLint config; fix imports/types to compile cleanly.
* Run:

```bash
pnpm lint && pnpm lint:fix || true
```

### 6) Wire up HTTP helpers (if used)

* Replace any legacy helpers with the CLI scaffold’s HTTP patterns (declarative or programmatic) to match docs.

### 7) Run locally (hot reload)

```bash
pnpm dev
# visit http://localhost:5678 → add the node → verify operations & credentials
```

### 8) Build & smoke test

```bash
pnpm build
# Validate dist paths match package.json n8n manifest
```

### 9) Release plumbing (optional now)

* Keep the scaffold’s `release-it` setup.
* Tag and publish when ready:

```bash
pnpm run release
```

### 10) Move migrated project back into repo

From `.cli-migrate/n8n-nodes-tally/`, copy all files over the original repo root, excluding `.git`.

```bash
rsync -a --exclude .git ./ ../..   # from inside scaffold folder
cd ../.. && rm -rf .cli-migrate
```

### 11) Commit in stages

1. **chore(cli):** add @n8n/node-cli scaffold, pnpm, engines, configs
2. **refactor(src):** move node & credentials into `src/…`
3. **fix(build):** align n8n manifest dist paths & assets
4. **test(dev):** verify hot‑reload, operations, credentials

---

## Post‑migration checklist

* [ ] `node -v` ≥ 20.19 on CI and local; add `.nvmrc` with `v20.19.0`.
* [ ] `pnpm -v` available via `corepack` on CI; cache `~/.pnpm-store`.
* [ ] Node appears in n8n search; all operations/params intact.
* [ ] README updated with **pnpm** commands and local dev instructions.

---

## Commands cheat‑sheet

```bash
# dev server with hot reload
pnpm dev

# build distributable
pnpm build

# lint & autofix
pnpm lint && pnpm lint:fix

# publish (uses release-it)
pnpm run release
```

---

## Notes

* Keep node IDs, display names, and operation names stable to avoid breaking existing workflows.
* Prefer **declarative HTTP API** template unless programmatic features are required.
* If the package was previously `npm`-based, remove `package-lock.json` and commit `pnpm-lock.yaml`.
