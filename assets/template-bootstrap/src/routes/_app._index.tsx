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
import { type LoaderFunctionArgs } from 'react-router';
import type { ShopperProducts, ShopperSearch } from '@salesforce/storefront-next-runtime/scapi';
import { fetchSearchProducts } from '@/lib/api/search';
import { fetchCategories } from '@/lib/api/categories';
import { currencyContext } from '@/lib/currency';
import { Region } from '@/components/region';
import PopularCategories from '@/components/home/popular-categories';
import ContentCard from '@/components/content-card';
import { getConfig, useConfig } from '@salesforce/storefront-next-runtime/config';
import type { AppConfig } from '@/types/config';
import { getBrandingPreset } from '@/config/branding-presets';
import { Button } from '@/components/ui/button';
import { PageType } from '@/lib/decorators/page-type';
import { RegionDefinition } from '@/lib/decorators/region-definition';

import { fetchPageWithComponentData, type PageWithComponentData } from '@/lib/util/pageLoader';
import { getLogger } from '@/lib/logger.server';

import hero01 from '/images/hero-01.webp';
import HeroCarousel, { HeroCarouselSkeleton, type HeroSlide } from '@/components/hero-carousel';
import { ProductCarouselSkeleton, ProductCarouselWithSuspense } from '@/components/product-carousel';
import { SeoMeta } from '@/components/seo-meta';
import { buildCanonicalUrl } from '@/utils/canonical-url';
import { useTranslation } from 'react-i18next';

@PageType({
    name: 'Home Page',
    description: 'Main landing page with hero carousel, featured products, and help sections',
    supportedAspectTypes: [],
})
@RegionDefinition([
    {
        id: 'headerbanner',
        name: 'Header Banner Region',
        description: 'Region for promotional banners and hero content',
        maxComponents: 3,
    },
    {
        id: 'main',
        name: 'Main Content Region',
        description: 'Region for main content',
        maxComponents: 5,
    },
])
export class HomePageMetadata {}

export type HomePageData = {
    page: Promise<PageWithComponentData>;
    searchResult: Promise<ShopperSearch.schemas['ProductSearchResult']>;
    categories: Promise<ShopperProducts.schemas['Category'][]>;
    pageUrl: string;
    ogImageUrl: string;
};

/**
 * Server-side loader function that fetches home page data.
 * This function runs on the server during SSR and prepares data for the home page.
 * @returns Promise that resolves to an object containing search result promise
 */
// eslint-disable-next-line react-refresh/only-export-components
export function loader(args: LoaderFunctionArgs): HomePageData {
    const logger = getLogger(args.context);
    logger.debug('HomePage: loader starting');

    const currency = args.context.get(currencyContext) as string;
    const requestUrl = new URL(args.request.url);
    const pageUrl = buildCanonicalUrl(requestUrl.origin, requestUrl.pathname, requestUrl.search);

    return {
        page: fetchPageWithComponentData(args, {
            pageId: 'homepage',
        }),
        searchResult: fetchSearchProducts(args.context, {
            refine: ['cgid=root'],
            limit: getConfig<AppConfig>(args.context).pages.home.featuredProductsCount,
            currency: currency ?? undefined,
        }),
        categories: fetchCategories(args.context, 'root', 1),
        pageUrl,
        ogImageUrl: new URL(hero01, requestUrl.origin).href,
    };
}

/**
 * Home page component that displays the home page content with granular Suspense boundaries.
 * Components within the page handle their own Suspense boundaries for progressive loading.
 * @returns JSX element representing the home page layout
 */
export default function HomePage({ loaderData }: { loaderData: HomePageData }) {
    const { t } = useTranslation('home');
    const config = useConfig<AppConfig>();
    const brand = getBrandingPreset(config.global.branding.name);
    const c = brand.content;
    const slide4 = c.hero.slide4 ?? c.hero.slide3;

    const heroSlides: HeroSlide[] = [
        {
            id: 'slide-1',
            title: c.hero.slide1.title,
            subtitle: c.hero.slide1.subtitle,
            imageUrl: c.hero.slide1.imageUrl,
            imageAlt: c.hero.slide1.imageAlt,
            ctaText: c.hero.slide1.ctaText,
            ctaLink: c.hero.slide1.ctaLink,
        },
        {
            id: 'slide-2',
            title: c.hero.slide2.title,
            subtitle: c.hero.slide2.subtitle,
            imageUrl: c.hero.slide2.imageUrl,
            imageAlt: c.hero.slide2.imageAlt,
            ctaText: c.hero.slide2.ctaText,
            ctaLink: c.hero.slide2.ctaLink,
        },
        {
            id: 'slide-3',
            title: c.hero.slide3.title,
            subtitle: c.hero.slide3.subtitle,
            imageUrl: c.hero.slide3.imageUrl,
            imageAlt: c.hero.slide3.imageAlt,
            ctaText: c.hero.slide3.ctaText,
            ctaLink: c.hero.slide3.ctaLink,
        },
        {
            id: 'slide-4',
            title: slide4.title,
            subtitle: slide4.subtitle,
            imageUrl: slide4.imageUrl,
            imageAlt: slide4.imageAlt,
            ctaText: slide4.ctaText,
            ctaLink: slide4.ctaLink,
        },
    ];

    return (
        <div className="pb-16 -mt-8">
            <SeoMeta
                rawTitle
                title={c.pageTitle}
                description={c.pageDescription}
                openGraph={{
                    type: 'website',
                    url: loaderData.pageUrl,
                    image: loaderData.ogImageUrl,
                }}
            />
            {/* Header Banner Region - Region component handles its own Suspense internally */}
            <div>
                <Region
                    page={loaderData.page}
                    regionId="headerbanner"
                    fallbackElement={
                        <>
                            {/* Provide fallback skeletons for the above the fold content */}
                            <HeroCarouselSkeleton showDots={true} showNavigation={true} />
                            <ProductCarouselSkeleton title={c.featuredProducts.title} />
                        </>
                    }
                    errorElement={
                        <>
                            <HeroCarousel
                                slides={heroSlides}
                                autoPlay={true}
                                autoPlayInterval={6000}
                                showNavigation={true}
                                showDots={true}
                            />

                            {/* Featured Products - ProductCarouselWithSuspense handles its own Suspense */}
                            <ProductCarouselWithSuspense
                                resolve={loaderData.searchResult}
                                title={c.featuredProducts.title}
                                shopAllUrl="/category/root"
                                shopAllText={t('featuredProducts.shopAll')}
                            />
                        </>
                    }
                />
            </div>

            {/* New Arrivals — driven by branding preset (storefront-branding apply workflow) */}
            <div className="pt-16">
                <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center rounded-2xl overflow-hidden">
                        <div className="relative h-64 lg:h-96">
                            <img
                                src={c.newArrivals.imageUrl}
                                alt={c.newArrivals.imageAlt}
                                className="w-full h-full object-cover"
                                loading="lazy"
                            />
                        </div>
                        <div className="p-8 lg:p-12">
                            <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-foreground mb-4">
                                {c.newArrivals.title}
                            </h2>
                            <p className="text-lg text-muted-foreground mb-6">{c.newArrivals.description}</p>
                            <Button size="lg" asChild>
                                <a href={c.newArrivals.ctaLink ?? '/category/newarrivals'}>{c.newArrivals.ctaText}</a>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Region - Region component handles its own Suspense internally */}
            {/* Note: This region doesn't provide fallback skeletons right now as it's located below the fold */}
            <Region
                page={loaderData.page}
                regionId="main"
                errorElement={
                    <>
                        {/* Popular Categories - full-width section with its own gray bg and container */}
                        <PopularCategories categoriesPromise={loaderData.categories} />

                        {/* Featured Content Cards - Static content */}
                        <div className="pt-16">
                            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <ContentCard
                                        title={c.featuredContent.women.title}
                                        description={c.featuredContent.women.description}
                                        imageUrl={c.featuredContent.women.imageUrl}
                                        imageAlt={c.featuredContent.women.imageAlt}
                                        buttonText={c.featuredContent.women.ctaText}
                                        buttonLink={c.featuredContent.women.ctaLink ?? '/category/womens'}
                                        showBackground={false}
                                        showBorder={false}
                                        loading="lazy"
                                    />
                                    <ContentCard
                                        title={c.featuredContent.men.title}
                                        description={c.featuredContent.men.description}
                                        imageUrl={c.featuredContent.men.imageUrl}
                                        imageAlt={c.featuredContent.men.imageAlt}
                                        buttonText={c.featuredContent.men.ctaText}
                                        buttonLink={c.featuredContent.men.ctaLink ?? '/category/mens'}
                                        showBackground={false}
                                        showBorder={false}
                                        loading="lazy"
                                    />
                                </div>

                                {/* Text-only card below women/men cards */}
                                <div className="mt-16 max-w-4xl mx-auto layout-gutter text-center">
                                    <ContentCard
                                        title={t('featuredContent.styleForRealLife.title')}
                                        description={t('featuredContent.styleForRealLife.description')}
                                        showBackground={false}
                                        showBorder={false}
                                        cardFooterClassName="items-center text-center p-0"
                                        cardDescriptionClassName="text-center"
                                        className="[&_h3]:text-3xl [&_h3]:md:text-4xl [&_h3]:font-normal [&_h3]:text-brand-black [&_h3]:mb-6 [&_h3]:tracking-tight [&_p]:text-lg [&_p]:text-brand-gray-700 [&_p]:leading-relaxed [&_p]:font-normal [&_p:last-of-type]:text-base [&_p:last-of-type]:text-brand-gray-600"
                                    />
                                </div>
                            </div>
                        </div>
                    </>
                }
            />
        </div>
    );
}
