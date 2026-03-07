import * as cheerio from 'cheerio';
import { candidateKeywords, normalizeWhitespace, truncate, uniq } from './strings.js';

const BLOCK_SELECTOR = 'main, section, article, header, footer, nav, div';
const TEXT_BLOCK_SELECTOR = 'h1, h2, h3, h4, h5, h6, p, li, a, button';

export function loadDocument(html, baseUrl) {
  return cheerio.load(html, {
    baseURI: baseUrl,
  });
}

export function getContentRoot($, onlyMainContent) {
  if (!onlyMainContent) {
    return $('body').first();
  }

  const candidates = [
    $('main').first(),
    $('[role="main"]').first(),
    $('article').first(),
    $('body').first(),
  ];

  return candidates.find((candidate) => candidate.length > 0) || $('body').first();
}

export function htmlToMarkdown($, root) {
  const lines = [];

  root.find(TEXT_BLOCK_SELECTOR).each((_, element) => {
    const node = $(element);
    const tagName = element.tagName.toLowerCase();
    const text = normalizeWhitespace(node.text());

    if (!text) {
      return;
    }

    if (/^h[1-6]$/.test(tagName)) {
      const level = Number(tagName.slice(1));
      lines.push(`${'#'.repeat(level)} ${text}`);
      return;
    }

    if (tagName === 'li') {
      lines.push(`- ${text}`);
      return;
    }

    if (tagName === 'a') {
      const href = node.attr('href');
      if (href) {
        lines.push(`[${text}](${href})`);
        return;
      }
    }

    if (tagName === 'button') {
      lines.push(`**${text}**`);
      return;
    }

    lines.push(text);
  });

  root.find('img').each((_, element) => {
    const node = $(element);
    const src = firstUrl(node.attr('srcset')) || node.attr('src') || node.attr('data-src');
    const alt = normalizeWhitespace(node.attr('alt')) || 'image';

    if (src) {
      lines.push(`![${alt}](${src})`);
    }
  });

  return uniq(lines).join('\n\n').trim();
}

export function extractDocumentMetadata($) {
  return {
    title: normalizeWhitespace($('title').first().text()) || null,
    description:
      normalizeWhitespace($('meta[name="description"]').attr('content')) ||
      normalizeWhitespace($('meta[property="og:description"]').attr('content')) ||
      null,
    siteName:
      normalizeWhitespace($('meta[property="og:site_name"]').attr('content')) ||
      normalizeWhitespace($('meta[name="application-name"]').attr('content')) ||
      null,
    language: $('html').attr('lang') || null,
  };
}

export function collectStylesheetUrls($, pageUrl) {
  const urls = [];

  $('link[rel="stylesheet"]').each((_, element) => {
    const href = $(element).attr('href');
    const absoluteUrl = resolveUrl(pageUrl, href);
    if (absoluteUrl) {
      urls.push(absoluteUrl);
    }
  });

  return uniq(urls);
}

export function collectInlineStyles($) {
  return $('style')
    .map((_, element) => $(element).html() || '')
    .get()
    .filter(Boolean);
}

export function collectImageCandidates($, pageUrl, onlyMainContent) {
  const root = getContentRoot($, onlyMainContent);
  const candidates = [];

  root.find('img, source').each((index, element) => {
    const node = $(element);
    const src = firstUrl(node.attr('srcset')) || node.attr('src') || node.attr('data-src');
    const absoluteUrl = resolveUrl(pageUrl, src);

    if (!absoluteUrl) {
      return;
    }

    const context = extractContext($, element);
    candidates.push(buildCandidate($, element, absoluteUrl, index, context));
  });

  $('header img, header source, nav img, nav source').each((index, element) => {
    const node = $(element);
    const src = firstUrl(node.attr('srcset')) || node.attr('src') || node.attr('data-src');
    const absoluteUrl = resolveUrl(pageUrl, src);

    if (!absoluteUrl) {
      return;
    }

    const context = extractContext($, element);
    candidates.push(buildCandidate($, element, absoluteUrl, candidates.length + index, context));
  });

  root.find('[style*="background-image"]').each((index, element) => {
    const node = $(element);
    const match = /background-image\s*:\s*url\((['"]?)([^'")]+)\1\)/i.exec(node.attr('style') || '');
    const absoluteUrl = resolveUrl(pageUrl, match?.[2]);

    if (!absoluteUrl) {
      return;
    }

    const context = extractContext($, element);
    candidates.push(
      buildCandidate($, element, absoluteUrl, candidates.length + index, context, {
        source: 'background-image',
      }),
    );
  });

  $('meta[property="og:image"], meta[name="twitter:image"]').each((_, element) => {
    const absoluteUrl = resolveUrl(pageUrl, $(element).attr('content'));
    if (!absoluteUrl) {
      return;
    }

    candidates.push({
      url: absoluteUrl,
      alt: normalizeWhitespace($(element).attr('content')) || null,
      width: null,
      height: null,
      index: candidates.length,
      source: 'meta',
      context: {
        heading: null,
        headings: [],
        paragraph: null,
        links: [],
        text: '',
      },
    });
  });

  const deduped = dedupeCandidates(candidates);
  deduped.forEach((candidate) => {
    candidate.keywords = candidateKeywords(
      candidate.url,
      candidate.alt,
      candidate.source,
      candidate.context.heading,
      candidate.context.text,
      candidate.context.links.map((link) => `${link.text} ${link.href}`).join(' '),
    );
  });

  return deduped;
}

function buildCandidate($, element, url, index, context, overrides = {}) {
  const node = $(element);
  return {
    url,
    alt: normalizeWhitespace(node.attr('alt')) || null,
    width: numericAttribute(node.attr('width')),
    height: numericAttribute(node.attr('height')),
    index,
    source: overrides.source || element.tagName.toLowerCase(),
    classes: normalizeWhitespace(node.attr('class')) || null,
    context,
  };
}

function dedupeCandidates(candidates) {
  const byUrl = new Map();

  for (const candidate of candidates) {
    const existing = byUrl.get(candidate.url);
    if (!existing || scoreCandidateCompleteness(candidate) > scoreCandidateCompleteness(existing)) {
      byUrl.set(candidate.url, candidate);
    }
  }

  return [...byUrl.values()];
}

function scoreCandidateCompleteness(candidate) {
  let score = 0;
  if (candidate.alt) score += 2;
  if (candidate.width && candidate.height) score += 4;
  if (candidate.context.heading) score += 3;
  if (candidate.context.paragraph) score += 2;
  return score;
}

function numericAttribute(value) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractContext($, element) {
  let current = $(element).closest(BLOCK_SELECTOR);
  let best = null;

  while (current.length) {
    const text = normalizeWhitespace(current.text());
    const headingCount = current.find('h1, h2, h3, h4, h5, h6').length;
    const imageCount = current.find('img').length;

    if (text && text.length <= 700 && (headingCount > 0 || text.length >= 24) && imageCount <= 8) {
      best = current;
      break;
    }

    current = current.parent().closest(BLOCK_SELECTOR);
  }

  const container = best || $(element).parent();
  const headings = uniq(
    container
      .find('h1, h2, h3, h4, h5, h6')
      .map((_, node) => normalizeWhitespace($(node).text()))
      .get()
      .filter(Boolean),
  );
  const paragraphs = uniq(
    container
      .find('p')
      .map((_, node) => normalizeWhitespace($(node).text()))
      .get()
      .filter(Boolean),
  );
  const links = uniqLinks(
    container
      .find('a, button')
      .map((_, node) => ({
        text: normalizeWhitespace($(node).text()),
        href: normalizeWhitespace($(node).attr('href')) || null,
      }))
      .get(),
  );

  return {
    heading: headings[0] || null,
    headings,
    paragraph: paragraphs[0] || null,
    links,
    text: truncate(normalizeWhitespace(container.text()), 700),
  };
}

function uniqLinks(links) {
  const seen = new Set();
  const result = [];

  for (const link of links) {
    const key = `${link.text}|${link.href || ''}`;
    if (!link.text || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(link);
  }

  return result;
}

function firstUrl(srcset) {
  if (!srcset) {
    return null;
  }

  return normalizeWhitespace(srcset)
    .split(',')
    .map((part) => normalizeWhitespace(part).split(' ')[0])
    .find(Boolean);
}

export function resolveUrl(baseUrl, rawUrl) {
  if (!rawUrl) {
    return null;
  }

  try {
    return new URL(rawUrl, baseUrl).toString();
  } catch {
    return null;
  }
}
