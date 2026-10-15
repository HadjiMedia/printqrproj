import { useState, useEffect } from 'react';
import { 
  FileUp, 
  QrCode, 
  Search, 
  Printer, 
  Clock, 
  CheckCircle2, 
  ShieldCheck, 
  FileText, 
  Image, 
  Layers, 
  ArrowRight,
  Store,
  Sparkles,
  Smartphone
} from 'lucide-react';
import { MAXIN_SHOP, DEFAULT_PRICING } from '../data/mockData';
import { QRCodeDisplay } from '../components/QRCodeDisplay';
import { PricingSettings, ShopLocation } from '../types/print';
import { fetchSettings } from '../services/api';

interface LandingViewProps {
  onNavigate: (tab: string, param?: string) => void;
  pricing?: PricingSettings;
  shop?: ShopLocation;
}

export function LandingView({ onNavigate, pricing: propPricing, shop: propShop }: LandingViewProps) {
  const [trackInput, setTrackInput] = useState('');
  const [showQrModal, setShowQrModal] = useState(false);
  const [livePricing, setLivePricing] = useState<PricingSettings>(propPricing || DEFAULT_PRICING);
  const [liveShop, setLiveShop] = useState<ShopLocation>(propShop || MAXIN_SHOP);

  useEffect(() => {
    if (propPricing) setLivePricing(propPricing);
    if (propShop) setLiveShop(propShop);
  }, [propPricing, propShop]);

  useEffect(() => {
    fetchSettings().then(res => {
      if (res.pricing) setLivePricing(res.pricing);
      if (res.shops && res.shops.length > 0) setLiveShop(res.shops[0]);
    }).catch(() => {});
  }, []);

  const pricing = livePricing;
  const shop = liveShop;
  const shopOrderUrl = `${window.location.origin}/?tab=order`;

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (trackInput.trim()) {
      onNavigate('track', trackInput.trim());
    }
  };

  return (
    <div className="space-y-16 pb-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-8 md:pt-14 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-6">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#D4DDD5] text-xs font-semibold text-[#23664B] shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-[#23664B] animate-pulse"></span>
                <span>Maxin Printing Service — Fast & Contactless</span>
              </div>

              {/* Title */}
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-[#20352A] leading-[1.15]">
                Send your files now, <br className="hidden sm:inline" />
                <span className="text-[#23664B]">pick up in minutes</span> without the line.
              </h1>

              {/* Description */}
              <p className="text-base sm:text-lg text-[#5A6E64] max-w-xl leading-relaxed">
                Scan the counter QR code from your phone or upload your documents right here. Choose your paper size, color mode, and copies, get an instant queue ticket, and follow live printing updates until collection.
              </p>

              {/* Primary Actions */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => onNavigate('order')}
                  className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-[#23664B] text-white font-semibold text-sm shadow-md hover:bg-[#1b523c] transition-all cursor-pointer group"
                >
                  <FileUp className="w-4 h-4 transition-transform group-hover:-translate-y-0.5" />
                  <span>Place a Print Order</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setShowQrModal(true)}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-white border border-[#D4DDD5] text-[#20352A] font-semibold text-sm hover:border-[#23664B] hover:bg-[#F7F8F5] transition-all cursor-pointer"
                >
                  <QrCode className="w-4 h-4 text-[#23664B]" />
                  <span>Scan Counter QR</span>
                </button>
              </div>

              {/* Quick Tracking Search Bar */}
              <div className="pt-4 border-t border-[#E2E7E2] max-w-lg">
                <p className="text-xs font-semibold text-[#5A6E64] uppercase tracking-wider mb-2">
                  Already placed an order? Track queue status:
                </p>
                <form onSubmit={handleTrackSubmit} className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A6E64]" />
                    <input
                      type="text"
                      value={trackInput}
                      onChange={e => setTrackInput(e.target.value)}
                      placeholder="Enter Ticket # (e.g. #1046) or Order ID"
                      className="w-full pl-10 pr-3 py-2.5 bg-white border border-[#D4DDD5] rounded-xl text-xs sm:text-sm text-[#20352A] placeholder:text-[#5A6E64]/60 focus:outline-none focus:ring-2 focus:ring-[#23664B]/30 focus:border-[#23664B]"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2.5 bg-[#20352A] text-white text-xs sm:text-sm font-semibold rounded-xl hover:bg-[#23664B] transition-colors"
                  >
                    Track
                  </button>
                </form>
              </div>
            </div>

            {/* Right Interactive Card: Maxin Printing Service Live QR */}
            <div className="lg:col-span-5">
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#D4DDD5] shadow-sm relative">
                {/* Store header */}
                <div className="flex items-center justify-between pb-4 border-b border-[#E2E7E2]">
                  <div>
                    <span className="text-[11px] font-bold text-[#23664B] uppercase tracking-wider">
                      Official Counter Kiosk
                    </span>
                    <h3 className="font-bold text-base text-[#20352A] mt-0.5">{shop.name}</h3>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#eef4f1] text-[#23664B]">
                      ~{shop.avgWaitMins} min wait
                    </span>
                    <span className="text-[10px] text-[#5A6E64] font-medium">
                      {shop.activeQueueCount} order{shop.activeQueueCount === 1 ? '' : 's'} in queue
                    </span>
                  </div>
                </div>

                {/* QR Display */}
                <div className="py-6 flex flex-col items-center">
                  <QRCodeDisplay
                    value={shopOrderUrl}
                    size={180}
                    label={shop.name.toUpperCase()}
                    sublabel="Point camera to open upload page"
                    showActions={false}
                  />

                  <div className="mt-4 text-center space-y-1">
                    <p className="text-xs text-[#5A6E64]">
                      {shop.address}
                    </p>
                    <p className="text-[11px] font-medium text-[#20352A]">
                      {shop.counterInfo}
                    </p>
                  </div>
                </div>

                {/* Bottom Action */}
                <div className="pt-4 border-t border-[#E2E7E2] flex items-center justify-between text-xs">
                  <span className="text-[#5A6E64]">Store open: {shop.hours}</span>
                  <button
                    type="button"
                    onClick={() => onNavigate('order')}
                    className="font-semibold text-[#23664B] hover:underline inline-flex items-center gap-1"
                  >
                    Order Online Now
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works (3 Steps) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <p className="text-xs font-bold uppercase tracking-wider text-[#23664B]">Frictionless Workflow</p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#20352A] mt-1">
            How {shop.name} works
          </h2>
          <p className="text-sm text-[#5A6E64] mt-2">
            No registration or account creation required. Just scan or upload, configure, and collect at the counter.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Step 1 */}
          <div className="bg-white rounded-2xl p-6 border border-[#D4DDD5] shadow-2xs hover:border-[#23664B]/40 transition-all">
            <div className="w-12 h-12 rounded-xl bg-[#eef4f1] text-[#23664B] flex items-center justify-center font-bold text-lg mb-4">
              1
            </div>
            <h3 className="font-bold text-base text-[#20352A]">Upload & Configure</h3>
            <p className="text-xs sm:text-sm text-[#5A6E64] mt-2 leading-relaxed">
              Drop your PDF, Word DOCX, or images. Choose Ordinary paper (Letter, A4, Legal, A3) or Photo Paper — Glossy (4R, 5R, A4), Single-Sided or Back-to-Back, and optional Borderless Printing.
            </p>
            <div className="mt-4 pt-3 border-t border-[#F7F8F5] flex items-center gap-2 text-xs font-medium text-[#23664B]">
              <Smartphone className="w-3.5 h-3.5" />
              <span>Works instantly from phone or laptop</span>
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-white rounded-2xl p-6 border border-[#D4DDD5] shadow-2xs hover:border-[#23664B]/40 transition-all">
            <div className="w-12 h-12 rounded-xl bg-[#eef4f1] text-[#23664B] flex items-center justify-center font-bold text-lg mb-4">
              2
            </div>
            <h3 className="font-bold text-base text-[#20352A]">Live Queue Ticket</h3>
            <p className="text-xs sm:text-sm text-[#5A6E64] mt-2 leading-relaxed">
              Receive your personalized confirmation receipt with assigned queue number like <span className="font-mono font-bold text-[#20352A]">#1046</span>. Watch live progress.
            </p>
            <div className="mt-4 pt-3 border-t border-[#F7F8F5] flex items-center gap-2 text-xs font-medium text-[#23664B]">
              <Clock className="w-3.5 h-3.5" />
              <span>Real-time status updates</span>
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-white rounded-2xl p-6 border border-[#D4DDD5] shadow-2xs hover:border-[#23664B]/40 transition-all">
            <div className="w-12 h-12 rounded-xl bg-[#eef4f1] text-[#23664B] flex items-center justify-center font-bold text-lg mb-4">
              3
            </div>
            <h3 className="font-bold text-base text-[#20352A]">Quick Counter Pickup</h3>
            <p className="text-xs sm:text-sm text-[#5A6E64] mt-2 leading-relaxed">
              When your status advances to <span className="font-semibold text-emerald-700">"Ready for Pickup"</span>, show your queue number at the counter, pay via Cash/GCash, and collect your prints!
            </p>
            <div className="mt-4 pt-3 border-t border-[#F7F8F5] flex items-center gap-2 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Zero time wasted in lines</span>
            </div>
          </div>
        </div>
      </section>

      {/* Transparent Pricing Table */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-xl mx-auto mb-8">
          <p className="text-xs font-bold uppercase tracking-wider text-[#23664B]">Transparent Rates</p>
          <h2 className="text-2xl font-bold text-[#20352A] mt-1">Live & Synchronized Pricing</h2>
          <p className="text-xs sm:text-sm text-[#5A6E64] mt-1">
            Real-time price calculation before you submit your file in Philippine Pesos (₱).
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-[#D4DDD5] text-center space-y-2">
            <span className="text-xs font-bold text-[#5A6E64] uppercase tracking-wider">Short / Letter</span>
            <p className="text-2xl font-extrabold text-[#20352A]">₱{pricing.pagePrices.Letter.bw}.00 <span className="text-xs font-normal text-[#5A6E64]">/ B&W (₱{pricing.pagePrices.Letter.color} Color)</span></p>
            <p className="text-[11px] text-[#5A6E64]">Resumes, assignments, questionnaires, school forms</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#23664B] text-center space-y-2 shadow-xs relative">
            <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-[#23664B] text-white text-[10px] font-bold">
              Standard
            </div>
            <span className="text-xs font-bold text-[#23664B] uppercase tracking-wider">A4 Standard</span>
            <p className="text-2xl font-extrabold text-[#20352A]">₱{pricing.pagePrices.A4.bw}.00 <span className="text-xs font-normal text-[#5A6E64]">/ B&W (₱{pricing.pagePrices.A4.color} Color)</span></p>
            <p className="text-[11px] text-[#5A6E64]">Business presentations, thesis reports, certificates</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#D4DDD5] text-center space-y-2">
            <span className="text-xs font-bold text-[#5A6E64] uppercase tracking-wider">Long / Legal</span>
            <p className="text-2xl font-extrabold text-[#20352A]">₱{pricing.pagePrices.Legal.bw}.00 <span className="text-xs font-normal text-[#5A6E64]">/ B&W (₱{pricing.pagePrices.Legal.color} Color)</span></p>
            <p className="text-[11px] text-[#5A6E64]">Legal documents, contracts, accounting ledgers</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#D4DDD5] text-center space-y-2">
            <span className="text-xs font-bold text-[#5A6E64] uppercase tracking-wider">A3 Large Paper</span>
            <p className="text-2xl font-extrabold text-[#20352A]">₱{pricing.pagePrices.A3?.bw ?? 12}.00 <span className="text-xs font-normal text-[#5A6E64]">/ B&W (₱{pricing.pagePrices.A3?.color ?? 20} Color)</span></p>
            <p className="text-[11px] text-[#5A6E64]">Architectural plans, engineering schematics, posters</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#D4DDD5] text-center space-y-2">
            <span className="text-xs font-bold text-[#5A6E64] uppercase tracking-wider">Photo Paper — Glossy</span>
            <p className="text-2xl font-extrabold text-[#20352A]">From ₱{pricing.photoPaperPrices?.glossy?.bw ?? 25}.00</p>
            <p className="text-[11px] text-[#5A6E64]">4R (4×6 in), 5R (5×7 in), and A4 Photo Glossy</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#D4DDD5] text-center space-y-2">
            <span className="text-xs font-bold text-[#5A6E64] uppercase tracking-wider">Back-to-Back (Duplex)</span>
            <p className="text-2xl font-extrabold text-[#20352A]">+{pricing.surcharges?.backToBack ? `₱${pricing.surcharges.backToBack}.00` : '₱5.00'}</p>
            <p className="text-[11px] text-[#5A6E64]">Per document printing job on supported ordinary paper</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#D4DDD5] text-center space-y-2">
            <span className="text-xs font-bold text-[#5A6E64] uppercase tracking-wider">Borderless Printing</span>
            <p className="text-2xl font-extrabold text-[#20352A]">+{pricing.surcharges?.borderless ? `₱${pricing.surcharges.borderless}.00` : '₱5.00'}</p>
            <p className="text-[11px] text-[#5A6E64]">Full-bleed edge-to-edge printing per document</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#D4DDD5] text-center space-y-2">
            <span className="text-xs font-bold text-[#5A6E64] uppercase tracking-wider">Binding & Finishing</span>
            <p className="text-2xl font-extrabold text-[#20352A]">From ₱{pricing.bindingPrices?.staple ?? 5}.00</p>
            <p className="text-[11px] text-[#5A6E64]">Staple ₱{pricing.bindingPrices?.staple ?? 5}.00 • Spiral ₱{pricing.bindingPrices?.spiral ?? 35}.00 • Booklet ₱{pricing.bindingPrices?.booklet ?? 45}.00</p>
          </div>
        </div>
      </section>

      {/* QR Code Scan Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 border border-[#D4DDD5] shadow-xl text-center space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#E2E7E2]">
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-[#23664B]" />
                <h3 className="font-bold text-sm text-[#20352A]">{shop.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="text-[#5A6E64] hover:text-[#20352A] text-lg font-bold"
              >
                ×
              </button>
            </div>

            <QRCodeDisplay
              value={shopOrderUrl}
              size={200}
              label="SCAN WITH YOUR SMARTPHONE"
              sublabel="Opens instant upload page for Maxin Printing Service"
            />

            <p className="text-xs text-[#5A6E64]">
              Point your smartphone camera at this code to order prints without downloading an app.
            </p>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowQrModal(false);
                  onNavigate('order');
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#23664B] text-white text-xs font-semibold hover:bg-[#1b523c]"
              >
                Continue on this Device
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
