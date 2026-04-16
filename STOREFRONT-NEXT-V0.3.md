# Storefront Next v0.3 compatibility (branding skill)

This document lists changes made so the **storefront-branding** workflow works with **Storefront Next template 0.3.x** (`@salesforce/storefront-next-runtime` / `@salesforce/storefront-next-dev` **0.3.0**). Use it to port the same updates into the upstream repository [cc-b2c-sfnext-brand-demo](https://github.com/davidsiguenza/cc-b2c-sfnext-brand-demo).

## Summary

| Area | v0.2 (original skill) | v0.3 |
|------|------------------------|------|
| Home route | `_app._index.tsx` used older page loader APIs (`fetchPageFromLoader`, `collectComponentDataPromises`) and `Region` with `componentData` | Uses `fetchPageWithComponentData`, `PageWithComponentData`, and `Region` **without** `componentData`; home has **four** hero slides |
| Config | Some samples used `@/config` `useConfig` | Runtime: `getConfig` / `useConfig` from `@salesforce/storefront-next-runtime/config` |
| Root layout | Simpler `root.tsx` | `buildSeoMetaDescriptors`, `seoMeta` in loader, `lang`/`dir` from i18n, optional extensions (e.g. store locator) |
| Header | Simpler layout | Sticky header, `UITarget`, shopper agent, `data-testid="header-logo"` |
| Bootstrap assets | Mapped `home-page.tsx` → `_app._index.tsx` | Map `_app._index.tsx` → `_app._index.tsx` directly |
| Stock template detection | Markers like `hero-cube.webp`, `new-arrivals.webp` | Markers aligned with v0.3 stock (`hero-01.webp`, `fetchPageWithComponentData`, etc.) |
| Generated brand content | Three hero slides only | `select-from-json.js` adds `hero.slide4` as a copy of `slide3` so presets match the four-slide home |

## Files to update in the GitHub repo

1. **`assets/template-bootstrap/`**  
   Replace bundled files with v0.3-based versions that include branding hooks:

   - `src/config/branding-presets.ts` — include optional `hero.slide4`; default assets use `/images/hero-01.webp` … `hero-04.webp`.
   - `src/routes/_app._index.tsx` — full v0.3 home with `getBrandingPreset`, New Arrivals block, preset-driven hero (4 slides), featured cards.
   - `src/root.tsx` — full v0.3 root with `BRANDING_PRESETS`, `data-brand` on `<html>`, `pageTitle` / `pageDescription` in `<head>` (alongside existing SEO pipeline).
   - `src/components/header/index.tsx` — preset logo via `getBrandImagePath`, `onError` fallback, `max-h-[100px]` (audit expects `100px` in source).
   - `src/app.css` — append `:root[data-brand='default'] { ... }` after stock theme (same token overrides as before).
   - `.env.default` — ensure `PUBLIC__app__global__branding__name=default` exists (under a “Demo Branding” or similar section).

2. **`scripts/bootstrap-storefront-next-template.mjs`**
   - `fileMappings`: copy `src/routes/_app._index.tsx` from assets (not `home-page.tsx`).
   - `inspectStockTemplate` checks: update patterns/forbidden for v0.3 stock (see committed version in this folder).

3. **`scripts/webcrawler/src/lib/select-from-json.js`**
   - In `buildContent`, set `hero.slide4` to `{ ...slide3 }` so applied/generated presets include a fourth slide without new crawl slots.

4. **`README.md` / `SKILL.md`**
   - State explicitly: **Supported: Storefront Next template v0.3.x** (and that v0.2 used the previous bootstrap layout).

5. **Removed obsolete file**
   - `assets/template-bootstrap/src/routes/home-page.tsx` — no longer used once `_app._index.tsx` is the canonical home file.

## Preset object keys (`branding-presets.ts`)

Brand ids may contain hyphens (e.g. `mi-marca`). Object keys **must** be quoted in TypeScript/JavaScript: `'mi-marca': { ... }`, not `mi-marca: { ... }`. The apply pipeline now emits keys with `JSON.stringify(brandId)` in `templates.js` (`buildPresetEntry`), and `apply-branding.js` matches quoted or unquoted keys when replacing an existing preset.

## Shell scripts (`set -u` and empty extra args)

`preview-brand.sh` and `apply-brand.sh` use `set -euo pipefail`. Iterating with `for x in "${EXTRA_ARGS[@]}"` **fails** when there are no optional trailing arguments (empty array) because `set -u` treats that expansion as an unbound variable in Bash. The fix is to scan extras with `for arg; do ... done` on the remaining positional parameters, then set `EXTRA_ARGS=("$@")`. If you maintain the upstream repo, keep that pattern.

## Auditing

From the storefront project root:

```bash
node ./.agents/skills/storefront-branding/scripts/audit-storefront-next.mjs
```

## Apply workflow (unchanged)

Apply still patches:

- `src/config/branding-presets.ts`
- `src/app.css`
- `.env`

Hooks in `root.tsx`, `_app._index.tsx`, and `header/index.tsx` must exist before apply succeeds end-to-end (same as v0.2).

## Version pin

When documenting releases, tie the skill version to:

- `package.json` → `"@salesforce/storefront-next-runtime": "0.3.0"` (and matching dev package).
