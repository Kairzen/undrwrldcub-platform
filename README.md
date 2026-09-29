# undrwrldcub platform

The shared baseline for every undrwrldcub.com site. Each site lives in its own repo; this repo keeps
them technically in step, and makes every difference a recorded decision rather than drift.

| Piece | Where | What it does |
|---|---|---|
| Baseline | `baseline.json` | The rules every site follows: Node, Astro major, host, build, config, allowed deps, required files |
| Brand package | `@undrwrldcub/brand` (this repo's root) | Fonts, design tokens, base CSS, `BrandHead`, `BrandMark`, and the icon kit synced into `public/brand/` at build |
| Drift check | `scripts/check-drift.mjs`, `.github/workflows/drift-check.yml` | Runs in every site's CI; fails on any difference not recorded in the site's `platform.json` |
| Lockfile sync | `.github/workflows/lock-sync.yml` | On a site PR, regenerates `package-lock.json` when `package.json` changed without it, and commits the result |
| Renovate preset | `default.json` | Weekly grouped dependency PRs; platform releases arrive as one PR per site |
| Site template | `template/` | Starting point for a new hobby site; always passes the newest baseline |

The baseline version **is** the brand package version. A site pins it once:
`"@undrwrldcub/brand": "github:Kairzen/undrwrldcub-platform#v1.0.0"`, and the drift check judges the
site against `baseline.json` at that tag.

## Baseline v1.0.0

- Node 22 (`.nvmrc`), Astro 5, static output to `dist/`, build script exactly `astro build`
- Host: Cloudflare Workers static assets (`wrangler.jsonc` with `assets.directory: ./dist`), per Cloudflare's guidance for new projects
- `astro.config`: `site` on undrwrldcub.com or a subdomain, `trailingSlash: 'always'`, `build.format: 'directory'`, `integrations: [brand()]`
- Dependencies: only `astro` and `@undrwrldcub/brand`; anything else is a deviation
- Required files: `.nvmrc`, `platform.json`, `renovate.json` (extends this preset), `.github/workflows/platform.yml`, `README.md`
- `.gitignore` includes `node_modules/`, `dist/`, `.astro/`, `public/brand/`; the brand kit is never committed in a site

## Recording a deviation

In the site's `platform.json`:

```json
{
  "site": "forever.undrwrldcub.com",
  "deviations": [
    { "rule": "dependency:pagefind", "why": "Full-text search over the 34-table KB", "decided": "2026-09-29" }
  ]
}
```

`rule` is the id the drift check prints (`node`, `astro`, `host`, `build-script`, `dependency:<name>`,
`astro-config:<key>`, `file:<path>`, `gitignore:<entry>`, `brand-assets`, `renovate`). `why` and `decided`
are required. A deviation that stops applying is flagged as stale so the list stays honest.

## Changing the platform

- **Change for every site**: edit here, bump `version` in `package.json` and `baseline.json` and the pin in
  `template/package.json`, push to `main`. The Release workflow tags `vX.Y.Z`; Renovate opens a PR on each
  site; the drift check on that PR shows exactly what the new baseline asks of that site.
- **Change for one site**: make it in the site and add a deviation.
- **Promote a deviation**: when two or more sites want the same thing, put it in the baseline, release,
  and delete the deviation from each site.

## Workflow files

The Claude GitHub connector cannot write files under a repo's root `.github/workflows/` (GitHub reserves that
for apps with the `workflows` permission). Workflow changes in this repo and in site repos are therefore
committed by Wes (web editor or local git); Claude prepares the exact contents. The same connector cannot
run npm, so dependency changes it makes arrive without a new lockfile; the lock-sync job fixes that on the PR.

## New site

Entirely cloud-side: GitHub, GitHub Actions and Cloudflare. No local machine is involved.

1. Wes creates the empty repo `Kairzen/<name>` on github.com (the connector cannot create repos).
2. Claude pushes `template/` (with `SITE-NAME` / `SITE-TITLE` replaced, minus the workflow file) to a branch and opens a PR.
3. Wes adds `.github/workflows/platform.yml` to that branch from the prefilled link Claude provides.
4. The lock-sync job generates `package-lock.json` on the PR; the drift check must pass; merge.
5. Cloudflare dashboard: Workers & Pages → Create → Import a repository; build `npm run build`,
   deploy `npx wrangler deploy`. The custom domain comes from `routes` in `wrangler.jsonc`.
6. Add a realm card for it on undrwrldcub.com.

## Running the check by hand (optional, any machine or sandbox)

```
git clone https://github.com/Kairzen/undrwrldcub-platform
node undrwrldcub-platform/scripts/check-drift.mjs --site path/to/site --platform undrwrldcub-platform
```
