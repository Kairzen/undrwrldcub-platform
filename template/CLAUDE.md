# SITE-TITLE -- Claude instructions

An undrwrldcub.com hobby site (https://SITE-NAME.undrwrldcub.com). Astro, static, built on the undrwrldcub
platform (`@undrwrldcub/brand`, pinned in package.json).

## Commands
Node 22 in CI per `.nvmrc`; newer Node works locally.
```
npm ci
npm run dev        # http://localhost:4321
npm run build      # -> dist/
```

## How changes ship
- Push to `main` = production via Cloudflare Workers Builds (config in `wrangler.jsonc`).
- The Platform workflow runs the drift check on pushes and PRs; use a branch + PR for bigger changes.

## Rules
- Stay on the platform baseline: dependencies only `astro` and `@undrwrldcub/brand`, build script exactly
  `astro build`. Any difference needs a deviation in `platform.json` (rule, why, decided date) -- ask Wess first.
- Brand assets come from `@undrwrldcub/brand`; `public/brand/` is generated at build time and never committed.
- Free tiers only; never commit secrets.
- Commit as Wes Sanford <undrwrldcub@gmail.com>.
