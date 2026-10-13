import { Printer, Store, Shield, MapPin, Phone, Clock, QrCode } from 'lucide-react';
import { MAXIN_SHOP } from '../data/mockData';

interface FooterProps {
  onNavigate: (tab: string, param?: string) => void;
}

export function Footer({ onNavigate }: FooterProps) {
  return (
    <footer className="bg-white border-t border-[#E2E7E2] mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand & info */}
          <div className="space-y-3 md:col-span-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#23664B] text-white flex items-center justify-center font-bold">
                <Printer className="w-4 h-4" />
              </div>
              <span className="font-bold text-base tracking-tight text-[#20352A]">
                PrintDrop
              </span>
            </div>
            <p className="text-xs text-[#5A6E64] leading-relaxed">
              Fast, contactless printing for students, businesses, and neighborhood residents. Skip lines and collect your prints in minutes.
            </p>
          </div>

          {/* Quick links */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-[#20352A] uppercase tracking-wider">
              Customer Services
            </h4>
            <ul className="space-y-1.5 text-xs text-[#5A6E64]">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('order')}
                  className="hover:text-[#23664B] transition-colors"
                >
                  Place a Print Order
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('track')}
                  className="hover:text-[#23664B] transition-colors"
                >
                  Track Order Queue Status
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('qr')}
                  className="hover:text-[#23664B] transition-colors"
                >
                  Shop QR Code Standees
                </button>
              </li>
            </ul>
          </div>

          {/* Store Location */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-[#20352A] uppercase tracking-wider">
              Store Location
            </h4>
            <div className="space-y-1.5 text-xs text-[#5A6E64]">
              <p className="font-semibold text-[#20352A]">{MAXIN_SHOP.name}</p>
              <p className="text-[11px] leading-tight flex items-start gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#23664B] shrink-0 mt-0.5" />
                <span>{MAXIN_SHOP.address} — {MAXIN_SHOP.counterInfo}</span>
              </p>
              <p className="text-[11px] flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-[#23664B] shrink-0" />
                <span>{MAXIN_SHOP.phone}</span>
              </p>
            </div>
          </div>

          {/* Staff & Hours */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-[#20352A] uppercase tracking-wider">
              Staff & Support
            </h4>
            <p className="text-xs text-[#5A6E64]">
              Mon - Sat: 7:30 AM - 9:00 PM <br />
              Sunday: 9:00 AM - 6:00 PM
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => onNavigate('admin')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F7F8F5] border border-[#D4DDD5] text-xs font-medium text-[#20352A] hover:bg-[#eef4f1] hover:text-[#23664B] transition-colors"
              >
                <Shield className="w-3.5 h-3.5 text-[#23664B]" />
                <span>Staff Admin Portal</span>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-[#E2E7E2] flex flex-col sm:flex-row items-center justify-between text-xs text-[#5A6E64] gap-2">
          <p>© {new Date().getFullYear()} PrintDrop Printing Systems. All rights reserved.</p>
          <p className="text-[11px]">Secure direct printing • Private localized file archive</p>
        </div>
      </div>
    </footer>
  );
}
