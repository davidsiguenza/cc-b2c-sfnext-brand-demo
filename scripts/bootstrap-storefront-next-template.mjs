#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const skillRoot = path.resolve(scriptDir, '..');
const auditScript = path.join(scriptDir, 'audit-storefront-next.mjs');
const assetRoot = path.join(skillRoot, 'assets', 'template-bootstrap');

const rawArgs = process.argv.slice(2);
const wantsJson = rawArgs.includes('--json');
const wantsForce = rawArgs.includes('--force');
const wantsHelp = rawArgs.includes('--help') || rawArgs.includes('-h');
const positional = rawArgs.filter((arg) => !['--json', '--force', '--help', '-h'].includes(arg));
const targetDir = path.resolve(positional[0] ?? process.cwd());

if (wantsHelp) {
    process.stdout.write(
        [
            'Usage: node ./.agents/skills/storefront-branding/scripts/bootstrap-storefront-next-template.mjs [target-path] [--force] [--json]',
            '',
            'Bootstraps the branding hooks into a clean storefront-next-template clone and reruns the branding audit.',
            'By default the script refuses to overwrite files unless the target still looks like the stock template.',
        ].join('\n')
    );
    process.exit(0);
}

const fileMappings = [
    ['assets/template-bootstrap/src/config/branding-presets.ts', 'src/config/branding-presets.ts'],
    ['assets/template-bootstrap/src/routes/_app._index.tsx', 'src/routes/_app._index.tsx'],
    ['assets/template-bootstrap/src/components/header/index.tsx', 'src/components/header/index.tsx'],
    ['assets/template-bootstrap/src/root.tsx', 'src/root.tsx'],
    ['assets/template-bootstrap/src/app.css', 'src/app.css'],
    ['assets/template-bootstrap/.env.default', '.env.default'],
];

const initialAudit = runAudit(targetDir);

if (initialAudit.ok) {
    writeSummary({
        ok: true,
        targetDir,
        alreadyReady: true,
        bootstrapped: false,
        copied: [],
        audit: initialAudit,
        message: 'Audit already passes. No bootstrap changes were applied.',
    });
    process.exit(0);
}

if (!wantsForce) {
    const stockCheck = await inspectStockTemplate(targetDir);
    if (!stockCheck.ok) {
        writeSummary({
            ok: false,
            targetDir,
            alreadyReady: false,
            bootstrapped: false,
            copied: [],
            audit: initialAudit,
            message:
                'Bootstrap refused because the target does not look like a clean storefront-next-template clone. Use --force only if you intentionally want to overwrite those files.',
            stockCheck,
        });
        process.exit(1);
    }
}

const copied = [];

for (const [assetRelative, targetRelative] of fileMappings) {
    const sourcePath = path.join(skillRoot, assetRelative);
    const destinationPath = path.join(targetDir, targetRelative);
    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    await fs.copyFile(sourcePath, destinationPath);
    copied.push(targetRelative);
}

const finalAudit = runAudit(targetDir);

writeSummary({
    ok: finalAudit.ok,
    targetDir,
    alreadyReady: false,
    bootstrapped: true,
    copied,
    audit: finalAudit,
    message: finalAudit.ok
        ? 'Bootstrap applied and the audit now passes.'
        : 'Bootstrap copied the template assets, but the audit still reports missing hooks.',
});

process.exit(finalAudit.ok ? 0 : 1);

function runAudit(targetPath) {
    const result = spawnSync(process.execPath, [auditScript, targetPath, '--json'], {
        encoding: 'utf8',
    });

    if (result.status === null) {
        throw result.error ?? new Error('Could not execute storefront branding audit.');
    }

    if (!result.stdout.trim()) {
        throw new Error(result.stderr.trim() || 'Storefront branding audit produced no output.');
    }

    try {
        return JSON.parse(result.stdout);
    } catch (error) {
        throw new Error(`Could not parse audit JSON: ${error.message}`);
    }
}

async function inspectStockTemplate(targetPath) {
    const checks = [
        {
            file: 'src/config/branding-presets.ts',
            expectMissing: true,
        },
        {
            file: 'src/routes/_app._index.tsx',
            patterns: [/useTranslation\('home'\)/, /hero-cube\.webp/, /new-arrivals\.webp/],
            forbidden: [/getBrandingPreset/, /useConfig\(/],
        },
        {
            file: 'src/components/header/index.tsx',
            patterns: [/useTranslation\('header'\)/, /market-logo\.svg/],
            forbidden: [/getBrandImagePath/, /useConfig\(/],
        },
        {
            file: 'src/root.tsx',
            patterns: [/NextGen PWA Kit Store/, /Welcome to our web store for high performers!/],
            forbidden: [/BRANDING_PRESETS/, /data-brand=\{brandId\}/],
        },
        {
            file: 'src/app.css',
            patterns: [/:\s*root,/],
            forbidden: [/:root\[data-brand='default'\]/],
        },
        {
            file: '.env.default',
            patterns: [/MRT_PROJECT=/, /PUBLIC__app__commerce__api__clientId=/],
            forbidden: [/PUBLIC__app__global__branding__name=/],
        },
    ];

    const details = [];

    for (const check of checks) {
        const filePath = path.join(targetPath, check.file);

        if (check.expectMissing) {
            try {
                await fs.access(filePath);
                details.push({
                    file: check.file,
                    ok: false,
                    reason: 'expected file to be absent in the stock template',
                });
            } catch (error) {
                if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
                    details.push({
                        file: check.file,
                        ok: true,
                        reason: 'missing as expected',
                    });
                    continue;
                }
                throw error;
            }
            continue;
        }

        let source = '';
        try {
            source = await fs.readFile(filePath, 'utf8');
        } catch (error) {
            if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
                details.push({
                    file: check.file,
                    ok: false,
                    reason: 'required stock template file is missing',
                });
                continue;
            }
            throw error;
        }

        const missingPattern = (check.patterns ?? []).find((pattern) => !pattern.test(source));
        if (missingPattern) {
            details.push({
                file: check.file,
                ok: false,
                reason: `missing stock marker ${missingPattern}`,
            });
            continue;
        }

        const forbiddenPattern = (check.forbidden ?? []).find((pattern) => pattern.test(source));
        if (forbiddenPattern) {
            details.push({
                file: check.file,
                ok: false,
                reason: `already contains non-stock marker ${forbiddenPattern}`,
            });
            continue;
        }

        details.push({
            file: check.file,
            ok: true,
            reason: 'matches stock template markers',
        });
    }

    return {
        ok: details.every((detail) => detail.ok),
        details,
    };
}

function writeSummary(summary) {
    if (wantsJson) {
        process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
        return;
    }

    const lines = [`Storefront branding bootstrap: ${summary.targetDir}`];

    if (summary.alreadyReady) {
        lines.push('PASS audit already passes; no bootstrap changes applied.');
    } else if (summary.bootstrapped) {
        lines.push(`APPLY copied ${summary.copied.length} template bootstrap files.`);
        summary.copied.forEach((file) => lines.push(`  - ${file}`));
    } else {
        lines.push('SKIP bootstrap was not applied.');
    }

    if (summary.stockCheck && !summary.stockCheck.ok) {
        lines.push('Stock template check failed:');
        summary.stockCheck.details
            .filter((detail) => !detail.ok)
            .forEach((detail) => lines.push(`  - ${detail.file}: ${detail.reason}`));
    }

    lines.push(summary.message);
    process.stdout.write(`${lines.join('\n')}\n`);
}
