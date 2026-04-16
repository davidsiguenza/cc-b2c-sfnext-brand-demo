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
import {
    type ReactElement,
    type ReactNode,
    type PropsWithChildren,
    useRef,
    useEffect,
    useCallback,
    useState,
} from 'react';
import { useLocation } from 'react-router';
import { Link } from '@/components/link';
import Search from './search';
import CartBadge from './cart-badge';
import UserActions from './user-actions/user-actions';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { SparklesIcon } from '@/components/icons';
import { useConfig } from '@salesforce/storefront-next-runtime/config';
import type { AppConfig } from '@/types/config';
import { launchChat } from '@/components/shopper-agent';
import { validateShopperAgentConfig } from '@/components/shopper-agent/shopper-agent.utils';
import { UITarget } from '@/targets/ui-target';
import { getBrandId, getBrandImagePath, getBrandingPreset } from '@/config/branding-presets';

interface HeaderProps extends PropsWithChildren {
    beforeHeader?: ReactNode;
}

export default function Header({ children, beforeHeader }: HeaderProps): ReactElement {
    const { t } = useTranslation('header');
    const location = useLocation();
    const headerRef = useRef<HTMLElement>(null);
    const config = useConfig<AppConfig>();
    const brandId = getBrandId(config.global.branding.name);
    const brand = getBrandingPreset(config.global.branding.name);
    const logoSrc = getBrandImagePath(brandId, 'logo');
    const [showLogoImage, setShowLogoImage] = useState(true);
    const showChat =
        (config.commerceAgent?.enabled === 'true' || config.commerceAgent?.enabled === true) &&
        validateShopperAgentConfig(config.commerceAgent);
    const updateHeaderHeight = useCallback(() => {
        if (headerRef.current) {
            const height = `${headerRef.current.offsetHeight}px`;
            headerRef.current.style.setProperty('--header-height', height);
            document.documentElement.style.setProperty('--header-height', height);
        }
    }, []);

    useEffect(() => {
        const el = headerRef.current;
        if (!el) return;
        updateHeaderHeight();
        const observer = new ResizeObserver(updateHeaderHeight);
        observer.observe(el);
        return () => observer.disconnect();
    }, [updateHeaderHeight]);

    useEffect(() => {
        setShowLogoImage(true);
    }, [logoSrc]);

    return (
        <header
            ref={headerRef}
            className="bg-header-background text-header-foreground border-b border-border sticky top-0 z-50">
            <div className="flex justify-end px-4 lg:px-9">{beforeHeader}</div>
            <div className="px-4 lg:px-9">
                {/* Top row: Logo left, Icons right */}
                <div className="flex items-center gap-x-4 lg:gap-x-6 h-16">
                    {/* Logo - color swapped by theme via --header-logo-filter in app.css */}
                    <Link to="/" className="flex-shrink-0 flex items-center" data-testid="header-logo">
                        {showLogoImage ? (
                            <img
                                src={logoSrc}
                                alt={brand.logoAlt ?? t('logoAlt')}
                                className="h-3 lg:h-4 w-auto max-h-[100px] object-contain [filter:var(--header-logo-filter)]"
                                onError={() => setShowLogoImage(false)}
                            />
                        ) : (
                            <span className="text-sm lg:text-base font-semibold tracking-tight text-header-foreground">
                                {brand.displayName}
                            </span>
                        )}
                    </Link>

                    {/* Navigation Menu - desktop only, next to logo */}
                    <div className="hidden lg:flex items-center">{children}</div>

                    {/* Spacer - takes remaining space */}
                    <div className="flex-1" />

                    {/* Search - desktop only */}
                    <div className="hidden lg:block" data-testid="header-search-desktop">
                        <Search key={`${location.pathname}${location.search}`} />
                    </div>

                    {/* Icons group - includes mobile hamburger */}
                    <div className="flex items-center space-x-2">
                        <UITarget targetId="header.before.cart" />
                        {showChat && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="cursor-pointer lg:px-4 px-1 text-header-foreground hover:bg-transparent hover:opacity-50 transition-opacity"
                                onClick={() => launchChat()}
                                aria-label={t('openChat')}>
                                <SparklesIcon />
                            </Button>
                        )}
                        <UserActions />
                        <CartBadge />
                        <div className="lg:hidden">{children}</div>
                    </div>
                </div>

                {/* Mobile search - second row */}
                <div className="pb-4 lg:hidden" data-testid="header-search-mobile">
                    <Search key={`${location.pathname}${location.search}`} />
                </div>
            </div>
        </header>
    );
}
