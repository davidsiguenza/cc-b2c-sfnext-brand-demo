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
import type { ShopperExperience, ShopperProducts, ShopperSearch } from '@salesforce/storefront-next-runtime/scapi';
import { fetchSearchProducts } from '@/lib/api/search';
import { fetchCategories } from '@/lib/api/categories';
import { currencyContext } from '@/lib/currency';
import { Region } from '@/components/region';
import PopularCategories from '@/components/home/popular-categories';
import ContentCard from '@/components/content-card';
import { Button } from '@/components/ui/button';
import { getConfig, useConfig } from '@/config';
import { PageType } from '@/lib/decorators/page-type';
import { RegionDefinition } from '@/lib/decorators/region-definition';

import { collectComponentDataPromises, fetchPageFromLoader } from '@/lib/util/pageLoader';

import HeroCarousel, { HeroCarouselSkeleton, type HeroSlide } from '@/components/hero-carousel';
import { ProductCarouselSkeleton, ProductCarouselWithSuspense } from '@/components/product-carousel';
import { getBrandingPreset } from '@/config/branding-presets';

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
    page: Promise<ShopperExperience.schemas['Page']>;
    searchResult: Promise<ShopperSearch.schemas['ProductSearchResult']>;
    categories: Promise<ShopperProducts.schemas['Category'][]>;
    componentData: Promise<Record<string, Promise<unknown>>>;
};

/**
 * Server-side loader function that fetches home page data.
 * This function runs on the server during SSR and prepares data for the home page.
 * @returns Promise that resolves to an object containing search result promise
 */
// eslint-disable-next-line react-refresh/only-export-components
export function loader(args: LoaderFunctionArgs): HomePageData {
    const currency = args.context.get(currencyContext) as string;
    const pagePromise = fetchPageFromLoader(args, {
        pageId: 'homepage',
    });

    return {
        page: pagePromise,
        searchResult: fetchSearchProducts(args.context, {
            categoryId: 'root',
            limit: getConfig(args.context).pages.home.featuredProductsCount,
            currency: currency ?? undefined,
        }),
        categories: fetchCategories(args.context, 'root', 1),
        componentData: collectComponentDataPromises(args, pagePromise),
    };
}

/**
 * Home page component that displays the home page content with granular Suspense boundaries.
 * Components within the page handle their own Suspense boundaries for progressive loading.
 * @returns JSX element representing the home page layout
 */
export default function HomePage({ loaderData }: { loaderData: HomePageData }) {
    const config = useConfig();
    const brand = getBrandingPreset(config.global.branding.name);
    const c = brand.content;

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
    ];

    return (
        <div className="pb-16 -mt-8">
            {/* Header Banner Region - Region component handles its own Suspense internally */}
            <div>
                <Region
                    page={loaderData.page}
                    regionId="headerbanner"
                    componentData={loaderData.componentData}
                    fallbackElement={
                        <>
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

                            <ProductCarouselWithSuspense
                                resolve={loaderData.searchResult}
                                title={c.featuredProducts.title}
                            />
                        </>
                    }
                />
            </div>

            {/* New Arrivals */}
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
                                <a href={c.newArrivals.ctaLink ?? '/category/newarrivals'}>
                                    {c.newArrivals.ctaText}
                                </a>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Region */}
            <div className="pt-16">
                <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
                    <Region
                        page={loaderData.page}
                        regionId="main"
                        componentData={loaderData.componentData}
                        errorElement={
                            <>
                                <PopularCategories categoriesPromise={loaderData.categories} />

                                <div className="pt-16 grid grid-cols-1 md:grid-cols-2 gap-6">
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
                            </>
                        }
                    />
                </div>
            </div>
        </div>
    );
}
