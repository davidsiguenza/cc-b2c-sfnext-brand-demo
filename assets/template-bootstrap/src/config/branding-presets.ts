/**
 * Minimal branding bootstrap for a clean Storefront Next template.
 *
 * This starter file intentionally reuses stock template assets so the branding
 * hooks can be installed without adding any extra default images.
 */

export const BRAND_IMAGE_NAMES = {
    logo: 'logo.svg',
} as const;

export type BrandHeroSlide = {
    title: string;
    subtitle: string;
    ctaText: string;
    ctaLink: string;
    imageUrl: string;
    imageAlt: string;
};

export type BrandFeatureBlock = {
    title: string;
    description: string;
    ctaText: string;
    ctaLink?: string;
    imageUrl: string;
    imageAlt: string;
};

export type BrandContent = {
    hero: {
        slide1: BrandHeroSlide;
        slide2: BrandHeroSlide;
        slide3: BrandHeroSlide;
    };
    featuredProducts: { title: string };
    newArrivals: BrandFeatureBlock;
    categoryGrid: { title: string; shopNowButton: string };
    featuredContent: {
        women: BrandFeatureBlock;
        men: BrandFeatureBlock;
    };
    pageTitle: string;
    pageDescription: string;
};

export type BrandingPreset = {
    displayName: string;
    logoAlt: string;
    images?: Partial<Record<keyof typeof BRAND_IMAGE_NAMES, string>>;
    content: BrandContent;
};

const DEFAULT_HERO_IMAGE = '/images/hero.png';
const DEFAULT_FEATURE_IMAGE = '/images/hero-new-arrivals.webp';

export const BRANDING_PRESETS: Record<string, BrandingPreset> = {
    default: {
        displayName: 'Performer',
        logoAlt: 'Home',
        images: {
            logo: '/images/market-logo.svg',
        },
        content: {
            hero: {
                slide1: {
                    title: 'The React Starter Store for High Performers',
                    subtitle: 'Discover our latest collection of products',
                    ctaText: 'Shop Now',
                    ctaLink: '/category/root',
                    imageUrl: DEFAULT_HERO_IMAGE,
                    imageAlt: 'Featured products showcase',
                },
                slide2: {
                    title: 'Premium Quality Products',
                    subtitle: 'Handpicked items for the modern lifestyle',
                    ctaText: 'Explore Collection',
                    ctaLink: '/category/root',
                    imageUrl: DEFAULT_HERO_IMAGE,
                    imageAlt: 'Premium quality products',
                },
                slide3: {
                    title: 'Fast & Reliable Delivery',
                    subtitle: 'Get your orders delivered quickly and safely',
                    ctaText: 'Learn More',
                    ctaLink: '/shipping',
                    imageUrl: DEFAULT_HERO_IMAGE,
                    imageAlt: 'Fast delivery illustration',
                },
            },
            featuredProducts: { title: 'Featured Products' },
            newArrivals: {
                title: 'New Arrivals',
                description:
                    'Discover the latest additions to our collection. From statement pieces to everyday essentials.',
                ctaText: 'SHOP NEW ARRIVALS',
                ctaLink: '/category/newarrivals',
                imageUrl: DEFAULT_FEATURE_IMAGE,
                imageAlt: 'New arrivals collection',
            },
            categoryGrid: { title: 'Step into Elegance', shopNowButton: 'Shop Now' },
            featuredContent: {
                women: {
                    title: 'Women',
                    description:
                        'Discover our curated collection of sophisticated footwear designed for the modern woman.',
                    ctaText: 'EXPLORE COLLECTION',
                    ctaLink: '/category/womens',
                    imageUrl: DEFAULT_FEATURE_IMAGE,
                    imageAlt: "Women's Collection",
                },
                men: {
                    title: 'Men',
                    description:
                        "Timeless craftsmanship meets contemporary style in our men's footwear collection.",
                    ctaText: 'EXPLORE COLLECTION',
                    ctaLink: '/category/mens',
                    imageUrl: DEFAULT_FEATURE_IMAGE,
                    imageAlt: "Men's Collection",
                },
            },
            pageTitle: 'NextGen PWA Kit Store',
            pageDescription: 'Welcome to our web store for high performers!',
        },
    },
};

const DEFAULT_BRAND = 'default';

export function getBrandId(raw: string | undefined | null): string {
    if (!raw) return DEFAULT_BRAND;
    const key = raw.toLowerCase();
    return key in BRANDING_PRESETS ? key : DEFAULT_BRAND;
}

export function getBrandingPreset(raw: string | undefined | null): BrandingPreset {
    return BRANDING_PRESETS[getBrandId(raw)] ?? BRANDING_PRESETS[DEFAULT_BRAND];
}

export function getBrandImagePath(
    brandId: string,
    asset: keyof typeof BRAND_IMAGE_NAMES
): string {
    const preset = BRANDING_PRESETS[brandId] ?? BRANDING_PRESETS[DEFAULT_BRAND];
    const value = preset.images?.[asset] ?? BRAND_IMAGE_NAMES[asset];

    if (/^(https?:\/\/|\/|\.{1,2}\/)/.test(value)) {
        return value;
    }

    return `/images/brands/${brandId}/${value}`;
}
