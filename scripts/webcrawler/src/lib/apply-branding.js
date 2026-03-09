import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { readTextFile, writeTextFile } from './fs.js';
import { buildCssBlock, buildEnvSnippet, buildPresetEntry } from './templates.js';

export async function applyBranding(analysis, targetProjectPath, options = {}) {
  const preparedAnalysis = await prepareAnalysisForApply(analysis, targetProjectPath);
  const brandingPath = path.join(targetProjectPath, 'src/config/branding-presets.ts');
  const cssPath = path.join(targetProjectPath, 'src/app.css');
  const envPath = path.join(targetProjectPath, '.env');

  const presetEntry = buildPresetEntry(preparedAnalysis);
  const cssBlock = buildCssBlock(preparedAnalysis);
  const envLine = buildEnvSnippet(preparedAnalysis);

  await patchBrandingPresets(brandingPath, preparedAnalysis.brandId, presetEntry, options);
  await patchCss(cssPath, preparedAnalysis.brandId, cssBlock, options);
  await patchEnv(envPath, envLine);
}

async function prepareAnalysisForApply(analysis, targetProjectPath) {
  const prepared = JSON.parse(JSON.stringify(analysis));
  const localizedLogoPath = await localizeRemoteLogo(prepared, targetProjectPath);

  if (localizedLogoPath) {
    prepared.images = {
      ...(prepared.images || {}),
      logo: localizedLogoPath,
    };
  }

  return prepared;
}

async function localizeRemoteLogo(analysis, targetProjectPath) {
  const logoUrl = analysis?.images?.logo;

  if (!logoUrl || !/^https?:\/\//i.test(logoUrl)) {
    return logoUrl || null;
  }

  try {
    const response = await fetch(logoUrl, {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`Logo request failed with status ${response.status} ${response.statusText}`);
    }

    const extension = resolveLogoExtension(logoUrl, response.headers.get('content-type'));
    const relativePath = `/images/brands/${analysis.brandId}/logo${extension}`;
    const filePath = path.join(targetProjectPath, 'public', relativePath.replace(/^\//, ''));
    const buffer = Buffer.from(await response.arrayBuffer());

    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, buffer);

    return relativePath;
  } catch {
    return logoUrl;
  }
}

function resolveLogoExtension(logoUrl, contentType) {
  const pathname = safeUrlPathname(logoUrl);
  const extension = path.extname(pathname).toLowerCase();

  if (extension) {
    return extension;
  }

  if (!contentType) {
    return '.svg';
  }

  if (contentType.includes('svg')) {
    return '.svg';
  }

  if (contentType.includes('png')) {
    return '.png';
  }

  if (contentType.includes('webp')) {
    return '.webp';
  }

  if (contentType.includes('jpeg') || contentType.includes('jpg')) {
    return '.jpg';
  }

  return '.img';
}

function safeUrlPathname(value) {
  try {
    return new URL(value).pathname;
  } catch {
    return value;
  }
}

async function patchBrandingPresets(filePath, brandId, presetEntry, options) {
  let source = await readTextFile(filePath);
  const existsPattern = new RegExp(`\\b${escapeRegExp(brandId)}\\s*:`, 'm');
  const exportPattern =
    /(export\s+const\s+BRANDING_PRESETS(?:\s*:\s*[^=]+)?\s*=\s*{)([\s\S]*?)(\n};)/;

  if (existsPattern.test(source)) {
    if (!options.replace) {
      throw new Error(`Brand "${brandId}" already exists in ${filePath}. Use --replace to overwrite.`);
    }

    source = replaceObjectEntry(source, brandId, presetEntry);
  } else if (exportPattern.test(source)) {
    source = source.replace(exportPattern, (_, start, middle, end) => `${start}${middle}\n    ${presetEntry}${end}`);
  } else {
    throw new Error(`Could not find BRANDING_PRESETS export in ${filePath}.`);
  }

  await writeTextFile(filePath, source);
}

async function patchCss(filePath, brandId, cssBlock, options) {
  let source = await readTextFile(filePath);
  const blockPattern = new RegExp(`:root\\[data-brand=['"]${escapeRegExp(brandId)}['"]\\]`, 'm');

  if (blockPattern.test(source)) {
    if (!options.replace) {
      throw new Error(`CSS block for "${brandId}" already exists in ${filePath}. Use --replace to overwrite.`);
    }

    source = replaceCssBlock(source, brandId, cssBlock);
  } else {
    source = `${source.trimEnd()}\n\n${cssBlock}\n`;
  }

  await writeTextFile(filePath, source);
}

async function patchEnv(filePath, envLine) {
  let source = '';

  try {
    source = await readTextFile(filePath);
  } catch {
    await writeTextFile(filePath, `${envLine}\n`);
    return;
  }

  if (/^PUBLIC__app__global__branding__name=.*$/m.test(source)) {
    source = source.replace(/^PUBLIC__app__global__branding__name=.*$/m, envLine);
  } else {
    source = `${source.trimEnd()}\n${envLine}\n`;
  }

  await writeTextFile(filePath, source);
}

function replaceObjectEntry(source, brandId, presetEntry) {
  const startPattern = new RegExp(`(^\\s*${escapeRegExp(brandId)}\\s*:\\s*{)`, 'm');
  const startMatch = startPattern.exec(source);

  if (!startMatch) {
    return source;
  }

  const startIndex = startMatch.index;
  const openingBraceIndex = source.indexOf('{', startIndex);
  const endIndex = findMatchingBrace(source, openingBraceIndex);

  if (endIndex === -1) {
    throw new Error(`Could not parse the existing preset block for "${brandId}".`);
  }

  const blockEnd = source.indexOf(',', endIndex);
  const sliceEnd = blockEnd === -1 ? endIndex + 1 : blockEnd + 1;
  const prefix = source.slice(0, startIndex);
  const suffix = source.slice(sliceEnd);

  return `${prefix}    ${presetEntry}${suffix.startsWith('\n') ? '' : '\n'}${suffix}`;
}

function replaceCssBlock(source, brandId, cssBlock) {
  const startPattern = new RegExp(`:root\\[data-brand=['"]${escapeRegExp(brandId)}['"]\\]\\s*{`, 'm');
  const startMatch = startPattern.exec(source);

  if (!startMatch) {
    return source;
  }

  const openingBraceIndex = source.indexOf('{', startMatch.index);
  const endIndex = findMatchingBrace(source, openingBraceIndex);

  if (endIndex === -1) {
    throw new Error(`Could not parse the existing CSS block for "${brandId}".`);
  }

  return `${source.slice(0, startMatch.index)}${cssBlock}${source.slice(endIndex + 1)}`;
}

function findMatchingBrace(source, openingBraceIndex) {
  let depth = 0;

  for (let index = openingBraceIndex; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
