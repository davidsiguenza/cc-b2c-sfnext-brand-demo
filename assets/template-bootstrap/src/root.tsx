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
import { type PropsWithChildren, useEffect, useMemo, useRef } from 'react';

// React Router
import {
    type DataStrategyResult,
    isRouteErrorResponse,
    Links,
    type LinksFunction,
    type LoaderFunctionArgs,
    Meta,
    type MetaDescriptor,
    type MetaFunction,
    type MiddlewareFunction,
    Navigate,
    Outlet,
    Scripts,
    ScrollRestoration,
    useMatches,
    useRevalidator,
    useRouteLoaderData,
} from 'react-router';

// Third-party libraries
import { type i18n } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { PageDesignerProvider } from '@salesforce/storefront-next-runtime/design/react/core';
import { isDesignModeActive, isPreviewModeActive } from '@salesforce/storefront-next-runtime/design/mode';
import { SiteProvider, siteContext, type Site, type Locale } from '@salesforce/storefront-next-runtime/site-context';

// Middlewares
import authMiddlewareServer, { getAuth as getAuthServer } from '@/middlewares/auth.server';
import { getPublicSessionData } from '@/middlewares/auth.utils';
import createBasketMiddleware, { basketResourceContext, type BasketSnapshot } from '@/middlewares/basket.server';
import shopperContextMiddlewareServer from '@/middlewares/shopper-context.server';
import legacyRoutesMiddlewareClient from '@/middlewares/legacy-routes.client';
import {
    performanceMetricsMiddlewareClient,
    performanceMetricsMiddlewareServer,
} from '@/middlewares/performance-metrics';
import { appConfigMiddlewareServer } from '@/middlewares/app-config.server';
import { appConfigMiddlewareClient } from '@/middlewares/app-config.client';
import { ConfigProvider, getConfig } from '@salesforce/storefront-next-runtime/config';
import type { AppConfig } from '@/types/config';
import { BRANDING_PRESETS, getBrandId } from '@/config/branding-presets';
import { siteContextMiddleware } from '@/middlewares/site-context.server';
import { i18nextMiddleware } from '@/middlewares/i18next.server';
import { currencyMiddleware } from '@/middlewares/currency.server';
// @sfdc-extension-block-start SFDC_EXT_STORE_LOCATOR
import {
    selectedStoreMiddleware,
    selectedStoreContext,
} from '@/extensions/store-locator/middlewares/selected-store.server';
import type { SelectedStoreInfo } from '@/extensions/store-locator/stores/store-locator-store';
// @sfdc-extension-block-end SFDC_EXT_STORE_LOCATOR
import { correlationMiddleware } from '@/middlewares/correlation.server';
import { loggingMiddleware } from '@/middlewares/logging.server';
import { modeDetectionMiddlewareServer, modeDetectionMiddlewareClient } from '@/middlewares/mode-detection';
import { maintenanceMiddleware } from '@/middlewares/maintenance.server';

// Providers
import AuthProvider from '@/providers/auth';
import BasketProvider from '@/providers/basket';
import { ComposeProviders } from '@/providers/compose-providers';
import { CurrencyProvider } from '@/providers/currency';
import { CorrelationProvider } from '@/providers/correlation';
import { correlationContext } from '@/lib/correlation';
import RecommendersProvider from '@/providers/recommenders';

// Components
import { ToasterTheme } from '@/components/toast';
import { TrackingConsentBanner } from '@/components/tracking-consent-banner';
import ShopperAgent from '@/components/shopper-agent';

// Hooks
import { useExecutePendingAction } from '@/hooks/use-execute-pending-action';

// Lib/Utils
import type { PublicSessionData } from '@/lib/api/types';
import { i18nextContext } from '@/lib/i18next';
import { initI18next } from '@/lib/i18next.client';
import { PageViewTracker } from '@/lib/analytics/page-view-tracker';
import { initializeRegistry } from '@/lib/static-registry';
import { currencyContext } from '@/lib/currency';
import { buildSeoMetaDescriptors } from '@/utils/seo';

// Import load-fonts to trigger module-level font loading
import '@/lib/load-fonts';

// Adapters
import { EINSTEIN_ADAPTER_NAME } from '@/adapters/einstein';

// Assets
import favicon from '/favicon.ico';

// Fonts (preload only the most-used weights: 500 and 600)
import sen500 from '@fonts/sen/sen-500.woff2?url';
import sen600 from '@fonts/sen/sen-600.woff2?url';

// Styles
import { PageDesignerInit } from '@/page-designer-init';
import appStylesHref from './app.css?url';

// Extensions
import { TargetProviders } from '@/targets/target-providers';
// @sfdc-extension-block-start SFDC_EXT_STORE_LOCATOR
import StoreLocatorProvider from '@/extensions/store-locator/providers/store-locator';
// @sfdc-extension-block-end SFDC_EXT_STORE_LOCATOR
import { type Maintenance, maintenanceContext } from '@/lib/maintenance';

// eslint-disable-next-line react-refresh/only-export-components
export const links: LinksFunction = () => {
    return [
        // Preload critical fonts
        { rel: 'preload', href: sen500, as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' },
        { rel: 'preload', href: sen600, as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' },
        { rel: 'preload', href: appStylesHref, as: 'style' },
        { rel: 'stylesheet', href: appStylesHref },
    ];
};

// eslint-disable-next-line react-refresh/only-export-components
export const meta: MetaFunction<typeof loader> = ({ loaderData }) => {
    return loaderData?.seoMeta ?? [];
};

// eslint-disable-next-line react-refresh/only-export-components
export const middleware: MiddlewareFunction<Response>[] = [
    correlationMiddleware,
    loggingMiddleware,
    modeDetectionMiddlewareServer,
    appConfigMiddlewareServer,
    siteContextMiddleware, // Must run after appConfig, before i18next and currency
    i18nextMiddleware,
    currencyMiddleware,
    selectedStoreMiddleware /** @sfdc-extension-line SFDC_EXT_STORE_LOCATOR */,
    performanceMetricsMiddlewareServer,
    maintenanceMiddleware,
    authMiddlewareServer,
    createBasketMiddleware(),
    shopperContextMiddlewareServer,
];

// eslint-disable-next-line react-refresh/only-export-components
export const clientMiddleware: MiddlewareFunction<Record<string, DataStrategyResult>>[] = [
    // Client middleware functions have varying return types, but React Router expects Record<string, DataStrategyResult>
    // We cast through unknown to avoid type errors while maintaining runtime correctness
    appConfigMiddlewareClient as unknown as MiddlewareFunction<Record<string, DataStrategyResult>>, // Must run first to set config in context
    modeDetectionMiddlewareClient,
    legacyRoutesMiddlewareClient as unknown as MiddlewareFunction<Record<string, DataStrategyResult>>, // Checks hybrid.enabled, needs config from context
    performanceMetricsMiddlewareClient as unknown as MiddlewareFunction<Record<string, DataStrategyResult>>,
];

// On the client side, initialize i18next.
// (On the server side, it's initialized elsewhere in middlewares/i18next.ts file)
// Read the language from the server-rendered HTML to avoid language detection issues
const i18nextOnClient =
    typeof window !== 'undefined' ? initI18next({ language: document.documentElement.lang || undefined }) : undefined;

// eslint-disable-next-line react-refresh/only-export-components
export const loader = ({
    context,
    request,
}: LoaderFunctionArgs): {
    // Public auth data - only non-sensitive fields, safe to serialize
    clientAuth: PublicSessionData;
    appConfig: AppConfig;
    basketSnapshot: BasketSnapshot | null;
    maintenance: Maintenance;
    locale: Locale;
    site: Site;
    currency: string;
    selectedStoreInfo: SelectedStoreInfo | null /** @sfdc-extension-line SFDC_EXT_STORE_LOCATOR */;
    correlationId: string;
    pageDesignerMode: 'EDIT' | 'PREVIEW' | undefined;
    // Pre-computed in the loader (server-only) so seo.ts stays out of the client bundle
    seoMeta: MetaDescriptor[];
    // Return as function to prevent i18next instance serialization
    getI18next: () => i18n;
} => {
    const session = getAuthServer(context);

    const appConfig = getConfig<AppConfig>(context);

    // Get i18next accessor functions from context (stored by middleware)
    const i18nextData = context.get(i18nextContext);
    if (!i18nextData) {
        throw new Error('i18next data not found in context. Ensure i18next middleware runs before loaders.');
    }

    // Call the bound functions to get locale and i18next instance

    // On the server side, our middleware stores the translations in this i18next object
    // so we'll need to be careful not to accidentally serialize this object (to avoid bloating the html).
    const i18next = i18nextData.getI18nextInstance();

    // Currency is already resolved by middleware
    const currency = context.get(currencyContext) as string;

    // @sfdc-extension-block-start SFDC_EXT_STORE_LOCATOR
    const selectedStoreInfo = context.get(selectedStoreContext) ?? null;
    // @sfdc-extension-block-end SFDC_EXT_STORE_LOCATOR

    // Get resolved site from site context middleware
    const siteCtx = context.get(siteContext);
    if (!siteCtx) {
        throw new Error('Site context not found. Ensure siteContextMiddleware runs before loaders.');
    }
    const locale = siteCtx.locale;
    const site = siteCtx.site;

    // Load the application basket provider with the basket snapshot. We are actively not loading the basket, as
    // we want to lazy load the basket when the basket is needed. This prevents low-engagement users from causing
    // unnecessary resource usage in the form of basket creations.
    const basketSnapshot = context.get(basketResourceContext)?.snapshot ?? null;

    // Get correlation ID from middleware for request tracing
    const correlationId = context.get(correlationContext);

    // Get maintenance data from middleware
    const maintenance = context.get(maintenanceContext);

    // Extract only non-sensitive fields for client - tokens stay server-side only
    const clientAuth = getPublicSessionData(session);

    const requestUrl = new URL(request.url);

    const seoMeta = buildSeoMetaDescriptors({
        site,
        appConfig,
        origin: requestUrl.origin,
        locale,
        location: { pathname: requestUrl.pathname, search: requestUrl.search },
    });

    return {
        appConfig,
        basketSnapshot,
        locale,
        site,
        currency,
        selectedStoreInfo /** @sfdc-extension-line SFDC_EXT_STORE_LOCATOR */,
        correlationId,
        maintenance,
        clientAuth,
        seoMeta,
        getI18next: () => i18next,
        pageDesignerMode: isDesignModeActive(request) ? 'EDIT' : isPreviewModeActive(request) ? 'PREVIEW' : undefined,
    };
};

// This creates a union type where properties unique to either loader are optional
// Properties present in both loaders remain required
type ServerLoaderData = ReturnType<typeof loader>;
type LoaderData = ServerLoaderData;

export function Layout({ children }: PropsWithChildren) {
    const matches = useMatches();
    const rootMatch = matches.find((m) => m.id === 'root');
    const appConfig = (rootMatch?.data as { appConfig?: AppConfig })?.appConfig;
    const appConfigScript = appConfig ? `window.__APP_CONFIG__ = ${JSON.stringify(appConfig)};` : '';

    const data = useRouteLoaderData<LoaderData>('root');
    const i18next = typeof window === 'undefined' ? data?.getI18next?.() : i18nextOnClient;
    const lang = i18next?.language ?? 'en';
    const dir = i18next?.dir(lang) ?? 'ltr';
    const brandId = getBrandId(data?.appConfig?.global.branding.name);
    const brandPreset = BRANDING_PRESETS[brandId] ?? BRANDING_PRESETS.default;

    return (
        <html lang={lang} dir={dir} data-brand={brandId}>
            <head>
                <meta charSet="utf-8" />
                {appConfig?.links?.preconnect?.map((origin: string) => (
                    <link key={origin} rel="preconnect" href={origin} />
                ))}
                {appConfig?.links?.prefetchDns?.map((origin: string) => (
                    <link key={origin} rel="dns-prefetch" href={origin} />
                ))}
                {appConfig?.links?.prefetch?.map((href: string) => (
                    <link key={href} rel="prefetch" href={href} />
                ))}
                <script
                    // eslint-disable-next-line react/no-danger
                    dangerouslySetInnerHTML={{
                        __html: `
                        ${appConfigScript}
                    `,
                    }}
                />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="description" content={brandPreset.content.pageDescription} />
                <link rel="icon" type="image/x-icon" href={favicon} />
                <title>{brandPreset.content.pageTitle}</title>
                <Meta />
                <Links />
            </head>
            <body className="antialiased flex flex-col min-h-screen">
                {children}
                <ToasterTheme />
                <ScrollRestoration />
                <Scripts />
            </body>
        </html>
    );
}

export function ErrorBoundary({ error }: { error: unknown }) {
    // Handle maintenance mode errors
    // Error is serialized when crossing server->client boundary, so we check the string representation
    if (error && error.toString().indexOf('MAINTENANCE_ERROR') >= 0) {
        // Use React Router Navigate for smooth client-side navigation
        return <Navigate to="/maintenance" replace />;
    }

    let title = 'Something went wrong';
    let status: number | undefined;
    let details: string | undefined;
    let stack: string | undefined;

    if (isRouteErrorResponse(error)) {
        status = error.status;
        title = error.status === 404 ? 'Page not found' : 'Something went wrong';
        details = error.status === 404 ? 'The requested page could not be found.' : error.statusText;
    } else if (error instanceof Error) {
        details = error.message;
        stack = error.stack;
    } else if (typeof error === 'string') {
        details = error;
    }

    return (
        <main className="flex items-center justify-center min-h-[60vh] p-4">
            <div className="w-full max-w-2xl">
                {/* Error header */}
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6">
                    <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5 rounded-full bg-destructive/20 p-2">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="size-5 text-destructive">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                        </div>
                        <div>
                            {status && <p className="text-sm font-medium text-destructive/70 mb-1">{status}</p>}
                            <h1 className="text-xl font-semibold text-destructive">{title}</h1>
                            {details && <p className="mt-1.5 text-sm text-foreground/80 break-all">Error: {details}</p>}
                        </div>
                    </div>
                </div>

                {/* Stack trace */}
                {stack && (
                    <div className="mt-4 border border-border rounded-lg bg-muted/30">
                        <div className="flex items-center px-4 py-3 border-b border-border">
                            <h2 className="text-sm font-semibold text-foreground">Stack Trace</h2>
                        </div>
                        <pre className="p-4 overflow-auto max-h-80 text-xs leading-relaxed text-foreground/90 font-mono">
                            <code>{stack}</code>
                        </pre>
                        <div className="px-4 py-3 border-t border-border">
                            <p className="text-xs text-muted-foreground">
                                To disable stack traces in production, turn off <strong>Enable Source Maps</strong> in
                                your Managed Runtime environment.{' '}
                                <a
                                    href="https://developer.salesforce.com/docs/commerce/pwa-kit-managed-runtime/guide/debugging.html#debug-on-managed-runtime"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline hover:no-underline">
                                    Learn more about debugging on Managed Runtime
                                </a>
                            </p>
                        </div>
                    </div>
                )}

                {/* No stack trace - fallback message */}
                {!stack && (
                    <div className="mt-4 border border-border rounded-lg bg-muted/30 px-6 py-4">
                        <p className="text-sm text-muted-foreground">
                            {details
                                ? 'If this problem persists, please contact support.'
                                : 'An unexpected error occurred. Please try again later.'}
                        </p>
                    </div>
                )}
            </div>
        </main>
    );
}

export default function App({
    loaderData: {
        clientAuth,
        basketSnapshot,
        getI18next,
        currency,
        correlationId,
        pageDesignerMode,
        site,
        // @sfdc-extension-block-start SFDC_EXT_STORE_LOCATOR
        selectedStoreInfo,
        // @sfdc-extension-block-end SFDC_EXT_STORE_LOCATOR
    },
}: {
    loaderData: LoaderData;
}) {
    // Currency is always provided by loader (which reads from middleware)
    if (!currency) {
        throw new Error('Currency is required but not provided by loader');
    }

    // Get app configuration from server loader data (initial load) or window.__APP_CONFIG__ (client nav)
    // This ensures config is read from MRT environment variables (via middleware), not baked at build time
    const serverData = useRouteLoaderData('root');
    const appConfig = serverData?.appConfig || (typeof window !== 'undefined' ? window.__APP_CONFIG__ : undefined);
    if (!appConfig) {
        throw new Error('App configuration not available - check server loader and window.__APP_CONFIG__');
    }

    // In server-only auth architecture:
    // - clientAuth contains only non-sensitive fields (userType, customerId, usid, etc.)
    // - These values are serialized directly from the server loader
    // - No client middleware or bootstrap needed - server is the single source of truth
    // - Tokens (accessToken, refreshToken) stay server-side only

    // Initialize Page Designer components
    initializeRegistry();

    const i18next = (typeof window === 'undefined' ? getI18next?.() : i18nextOnClient) as i18n;

    const sites = appConfig.commerce.sites as AppConfig['commerce']['sites'];
    const defaultSite = sites.find((s) => s.id === appConfig.defaultSiteId) ?? sites[0];
    const shopperAgentLocale = i18next?.language ?? defaultSite?.defaultLocale ?? appConfig.i18n.fallbackLng;

    // Memoize the providers array to prevent unnecessary remounting of providers on render
    const providers = useMemo(
        () =>
            [
                [I18nextProvider, { i18n: i18next }],
                [ConfigProvider, { config: appConfig }],
                [SiteProvider, { value: site }],
                [CurrencyProvider, { value: currency }],
                [AuthProvider, { value: clientAuth }],
                [BasketProvider, { snapshot: basketSnapshot }],
                [RecommendersProvider, { adapterName: EINSTEIN_ADAPTER_NAME }],
                [CorrelationProvider, { value: correlationId }],
                // @sfdc-extension-block-start SFDC_EXT_STORE_LOCATOR
                [StoreLocatorProvider, { selectedStoreInfo }],
                // @sfdc-extension-block-end SFDC_EXT_STORE_LOCATOR
            ] as const,
        [
            correlationId,
            i18next,
            appConfig,
            currency,
            clientAuth,
            basketSnapshot,
            site,
            // @sfdc-extension-block-start SFDC_EXT_STORE_LOCATOR
            selectedStoreInfo,
            // @sfdc-extension-block-end SFDC_EXT_STORE_LOCATOR
        ]
    );

    const hybridEnabled = Boolean(appConfig?.hybrid?.enabled);

    return (
        <ComposeProviders providers={providers}>
            <TargetProviders>
                <AuthActionExecutor />
                {hybridEnabled && <BackNavigationRevalidator />}
                <PageDesignerProvider
                    clientId="odyssey"
                    targetOrigin="*"
                    usid={clientAuth?.usid}
                    mode={pageDesignerMode}>
                    <PageDesignerInit />
                    <Outlet />
                </PageDesignerProvider>
                <TrackingConsentBanner />
                {typeof window !== 'undefined' && <PageViewTracker />}
            </TargetProviders>
            {(appConfig.commerceAgent?.enabled === 'true' || appConfig.commerceAgent?.enabled === true) && (
                <ShopperAgent
                    commerceAgentConfiguration={appConfig.commerceAgent}
                    locale={shopperAgentLocale}
                    currency={currency}
                    userId={clientAuth?.customerId}
                />
            )}
        </ComposeProviders>
    );
}

/**
 * Component that executes pending actions after authentication
 * This runs on every route to check if there are actions queued from auth interception
 */
function AuthActionExecutor() {
    useExecutePendingAction();
    return null;
}

/**
 * Revalidates loader data once on back/forward (e.g. back from SFRA). Mounted only when
 * hybrid is enabled; ensures UI is fresh after a full-page redirect. No-op when hybrid is off.
 */
function BackNavigationRevalidator() {
    const revalidator = useRevalidator();
    const didRevalidateRef = useRef(false);
    useEffect(() => {
        if (didRevalidateRef.current) return;
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
        if (nav?.type === 'back_forward' && revalidator.state === 'idle') {
            didRevalidateRef.current = true;
            void revalidator.revalidate();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return null;
}
