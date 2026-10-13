import { useState, useEffect } from 'react';
import { 
  Search, 
  Clock, 
  RefreshCw, 
  ArrowRight,
  AlertCircle,
  HelpCircle,
  Store
} from 'lucide-react';
import { PrintOrder } from '../types/print';
import { trackOrder } from '../services/api';
import { OrderConfirmationReceipt } from '../components/OrderConfirmationReceipt';

interface TrackViewProps {
  initialOrderId?: string;
  onNavigate: (tab: string, param?: string) => void;
}

export function TrackView({ initialOrderId, onNavigate }: TrackViewProps) {
  // Parse order and token if formatted as "PD-1046&token=xyz"
  const parsedId = initialOrderId?.split('&token=')[0] || initialOrderId || '';
  const parsedToken = initialOrderId?.includes('&token=') ? initialOrderId.split('&token=')[1] : '';

  const [searchQuery, setSearchQuery] = useState(parsedId);
  const [trackingToken, setTrackingToken] = useState(parsedToken);
  const [currentOrder, setCurrentOrder] = useState<PrintOrder | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchStatus = async (query: string, token?: string) => {
    if (!query.trim()) return;
    setIsRefreshing(true);
    setErrorMessage(null);

    try {
      const res = await trackOrder(query.trim(), token);
      setCurrentOrder(res.order);
      setHasSearched(true);
    } catch (err: any) {
      setCurrentOrder(null);
      setHasSearched(true);
      setErrorMessage(err.message || 'Order not found');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (parsedId) {
      setSearchQuery(parsedId);
      if (parsedToken) setTrackingToken(parsedToken);
      fetchStatus(parsedId, parsedToken);
    }
  }, [initialOrderId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStatus(searchQuery, trackingToken);
  };

  return (
    <div className="py-6">
      {/* If an order is active, display the Receipt-Style Confirmation and Timeline */}
      {currentOrder ? (
        <OrderConfirmationReceipt
          order={currentOrder}
          trackingToken={trackingToken}
          onNavigateHome={() => onNavigate('landing')}
          onOrderUpdated={updated => setCurrentOrder(updated)}
        />
      ) : (
        /* If no order loaded yet, show the Lookup form */
        <div className="max-w-xl mx-auto px-4 py-12 space-y-8">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#eef4f1] text-[#23664B] text-xs font-semibold">
              <Clock className="w-3.5 h-3.5" />
              <span>Maxin Printing Service Order Tracker</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#20352A]">
              Track Your Print Queue
            </h1>
            <p className="text-xs sm:text-sm text-[#5A6E64]">
              Enter your assigned Queue Ticket (e.g. #1046) or Order ID (e.g. PD-1046) to view your receipt and live printing progress.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#D4DDD5] shadow-sm space-y-4">
            <form onSubmit={handleSearchSubmit} className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A6E64]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Enter Ticket #1046 or Order PD-1046"
                  className="w-full pl-10 pr-3 py-3 rounded-xl bg-[#F7F8F5] border border-[#D4DDD5] text-sm text-[#20352A] placeholder:text-[#5A6E64]/60 focus:outline-none focus:ring-2 focus:ring-[#23664B]/30"
                />
              </div>

              <button
                type="submit"
                disabled={isRefreshing}
                className="w-full py-3 rounded-xl bg-[#23664B] hover:bg-[#1b523c] text-white text-sm font-bold shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>Track Print Status</span>
              </button>
            </form>

            <div className="pt-3 border-t border-[#F7F8F5] flex flex-wrap items-center gap-2 text-xs">
              <span className="text-[#5A6E64]">Try demo tickets:</span>
              {['#1046', '#1045', '#1044'].map(demoTicket => (
                <button
                  key={demoTicket}
                  type="button"
                  onClick={() => {
                    setSearchQuery(demoTicket);
                    fetchStatus(demoTicket);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[#F7F8F5] hover:bg-[#eef4f1] text-[#20352A] font-mono text-xs border border-[#E2E7E2] transition-colors cursor-pointer"
                >
                  {demoTicket}
                </button>
              ))}
            </div>
          </div>

          {hasSearched && !currentOrder && (
            <div className="bg-white rounded-2xl p-6 border border-[#D4DDD5] text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center mx-auto">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-[#20352A]">Order Not Found</h3>
                <p className="text-xs text-[#5A6E64] mt-1">
                  {errorMessage || `We couldn't find an order matching "${searchQuery}". Please check your receipt ticket number.`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('order')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#23664B] text-white text-xs font-semibold hover:bg-[#1b523c]"
              >
                <span>Place a New Order</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
