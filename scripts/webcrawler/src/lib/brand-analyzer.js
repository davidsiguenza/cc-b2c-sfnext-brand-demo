import { collectImageCandidates, collectInlineStyles, collectStylesheetUrls, extractDocumentMetadata } from './dom.js';
import { extractBrandTokens } from './colors.js';
import { candidateKeywords, normalizeWhitespace, slugify, titleCase, truncate } from './strings.js';

const DEFAULTS = {
  heroCtaText: 'SHOP NOW',
  featureCtaText: 'EXPLORE',
  browseTitle: 'Browse',
  browseCtaText: 'Shop',
  featuredProductsTitle: 'Our Picks',
};

export async function analyzeBrand({ $, pageUrl, requestedUrl, html, onlyMainContent, brandId, displayName }) {
  const metadata = extractDocumentMetadata($);
  const stylesheetUrls = collectStylesheetUrls($, pageUrl);
  const inlineStyles = collectInlineStyles($);
  const imageCandidates = collectImageCandidates($, pageUrl, onlyMainContent)
    .map((candidate) => ({
      ...candidate,
      scores: scoreCandidate(candidate),
    }))
    .sort((left, right) => topScore(right) - topScore(left));
  const brandTokens = await extractBrandTokens($, pageUrl, stylesheetUrls, inlineStyles);

  const effectiveBrandId = brandId || slugify(displayName || metadata.siteName || deriveDisplayName(metadata.title, requestedUrl));
  const effectiveDisplayName =
    displayName || metadata.siteName || deriveDisplayName(metadata.title, requestedUrl) || titleCase(effectiveBrandId);

  const selections = selectAssets(imageCandidates);
  const content = buildContent({
    selections,
    metadata,
    pageUrl,
    displayName: effectiveDisplayName,
  });

  return {
    brandId: effectiveBrandId,
    displayName: effectiveDisplayName,
    source: {
      requestedUrl,
      finalUrl: pageUrl,
      fetchedAt: new Date().toISOString(),
    },
    rendererSummary: {
      htmlLength: html.length,
      stylesheetCount: stylesheetUrls.length,
      imageCandidateCount: imageCandidates.length,
    },
    images: {
      logo: selections.logo?.url || null,
    },
    tokens: brandTokens,
    content,
    selections,
    candidates: {
      images: imageCandidates.slice(0, 30),
    },
  };
}

function scoreCandidate(candidate) {
  const keywords = candidate.keywords || candidateKeywords(candidate.url, candidate.alt);
  const landscapeScore = scoreLandscape(candidate);
  const topOfPageBonus = Math.max(0, 24 - candidate.index * 4);

  return {
    logo:
      topOfPageBonus +
      landscapeScore * -0.15 +
      keywordScore(keywords, ['logo', 'brand', 'wordmark', 'header'], 40) +
      keywordScore(keywords, ['svg'], 30) +
      keywordScore(keywords, ['hero', 'banner', 'desktop', 'homepage'], -20) +
      keywordScore(keywords, ['icon'], -10),
    hero:
      landscapeScore +
      topOfPageBonus +
      keywordScore(keywords, ['hero', 'banner', 'homepage', 'desktop', '_desktop', 'carousel', 'slider'], 22) +
      keywordScore(
        keywords,
        ['mobile', '_mobile', 'portrait', 'logo', 'icon', 'new', 'arrival', 'noved', 'women', 'mujer', 'men', 'hombre'],
        -18,
      ),
    newArrivals:
      landscapeScore +
      keywordScore(
        keywords,
        ['new', 'arrivals', 'latest', 'season', 'collection', 'noved', 'just in', 'sneaker', 'launch'],
        18,
      ) +
      keywordScore(keywords, ['mobile', '_mobile', 'logo', 'icon'], -20),
    women:
      landscapeScore +
      keywordScore(keywords, ['women', 'woman', 'mujer', 'female', 'ladies'], 30) +
      keywordScore(keywords, ['men', 'man', 'hombre'], -12),
    men:
      landscapeScore +
      keywordScore(keywords, ['men', 'man', 'hombre', 'male'], 30) +
      keywordScore(keywords, ['women', 'woman', 'mujer'], -12),
  };
}

function selectAssets(candidates) {
  const used = new Set();
  const logo = pickBest(candidates, 'logo', used);
  if (logo) {
    used.add(logo.url);
  }

  const heroSlides = [];
  for (const candidate of candidates
    .filter((item) => !used.has(item.url))
    .sort((left, right) => right.scores.hero - left.scores.hero)) {
    if (heroSlides.length === 3) {
      break;
    }

    heroSlides.push(candidate);
    used.add(candidate.url);
  }

  const women = pickBest(candidates, 'women', used);
  if (women) {
    used.add(women.url);
  }

  const men = pickBest(candidates, 'men', used);
  if (men) {
    used.add(men.url);
  }

  const newArrivals =
    pickBest(candidates, 'newArrivals', used) ||
    pickByFallback(candidates, ['newArrivals', 'hero', 'women', 'men'], used);
  if (newArrivals) {
    used.add(newArrivals.url);
  }

  return {
    logo,
    heroSlides,
    women: women || pickByFallback(candidates, ['women', 'hero'], used),
    men: men || pickByFallback(candidates, ['men', 'hero'], used),
    newArrivals,
  };
}

function pickBest(candidates, scoreKey, used) {
  return candidates
    .filter((candidate) => !used.has(candidate.url))
    .sort((left, right) => right.scores[scoreKey] - left.scores[scoreKey])[0] || null;
}

function pickByFallback(candidates, scoreKeys, used) {
  const available = candidates.filter((candidate) => !used.has(candidate.url));
  if (available.length === 0) {
    return null;
  }

  return available.sort(
    (left, right) => compositeScore(right, scoreKeys) - compositeScore(left, scoreKeys),
  )[0];
}

function compositeScore(candidate, scoreKeys) {
  return scoreKeys.reduce((total, key) => total + (candidate.scores[key] || 0), 0);
}

function buildContent({ selections, metadata, pageUrl, displayName }) {
  const heroSlides = selections.heroSlides.map((candidate, index) =>
    buildImageSlot(candidate, {
      fallbackTitle: `${displayName} ${index + 1}`,
      fallbackCtaText: DEFAULTS.heroCtaText,
      fallbackLink: pageUrl,
      allowSubtitle: true,
    }),
  );

  while (heroSlides.length < 3) {
    heroSlides.push({
      title: `${displayName} ${heroSlides.length + 1}`,
      subtitle: metadata.description || `Discover the latest from ${displayName}.`,
      ctaText: DEFAULTS.heroCtaText,
      ctaLink: '/',
      imageUrl: '',
      imageAlt: `${displayName} hero image ${heroSlides.length + 1}`,
    });
  }

  const women = buildImageSlot(selections.women, {
    fallbackTitle: 'Women',
    fallbackCtaText: DEFAULTS.featureCtaText,
    fallbackLink: pageUrl,
    allowSubtitle: true,
  });

  const men = buildImageSlot(selections.men, {
    fallbackTitle: 'Men',
    fallbackCtaText: DEFAULTS.featureCtaText,
    fallbackLink: pageUrl,
    allowSubtitle: true,
  });

  const newArrivals = buildImageSlot(selections.newArrivals, {
    fallbackTitle: 'New Arrivals',
    fallbackCtaText: DEFAULTS.heroCtaText,
    fallbackLink: pageUrl,
    allowSubtitle: true,
  });

  return {
    hero: {
      slide1: heroSlides[0],
      slide2: heroSlides[1],
      slide3: heroSlides[2],
    },
    featuredProducts: {
      title: DEFAULTS.featuredProductsTitle,
    },
    newArrivals: {
      title: newArrivals.title,
      description: newArrivals.subtitle,
      ctaText: newArrivals.ctaText,
      ctaLink: newArrivals.ctaLink,
      imageUrl: newArrivals.imageUrl,
      imageAlt: newArrivals.imageAlt,
    },
    categoryGrid: {
      title: DEFAULTS.browseTitle,
      shopNowButton: DEFAULTS.browseCtaText,
    },
    featuredContent: {
      women: {
        title: women.title,
        description: women.subtitle,
        ctaText: women.ctaText,
        ctaLink: women.ctaLink,
        imageUrl: women.imageUrl,
        imageAlt: women.imageAlt,
      },
      men: {
        title: men.title,
        description: men.subtitle,
        ctaText: men.ctaText,
        ctaLink: men.ctaLink,
        imageUrl: men.imageUrl,
        imageAlt: men.imageAlt,
      },
    },
    pageTitle: metadata.title || `${displayName} Store`,
    pageDescription: metadata.description || `Welcome to ${displayName}.`,
  };
}

function buildImageSlot(candidate, options) {
  const title = firstMeaningful([
    candidate?.context?.heading,
    candidate?.alt,
    options.fallbackTitle,
  ]);
  const subtitle = options.allowSubtitle
    ? firstMeaningful([
        candidate?.context?.paragraph,
        candidate?.context?.headings?.[1],
        candidate?.context?.text,
        `Discover ${title}.`,
      ])
    : null;

  const cta = firstRelevantLink(candidate?.context?.links) || {};
  const ctaText = cta.text || options.fallbackCtaText;
  const ctaLink = sanitizeLink(cta.href || options.fallbackLink);

  return {
    title,
    subtitle: truncate(subtitle || '', 180),
    ctaText,
    ctaLink,
    imageUrl: candidate?.url || '',
    imageAlt: candidate?.alt || title,
  };
}

function firstMeaningful(values) {
  return values.map((value) => normalizeWhitespace(value)).find((value) => value && value.length > 0) || '';
}

function firstRelevantLink(links = []) {
  return links.find((link) => {
    const text = normalizeWhitespace(link.text).toLowerCase();
    return text && text.length <= 30 && !['search', 'menu', 'close'].includes(text);
  });
}

function sanitizeLink(rawLink) {
  if (!rawLink) {
    return '/';
  }

  try {
    const url = new URL(rawLink);
    return `${url.pathname}${url.search}` || '/';
  } catch {
    return rawLink.startsWith('/') ? rawLink : '/';
  }
}

function scoreLandscape(candidate) {
  let score = 0;
  if (candidate.width && candidate.height) {
    score += candidate.width >= candidate.height ? 18 : -10;
    if (candidate.width / Math.max(candidate.height, 1) >= 1.45) {
      score += 12;
    }
  }

  score += keywordScore(candidate.keywords, ['desktop', '_desktop', 'landscape', 'banner'], 18);
  score += keywordScore(candidate.keywords, ['mobile', '_mobile', 'portrait'], -22);
  return score;
}

function keywordScore(input, terms, scorePerHit) {
  return terms.reduce(
    (total, term) => total + (input.includes(term) ? scorePerHit : 0),
    0,
  );
}

function topScore(candidate) {
  return Math.max(...Object.values(candidate.scores));
}

function deriveDisplayName(title, requestedUrl) {
  if (title) {
    const fromTitle = title.split(/[|\-–·]/)[0];
    if (normalizeWhitespace(fromTitle)) {
      return normalizeWhitespace(fromTitle);
    }
  }

  try {
    return new URL(requestedUrl).hostname.replace(/^www\./, '').split('.')[0];
  } catch {
    return 'Brand';
  }
}
