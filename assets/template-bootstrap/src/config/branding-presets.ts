/**
 * Copyright 2026 Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Branding presets for the storefront-branding workflow (preview / apply).
 * Default content mirrors the stock Storefront Next v0.3 home template assets.
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
        /** Optional fourth slide (v0.3 home); generated brands copy slide3 when absent. */
        slide4?: BrandHeroSlide;
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

const HERO_01 = '/images/hero-01.webp';
const HERO_02 = '/images/hero-02.webp';
const HERO_03 = '/images/hero-03.webp';
const HERO_04 = '/images/hero-04.webp';

export const BRANDING_PRESETS: Record<string, BrandingPreset> = {
    default: {
        displayName: 'Performer',
        logoAlt: 'Home',
        images: {
            logo: '/images/logo.svg',
        },
        content: {
            hero: {
                slide1: {
                    title: 'The React Starter Store for High Performers',
                    subtitle: 'Discover our latest collection of products',
                    ctaText: 'Shop Now',
                    ctaLink: '/category/root',
                    imageUrl: HERO_01,
                    imageAlt: 'Featured products showcase',
                },
                slide2: {
                    title: 'Premium Quality Products',
                    subtitle: 'Handpicked items for the modern lifestyle',
                    ctaText: 'Explore Collection',
                    ctaLink: '/category/root',
                    imageUrl: HERO_02,
                    imageAlt: 'Premium quality products',
                },
                slide3: {
                    title: 'Fast & Reliable Delivery',
                    subtitle: 'Get your orders delivered quickly and safely',
                    ctaText: 'Learn More',
                    ctaLink: '/shipping',
                    imageUrl: HERO_03,
                    imageAlt: 'Fast delivery illustration',
                },
                slide4: {
                    title: 'Style That Moves With You',
                    subtitle: 'Curated looks for every season',
                    ctaText: 'Shop Now',
                    ctaLink: '/category/root',
                    imageUrl: HERO_04,
                    imageAlt: 'Seasonal collection',
                },
            },
            featuredProducts: { title: 'Featured Products' },
            newArrivals: {
                title: 'New Arrivals',
                description:
                    'Discover the latest additions to our collection. From statement pieces to everyday essentials.',
                ctaText: 'SHOP NEW ARRIVALS',
                ctaLink: '/category/newarrivals',
                imageUrl: HERO_03,
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
                    imageUrl: HERO_03,
                    imageAlt: "Women's Collection",
                },
                men: {
                    title: 'Men',
                    description:
                        "Timeless craftsmanship meets contemporary style in our men's footwear collection.",
                    ctaText: 'EXPLORE COLLECTION',
                    ctaLink: '/category/mens',
                    imageUrl: HERO_04,
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

export function getBrandImagePath(brandId: string, asset: keyof typeof BRAND_IMAGE_NAMES): string {
    const preset = BRANDING_PRESETS[brandId] ?? BRANDING_PRESETS[DEFAULT_BRAND];
    const value = preset.images?.[asset] ?? BRAND_IMAGE_NAMES[asset];

    if (/^(https?:\/\/|\/|\.{1,2}\/)/.test(value)) {
        return value;
    }

    return `/images/brands/${brandId}/${value}`;
}
