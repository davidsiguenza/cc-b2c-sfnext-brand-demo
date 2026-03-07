#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const skillRoot = path.resolve(scriptDir, '..');
const bootstrapRef = path.join(skillRoot, 'references', 'storefront-next-template-bootstrap.md');

const rawArgs = process.argv.slice(2);
const wantsJson = rawArgs.includes('--json');
const wantsHelp = rawArgs.includes('--help') || rawArgs.includes('-h');
const positional = rawArgs.filter((arg) => arg !== '--json' && arg !== '--help' && arg !== '-h');
const targetDir = path.resolve(positional[0] ?? process.cwd());

if (wantsHelp) {
    process.stdout.write(
        [
            'Usage: node ./.agents/skills/storefront-branding/scripts/audit-storefront-next.mjs [target-path] [--json]',
            '',
            'Checks whether a Storefront Next repo already has the branding hooks required by the storefront-branding skill.',
        ].join('\n')
    );
    process.exit(0);
}

const checks = [
    {
        id: 'branding-presets',
        file: 'src/config/branding-presets.ts',
        patterns: [
            { label: 'exports BRANDING_PRESETS', regex: /export\s+const\s+BRANDING_PRESETS/ },
            { label: 'exports getBrandId', regex: /export\s+function\s+getBrandId/ },
            { label: 'exports getBrandingPreset', regex: /export\s+function\s+getBrandingPreset/ },
            { label: 'exports getBrandImagePath', regex: /export\s+function\s+getBrandImagePath/ },
        ],
    },
    {
        id: 'home-route',
        file: 'src/routes/_app._index.tsx',
        patterns: [
            { label: 'imports getBrandingPreset', regex: /getBrandingPreset/ },
            { label: 'reads active brand content', regex: /const\s+c\s*=\s*brand\.content/ },
            { label: 'uses newArrivals image from preset', regex: /c\.newArrivals\.imageUrl/ },
            { label: 'uses newArrivals CTA link from preset', regex: /c\.newArrivals\.ctaLink/ },
            { label: 'uses women feature CTA link from preset', regex: /c\.featuredContent\.women\.ctaLink/ },
            { label: 'uses men feature CTA link from preset', regex: /c\.featuredContent\.men\.ctaLink/ },
        ],
    },
    {
        id: 'header',
        file: 'src/components/header/index.tsx',
        patterns: [
            { label: 'uses getBrandImagePath', regex: /getBrandImagePath/ },
            { label: 'uses getBrandingPreset', regex: /getBrandingPreset/ },
            { label: 'caps logo height at 100px', regex: /100px/ },
            { label: 'falls back when logo load fails', regex: /onError/ },
        ],
    },
    {
        id: 'root',
        file: 'src/root.tsx',
        patterns: [
            { label: 'uses BRANDING_PRESETS', regex: /BRANDING_PRESETS/ },
            { label: 'sets data-brand on html', regex: /data-brand=\{brandId\}/ },
            { label: 'uses page description from preset', regex: /pageDescription/ },
            { label: 'uses page title from preset', regex: /pageTitle/ },
        ],
    },
    {
        id: 'app-css',
        file: 'src/app.css',
        patterns: [
            { label: 'contains brand override selector', regex: /:root\[data-brand=['"][^'"]+['"]\]/ },
        ],
    },
];

const results = [];

for (const check of checks) {
    results.push(await inspectFileCheck(check));
}

results.push(await inspectEnvCheck());

const missing = results.filter((result) => !result.ok);
const summary = {
    targetDir,
    ok: missing.length === 0,
    results,
    nextStep:
        missing.length === 0
            ? null
            : `If this is a clean storefront-next-template clone, run node ./.agents/skills/storefront-branding/scripts/bootstrap-storefront-next-template.mjs${targetDir === process.cwd() ? '' : ` ${targetDir}`} and rerun the audit. Otherwise read ${bootstrapRef} and adapt the same hooks manually.`,
};

if (wantsJson) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
} else {
    renderTextSummary(summary);
}

process.exit(summary.ok ? 0 : 1);

async function inspectFileCheck(check) {
    const filePath = path.join(targetDir, check.file);

    try {
        const source = await fs.readFile(filePath, 'utf8');
        const missingPatterns = check.patterns
            .filter((pattern) => !pattern.regex.test(source))
            .map((pattern) => pattern.label);

        return {
            id: check.id,
            file: check.file,
            ok: missingPatterns.length === 0,
            missing: missingPatterns,
        };
    } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
            return {
                id: check.id,
                file: check.file,
                ok: false,
                missing: ['file is missing'],
            };
        }

        throw error;
    }
}

async function inspectEnvCheck() {
    const envFiles = ['.env.default', '.env'];
    const pattern = /^PUBLIC__app__global__branding__name=.*$/m;

    for (const file of envFiles) {
        const filePath = path.join(targetDir, file);

        try {
            const source = await fs.readFile(filePath, 'utf8');
            if (pattern.test(source)) {
                return {
                    id: 'env',
                    file,
                    ok: true,
                    missing: [],
                };
            }
        } catch (error) {
            if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) {
                throw error;
            }
        }
    }

    return {
        id: 'env',
        file: '.env.default or .env',
        ok: false,
        missing: ['PUBLIC__app__global__branding__name is missing'],
    };
}

function renderTextSummary(summary) {
    const lines = [`Storefront branding audit: ${summary.targetDir}`];

    for (const result of summary.results) {
        const prefix = result.ok ? 'PASS' : 'FAIL';
        const detail = result.ok ? 'ready' : result.missing.join('; ');
        lines.push(`${prefix} ${result.file}: ${detail}`);
    }

    if (summary.ok) {
        lines.push('Audit passed. The repo is ready for the branding preview/apply workflow.');
    } else {
        lines.push(`Audit failed. ${summary.nextStep}`);
    }

    process.stdout.write(`${lines.join('\n')}\n`);
}
