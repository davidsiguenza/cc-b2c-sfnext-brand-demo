# Storefront Next Branding Hooks

Use this reference to understand the hook contract that the branding workflow expects. When the target repo is a clean `storefront-next-template`, start with `references/storefront-next-template-bootstrap.md` instead of inventing the integration from scratch.

## Contents

- Required integration points
- Minimal data model
- Logo rules
- Activation and output expectations

## Required integration points

The skill is portable only if the target storefront exposes these hook points or their equivalents:

1. `src/config/branding-presets.ts`
   - Define the brand registry, shared types, and helper functions.
   - Export:
     - `BRANDING_PRESETS`
     - `getBrandId(raw)`
     - `getBrandingPreset(raw)`
     - `getBrandImagePath(brandId, asset)`
   - `getBrandImagePath()` must return explicit HTTP(S) URLs and root-relative asset paths as-is.
   - Support both repo-local assets and brand-folder assets.

2. `src/components/header/index.tsx`
   - Resolve the active brand with `useConfig()`.
   - Render the logo from `getBrandImagePath(getBrandId(...), 'logo')`.
   - Cap the rendered logo height at `100px`.
   - If the image fails to load, fall back to the brand display name instead of leaving the header blank.

3. `src/routes/_app._index.tsx`
   - Pull homepage content from `getBrandingPreset(config.global.branding.name)`.
   - Drive at least these slots from the preset:
     - `hero.slide1`
     - `hero.slide2`
     - `hero.slide3`
     - `featuredProducts.title`
     - `newArrivals`
     - `featuredContent.women`
     - `featuredContent.men`
   - Use `newArrivals.ctaLink`, `featuredContent.women.ctaLink`, and `featuredContent.men.ctaLink` when provided, with sensible route fallbacks if those fields are absent.

4. `src/root.tsx`
   - Set `data-brand="<brand-id>"` on the `<html>` element.
   - Set page `<title>` and `<meta name="description">` from the active preset.

5. `src/app.css`
   - Add per-brand CSS token overrides using `:root[data-brand='<brand-id>']`.

6. `.env.default` and `.env`
   - Keep `PUBLIC__app__global__branding__name` in `.env.default` for template bootstrap.
   - Allow `.env` to override the active brand during local development or when the apply flow writes it.
   - Activate a brand with:

```bash
PUBLIC__app__global__branding__name=<brand-id>
```

7. `public/images/brands/<brand-id>/`
   - Prefer storing `logo.svg` here for reliability.
   - External logo URLs are allowed, but local logos are more reliable for previews and demos.

If a target project uses different filenames or route structure, adapt the equivalent files rather than forcing these exact paths.

## Minimal data model

The preset must contain enough structured data for the homepage and metadata:

```ts
type BrandingPreset = {
  displayName: string
  logoAlt: string
  images?: {
    logo?: string
  }
  content: {
    hero: {
      slide1: HeroSlide
      slide2: HeroSlide
      slide3: HeroSlide
    }
    featuredProducts: { title: string }
    newArrivals: {
      title: string
      description: string
      ctaText: string
      ctaLink?: string
      imageUrl: string
      imageAlt: string
    }
    categoryGrid: {
      title: string
      shopNowButton: string
    }
    featuredContent: {
      women: FeaturedBlock
      men: FeaturedBlock
    }
    pageTitle: string
    pageDescription: string
  }
}
```

`HeroSlide` and `FeaturedBlock` both need title/copy/image fields similar to the current implementation in this repo. `FeaturedBlock` should also allow an optional `ctaLink`.

## Logo rules

- Prefer `public/images/brands/<brand-id>/logo.svg`.
- Never let the header logo exceed `100px` height.
- If the crawler proposes an external logo URL, prefer downloading it into the local brand folder during the apply flow when practical.
- If the selected logo fails, keep the storefront usable by falling back to `displayName`.
- If the preset points at a root-relative asset such as `/images/market-logo.svg`, return that path directly instead of forcing `/images/brands/<brand-id>/...`.

## Activation and output expectations

When the hooks exist, the skill should be able to:

1. Run preview-only generation into `.webcrawler/<brand-id>/`.
2. Regenerate the preview with `overrides.json`.
3. Apply the final approved brand by patching:
   - `src/config/branding-presets.ts`
   - `src/app.css`
   - `.env`

The target repo does not need a top-level `docs/BRANDED-DEMO.md` for the skill to work. That file is optional repo documentation, not a required dependency of the skill.

For the stock template bootstrap, the bundled starter preset intentionally reuses `/images/market-logo.svg`, `/images/hero.png`, and `/images/hero-new-arrivals.webp` so no extra default assets are required.
