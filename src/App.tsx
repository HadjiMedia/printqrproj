/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { LandingView } from './views/LandingView';
import { OrderView } from './views/OrderView';
import { TrackView } from './views/TrackView';
import { ShopQRView } from './views/ShopQRView';
import { AdminView } from './views/AdminView';
import { PricingSettings, ShopLocation } from './types/print';
import { DEFAULT_PRICING, MAXIN_SHOP } from './data/mockData';
import { fetchSettings } from './services/api';

export default function App() {
  const [currentTab, setCurrentTab] = useState<string>('landing');
  const [trackOrderId, setTrackOrderId] = useState<string>('');
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem('printdrop_admin_auth') === 'true';
  });
  const [pricing, setPricing] = useState<PricingSettings>(DEFAULT_PRICING);
  const [shop, setShop] = useState<ShopLocation>(MAXIN_SHOP);

  const refreshSettings = async () => {
    try {
      const res = await fetchSettings();
      if (res.pricing) setPricing(res.pricing);
      if (res.shops && res.shops.length > 0) setShop(res.shops[0]);
    } catch (_) {}
  };

  useEffect(() => {
    refreshSettings();
    const interval = setInterval(refreshSettings, 10000);
    return () => clearInterval(interval);
  }, []);

  // Handle URL parameters for direct deep-linking from QR codes or share links
  useEffect(() => {
    const parseUrl = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        const order = params.get('order');

        if (order) {
          setTrackOrderId(order);
          setCurrentTab('track');
        } else if (tab && ['landing', 'order', 'track', 'qr', 'admin'].includes(tab)) {
          setCurrentTab(tab);
        }
      } catch (e) {
        console.error('URL parse error:', e);
      }
    };

    parseUrl();
    window.addEventListener('popstate', parseUrl);
    return () => window.removeEventListener('popstate', parseUrl);
  }, []);

  const handleNavigate = (tab: string, param?: string) => {
    setCurrentTab(tab);
    if (tab === 'track' && param) {
      setTrackOrderId(param);
    }

    // Update browser URL query without reloading
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      if (tab === 'track' && param) {
        url.searchParams.set('order', param);
      } else {
        url.searchParams.delete('order');
      }
      url.searchParams.delete('shop');
      window.history.pushState({}, '', url.toString());
    } catch (e) {
      // Ignore URL state error in constrained environments
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLoginChange = (loggedIn: boolean) => {
    setIsAdminLoggedIn(loggedIn);
    if (loggedIn) {
      localStorage.setItem('printdrop_admin_auth', 'true');
    } else {
      localStorage.removeItem('printdrop_admin_auth');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8F5] text-[#20352A]">
      {/* Navigation */}
      <Navbar
        currentTab={currentTab}
        onNavigate={handleNavigate}
        isAdminLoggedIn={isAdminLoggedIn}
      />

      {/* Main Content Body */}
      <main className="flex-1">
        {currentTab === 'landing' && (
          <LandingView
            onNavigate={handleNavigate}
            pricing={pricing}
            shop={shop}
          />
        )}

        {currentTab === 'order' && (
          <OrderView
            onNavigate={handleNavigate}
          />
        )}

        {currentTab === 'track' && (
          <TrackView
            initialOrderId={trackOrderId}
            onNavigate={handleNavigate}
          />
        )}

        {currentTab === 'qr' && (
          <ShopQRView
            onNavigate={handleNavigate}
          />
        )}

        {currentTab === 'admin' && (
          <AdminView
            isAdminLoggedIn={isAdminLoggedIn}
            onLoginChange={handleLoginChange}
            onSettingsSaved={refreshSettings}
          />
        )}
      </main>

      {/* Footer */}
      <Footer onNavigate={handleNavigate} />
    </div>
  );
}
