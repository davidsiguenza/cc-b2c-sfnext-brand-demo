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
import { useEffect, useState, type ReactElement, type PropsWithChildren } from 'react';
import { Link, useLocation } from 'react-router';
import Search from './search';
import CartBadge from './cart-badge';
import UserActions from './user-actions/user-actions';
import { PluginComponent } from '@/plugins/plugin-component';
import { useConfig } from '@/config';
import { getBrandId, getBrandImagePath, getBrandingPreset } from '@/config/branding-presets';

export default function Header({ children }: PropsWithChildren): ReactElement {
    const location = useLocation();
    const config = useConfig();
    const brandId = getBrandId(config.global.branding.name);
    const brand = getBrandingPreset(config.global.branding.name);
    const logoSrc = getBrandImagePath(brandId, 'logo');
    const [showLogoImage, setShowLogoImage] = useState(true);

    useEffect(() => {
        setShowLogoImage(true);
    }, [logoSrc]);

    return (
        <header className="bg-background shadow-md sticky top-0 z-50">
            <div className="container mx-auto px-4 py-4">
                <div className="flex items-center justify-between">
                    {/* Logo */}
                    <Link to="/" className="flex items-center space-x-4">
                        {showLogoImage ? (
                            <img
                                src={logoSrc}
                                alt={brand.logoAlt}
                                className="block w-auto max-w-full shrink-0 object-contain"
                                style={{ height: '48px', maxHeight: '100px' }}
                                onError={() => setShowLogoImage(false)}
                            />
                        ) : (
                            <span className="text-xl font-semibold tracking-tight text-foreground">
                                {brand.displayName}
                            </span>
                        )}
                    </Link>

                    {/* Mega Menu */}
                    {children}

                    {/* Search, Account Icon, Cart */}
                    <div className="flex items-center space-x-4">
                        <Search key={`${location.pathname}${location.search}`} />
                        <PluginComponent pluginId="header.before.cart" />
                        <UserActions />
                        <CartBadge />
                    </div>
                </div>
            </div>
        </header>
    );
}
