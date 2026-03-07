# Storefront Next Template Bootstrap

Use this reference when `scripts/audit-storefront-next.mjs` fails against a clean `storefront-next-template` clone.

## Goal

Install the one-time branding hooks so the crawler workflow can later patch only:

- `src/config/branding-presets.ts`
- `src/app.css`
- `.env`

## Required Delta vs `storefront-next-template`

Compared with the stock template, the branded repo adds or changes:

- `src/config/branding-presets.ts`
- `src/routes/_app._index.tsx`
- `src/components/header/index.tsx`
- `src/root.tsx`
- `src/app.css`
- `.env.default`

No extra default hero or content images are required for bootstrap. The bundled starter preset reuses the stock template assets:

- `/images/market-logo.svg`
- `/images/hero.png`
- `/images/hero-new-arrivals.webp`

## Automated Bootstrap

Run this from the storefront repo root:

```bash
node ./.agents/skills/storefront-branding/scripts/bootstrap-storefront-next-template.mjs
```

Or target another repo explicitly:

```bash
node ./.agents/skills/storefront-branding/scripts/bootstrap-storefront-next-template.mjs /absolute/path/to/storefront-next-template
```

The script:

1. Runs the branding audit.
2. Verifies the target still looks like the stock `storefront-next-template`.
3. Copies the bundled bootstrap-ready files into place.
4. Reruns the audit and exits non-zero if the hooks are still incomplete.

Use `--force` only when you intentionally want to overwrite those template files.

## What The Script Copies

The bootstrap currently copies these files from the skill bundle into the target repo:

```bash
src/config/branding-presets.ts
src/routes/_app._index.tsx
src/components/header/index.tsx
src/root.tsx
src/app.css
.env.default
```

## Installed Behavior

- `src/config/branding-presets.ts` comes from the bundled starter preset.
- `src/routes/_app._index.tsx` reads homepage copy, imagery, and CTA links from the active brand preset.
- `src/components/header/index.tsx` resolves the active logo from the preset and falls back to the brand display name if the image fails to load.
- `src/root.tsx` sets `data-brand` on `<html>` and uses preset-driven `<title>` plus `<meta name="description">`.
- `src/app.css` keeps the stock palette and adds a default `:root[data-brand='default']` block so generated brand CSS can append later.
- `.env.default` gains `PUBLIC__app__global__branding__name=default`.

## Manual Fallback

If the target repo is not a clean stock template, do not run the automated bootstrap unless you explicitly want to overwrite those files. Instead adapt the equivalent hooks manually:

1. Copy the bundled starter file into the target repo:

```bash
cp ./.agents/skills/storefront-branding/assets/template-bootstrap/src/config/branding-presets.ts \
  src/config/branding-presets.ts
```

2. Patch `src/routes/_app._index.tsx`.
   - Import `useConfig` and `getBrandingPreset`.
   - Read `const brand = getBrandingPreset(config.global.branding.name); const c = brand.content;`.
   - Drive all three hero slides from `c.hero.*`.
   - Drive the new-arrivals image, text, and CTA from `c.newArrivals`.
   - Drive the women and men content cards from `c.featuredContent.*`, including CTA links when present.

3. Patch `src/components/header/index.tsx`.
   - Import `useConfig`, `getBrandId`, `getBrandingPreset`, and `getBrandImagePath`.
   - Resolve the active logo from the preset.
   - Cap logo height at `100px`.
   - Fall back to the brand display name if the image fails to load.

4. Patch `src/root.tsx`.
   - Import `BRANDING_PRESETS`.
   - Derive `brandId` from `data?.appConfig?.global.branding.name`.
   - Set `data-brand={brandId}` on `<html>`.
   - Use the active preset for `<title>` and `<meta name="description">`.

5. Patch `src/app.css`.
   - Keep the stock default palette.
   - Add at least one sample override block using `:root[data-brand='<id>']`.
   - Leave the generated workflow free to append additional blocks later.

6. Patch `.env.default`.
   - Add `PUBLIC__app__global__branding__name=default`.
   - `.env` can stay absent until the apply flow writes it.

7. Rerun the audit:

```bash
node ./.agents/skills/storefront-branding/scripts/audit-storefront-next.mjs
```

Only continue to the crawler flow after the audit passes.

## Important Behavior

- `getBrandImagePath()` must return HTTP(S) URLs and root-relative asset paths such as `/images/market-logo.svg` as-is.
- The homepage route should honor `ctaLink` for `newArrivals`, `featuredContent.women`, and `featuredContent.men` when those values are present.
- The bootstrap should be minimal. Do not add extra repo-level docs or a second copy of the crawler runtime.
