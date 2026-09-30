# undrwrldcub platform -- Claude instructions

The shared baseline for every undrwrldcub.com site (each site is its own repo). Read `README.md` first.

- `baseline.json` -- rules every site follows (Node, Astro major, host, build, config, allowed deps, files)
- `@undrwrldcub/brand` (this repo's root package) -- fonts, tokens, base CSS, `BrandHead`, `BrandMark`, icon kit
- `scripts/check-drift.mjs` + `.github/workflows/drift-check.yml` -- CI drift check used by every site
- `.github/workflows/lock-sync.yml` -- regenerates site lockfiles on PRs
- `.github/workflows/release.yml` -- tags `vX.Y.Z` when `version` changes on main
- `default.json` -- Renovate preset; `template/` -- starting point for a new hobby site

## Commands
```
npm ci
node scripts/check-drift.mjs --site ../undrwrldcub-site --platform .
node scripts/check-drift.mjs --site ../wow-forever-wiki --platform .
```

## Rules
- A change here reaches sites only through a release: bump `version` in `package.json` and `baseline.json`
  and the pin in `template/package.json`, push to main; Release tags it; then bump each site's pin
  (`github:Kairzen/undrwrldcub-platform#vX.Y.Z`) and let the drift check show what the site must change.
- Sites: undrwrldcub-site (Worker `undrwrldcub-home`), wow-forever-wiki (Worker `forever-wiki`).
- Deviations live in each site's `platform.json`; when two or more sites want the same thing, promote it here.
- Keep `template/` passing the newest baseline, including its `CLAUDE.md` and `.vscode/`.
- Free tiers only; never commit secrets.
- Commit as Wes Sanford <undrwrldcub@gmail.com> (set in this clone's git config).
