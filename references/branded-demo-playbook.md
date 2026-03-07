# Branded Demo Playbook

Use this reference after the target storefront already passes the branding hook audit. If the repo is still a clean `storefront-next-template`, bootstrap it first with `references/storefront-next-template-bootstrap.md`.

## Architecture

Everything that varies per demo should stay centralized in three places:

| What | Where |
| --- | --- |
| Active brand id | `.env` or `.env.default` via `PUBLIC__app__global__branding__name` |
| Brand content and image mapping | `src/config/branding-presets.ts` |
| Brand color tokens | `src/app.css` via `:root[data-brand='<id>']` |

The workflow should only patch `branding-presets.ts`, `app.css`, and `.env`. The route/header/root wiring is a one-time integration step.

## Brand Content Model

The preset must provide:

- `displayName`
- `logoAlt`
- optional `images.logo`
- `content.hero.slide1`
- `content.hero.slide2`
- `content.hero.slide3`
- `content.featuredProducts.title`
- `content.newArrivals`
- `content.categoryGrid`
- `content.featuredContent.women`
- `content.featuredContent.men`
- `content.pageTitle`
- `content.pageDescription`

Each hero slide needs `title`, `subtitle`, `ctaText`, `ctaLink`, `imageUrl`, and `imageAlt`.

`newArrivals` and both featured content blocks should also carry their own CTA link when the crawl can infer one.

## Homepage Slots

| Slot key | Purpose |
| --- | --- |
| `logo` | Header logo |
| `hero.slide1` | First hero banner |
| `hero.slide2` | Second hero banner |
| `hero.slide3` | Third hero banner |
| `newArrivals` | Split content block below featured products |
| `featured.women` | Left content card |
| `featured.men` | Right content card |

The workflow should keep these image selections visually distinct whenever alternatives exist.

## Image Selection Rules

- Prefer desktop and landscape assets for hero, new-arrivals, and featured blocks.
- Avoid mobile, portrait, icon, and video assets for those slots.
- Prefer SVG for logos.
- Prefer one image family per slot. Different encodings of the same asset should count as one family.
- Do not reuse the same image family across multiple homepage slots unless the source page truly has no better alternatives.

## Review-First Workflow

For conversational requests, prefer the guided review session:

```bash
./.agents/skills/storefront-branding/scripts/start-brand-review.sh "<url>" [brand-id]
```

Lower-level preview command:

```bash
./.agents/skills/storefront-branding/scripts/preview-brand.sh "<url>" "<brand-id>"
```

The first pass must be preview-only unless the user explicitly says to skip review.

## Artifacts

The preview phase writes artifacts under `.webcrawler/<brand-id>/`:

- `page.json`: rendered scrape payload plus image candidates
- `analysis.json`: selected brand content, tokens, and slot assignments
- `preview.html`: interactive review UI
- `overrides.json`: saved slot and token overrides
- `branding-preset.snippet.ts`: generated preset entry
- `brand-tokens.css`: generated CSS token block
- `env.txt`: generated `PUBLIC__app__global__branding__name=...` line
- `report.md`: human-readable summary

Always return at least the preview path or localhost URL plus the paths to `page.json` and `analysis.json`.

## Overrides Loop

The preview UI lets the reviewer:

- reassign slot images by family or by specific variation
- edit detected color tokens
- save `overrides.json`
- regenerate the preview
- apply the approved brand directly from the browser when using the guided review session

Typical slot override payload:

```json
{
  "slots": {
    "logo": 0,
    "hero.slide1": 5,
    "hero.slide2": 9,
    "hero.slide3": 12,
    "newArrivals": 20,
    "featured.women": 25,
    "featured.men": 30
  }
}
```

The numbers point at `page.json.images[]`. The workflow is responsible for mapping those selections back to coherent text, image, and CTA fields.

Regenerate with overrides before applying:

```bash
./.agents/skills/storefront-branding/scripts/preview-brand.sh \
  "<url>" \
  "<brand-id>" \
  --overrides ".webcrawler/<brand-id>/overrides.json"
```

## Apply Phase

Only after explicit approval:

```bash
./.agents/skills/storefront-branding/scripts/apply-brand.sh \
  "<url>" \
  "<brand-id>" \
  --replace \
  --overrides ".webcrawler/<brand-id>/overrides.json"
```

This should patch the current storefront, then run `typecheck` and `build`. Add `--push` only if the user explicitly asks to deploy.

## Conversation Pattern

Use this sequence:

1. Generate the first preview only.
2. Tell the user where to review `preview.html`.
3. Ask them to send back updated overrides or approve from the review session.
4. Regenerate preview as many times as needed.
5. Apply only after approval.

## Guardrails

- Never hand-edit `branding-presets.ts` to partially apply overrides.
- Keep preview artifacts in `.webcrawler/<brand-id>/`.
- Call out duplicate image families before applying.
- Treat token edits as part of the preview state.
- Do not require a repo-level `docs/BRANDED-DEMO.md`. This reference is the skill-local source of truth for the flow.
