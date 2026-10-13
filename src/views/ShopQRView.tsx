import { useState } from 'react';
import { 
  Store, 
  Printer, 
  Copy, 
  Check, 
  ArrowRight,
  MapPin,
  Clock
} from 'lucide-react';
import { MAXIN_SHOP } from '../data/mockData';
import { QRCodeDisplay } from '../components/QRCodeDisplay';

interface ShopQRViewProps {
  onNavigate: (tab: string, param?: string) => void;
}

export function ShopQRView({ onNavigate }: ShopQRViewProps) {
  const [copied, setCopied] = useState(false);
  const shopUrl = `${window.location.origin}/?tab=order`;

  const handlePrintStandee = () => {
    window.print();
  };

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(shopUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="text-center max-w-xl mx-auto space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#eef4f1] text-[#23664B] text-xs font-semibold">
          <Store className="w-3.5 h-3.5" />
          <span>Counter QR Standee</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#20352A]">
          Maxin Printing Service QR Standee
        </h1>
        <p className="text-xs sm:text-sm text-[#5A6E64]">
          Place this QR standee on the counter, front desk, or shop door. Walk-in customers scan it with their phone camera to submit print jobs directly.
        </p>
      </div>

      {/* Printable Standee Display Card */}
      <div className="max-w-md mx-auto bg-white rounded-3xl p-8 border-2 border-[#23664B]/30 shadow-md text-center space-y-6 print:border-none print:shadow-none print:p-0">
        {/* Standee Header */}
        <div className="space-y-1">
          <div className="inline-block px-3.5 py-1 rounded-full bg-[#23664B] text-white text-[11px] font-black uppercase tracking-widest shadow-2xs">
            MAXIN PRINTING SERVICE
          </div>
          <h2 className="text-2xl font-black text-[#20352A] tracking-tight mt-2">
            SCAN TO PRINT HERE
          </h2>
          <p className="text-xs text-[#5A6E64]">
            Fast • Contactless • No Lines
          </p>
        </div>

        {/* QR Code Container */}
        <div className="flex justify-center py-2">
          <QRCodeDisplay
            value={shopUrl}
            size={220}
            label="MAXIN PRINTING SERVICE"
            sublabel="Scan with Camera or QR Reader"
            showActions={false}
          />
        </div>

        {/* Instructions block */}
        <div className="bg-[#F7F8F5] rounded-2xl p-4 text-xs text-[#20352A] space-y-2 border border-[#E2E7E2]">
          <div className="flex items-center justify-between text-left border-b border-[#E2E7E2] pb-2">
            <span className="font-semibold text-[#5A6E64]">Shop:</span>
            <span className="font-bold text-[#23664B]">{MAXIN_SHOP.name}</span>
          </div>
          <div className="flex items-center justify-between text-left border-b border-[#E2E7E2] pb-2">
            <span className="font-semibold text-[#5A6E64]">Counter:</span>
            <span>{MAXIN_SHOP.counterInfo}</span>
          </div>
          <div className="flex items-center justify-between text-left">
            <span className="font-semibold text-[#5A6E64]">Hours:</span>
            <span className="font-semibold text-emerald-800">{MAXIN_SHOP.hours}</span>
          </div>
        </div>

        <p className="text-[11px] text-[#5A6E64] font-medium leading-tight">
          1. Point phone camera &nbsp;→&nbsp; 2. Upload file &nbsp;→&nbsp; 3. Pick up at counter
        </p>

        {/* Actions (Hidden when printing via print:hidden) */}
        <div className="pt-2 flex flex-col sm:flex-row gap-2 print:hidden">
          <button
            type="button"
            onClick={handlePrintStandee}
            className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#23664B] text-white text-xs font-bold hover:bg-[#1b523c] shadow-xs transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Counter Standee</span>
          </button>

          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl bg-white border border-[#D4DDD5] text-xs font-semibold text-[#20352A] hover:bg-[#F7F8F5] transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-[#5A6E64]" />}
            <span>{copied ? 'Link Copied' : 'Copy URL'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
