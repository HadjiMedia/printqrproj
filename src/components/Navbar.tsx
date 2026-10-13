import { useState, useEffect } from 'react';
import { Printer, QrCode, Search, Shield, Menu, X, FileUp, Store } from 'lucide-react';
import { MAXIN_SHOP } from '../data/mockData';

interface NavbarProps {
  currentTab: string;
  onNavigate: (tab: string, param?: string) => void;
  isAdminLoggedIn: boolean;
}

export function Navbar({
  currentTab,
  onNavigate,
  isAdminLoggedIn,
}: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [waitingCount, setWaitingCount] = useState(0);

  useEffect(() => {
    const updateCount = async () => {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          const shop = data.shops?.[0];
          if (shop) setWaitingCount(shop.activeQueueCount || 0);
        }
      } catch (_) {}
    };
    updateCount();
    const interval = setInterval(updateCount, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleNav = (tab: string, param?: string) => {
    onNavigate(tab, param);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E2E7E2] transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-4 sm:gap-6">
            <button
              type="button"
              onClick={() => handleNav('landing')}
              className="flex items-center gap-2.5 group text-left cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-[#23664B] flex items-center justify-center text-white shadow-xs group-hover:bg-[#1b523c] transition-colors shrink-0">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-base sm:text-lg tracking-tight text-[#20352A] group-hover:text-[#23664B] transition-colors flex items-center gap-1.5">
                  Maxin Printing Service
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.2 rounded-full bg-[#eef4f1] text-[#23664B] border border-[#d6e6df]">
                    PrintDrop
                  </span>
                </span>
                <p className="text-[11px] text-[#5A6E64] font-medium leading-none">Instant Print & Pickup Counter</p>
              </div>
            </button>

            {/* Shop Badge (Fixed to Maxin Printing Service) */}
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#F7F8F5] border border-[#E2E7E2] text-xs text-[#5A6E64]">
              <Store className="w-3.5 h-3.5 text-[#23664B]" />
              <span className="font-medium text-[#20352A]">Main Store Front</span>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleNav('landing')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentTab === 'landing'
                  ? 'text-[#23664B] bg-[#eef4f1]'
                  : 'text-[#20352A] hover:text-[#23664B] hover:bg-[#F7F8F5]'
              }`}
            >
              Home
            </button>

            <button
              type="button"
              onClick={() => handleNav('order')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                currentTab === 'order'
                  ? 'text-[#23664B] bg-[#eef4f1]'
                  : 'text-[#20352A] hover:text-[#23664B] hover:bg-[#F7F8F5]'
              }`}
            >
              <FileUp className="w-4 h-4" />
              <span>Send Files / Order</span>
            </button>

            <button
              type="button"
              onClick={() => handleNav('track')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                currentTab === 'track'
                  ? 'text-[#23664B] bg-[#eef4f1]'
                  : 'text-[#20352A] hover:text-[#23664B] hover:bg-[#F7F8F5]'
              }`}
            >
              <Search className="w-4 h-4" />
              <span>Track Order</span>
            </button>

            <button
              type="button"
              onClick={() => handleNav('qr')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                currentTab === 'qr'
                  ? 'text-[#23664B] bg-[#eef4f1]'
                  : 'text-[#20352A] hover:text-[#23664B] hover:bg-[#F7F8F5]'
              }`}
            >
              <QrCode className="w-4 h-4" />
              <span>Shop QR Standee</span>
            </button>
          </nav>

          {/* Right Action: Admin Portal Button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleNav('admin')}
              className={`relative inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                currentTab === 'admin'
                  ? 'bg-[#23664B] text-white border-[#23664B] shadow-xs'
                  : 'bg-white text-[#20352A] border-[#D4DDD5] hover:border-[#23664B] hover:bg-[#F7F8F5]'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Staff Dashboard</span>
              <span className="sm:hidden">Staff</span>
              {waitingCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-white font-bold animate-pulse">
                  {waitingCount}
                </span>
              )}
            </button>

            {/* Mobile menu toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-[#20352A] hover:bg-[#F7F8F5] border border-[#E2E7E2]"
              aria-label="Toggle navigation"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden py-4 border-t border-[#E2E7E2] space-y-2">
            <button
              type="button"
              onClick={() => handleNav('landing')}
              className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-[#20352A] hover:bg-[#eef4f1]"
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => handleNav('order')}
              className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-[#23664B] bg-[#eef4f1] font-semibold flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <FileUp className="w-4 h-4" /> Place Print Order
              </span>
              <span className="text-xs font-normal bg-white px-2 py-0.5 rounded">Fast</span>
            </button>
            <button
              type="button"
              onClick={() => handleNav('track')}
              className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-[#20352A] hover:bg-[#eef4f1] flex items-center gap-2"
            >
              <Search className="w-4 h-4" /> Track Print Status
            </button>
            <button
              type="button"
              onClick={() => handleNav('qr')}
              className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-[#20352A] hover:bg-[#eef4f1] flex items-center gap-2"
            >
              <QrCode className="w-4 h-4" /> Shop QR Standee & Direct Scan
            </button>
            <button
              type="button"
              onClick={() => handleNav('admin')}
              className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-[#20352A] hover:bg-[#eef4f1] flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <Shield className="w-4 h-4" /> Staff Admin Queue
              </span>
              {waitingCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-amber-500 text-white font-bold">
                  {waitingCount} active
                </span>
              )}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
