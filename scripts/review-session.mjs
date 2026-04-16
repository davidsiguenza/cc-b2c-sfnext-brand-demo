import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourceUrl = args.url || args.positional[0];

  if (!sourceUrl) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const projectDir = path.resolve(args.projectDir || process.cwd());
  const brandId = normalizeBrandId(args.brandId || args.positional[1] || deriveBrandId(sourceUrl));
  const displayName = args.displayName || humanizeBrandId(brandId);
  const host = args.host || '127.0.0.1';
  const explicitPort = args.port ? Number(args.port) : null;
  const preferredPort = Number.isInteger(explicitPort) && explicitPort > 0 ? explicitPort : 4173;
  const outputDir = path.join(projectDir, '.webcrawler', brandId);
  const overridesPath = path.resolve(args.overrides || path.join(outputDir, 'overrides.json'));
  const previewScriptPath = path.join(__dirname, 'preview-brand.sh');
  const applyScriptPath = path.join(__dirname, 'apply-brand.sh');

  await ensureBlankOverridesFile(overridesPath);

  const previewArgs = [sourceUrl, brandId, '--display-name', displayName, '--overrides', overridesPath];
  if (args.waitFor) {
    previewArgs.push('--wait-for', String(args.waitFor));
  }
  if (args.onlyMainContent) {
    previewArgs.push('--only-main-content');
  }

  const firstPreview = await runScript(previewScriptPath, previewArgs, { cwd: projectDir });
  const previewResult = parseJsonOutput(firstPreview.stdout, 'preview');

  const session = createSessionState({
    sourceUrl,
    brandId,
    displayName,
    host,
    projectDir,
    outputDir: previewResult.outputDir || outputDir,
    overridesPath,
    previewHtmlPath: previewResult.previewHtml || path.join(outputDir, 'preview.html'),
    previewArgs,
    applyScriptPath,
    previewScriptPath,
    waitFor: args.waitFor,
    onlyMainContent: args.onlyMainContent,
  });

  const server = createServer((request, response) => {
    void handleRequest(request, response, session).catch((error) => {
      json(response, error && error.statusCode ? error.statusCode : 500, {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  });

  const port = await listenWithFallback(server, host, preferredPort, explicitPort ? 0 : 20);
  session.port = port;

  process.stdout.write(
    [
      'Brand review session ready.',
      `Preview: http://${host}:${port}/preview.html`,
      `Brand ID: ${brandId}`,
      `Overrides: ${overridesPath}`,
      `Output: ${session.outputDir}`,
      'Use the preview UI to save overrides, regenerate the proposal, or apply the final brand.',
      'Press Ctrl+C to stop the review server.',
    ].join('\n') + '\n'
  );

  const shutdown = () => {
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

function parseArgs(argv) {
  const positional = [];
  const options = {
    onlyMainContent: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith('--')) {
      positional.push(value);
      continue;
    }

    const key = value.replace(/^--/, '');

    if (key === 'only-main-content') {
      options.onlyMainContent = true;
      continue;
    }

    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      throw new Error(`Missing value for --${key}`);
    }

    options[toCamelCase(key)] = next;
    index += 1;
  }

  return {
    positional,
    ...options,
  };
}

function printUsage() {
  process.stderr.write(
    [
      'Usage:',
      '  start-brand-review.sh <url> [brand-id] [--display-name <name>] [--host <host>] [--port <port>]',
      '  Optional:',
      '    --wait-for <ms>         Wait time forwarded to the crawler preview step',
      '    --only-main-content     Restrict extraction to the main content root',
      '    --project-dir <path>    Storefront root, defaults to the current working directory',
      '    --overrides <path>      Overrides file, defaults to .webcrawler/<brand-id>/overrides.json',
    ].join('\n') + '\n'
  );
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
}

function deriveBrandId(rawUrl) {
  let hostname = '';

  try {
    hostname = new URL(rawUrl).hostname.toLowerCase();
  } catch (_error) {
    return 'brand-demo';
  }

  hostname = hostname.replace(/^www\./, '');
  const parts = hostname.split('.').filter(Boolean);
  if (parts.length === 0) {
    return 'brand-demo';
  }
  if (parts.length === 1) {
    return parts[0];
  }

  const secondLevelTlds = new Set(['co', 'com', 'org', 'net', 'gov', 'ac']);
  let candidate = parts[parts.length - 2];
  if (
    parts.length >= 3 &&
    parts[parts.length - 1].length === 2 &&
    secondLevelTlds.has(parts[parts.length - 2])
  ) {
    candidate = parts[parts.length - 3];
  }

  return candidate || 'brand-demo';
}

function normalizeBrandId(value) {
  return String(value || 'brand-demo')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'brand-demo';
}

function humanizeBrandId(value) {
  return String(value || 'Brand Demo')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

async function ensureBlankOverridesFile(filePath) {
  await mkdir(path.dirname(filePath), { recursive: true });

  try {
    await access(filePath);
    return;
  } catch (error) {
    if (!error || error.code !== 'ENOENT') {
      throw error;
    }
  }

  await writeFile(filePath, '{\n  "slots": {}\n}\n', 'utf8');
}

function runScript(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, STOREFRONT_BRANDING_REVIEW_SESSION: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      const error = new Error(`${path.basename(command)} exited with code ${code}`);
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });
  });
}

function parseJsonOutput(stdout, label) {
  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(`Could not parse ${label} command output as JSON: ${error.message}`);
  }
}

function createSessionState(input) {
  return {
    sourceUrl: input.sourceUrl,
    brandId: input.brandId,
    displayName: input.displayName,
    host: input.host,
    port: null,
    projectDir: input.projectDir,
    outputDir: input.outputDir,
    overridesPath: input.overridesPath,
    previewHtmlPath: input.previewHtmlPath,
    previewArgs: input.previewArgs,
    previewScriptPath: input.previewScriptPath,
    applyScriptPath: input.applyScriptPath,
    waitFor: input.waitFor,
    onlyMainContent: input.onlyMainContent,
    activeJob: null,
    lastApplyResult: null,
  };
}

async function handleRequest(request, response, session) {
  const origin = `http://${session.host}${session.port ? `:${session.port}` : ''}`;
  const requestUrl = new URL(request.url || '/', origin);

  if (requestUrl.pathname === '/api/session' && request.method === 'GET') {
    json(response, 200, buildSessionPayload(session));
    return;
  }

  if (requestUrl.pathname === '/api/overrides' && request.method === 'GET') {
    const overrides = await readJsonFile(session.overridesPath, { slots: {} });
    json(response, 200, {
      ok: true,
      overrides,
      path: session.overridesPath,
    });
    return;
  }

  if (requestUrl.pathname === '/api/overrides' && request.method === 'POST') {
    const payload = await readRequestJson(request);
    validateOverridesPayload(payload);
    await writeFile(session.overridesPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    json(response, 200, {
      ok: true,
      overridesPath: session.overridesPath,
      savedAt: new Date().toISOString(),
    });
    return;
  }

  if (requestUrl.pathname === '/api/regenerate' && request.method === 'POST') {
    await ensureIdle(session);
    session.activeJob = 'regenerate';

    try {
      const result = await runScript(session.previewScriptPath, session.previewArgs, {
        cwd: session.projectDir,
      });
      const parsed = parseJsonOutput(result.stdout, 'regenerate');
      session.outputDir = parsed.outputDir || session.outputDir;
      session.previewHtmlPath = parsed.previewHtml || session.previewHtmlPath;

      json(response, 200, {
        ok: true,
        previewUrl: `/preview.html?ts=${Date.now()}`,
        outputDir: session.outputDir,
      });
    } catch (error) {
      json(response, 500, {
        ok: false,
        error: error.message,
        stderr: error.stderr || '',
      });
    } finally {
      session.activeJob = null;
    }
    return;
  }

  if (requestUrl.pathname === '/api/apply' && request.method === 'POST') {
    await ensureIdle(session);
    session.activeJob = 'apply';

    try {
      const result = await runScript(
        session.applyScriptPath,
        [session.sourceUrl, session.brandId, '--replace', '--display-name', session.displayName, '--overrides', session.overridesPath],
        {
          cwd: session.projectDir,
        }
      );
      const parsed = parseJsonOutput(result.stdout, 'apply');
      session.lastApplyResult = parsed;

      json(response, 200, {
        ok: true,
        appliedTo: parsed.appliedTo || session.projectDir,
        ranSteps: parsed.ranSteps || [],
      });
    } catch (error) {
      json(response, 500, {
        ok: false,
        error: error.message,
        stderr: error.stderr || '',
      });
    } finally {
      session.activeJob = null;
    }
    return;
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    json(response, 405, { ok: false, error: 'Method not allowed.' });
    return;
  }

  await serveStaticFile(requestUrl.pathname, response, session.outputDir);
}

function buildSessionPayload(session) {
  return {
    ok: true,
    brandId: session.brandId,
    displayName: session.displayName,
    sourceUrl: session.sourceUrl,
    outputDir: session.outputDir,
    overridesPath: session.overridesPath,
    previewUrl: '/preview.html',
    activeJob: session.activeJob,
    lastApplyResult: session.lastApplyResult,
  };
}

async function ensureIdle(session) {
  if (session.activeJob) {
    const error = new Error(`Another review action is already running: ${session.activeJob}`);
    error.statusCode = 409;
    throw error;
  }
}

async function readRequestJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Could not parse request JSON: ${error.message}`);
  }
}

function validateOverridesPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Overrides payload must be a JSON object.');
  }

  const slots = payload.slots;
  if (!slots || typeof slots !== 'object' || Array.isArray(slots)) {
    throw new Error('Overrides payload must contain a "slots" object.');
  }

  Object.keys(slots).forEach((slotKey) => {
    if (!Number.isInteger(slots[slotKey])) {
      throw new Error(`Override slot "${slotKey}" must point to an integer image index.`);
    }
  });

  if (payload.tokens !== undefined) {
    if (!payload.tokens || typeof payload.tokens !== 'object' || Array.isArray(payload.tokens)) {
      throw new Error('Override tokens must be a JSON object.');
    }

    Object.keys(payload.tokens).forEach((tokenKey) => {
      const value = String(payload.tokens[tokenKey] || '').trim();
      if (!/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(value)) {
        throw new Error(`Override token "${tokenKey}" must be a hex color value.`);
      }
    });
  }
}

async function readJsonFile(filePath, fallbackValue) {
  try {
    const raw = await readFile(filePath, 'utf8');
    return raw.trim() ? JSON.parse(raw) : fallbackValue;
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return fallbackValue;
    }
    throw error;
  }
}

async function serveStaticFile(rawPathname, response, outputDir) {
  const pathname = rawPathname === '/' ? '/preview.html' : rawPathname;
  const decodedPath = decodeURIComponent(pathname);
  const normalizedPath = path.normalize(decodedPath).replace(/^(\.\.(\/|\\|$))+/, '');
  const targetPath = path.join(outputDir, normalizedPath);
  const resolvedTarget = path.resolve(targetPath);
  const resolvedOutputDir = path.resolve(outputDir);

  if (!resolvedTarget.startsWith(resolvedOutputDir)) {
    json(response, 403, { ok: false, error: 'Forbidden path.' });
    return;
  }

  let stats;
  try {
    stats = await stat(resolvedTarget);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      json(response, 404, { ok: false, error: 'File not found.' });
      return;
    }
    throw error;
  }

  if (stats.isDirectory()) {
    return serveStaticFile(path.join(decodedPath, 'preview.html'), response, outputDir);
  }

  const mimeType = getMimeType(resolvedTarget);
  const contents = await readFile(resolvedTarget);
  response.writeHead(200, {
    'Content-Type': mimeType,
    'Cache-Control': 'no-store',
  });
  response.end(contents);
}

function getMimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  switch (extension) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.md':
      return 'text/markdown; charset=utf-8';
    case '.txt':
      return 'text/plain; charset=utf-8';
    default:
      return 'application/octet-stream';
  }
}

function json(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function listenWithFallback(server, host, preferredPort, retries) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    let currentPort = preferredPort;

    const tryListen = () => {
      const onError = (error) => {
        server.off('listening', onListening);
        if (error && error.code === 'EADDRINUSE' && attempts < retries) {
          attempts += 1;
          currentPort += 1;
          tryListen();
          return;
        }
        reject(error);
      };

      const onListening = () => {
        server.off('error', onError);
        resolve(currentPort);
      };

      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(currentPort, host);
    };

    tryListen();
  });
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
