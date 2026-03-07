# Storefront Branding Skill

Guided review-first branding workflow for Storefront Next storefronts.

This skill lets you:

- scrape a customer site and generate a proposed storefront brand
- review the proposal in a local browser UI before patching anything
- save overrides for images and color tokens
- regenerate the preview as many times as needed
- apply the approved result into `branding-presets.ts`, `app.css`, and `.env`

## What You Need

- Node.js 20+
- `npm` available in your shell
- a Storefront Next repo
- this skill installed at `.agents/skills/storefront-branding` inside that repo

The bundled crawler installs its own pinned npm dependency on first run if `scripts/webcrawler/node_modules` is missing.

## Install The Skill

From the root of your Storefront Next project:

```bash
mkdir -p .agents/skills
git clone https://github.com/davidsiguenza/cc-b2c-sfnext-brand-demo.git .agents/skills/storefront-branding
```

If you already have the folder locally, copy it into `.agents/skills/storefront-branding`.

## End-To-End Flow

All commands below assume your current working directory is the Storefront Next project root.

### 1. Audit The Storefront

Check whether the repo already has the branding hooks required by the workflow:

```bash
node ./.agents/skills/storefront-branding/scripts/audit-storefront-next.mjs
```

If the audit passes, continue to the guided review flow.

If the audit fails on a clean `storefront-next-template`, bootstrap the required hooks:

1. Copy the bundled starter preset:

```bash
cp ./.agents/skills/storefront-branding/assets/template-bootstrap/src/config/branding-presets.ts \
  src/config/branding-presets.ts
```

2. Patch the remaining files described in `references/storefront-next-template-bootstrap.md`:
   - `src/routes/_app._index.tsx`
   - `src/components/header/index.tsx`
   - `src/root.tsx`
   - `src/app.css`
   - `.env.default`

3. Run the audit again.

## 2. Start The Guided Review UI

Launch a preview-first review session:

```bash
./.agents/skills/storefront-branding/scripts/start-brand-review.sh "https://www.example.com" example
```

You can also omit the brand id and let the script derive one from the URL:

```bash
./.agents/skills/storefront-branding/scripts/start-brand-review.sh "https://www.example.com"
```

Optional arguments:

- `--display-name "Example Brand"`
- `--host 127.0.0.1`
- `--port 4173`
- `--wait-for 3000`
- `--only-main-content`
- `--project-dir /absolute/path/to/storefront`
- `--overrides .webcrawler/example/overrides.json`

The command will:

- create `.webcrawler/<brand-id>/overrides.json`
- generate the first preview proposal
- start a local review server, usually on `http://127.0.0.1:4173/preview.html`

It also writes these artifacts under `.webcrawler/<brand-id>/`:

- `preview.html`
- `page.json`
- `analysis.json`
- `overrides.json`
- `branding-preset.snippet.ts`
- `brand-tokens.css`
- `env.txt`
- `report.md`

## 3. Review The Proposal In The Browser

Open the printed localhost URL, usually:

```text
http://127.0.0.1:4173/preview.html
```

The review UI is organized like this:

- `Selected assets`: the current slot assignments that will feed the homepage
- `Detected candidate families`: grouped asset families so repeated file formats do not flood the page
- `Brand colors`: editable token values when color tokens were detected
- `Overrides JSON`: the exact payload that will be saved, regenerated, or applied

### UI Process

1. Review the current slot selection in `Selected assets`.
2. Click `Change image` on the slot you want to replace.
3. In `Detected candidate families`, choose either:
   - the whole family if any variation works
   - a specific variation if you need a precise file
4. Adjust `Brand colors` if the detected palette needs tuning.
5. Use one of these actions:
   - `Save overrides.json`: writes the current overrides to disk
   - `Regenerate preview`: rebuilds the proposal using the saved overrides
   - `Apply to storefront`: writes the final approved brand into the current storefront repo
   - `Copy overrides.json`: copies the current payload to the clipboard

The page also warns about duplicate imagery or duplicated extracted text context across slots. Resolve those before applying if better alternatives exist.

## 4. What Apply To Storefront Changes

`Apply to storefront` runs the same workflow as the CLI apply step. It patches the current storefront project and then runs validation.

The workflow is designed to update only:

- `src/config/branding-presets.ts`
- `src/app.css`
- `.env`

After apply, the workflow runs:

- `typecheck`
- `build`

Add `--push` only if you explicitly want a deploy/push step from the CLI flow.

## 5. Preview-Only And Manual CLI Flow

If you do not want the local review server, generate a preview only:

```bash
./.agents/skills/storefront-branding/scripts/preview-brand.sh \
  "https://www.example.com" \
  "example"
```

That creates the same `.webcrawler/example/` artifact set, including `preview.html`.

If you are reviewing outside the guided session:

1. Open `.webcrawler/<brand-id>/preview.html`
2. Use `Copy overrides.json`
3. Save the payload into `.webcrawler/<brand-id>/overrides.json`
4. Regenerate from the terminal:

```bash
./.agents/skills/storefront-branding/scripts/preview-brand.sh \
  "https://www.example.com" \
  "example" \
  --overrides ".webcrawler/example/overrides.json"
```

5. Once approved, apply from the terminal:

```bash
./.agents/skills/storefront-branding/scripts/apply-brand.sh \
  "https://www.example.com" \
  "example" \
  --replace \
  --overrides ".webcrawler/example/overrides.json"
```

## Notes

- Run all commands from the storefront project root, not from inside the skill folder.
- Keep using the same brand id and the same `.webcrawler/<brand-id>/` directory across refinement rounds.
- Do not hand-edit the generated brand entry in `branding-presets.ts`; regenerate from overrides instead.
- If the guided review server is already using port `4173`, it will try the next available local port.
- The skill does not require repo-level docs outside the skill folder.

## Using It Through Codex

If Codex is installed in the same repo and can see the skill, ask it to use `$storefront-branding` for a new URL. The expected agent flow is:

1. audit or bootstrap the storefront
2. start a preview-first review session
3. return the localhost preview URL and artifact paths
4. iterate on overrides until approved
5. apply only after approval
