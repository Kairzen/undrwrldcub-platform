# SITE-TITLE

Part of the undrwrldcub.com family, live at **https://SITE-NAME.undrwrldcub.com**.
Built from the [undrwrldcub platform](https://github.com/Kairzen/undrwrldcub-platform) template.

- Brand, fonts, tokens and icons come from `@undrwrldcub/brand` (pinned in `package.json`).
- `platform.json` lists every deliberate deviation from the platform baseline.
- `.github/workflows/platform.yml` runs the drift check on every push and PR.

Build: `npm ci && npm run build` → `dist/`, served by Cloudflare Workers static assets (`wrangler.jsonc`).
