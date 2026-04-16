function renderValue(value, indentLevel = 0) {
  const indent = '    '.repeat(indentLevel);
  const nextIndent = '    '.repeat(indentLevel + 1);

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }

    return `[\n${value
      .map((item) => `${nextIndent}${renderValue(item, indentLevel + 1)}`)
      .join(',\n')}\n${indent}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value).filter(([, current]) => current !== undefined);
    if (entries.length === 0) {
      return '{}';
    }

    return `{\n${entries
      .map(([key, current]) => `${nextIndent}${key}: ${renderValue(current, indentLevel + 1)}`)
      .join(',\n')}\n${indent}}`;
  }

  return JSON.stringify(value);
}

export function buildPresetEntry(analysis) {
  const preset = {
    displayName: analysis.displayName,
    logoAlt: `${analysis.displayName} home`,
    images: {
      logo: analysis.images.logo,
    },
    content: analysis.content,
  };

  // Quote key so brand ids like "mi-marca" remain valid JavaScript object keys.
  const presetKey = JSON.stringify(String(analysis.brandId));
  return `${presetKey}: ${renderValue(preset, 1)},`;
}

export function buildCssBlock(analysis) {
  const { tokens } = analysis;
  return `:root[data-brand='${analysis.brandId}'] {
    --primary: ${tokens.primary};
    --primary-foreground: ${tokens.primaryForeground};
    --background: ${tokens.background};
    --foreground: ${tokens.foreground};
    --accent: ${tokens.accent};
    --accent-foreground: ${tokens.accentForeground};
    --border: ${tokens.border};
    --ring: ${tokens.ring};
}`;
}

export function buildEnvSnippet(analysis) {
  return `PUBLIC__app__global__branding__name=${analysis.brandId}`;
}

export function buildReport(analysis) {
  const heroSlides = [
    analysis.content.hero.slide1,
    analysis.content.hero.slide2,
    analysis.content.hero.slide3,
  ];

  const lines = [
    `# ${analysis.displayName}`,
    '',
    `- Brand id: \`${analysis.brandId}\``,
    `- Source URL: ${analysis.source.finalUrl}`,
    `- Images discovered: ${analysis.rendererSummary.imageCandidateCount}`,
    '',
    '## Selected assets',
    '',
    `- Logo: ${analysis.images.logo || 'not found'}`,
  ];

  heroSlides.forEach((slide, index) => {
    lines.push(`- Hero ${index + 1}: ${slide.imageUrl || 'missing'} -> ${slide.title}`);
  });

  lines.push(`- New arrivals: ${analysis.content.newArrivals.imageUrl || 'missing'} -> ${analysis.content.newArrivals.title}`);
  lines.push(`- Women: ${analysis.content.featuredContent.women.imageUrl || 'missing'} -> ${analysis.content.featuredContent.women.title}`);
  lines.push(`- Men: ${analysis.content.featuredContent.men.imageUrl || 'missing'} -> ${analysis.content.featuredContent.men.title}`);
  lines.push('');
  lines.push('## Tokens');
  lines.push('');
  lines.push(`- Primary: ${analysis.tokens.primary}`);
  lines.push(`- Background: ${analysis.tokens.background}`);
  lines.push(`- Foreground: ${analysis.tokens.foreground}`);

  return `${lines.join('\n')}\n`;
}
