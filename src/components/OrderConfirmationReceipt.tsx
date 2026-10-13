import { useState, useEffect, useRef } from 'react';
import { 
  Printer, 
  Download, 
  CheckCircle2, 
  Clock, 
  ArrowLeft, 
  FileText, 
  RefreshCw, 
  Store, 
  Phone, 
  MapPin, 
  Sparkles,
  AlertCircle,
  CheckCheck,
  XCircle,
  Copy,
  Check
} from 'lucide-react';
import { PrintOrder, OrderStatus } from '../types/print';
import { MAXIN_SHOP, formatBytes } from '../data/mockData';
import { trackOrder, getFileDownloadUrl } from '../services/api';

interface OrderConfirmationReceiptProps {
  order: PrintOrder;
  trackingToken?: string;
  onNavigateHome: () => void;
  onOrderUpdated?: (order: PrintOrder) => void;
}

export function OrderConfirmationReceipt({
  order: initialOrder,
  trackingToken,
  onNavigateHome,
  onOrderUpdated,
}: OrderConfirmationReceiptProps) {
  const [currentOrder, setCurrentOrder] = useState<PrintOrder>(initialOrder);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const pollRef = useRef<any>(null);

  // Poll for live status updates from server every 4 seconds
  useEffect(() => {
    setCurrentOrder(initialOrder);
  }, [initialOrder]);

  useEffect(() => {
    const pollStatus = async () => {
      if (currentOrder.status === 'completed' || currentOrder.status === 'cancelled') {
        return;
      }
      try {
        const token = trackingToken || currentOrder.trackingToken;
        const res = await trackOrder(currentOrder.id, token);
        if (res.order) {
          setCurrentOrder(res.order);
          if (onOrderUpdated) onOrderUpdated(res.order);
        }
      } catch (_) {}
    };

    pollRef.current = setInterval(pollStatus, 4000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [currentOrder.id, currentOrder.status, trackingToken]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      const token = trackingToken || currentOrder.trackingToken;
      const res = await trackOrder(currentOrder.id, token);
      if (res.order) {
        setCurrentOrder(res.order);
        if (onOrderUpdated) onOrderUpdated(res.order);
      }
    } catch (_) {
    } finally {
      setIsRefreshing(false);
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const handleDownloadReceipt = () => {
    const lines = [
      '==================================================',
      '             MAXIN PRINTING SERVICE               ',
      '         Official Print Order & Receipt           ',
      '==================================================',
      `Date:       ${new Date(currentOrder.createdAt).toLocaleString()}`,
      `Order ID:   ${currentOrder.id}`,
      `Queue #:    ${currentOrder.queueNumber}`,
      `Customer:   ${currentOrder.customerName}`,
      `Phone:      ${currentOrder.customerPhone || 'N/A'}`,
      `Status:     ${currentOrder.status.toUpperCase()}`,
      '--------------------------------------------------',
      'DOCUMENTS & SPECIFICATIONS:',
      ...currentOrder.files.map(
        (f, idx) =>
          ` ${idx + 1}. ${f.fileName}\n    ${f.pageCount} pgs x ${f.copies} copy(s) | ${f.paperSize} | ${f.printType.toUpperCase()} | ${f.duplex}\n    Subtotal: ₱${f.subtotal.toFixed(2)}`
      ),
      '--------------------------------------------------',
      `Finishing:  ${currentOrder.binding !== 'none' ? currentOrder.binding.toUpperCase() : 'None'}`,
      `Instructions: ${currentOrder.instructions || 'None'}`,
      '--------------------------------------------------',
      `TOTAL AMOUNT DUE: ₱${currentOrder.totalPrice.toFixed(2)}`,
      '==================================================',
      'Collection Counter: Express Claim Station',
      'Address: 124 Commercial Avenue, Ground Floor',
      'Phone: +63 917 888 5678',
      'Thank you for printing with Maxin Printing Service!',
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Maxin_Receipt_${currentOrder.queueNumber.replace('#', '')}_${currentOrder.id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyTrackingLink = () => {
    const token = trackingToken || currentOrder.trackingToken;
    const url = `${window.location.origin}/?tab=track&order=${currentOrder.id}&token=${token}`;
    navigator.clipboard?.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Timeline Step Status Evaluator
  const getStepState = (stepNumber: 1 | 2 | 3) => {
    const s = currentOrder.status;
    if (s === 'cancelled') return 'cancelled';

    if (stepNumber === 1) {
      if (s === 'waiting') return 'active';
      return 'completed'; // For printing, ready, completed
    }
    if (stepNumber === 2) {
      if (s === 'waiting') return 'upcoming';
      if (s === 'printing') return 'active';
      return 'completed'; // For ready, completed
    }
    if (stepNumber === 3) {
      if (s === 'ready') return 'active';
      if (s === 'completed') return 'completed';
      return 'upcoming';
    }
    return 'upcoming';
  };

  const firstName = currentOrder.customerName.trim().split(' ')[0] || currentOrder.customerName;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10 space-y-6">
      {/* Back to Shop Link (Hidden when printing) */}
      <div className="print:hidden flex items-center justify-between">
        <button
          type="button"
          onClick={onNavigateHome}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#23664B] hover:text-[#1b523c] transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          <span>Back to Maxin Printing Service</span>
        </button>

        <button
          type="button"
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 text-xs text-[#5A6E64] hover:text-[#20352A] px-2.5 py-1.5 rounded-xl border border-[#D4DDD5] bg-white transition-colors cursor-pointer"
          title="Refresh order status"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#23664B]' : ''}`} />
          <span className="hidden sm:inline">Refresh Status</span>
        </button>
      </div>

      {/* Main Receipt-Style Confirmation Card */}
      <div className="bg-white rounded-3xl border border-[#D4DDD5] shadow-md overflow-hidden print:border-none print:shadow-none print:p-0">
        {/* Dark Green Confirmation Header */}
        <div className="bg-[#23664B] text-white p-6 sm:p-8 space-y-4 relative overflow-hidden">
          {/* Subtle background decoration */}
          <div className="absolute right-0 top-0 translate-x-1/4 -translate-y-1/4 w-64 h-64 bg-white/5 rounded-full pointer-events-none"></div>

          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-white text-[11px] font-bold tracking-wider uppercase border border-white/20">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
            <span>PRINT ORDER CONFIRMED</span>
          </div>

          {/* Large Personalized Heading */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              You're all set, {firstName}.
            </h1>
            <p className="text-xs sm:text-sm text-white/90 mt-1.5 leading-relaxed max-w-lg">
              Follow your order progress below and show your assigned queue number when collecting your documents at the counter.
            </p>
          </div>

          {/* Prominent Queue Number & Total Price Card */}
          <div className="bg-white text-[#20352A] rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-xs border border-white/20 mt-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#5A6E64]">
                Assigned Queue Ticket
              </span>
              <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-[#23664B] tabular-nums mt-0.5">
                {currentOrder.queueNumber}
              </div>
              <p className="text-[11px] font-mono text-[#5A6E64] mt-0.5">
                Order ID: <span className="font-semibold text-[#20352A]">{currentOrder.id}</span>
              </p>
            </div>

            <div className="text-right">
              <span className="text-[11px] font-bold text-[#5A6E64] uppercase tracking-wider">
                Total Order Price
              </span>
              <div className="text-2xl sm:text-3xl font-black text-[#20352A] tabular-nums mt-0.5">
                ₱{currentOrder.totalPrice.toFixed(2)}
              </div>
              <span className="text-[10px] text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 block mt-0.5">
                Pay upon pickup
              </span>
            </div>
          </div>
        </div>

        {/* Vertical Order Progress Timeline */}
        <div className="p-6 sm:p-8 space-y-6 border-b border-[#E2E7E2]">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#23664B] flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              <span>Live Order Progress</span>
            </h2>
            <div className="flex items-center gap-1.5 text-[11px] text-[#5A6E64]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Auto-updates live</span>
            </div>
          </div>

          {/* Step list with continuous vertical connecting indicators */}
          <div className="space-y-0 pl-1">
            {/* Step 1: Order Received */}
            <div className="relative flex items-start gap-4 pb-7">
              {/* Connecting line to Step 2 */}
              <div className={`absolute left-4 top-8 bottom-0 w-0.5 -ml-[1px] ${
                getStepState(1) === 'completed' ? 'bg-[#23664B]' : 'bg-[#E2E7E2]'
              }`}></div>

              {/* Indicator circle */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 transition-all ${
                getStepState(1) === 'completed'
                  ? 'bg-[#23664B] text-white shadow-xs'
                  : getStepState(1) === 'active'
                  ? 'bg-amber-500 text-white ring-4 ring-amber-100 shadow-xs'
                  : 'bg-white border-2 border-[#D4DDD5] text-[#5A6E64]'
              }`}>
                {getStepState(1) === 'completed' ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <span className="text-xs font-bold font-mono">1</span>
                )}
              </div>

              {/* Text content */}
              <div className="pt-0.5">
                <h3 className={`text-sm font-bold ${
                  getStepState(1) === 'active' ? 'text-amber-900 font-extrabold' : 'text-[#20352A]'
                }`}>
                  Order Received
                </h3>
                <p className="text-xs text-[#5A6E64] mt-0.5 leading-relaxed">
                  Your files have been received and your order is waiting in the queue.
                </p>
              </div>
            </div>

            {/* Step 2: Printing Your Pages */}
            <div className="relative flex items-start gap-4 pb-7">
              {/* Connecting line to Step 3 */}
              <div className={`absolute left-4 top-8 bottom-0 w-0.5 -ml-[1px] ${
                getStepState(2) === 'completed' ? 'bg-[#23664B]' : 'bg-[#E2E7E2]'
              }`}></div>

              {/* Indicator circle */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 transition-all ${
                getStepState(2) === 'completed'
                  ? 'bg-[#23664B] text-white shadow-xs'
                  : getStepState(2) === 'active'
                  ? 'bg-blue-600 text-white ring-4 ring-blue-100 shadow-xs animate-pulse'
                  : 'bg-white border-2 border-[#D4DDD5] text-[#5A6E64]'
              }`}>
                {getStepState(2) === 'completed' ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Printer className="w-4 h-4" />
                )}
              </div>

              {/* Text content */}
              <div className="pt-0.5">
                <h3 className={`text-sm font-bold ${
                  getStepState(2) === 'active' ? 'text-blue-900 font-extrabold' : 'text-[#20352A]'
                }`}>
                  Printing Your Pages
                </h3>
                <p className="text-xs text-[#5A6E64] mt-0.5 leading-relaxed">
                  The print team is currently printing your order.
                </p>
              </div>
            </div>

            {/* Step 3: Ready for Pickup */}
            <div className="relative flex items-start gap-4">
              {/* Indicator circle */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 transition-all ${
                getStepState(3) === 'completed'
                  ? 'bg-[#20352A] text-white shadow-xs'
                  : getStepState(3) === 'active'
                  ? 'bg-emerald-600 text-white ring-4 ring-emerald-100 shadow-md animate-bounce'
                  : 'bg-white border-2 border-[#D4DDD5] text-[#5A6E64]'
              }`}>
                {getStepState(3) === 'completed' ? (
                  <CheckCheck className="w-4 h-4" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
              </div>

              {/* Text content */}
              <div className="pt-0.5">
                <h3 className={`text-sm font-bold ${
                  getStepState(3) === 'active' ? 'text-emerald-900 font-extrabold' : 'text-[#20352A]'
                }`}>
                  Ready for Pickup
                </h3>
                <p className="text-xs text-[#5A6E64] mt-0.5 leading-relaxed">
                  Your pages are ready at the counter. Please present Ticket{' '}
                  <span className="font-mono font-bold text-[#23664B]">{currentOrder.queueNumber}</span> at the counter.
                </p>
              </div>
            </div>
          </div>

          {/* Final State Banner for Completed or Cancelled */}
          {currentOrder.status === 'completed' && (
            <div className="p-3.5 rounded-2xl bg-gray-100 border border-gray-200 text-xs text-gray-800 flex items-center gap-2.5">
              <CheckCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              <span><strong>Order Completed:</strong> You have collected and settled this order. Thank you!</span>
            </div>
          )}

          {currentOrder.status === 'cancelled' && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-center gap-2.5">
              <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span><strong>Order Cancelled:</strong> {currentOrder.statusMessage || 'This order was cancelled.'}</span>
            </div>
          )}
        </div>

        {/* Compact Official Receipt Section */}
        <div className="p-6 sm:p-8 space-y-5 bg-[#F7F8F5]/50 print:bg-white print:p-0">
          <div className="flex items-center justify-between border-b border-[#E2E7E2] pb-3">
            <div>
              <span className="font-extrabold text-sm text-[#20352A]">Maxin Printing Service</span>
              <p className="text-[11px] text-[#5A6E64]">Official Print Order Manifest & Receipt</p>
            </div>
            <span className="text-[11px] font-mono text-[#5A6E64]">
              {new Date(currentOrder.createdAt).toLocaleDateString()}
            </span>
          </div>

          {/* Itemized Document Table */}
          <div className="space-y-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#5A6E64]">
              Itemized Documents ({currentOrder.files.length})
            </span>

            <div className="divide-y divide-[#E2E7E2] border-y border-[#E2E7E2]">
              {currentOrder.files.map((file, idx) => (
                <div key={file.id || idx} className="py-2.5 flex items-start justify-between text-xs gap-3">
                  <div className="space-y-0.5">
                    <p className="font-bold text-[#20352A] leading-tight">
                      {idx + 1}. {file.fileName}
                    </p>
                    <p className="text-[11px] text-[#5A6E64]">
                      {file.pageCount} page(s) × {file.copies} copy(s) • {file.paperSize} • {file.printType === 'color' ? 'Full Color' : 'Black & White'} • {file.duplex !== 'single' ? 'Double-Sided' : 'Single-Sided'}
                    </p>
                  </div>
                  <span className="font-bold text-[#20352A] shrink-0">
                    ₱{file.subtotal.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Extras / Finishing */}
          {currentOrder.binding !== 'none' && (
            <div className="flex justify-between text-xs text-[#5A6E64] pt-1">
              <span>Binding / Collation ({currentOrder.binding}):</span>
              <span className="font-medium text-[#20352A]">Included in total</span>
            </div>
          )}

          {currentOrder.instructions && (
            <div className="p-2.5 rounded-xl bg-white border border-[#E2E7E2] text-xs">
              <span className="font-bold text-[#20352A]">Special Instructions:</span>{' '}
              <span className="text-[#5A6E64] italic">"{currentOrder.instructions}"</span>
            </div>
          )}

          {/* Receipt Totals Breakdown */}
          <div className="pt-2 border-t border-[#E2E7E2] space-y-1 text-xs">
            <div className="flex justify-between font-extrabold text-sm text-[#20352A] pt-1">
              <span>Total Amount Due:</span>
              <span className="text-base text-[#23664B]">₱{currentOrder.totalPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[11px] text-[#5A6E64]">
              <span>Payment Method:</span>
              <span>Cash or GCash at Counter</span>
            </div>
          </div>

          {/* Store Claim Location */}
          <div className="p-3 rounded-xl bg-white border border-[#E2E7E2] text-[11px] text-[#5A6E64] space-y-1">
            <p className="font-semibold text-[#20352A] flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-[#23664B]" />
              <span>{MAXIN_SHOP.name}</span>
            </p>
            <p className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#5A6E64]" />
              <span>{MAXIN_SHOP.address} — {MAXIN_SHOP.counterInfo}</span>
            </p>
            <p className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-[#5A6E64]" />
              <span>{MAXIN_SHOP.phone} ({MAXIN_SHOP.hours})</span>
            </p>
          </div>

          {/* Action Buttons (Hidden when printing via print:hidden) */}
          <div className="pt-3 flex flex-wrap gap-2.5 print:hidden">
            <button
              type="button"
              onClick={handlePrintReceipt}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-[#23664B] hover:bg-[#1b523c] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Receipt</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadReceipt}
              className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-white border border-[#D4DDD5] text-xs font-semibold text-[#20352A] hover:bg-[#F7F8F5] transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#5A6E64]" />
              <span>Download Receipt</span>
            </button>

            <button
              type="button"
              onClick={handleCopyTrackingLink}
              className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-white border border-[#D4DDD5] text-xs font-semibold text-[#20352A] hover:bg-[#F7F8F5] transition-colors cursor-pointer"
              title="Copy tracking link"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-[#5A6E64]" />}
              <span>{copiedLink ? 'Link Copied!' : 'Copy Link'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
