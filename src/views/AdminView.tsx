import { useState, useEffect, useMemo } from 'react';
import { 
  Shield, 
  Search, 
  Download, 
  Printer, 
  Clock, 
  CheckCircle2, 
  CheckCheck,
  XCircle, 
  RefreshCw, 
  Plus, 
  LogOut, 
  Lock, 
  Store, 
  FileText, 
  Trash2, 
  Volume2, 
  VolumeX, 
  Eye, 
  Send, 
  AlertCircle, 
  FileArchive,
  DollarSign,
  DownloadCloud,
  FileSpreadsheet,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { PrintOrder, OrderStatus, PaperSize, PrintType, PricingSettings } from '../types/print';
import { 
  adminLogin, 
  adminLogout, 
  checkAdminAuth, 
  getAdminOrders, 
  updateOrderStatusApi, 
  deleteOrderApi, 
  retryTelegramDelivery, 
  getAdminStats, 
  updateSettingsApi,
  getFileDownloadUrl,
  getZipDownloadUrl,
  submitOrder,
  fetchSettings,
  fetchAuthorizedDevices,
  approveDeviceApi,
  revokeDeviceApi
} from '../services/api';
import { SHOPS, formatBytes, DEFAULT_PRICING } from '../data/mockData';
import { StatusBadge } from '../components/StatusBadge';
import { TelegramPanel } from '../components/TelegramPanel';

interface AdminViewProps {
  isAdminLoggedIn: boolean;
  onLoginChange: (status: boolean) => void;
  onSettingsSaved?: () => void;
}

export function AdminView({
  isAdminLoggedIn,
  onLoginChange,
  onSettingsSaved,
}: AdminViewProps) {
  // Login form state
  const [username, setUsername] = useState('staff');
  const [password, setPassword] = useState('printdrop2025');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Dashboard state
  const [orders, setOrders] = useState<PrintOrder[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'waiting' | 'printing' | 'ready' | 'completed' | 'cancelled' | 'all' | 'pricing' | 'telegram' | 'devices'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    waiting: 0,
    printing: 0,
    ready: 0,
    completed: 0,
    cancelled: 0,
    telegramFailures: 0,
    todayRevenue: 0,
    totalPages: 0,
  });
  const [pricing, setPricing] = useState<PricingSettings>(DEFAULT_PRICING);
  const [shopsList, setShopsList] = useState(SHOPS);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [authorizedDevices, setAuthorizedDevices] = useState<any[]>([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);\n  const [isSavingOptions, setIsSavingOptions] = useState(false);

  // Selected Order Modal
  const [selectedOrder, setSelectedOrder] = useState<PrintOrder | null>(null);

  // Walk-in order modal
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [walkInName, setWalkInName] = useState('');
  const [walkInFile, setWalkInFile] = useState('Counter_Document.pdf');
  const [walkInPages, setWalkInPages] = useState(1);
  const [walkInCopies, setWalkInCopies] = useState(1);
  const [walkInType, setWalkInType] = useState<PrintType>('bw');
  const [walkInSize, setWalkInSize] = useState<PaperSize>('A4');

  // Flash Message
  const [flashMessage, setFlashMessage] = useState<string | null>(null);

  const showFlash = (msg: string) => {
    setFlashMessage(msg);
    setTimeout(() => setFlashMessage(null), 3500);
  };

  const loadDashboardData = async () => {
    setIsRefreshing(true);
    try {
      const [ordersRes, statsRes] = await Promise.all([
        getAdminOrders({
          tab: activeTab === 'pricing' || activeTab === 'telegram' || activeTab === 'devices' ? 'all' : activeTab,
          search: searchQuery || undefined,
          limit: 100,
        }),
        getAdminStats(),
      ]);
      setOrders(ordersRes.orders);
      setStats(statsRes);
    } catch (err: any) {
      if (err.message?.includes('Unauthorized')) {
        onLoginChange(false);
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (isAdminLoggedIn) {
      loadDashboardData();
      const interval = setInterval(loadDashboardData, 8000); // 8s auto refresh
      return () => clearInterval(interval);
    }
  }, [isAdminLoggedIn, activeTab, searchQuery]);

  const loadDevices = async () => {
    setIsLoadingDevices(true);
    try {
      setAuthorizedDevices(await fetchAuthorizedDevices());
    } catch (err: any) {
      showFlash(err.message || 'Unable to load device requests.');
    } finally {
      setIsLoadingDevices(false);
    }
  };

  const handleApproveDevice = async (deviceId: string) => {
    try {
      await approveDeviceApi(deviceId);
      showFlash('Device approved. Ask the device to sign in again.');
      await loadDevices();
    } catch (err: any) {
      alert(err.message || 'Unable to approve device.');
    }
  };

  const handleRevokeDevice = async (deviceId: string) => {
    if (!window.confirm('Revoke this device? Its access will be blocked.')) return;
    try {
      await revokeDeviceApi(deviceId);
      showFlash('Device access revoked.');
      await loadDevices();
    } catch (err: any) {
      alert(err.message || 'Unable to revoke device.');
    }
  };

  useEffect(() => {
    if (isAdminLoggedIn && activeTab === 'devices') loadDevices();
  }, [isAdminLoggedIn, activeTab]);

  // Synchronize persisted pricing settings from Neon database
  useEffect(() => {
    fetchSettings().then(res => {
      if (res.pricing) setPricing(res.pricing);
    }).catch(() => {});
  }, [isAdminLoggedIn, activeTab]);

  // Handle Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);

    try {
      const result = await adminLogin(username.trim(), password.trim());
      if (result.success && result.token) {
        onLoginChange(true);
      } else if (result.requireApproval) {
        setLoginError(result.message || 'This device needs approval from your primary admin device. Approve it there, then sign in again.');
      } else {
        throw new Error(result.message || 'The server did not create an admin session. Please try again.');
      }
    } catch (err: any) {
      setLoginError(err.message || 'Authentication failed. Please check credentials.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await adminLogout();
    onLoginChange(false);
  };

  // Status transitions
  const handleStatusChange = async (orderId: string, nextStatus: OrderStatus, defaultNote?: string) => {
    try {
      const updated = await updateOrderStatusApi(orderId, nextStatus, defaultNote);
      setOrders(prev => prev.map(o => (o.id === orderId ? updated : o)));
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(updated);
      }
      showFlash(`Ticket #${updated.queueNumber} marked as ${nextStatus.toUpperCase()}`);
      loadDashboardData();
    } catch (err: any) {
      alert(`Error updating status: ${err.message}`);
    }
  };

  const handleCancelOrder = async (order: PrintOrder) => {
    const reason = window.prompt(`Please provide reason for cancelling Order #${order.queueNumber}:`, 'Customer requested cancellation at counter');
    if (reason !== null) {
      handleStatusChange(order.id, 'cancelled', reason || 'Cancelled by staff');
    }
  };

  const handleSavePrintOptions = async () => {
    if (!selectedOrder) return;
    setIsSavingOptions(true);
    try {
      const updated = await updateOrderPrintOptionsApi(selectedOrder.id, {
        binding: selectedOrder.binding,
        files: selectedOrder.files.map(file => ({
          id: file.id,
          paperSize: file.paperSize,
          paperType: file.paperType,
          photoPaperSize: file.photoPaperSize,
          duplex: file.duplex,
          borderless: file.borderless,
          quality: file.quality,
          printType: file.printType,
          orientation: file.orientation,
        })),
      });
      setSelectedOrder(updated);
      setOrders(prev => prev.map(order => order.id === updated.id ? updated : order));
      showFlash('Print options saved and total recalculated.');
      await loadDashboardData();
    } catch (err: any) {
      showFlash(err.message || 'Could not save print options.');
    } finally {
      setIsSavingOptions(false);
    }
  };

  const handleDelete = async (orderId: string) => {
    if (window.confirm('Are you sure you want to delete this order record? This cannot be undone.')) {
      try {
        await deleteOrderApi(orderId);
        setOrders(prev => prev.filter(o => o.id !== orderId));
        if (selectedOrder?.id === orderId) setSelectedOrder(null);
        showFlash('Order deleted permanently.');
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const handleRetryTelegram = async (orderId: string) => {
    showFlash('Retrying Telegram delivery...');
    try {
      const res = await retryTelegramDelivery(orderId);
      if (res.overallStatus === 'delivered') {
        showFlash('Telegram files delivered successfully and cleaned up from disk!');
      } else {
        showFlash(`Telegram delivery result: ${res.overallStatus} (${res.error || 'Check bot setup'})`);
      }
      loadDashboardData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleShopAccepting = async (shopId: string) => {
    const updated = shopsList.map(s => (s.id === shopId ? { ...s, acceptingOrders: !s.acceptingOrders } : s));
    setShopsList(updated);
    try {
      await updateSettingsApi({ shops: updated });
      showFlash('Branch order intake status updated.');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSavePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await updateSettingsApi({ pricing });
      if (res && res.pricing) {
        setPricing(res.pricing);
      }
      if (onSettingsSaved) {
        onSettingsSaved();
      }
      showFlash('Pricing rate card updated and applied to all incoming orders.');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateWalkIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walkInName.trim()) return;

    try {
      const res = await submitOrder({
        customerName: walkInName.trim(),
        shopId: 'maxin-printing-service',
        binding: 'none',
        instructions: 'Walk-in customer at shop counter',
        files: [
          {
            fileName: walkInFile.trim() || 'Counter_Direct.pdf',
            fileSize: 102400,
            fileType: 'application/pdf',
            pageCount: walkInPages,
            copies: walkInCopies,
            paperSize: walkInSize,
            printType: walkInType,
            orientation: 'portrait',
            duplex: 'single',
          },
        ],
      });

      setShowWalkInModal(false);
      setWalkInName('');
      showFlash(`Walk-in Ticket #${res.order.queueNumber} queued successfully!`);
      loadDashboardData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // If not logged in, render Server-Authenticated Staff Login Card
  if (!isAdminLoggedIn) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="bg-white rounded-3xl p-8 border border-[#D4DDD5] shadow-lg text-center space-y-6">
          <div className="w-14 h-14 rounded-2xl bg-[#23664B] text-white flex items-center justify-center mx-auto shadow-md">
            <Shield className="w-7 h-7" />
          </div>

          <div>
            <h2 className="text-2xl font-extrabold text-[#20352A]">
              Staff & Admin Portal
            </h2>
            <p className="text-xs text-[#5A6E64] mt-1">
              Secure server authentication for print management and queue dispatch.
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4 text-left">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#20352A]">Staff Username</label>
              <input
                type="text"
                required
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="staff"
                className="w-full text-sm py-2.5 px-3.5 rounded-xl bg-[#F7F8F5] border border-[#D4DDD5] text-[#20352A] focus:outline-none focus:ring-2 focus:ring-[#23664B]/30"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#20352A]">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full text-sm py-2.5 px-3.5 rounded-xl bg-[#F7F8F5] border border-[#D4DDD5] text-[#20352A] focus:outline-none focus:ring-2 focus:ring-[#23664B]/30"
              />
            </div>

            {loginError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 rounded-xl bg-[#23664B] hover:bg-[#1b523c] text-white font-bold text-sm shadow-md transition-colors cursor-pointer"
            >
              {isLoggingIn ? 'Verifying...' : 'Sign In to Management Console'}
            </button>
          </form>

          <div className="pt-2 border-t border-[#E2E7E2]">
            <p className="text-[11px] text-[#5A6E64] mb-2">Default credentials: <code className="bg-[#F7F8F5] px-1 py-0.5 rounded text-[#20352A]">staff</code> / <code className="bg-[#F7F8F5] px-1 py-0.5 rounded text-[#20352A]">printdrop2025</code></p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Flash Message Banner */}
      {flashMessage && (
        <div className="fixed top-20 right-6 z-50 bg-[#20352A] text-white text-xs font-medium px-4 py-2.5 rounded-xl shadow-lg border border-[#23664B] flex items-center gap-2 animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{flashMessage}</span>
        </div>
      )}

      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white rounded-2xl p-5 border border-[#D4DDD5] shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#23664B] text-white flex items-center justify-center font-bold text-xs shadow-xs">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#20352A] leading-tight">
              PrintDrop Management Console
            </h1>
            <p className="text-xs text-[#5A6E64]">
              Connected to Persistent Server & Real Telegram Dispatch
            </p>
          </div>
        </div>

        {/* Right Header Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowWalkInModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#23664B] hover:bg-[#1b523c] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Counter Order</span>
          </button>

          <a
            href="/api/admin/export-csv"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#D4DDD5] text-xs font-semibold text-[#20352A] hover:bg-[#F7F8F5] transition-colors"
            title="Download CSV export"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#23664B]" />
            <span>Export CSV</span>
          </a>

          <button
            type="button"
            onClick={loadDashboardData}
            disabled={isRefreshing}
            className="p-2 rounded-xl bg-[#F7F8F5] border border-[#D4DDD5] text-[#5A6E64] hover:text-[#20352A] transition-colors"
            title="Refresh order data"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#23664B]' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#D4DDD5] text-[#5A6E64] hover:text-rose-700 hover:border-rose-300 text-xs font-medium transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Summary Cards (Section F) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        <div className={`p-4 rounded-2xl border transition-all ${
          stats.waiting > 0 ? 'bg-amber-50 border-amber-300 shadow-2xs' : 'bg-white border-[#D4DDD5]'
        }`}>
          <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Waiting</span>
          <p className="text-2xl font-black text-amber-900 mt-1">{stats.waiting}</p>
          <span className="text-[10px] text-amber-700">Needs printing</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-blue-200 shadow-2xs">
          <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">Printing</span>
          <p className="text-2xl font-black text-blue-900 mt-1">{stats.printing}</p>
          <span className="text-[10px] text-blue-700">In process</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-300 shadow-2xs">
          <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Ready for Pickup</span>
          <p className="text-2xl font-black text-emerald-900 mt-1">{stats.ready}</p>
          <span className="text-[10px] text-emerald-700">At counter</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#D4DDD5] shadow-2xs">
          <span className="text-[11px] font-bold text-[#5A6E64] uppercase tracking-wider">Completed</span>
          <p className="text-2xl font-black text-[#20352A] mt-1">{stats.completed}</p>
          <span className="text-[10px] text-[#5A6E64]">Collected</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#D4DDD5] shadow-2xs">
          <span className="text-[11px] font-bold text-[#5A6E64] uppercase tracking-wider">Cancelled</span>
          <p className="text-2xl font-black text-rose-800 mt-1">{stats.cancelled}</p>
          <span className="text-[10px] text-rose-600">Discontinued</span>
        </div>

        <div className={`p-4 rounded-2xl border shadow-2xs ${
          stats.telegramFailures > 0 ? 'bg-rose-50 border-rose-300' : 'bg-white border-[#D4DDD5]'
        }`}>
          <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">TG Failures</span>
          <p className="text-2xl font-black text-rose-900 mt-1">{stats.telegramFailures}</p>
          <span className="text-[10px] text-rose-700">{stats.telegramFailures > 0 ? 'Needs retry' : 'None'}</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#23664B] shadow-2xs col-span-2 sm:col-span-1">
          <span className="text-[11px] font-bold text-[#23664B] uppercase tracking-wider">Today's Revenue</span>
          <p className="text-2xl font-black text-[#20352A] mt-1">₱{stats.todayRevenue.toFixed(2)}</p>
          <span className="text-[10px] text-[#5A6E64]">Claimed orders</span>
        </div>
      </div>

      {/* Navigation Tabs & Filters */}
      <div className="bg-white rounded-2xl p-4 border border-[#D4DDD5] shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E7E2] pb-3">
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('active')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'active' ? 'bg-[#23664B] text-white shadow-2xs' : 'text-[#5A6E64] hover:bg-[#F7F8F5]'
              }`}
            >
              Active Queue ({stats.waiting + stats.printing + stats.ready})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('waiting')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'waiting' ? 'bg-amber-600 text-white shadow-2xs' : 'text-amber-800 hover:bg-amber-50'
              }`}
            >
              Waiting ({stats.waiting})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('printing')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'printing' ? 'bg-blue-600 text-white shadow-2xs' : 'text-blue-800 hover:bg-blue-50'
              }`}
            >
              Printing ({stats.printing})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ready')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'ready' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-emerald-800 hover:bg-emerald-50'
              }`}
            >
              Ready for Pickup ({stats.ready})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('completed')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'completed' ? 'bg-gray-800 text-white shadow-2xs' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Completed ({stats.completed})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'all' ? 'bg-[#20352A] text-white shadow-2xs' : 'text-[#5A6E64] hover:bg-[#F7F8F5]'
              }`}
            >
              All Orders ({stats.total})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('pricing')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 ${
                activeTab === 'pricing' ? 'bg-[#23664B] text-white shadow-2xs' : 'text-[#5A6E64] hover:bg-[#F7F8F5]'
              }`}
            >
              <DollarSign className="w-3 h-3" />
              <span>Pricing Manager</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('devices')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 ${
                activeTab === 'devices' ? 'bg-[#23664B] text-white shadow-2xs' : 'text-[#5A6E64] hover:bg-[#F7F8F5]'
              }`}
            >
              <Shield className="w-3 h-3" />
              <span>Device Approvals</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('telegram')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 ${
                activeTab === 'telegram' ? 'bg-[#20352A] text-white shadow-2xs' : 'text-[#5A6E64] hover:bg-[#F7F8F5]'
              }`}
            >
              <Send className="w-3 h-3" />
              <span>Telegram Bot Setup</span>
            </button>
          </div>

          {/* Intake Status for Maxin Printing Service */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#5A6E64] font-medium">Store Intake:</span>
            <button
              type="button"
              onClick={() => handleToggleShopAccepting(shopsList[0]?.id || 'maxin-printing-service')}
              className={`px-3 py-1 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
                shopsList[0]?.acceptingOrders
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs'
                  : 'bg-rose-50 text-rose-800 border-rose-300 shadow-2xs'
              }`}
              title="Click to toggle intake status"
            >
              <span className={`w-2 h-2 rounded-full ${shopsList[0]?.acceptingOrders ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
              <span>Maxin Printing Service: {shopsList[0]?.acceptingOrders ? 'Accepting Orders' : 'Intake Paused'}</span>
            </button>
          </div>
        </div>

        {/* Search input */}
        {activeTab !== 'pricing' && activeTab !== 'telegram' && activeTab !== 'devices' && (
          <div className="max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#5A6E64]" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by customer, ticket #, order ID, phone..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-[#F7F8F5] border border-[#D4DDD5] text-[#20352A] focus:outline-none focus:ring-2 focus:ring-[#23664B]/30"
              />
            </div>
          </div>
        )}
      </div>

      {/* Tab Content Views */}
      {activeTab === 'devices' ? (
        <div className="bg-white rounded-2xl p-6 border border-[#D4DDD5] shadow-2xs space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-base text-[#20352A]">Trusted Device Management</h3>
              <p className="text-xs text-[#5A6E64] mt-1">Approve new staff devices here. Only approve devices you recognize.</p>
            </div>
            <button type="button" onClick={loadDevices} disabled={isLoadingDevices} className="px-3 py-2 rounded-xl border border-[#D4DDD5] text-xs font-semibold text-[#20352A]">{isLoadingDevices ? 'Refreshing…' : 'Refresh'}</button>
          </div>
          {isLoadingDevices ? (
            <p className="text-sm text-[#5A6E64]">Loading device requests…</p>
          ) : authorizedDevices.length === 0 ? (
            <p className="text-sm text-[#5A6E64] bg-[#F7F8F5] rounded-xl p-4">No device records found.</p>
          ) : (
            <div className="space-y-3">
              {authorizedDevices.map((device, index) => (
                <div key={device.deviceId || device.id || index} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-[#D4DDD5]">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-[#20352A] break-words">{device.deviceName || 'Unnamed device'} {device.isPrimary ? '· Primary' : ''}</p>
                    <p className="text-xs text-[#5A6E64] mt-1">Status: <span className="font-semibold">{device.status || 'unknown'}</span></p>
                    {device.requestId && <p className="text-xs text-[#5A6E64]">Request: {device.requestId}</p>}
                    {device.createdAt && <p className="text-xs text-[#5A6E64]">Requested: {new Date(device.createdAt).toLocaleString()}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    {device.status === 'pending' && device.deviceId && (
                      <button type="button" onClick={() => handleApproveDevice(device.deviceId)} className="px-3 py-2 rounded-lg bg-[#23664B] text-white text-xs font-bold">Approve Device</button>
                    )}
                    {device.status === 'approved' && !device.isPrimary && device.deviceId && (
                      <button type="button" onClick={() => handleRevokeDevice(device.deviceId)} className="px-3 py-2 rounded-lg border border-rose-300 text-rose-700 text-xs font-bold">Revoke Access</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : activeTab === 'telegram' ? (
        <TelegramPanel />
      ) : activeTab === 'pricing' ? (
        /* Pricing Manager Tab (Section D & F) */
        <div className="bg-white rounded-2xl p-6 border border-[#D4DDD5] shadow-2xs space-y-6">
          <div className="flex items-center justify-between border-b border-[#E2E7E2] pb-4">
            <div>
              <h3 className="font-bold text-base text-[#20352A]">
                Print Rate Card & Paper Price Configuration
              </h3>
              <p className="text-xs text-[#5A6E64]">
                Manage live rates in Philippine Peso (₱). Prices update immediately for all customer orders.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#eef4f1] text-[#23664B]">
              Currency: PHP (₱)
            </span>
          </div>

          <form onSubmit={handleSavePricing} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              {/* Letter */}
              <div className="p-4 rounded-xl border border-[#D4DDD5] bg-[#F7F8F5] space-y-3">
                <span className="font-bold text-sm text-[#20352A]">Short / Letter Size</span>
                <div className="space-y-1">
                  <label className="text-[11px] text-[#5A6E64]">B&W (₱/page)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={pricing.pagePrices.Letter.bw}
                    onChange={e => setPricing({
                      ...pricing,
                      pagePrices: {
                        ...pricing.pagePrices,
                        Letter: { ...pricing.pagePrices.Letter, bw: parseFloat(e.target.value) || 0 }
                      }
                    })}
                    className="w-full py-1.5 px-2 rounded-lg bg-white border border-[#D4DDD5] font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-[#5A6E64]">Color (₱/page)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={pricing.pagePrices.Letter.color}
                    onChange={e => setPricing({
                      ...pricing,
                      pagePrices: {
                        ...pricing.pagePrices,
                        Letter: { ...pricing.pagePrices.Letter, color: parseFloat(e.target.value) || 0 }
                      }
                    })}
                    className="w-full py-1.5 px-2 rounded-lg bg-white border border-[#D4DDD5] font-bold"
                  />
                </div>
              </div>

              {/* A4 */}
              <div className="p-4 rounded-xl border border-[#23664B] bg-[#eef4f1]/30 space-y-3">
                <span className="font-bold text-sm text-[#23664B]">A4 Standard</span>
                <div className="space-y-1">
                  <label className="text-[11px] text-[#5A6E64]">B&W (₱/page)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={pricing.pagePrices.A4.bw}
                    onChange={e => setPricing({
                      ...pricing,
                      pagePrices: {
                        ...pricing.pagePrices,
                        A4: { ...pricing.pagePrices.A4, bw: parseFloat(e.target.value) || 0 }
                      }
                    })}
                    className="w-full py-1.5 px-2 rounded-lg bg-white border border-[#D4DDD5] font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-[#5A6E64]">Color (₱/page)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={pricing.pagePrices.A4.color}
                    onChange={e => setPricing({
                      ...pricing,
                      pagePrices: {
                        ...pricing.pagePrices,
                        A4: { ...pricing.pagePrices.A4, color: parseFloat(e.target.value) || 0 }
                      }
                    })}
                    className="w-full py-1.5 px-2 rounded-lg bg-white border border-[#D4DDD5] font-bold"
                  />
                </div>
              </div>

              {/* Legal */}
              <div className="p-4 rounded-xl border border-[#D4DDD5] bg-[#F7F8F5] space-y-3">
                <span className="font-bold text-sm text-[#20352A]">Long / Legal Size</span>
                <div className="space-y-1">
                  <label className="text-[11px] text-[#5A6E64]">B&W (₱/page)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={pricing.pagePrices.Legal.bw}
                    onChange={e => setPricing({
                      ...pricing,
                      pagePrices: {
                        ...pricing.pagePrices,
                        Legal: { ...pricing.pagePrices.Legal, bw: parseFloat(e.target.value) || 0 }
                      }
                    })}
                    className="w-full py-1.5 px-2 rounded-lg bg-white border border-[#D4DDD5] font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-[#5A6E64]">Color (₱/page)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={pricing.pagePrices.Legal.color}
                    onChange={e => setPricing({
                      ...pricing,
                      pagePrices: {
                        ...pricing.pagePrices,
                        Legal: { ...pricing.pagePrices.Legal, color: parseFloat(e.target.value) || 0 }
                      }
                    })}
                    className="w-full py-1.5 px-2 rounded-lg bg-white border border-[#D4DDD5] font-bold"
                  />
                </div>
              </div>

              {/* Finishing & Duplex Discount */}
              <div className="p-4 rounded-xl border border-[#D4DDD5] bg-[#F7F8F5] space-y-3">
                <span className="font-bold text-sm text-[#20352A]">Binding & Discounts</span>
                <div className="space-y-1">
                  <label className="text-[11px] text-[#5A6E64]">Duplex Discount (%)</label>
                  <input
                    type="number"
                    value={pricing.duplexDiscountPercent}
                    onChange={e => setPricing({ ...pricing, duplexDiscountPercent: parseInt(e.target.value) || 0 })}
                    className="w-full py-1.5 px-2 rounded-lg bg-white border border-[#D4DDD5] font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-[#5A6E64]">Corner Staple (₱)</label>
                  <input
                    type="number"
                    value={pricing.bindingPrices.staple}
                    onChange={e => setPricing({
                      ...pricing,
                      bindingPrices: { ...pricing.bindingPrices, staple: parseFloat(e.target.value) || 0 }
                    })}
                    className="w-full py-1.5 px-2 rounded-lg bg-white border border-[#D4DDD5] font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-[#5A6E64]">Spiral Binding (₱)</label>
                  <input
                    type="number"
                    value={pricing.bindingPrices.spiral}
                    onChange={e => setPricing({
                      ...pricing,
                      bindingPrices: { ...pricing.bindingPrices, spiral: parseFloat(e.target.value) || 0 }
                    })}
                    className="w-full py-1.5 px-2 rounded-lg bg-white border border-[#D4DDD5] font-bold"
                  />
                </div>
              </div>

              {/* A3 Large Paper */}
              <div className="p-4 rounded-xl border border-[#D4DDD5] bg-[#F7F8F5] space-y-3">
                <span className="font-bold text-sm text-[#20352A]">A3 Large Paper</span>
                <div className="space-y-1">
                  <label className="text-[11px] text-[#5A6E64]">B&W (₱/page)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={pricing.pagePrices.A3?.bw ?? 12}
                    onChange={e => setPricing({
                      ...pricing,
                      pagePrices: {
                        ...pricing.pagePrices,
                        A3: { ...pricing.pagePrices.A3, bw: parseFloat(e.target.value) || 0, color: pricing.pagePrices.A3?.color ?? 20 }
                      }
                    })}
                    className="w-full py-1.5 px-2 rounded-lg bg-white border border-[#D4DDD5] font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-[#5A6E64]">Color (₱/page)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={pricing.pagePrices.A3?.color ?? 20}
                    onChange={e => setPricing({
                      ...pricing,
                      pagePrices: {
                        ...pricing.pagePrices,
                        A3: { ...pricing.pagePrices.A3, color: parseFloat(e.target.value) || 0, bw: pricing.pagePrices.A3?.bw ?? 12 }
                      }
                    })}
                    className="w-full py-1.5 px-2 rounded-lg bg-white border border-[#D4DDD5] font-bold"
                  />
                </div>
              </div>

              {/* Photo Paper — Glossy */}
              <div className="p-4 rounded-xl border border-amber-300 bg-amber-50/40 space-y-3">
                <span className="font-bold text-sm text-amber-900 flex items-center gap-1">
                  <span>Photo Paper (Glossy)</span>
                </span>
                <div className="space-y-1">
                  <label className="text-[11px] text-[#5A6E64]">B&W Photo (₱/sheet)</label>
                  <input
                    type="number"
                    step="1"
                    value={pricing.photoPaperPrices?.glossy?.bw ?? 25}
                    onChange={e => setPricing({
                      ...pricing,
                      photoPaperPrices: {
                        ...pricing.photoPaperPrices,
                        glossy: { 
                          bw: parseFloat(e.target.value) || 0, 
                          color: pricing.photoPaperPrices?.glossy?.color ?? 35 
                        }
                      }
                    })}
                    className="w-full py-1.5 px-2 rounded-lg bg-white border border-[#D4DDD5] font-bold text-amber-950"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-[#5A6E64]">Color Photo (₱/sheet)</label>
                  <input
                    type="number"
                    step="1"
                    value={pricing.photoPaperPrices?.glossy?.color ?? 35}
                    onChange={e => setPricing({
                      ...pricing,
                      photoPaperPrices: {
                        ...pricing.photoPaperPrices,
                        glossy: { 
                          color: parseFloat(e.target.value) || 0, 
                          bw: pricing.photoPaperPrices?.glossy?.bw ?? 25 
                        }
                      }
                    })}
                    className="w-full py-1.5 px-2 rounded-lg bg-white border border-[#D4DDD5] font-bold text-amber-950"
                  />
                </div>
              </div>

              {/* Job Surcharges (Back-to-Back, Borderless, High Quality) */}
              <div className="p-4 rounded-xl border border-[#23664B] bg-emerald-50/30 space-y-3">
                <span className="font-bold text-sm text-[#23664B]">Print Job Surcharges</span>
                <div className="space-y-1">
                  <label className="text-[11px] text-[#5A6E64]">Back-to-Back Surcharge (₱/job)</label>
                  <input
                    type="number"
                    step="1"
                    value={pricing.surcharges?.backToBack ?? 5}
                    onChange={e => setPricing({
                      ...pricing,
                      surcharges: {
                        ...pricing.surcharges,
                        backToBack: parseFloat(e.target.value) || 0,
                        borderless: pricing.surcharges?.borderless ?? 5,
                        highQuality: pricing.surcharges?.highQuality ?? 10,
                      }
                    })}
                    className="w-full py-1.5 px-2 rounded-lg bg-white border border-[#D4DDD5] font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-[#5A6E64]">Borderless Surcharge (₱/job)</label>
                  <input
                    type="number"
                    step="1"
                    value={pricing.surcharges?.borderless ?? 5}
                    onChange={e => setPricing({
                      ...pricing,
                      surcharges: {
                        ...pricing.surcharges,
                        borderless: parseFloat(e.target.value) || 0,
                        backToBack: pricing.surcharges?.backToBack ?? 5,
                        highQuality: pricing.surcharges?.highQuality ?? 10,
                      }
                    })}
                    className="w-full py-1.5 px-2 rounded-lg bg-white border border-[#D4DDD5] font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-[#5A6E64]">High Quality Surcharge (₱/job)</label>
                  <input
                    type="number"
                    step="1"
                    value={pricing.surcharges?.highQuality ?? 10}
                    onChange={e => setPricing({
                      ...pricing,
                      surcharges: {
                        ...pricing.surcharges,
                        highQuality: parseFloat(e.target.value) || 0,
                        backToBack: pricing.surcharges?.backToBack ?? 5,
                        borderless: pricing.surcharges?.borderless ?? 5,
                      }
                    })}
                    className="w-full py-1.5 px-2 rounded-lg bg-white border border-[#D4DDD5] font-bold"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-[#23664B] hover:bg-[#1b523c] text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Save & Apply New Pricing
            </button>
          </form>
        </div>
      ) : (
        /* Orders Queue Table */
        <div className="bg-white rounded-2xl border border-[#D4DDD5] shadow-2xs overflow-hidden">
          {orders.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#F7F8F5] text-[#5A6E64] flex items-center justify-center mx-auto">
                <FileText className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-[#20352A]">No orders found for this queue filter</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F7F8F5] text-[#5A6E64] font-semibold border-b border-[#E2E7E2]">
                  <tr>
                    <th className="py-3 px-4">Queue #</th>
                    <th className="py-3 px-4">Customer & Phone</th>
                    <th className="py-3 px-4">Documents</th>
                    <th className="py-3 px-4">Telegram Delivery</th>
                    <th className="py-3 px-4">Total</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Queue Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E7E2]">
                  {orders.map(order => {
                    const shop = shopsList.find(s => s.id === order.shopId);
                    return (
                      <tr
                        key={order.id}
                        className={`hover:bg-[#F7F8F5]/80 transition-colors ${
                          order.status === 'waiting' ? 'bg-amber-50/30' : ''
                        }`}
                      >
                        {/* Queue Ticket */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="font-mono font-black text-sm px-2 py-0.5 rounded-lg bg-[#20352A] text-white">
                            {order.queueNumber}
                          </span>
                          <span className="font-mono text-[11px] text-[#5A6E64] mt-0.5 block">
                            {order.id}
                          </span>
                        </td>

                        {/* Customer */}
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-[#20352A] text-sm">{order.customerName}</p>
                          <p className="text-[11px] text-[#5A6E64]">{order.customerPhone || 'Counter / No phone'}</p>
                        </td>

                        {/* Files & Specs */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-1 max-w-[240px]">
                            {order.files.map((file, idx) => {
                              const isBackToBack = file.duplex !== 'single';
                              const isGlossy = file.paperType === 'glossy';
                              return (
                                <div key={file.id || idx} className="space-y-0.5 text-[11px] pb-1 border-b border-[#F0F3F0] last:border-0">
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="truncate text-[#20352A] font-bold max-w-[140px]" title={file.fileName}>
                                      {file.fileName}
                                    </span>
                                    <span className="text-[#23664B] font-semibold shrink-0">
                                      ₱{file.subtotal.toFixed(2)}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1 text-[10px] text-[#5A6E64]">
                                    <span>{file.pageCount}p × {file.copies}</span>
                                    <span>•</span>
                                    <span className={isGlossy ? 'text-amber-800 font-bold' : ''}>
                                      {isGlossy ? `Glossy (${file.photoPaperSize || file.paperSize})` : file.paperSize}
                                    </span>
                                    <span>•</span>
                                    <span>{file.printType.toUpperCase()}</span>
                                    {isBackToBack && (
                                      <span className="px-1 py-0.2 rounded bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200">
                                        Back-to-Back
                                      </span>
                                    )}
                                    {file.borderless && (
                                      <span className="px-1 py-0.2 rounded bg-blue-50 text-blue-800 font-semibold border border-blue-200">
                                        Borderless
                                      </span>
                                    )}
                                    {file.quality === 'high' && (
                                      <span className="px-1 py-0.2 rounded bg-purple-50 text-purple-800 font-semibold border border-purple-200">
                                        High Qual
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                            {/* Download Action Links */}
                            <div className="pt-1 flex items-center gap-2">
                              {order.files.length === 1 ? (
                                <a
                                  href={`/api/orders/${order.id}/files/${order.files[0].id}`}
                                  download={order.files[0].fileName}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#23664B] hover:underline"
                                >
                                  <Download className="w-3 h-3" />
                                  <span>Download File</span>
                                </a>
                              ) : (
                                <a
                                  href={getZipDownloadUrl(order.id)}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#23664B] hover:underline"
                                >
                                  <FileArchive className="w-3 h-3" />
                                  <span>Download All (ZIP)</span>
                                </a>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Telegram Status */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {order.telegramStatus === 'delivered' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Sent & Cleaned</span>
                            </span>
                          ) : order.telegramStatus === 'failed' ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                                <AlertCircle className="w-3 h-3 text-rose-600" />
                                <span>Failed</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRetryTelegram(order.id)}
                                className="block text-[10px] text-[#23664B] font-semibold hover:underline"
                              >
                                Retry Upload
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-[#5A6E64] font-medium">
                              Local Disk Only
                            </span>
                          )}
                        </td>

                        {/* Total Due */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="font-bold text-[#20352A] text-sm">
                            ₱{order.totalPrice.toFixed(2)}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <StatusBadge status={order.status} size="sm" />
                          <span className="text-[10px] text-[#5A6E64] block mt-1">
                            {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>

                        {/* Action Buttons */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {order.status === 'waiting' && (
                              <button
                                type="button"
                                onClick={() => handleStatusChange(order.id, 'printing', 'Started by staff')}
                                className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px] transition-colors cursor-pointer"
                              >
                                Start Printing
                              </button>
                            )}

                            {order.status === 'printing' && (
                              <button
                                type="button"
                                onClick={() => handleStatusChange(order.id, 'ready', 'Printing complete at counter')}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] transition-colors cursor-pointer"
                              >
                                Mark Ready
                              </button>
                            )}

                            {order.status === 'ready' && (
                              <button
                                type="button"
                                onClick={() => handleStatusChange(order.id, 'completed', 'Customer picked up and paid')}
                                className="px-2.5 py-1 rounded-lg bg-[#20352A] hover:bg-[#23664B] text-white font-semibold text-[11px] transition-colors cursor-pointer"
                              >
                                Mark Claimed
                              </button>
                            )}

                            {order.status !== 'completed' && order.status !== 'cancelled' && (
                              <button
                                type="button"
                                onClick={() => handleCancelOrder(order)}
                                className="p-1 text-[#5A6E64] hover:text-rose-600 rounded transition-colors"
                                title="Cancel order"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setSelectedOrder(order)}
                              className="p-1 rounded text-[#5A6E64] hover:text-[#20352A] hover:bg-gray-100 transition-colors"
                              title="Inspect order details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Inspect Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 border border-[#D4DDD5] shadow-2xl space-y-6 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-[#E2E7E2] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black font-mono text-[#23664B]">
                    #{selectedOrder.queueNumber}
                  </span>
                  <StatusBadge status={selectedOrder.status} size="sm" />
                </div>
                <p className="text-xs text-[#5A6E64] mt-0.5">
                  Order ID: <span className="font-mono font-semibold text-[#20352A]">{selectedOrder.id}</span>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="text-[#5A6E64] hover:text-[#20352A] text-xl font-bold p-1"
              >
                ×
              </button>
            </div>

            {/* Customer & Price summary */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-[#F7F8F5] space-y-0.5">
                <span className="text-[#5A6E64]">Customer</span>
                <p className="font-bold text-[#20352A] text-sm">{selectedOrder.customerName}</p>
                <p className="text-[#5A6E64]">{selectedOrder.customerPhone || 'Counter walk-in'}</p>
              </div>

              <div className="p-3 rounded-xl bg-[#F7F8F5] space-y-0.5">
                <span className="text-[#5A6E64]">Total Charge</span>
                <p className="font-extrabold text-[#23664B] text-lg">₱{selectedOrder.totalPrice.toFixed(2)}</p>
                <p className="text-[#5A6E64]">Finishing: {selectedOrder.binding.toUpperCase()}</p>
              </div>
            </div>

            {/* Editable print options */}
            {!['completed', 'cancelled'].includes(selectedOrder.status) && (
              <div className="space-y-3 rounded-2xl border border-[#D4DDD5] bg-[#F7F8F5] p-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
                <div>
                  <h3 className="text-sm font-bold text-[#20352A]">Edit Print Specifications</h3>
                  <p className="text-[11px] text-[#5A6E64] mt-1">Changes are saved to the order and pricing is recalculated using current rates.</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#20352A]">Document Binding</label>
                  <select value={selectedOrder.binding} onChange={e => setSelectedOrder(prev => prev ? {...prev, binding: e.target.value as any} : prev)} className="w-full rounded-xl border border-[#D4DDD5] bg-white px-3 py-2 text-xs">
                    <option value="none">No Binding</option><option value="staple">Staple</option><option value="spiral">Spiral Binding</option><option value="booklet">Booklet</option>
                  </select>
                </div>
                {selectedOrder.files.map((file, idx) => (
                  <div key={file.id} className="rounded-xl border border-[#D4DDD5] bg-white p-3 space-y-3">
                    <p className="text-xs font-bold text-[#20352A]">{idx + 1}. {file.fileName}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[11px] text-[#5A6E64]">Paper Type</label>
                        <select value={file.paperType} onChange={e => setSelectedOrder(prev => prev ? {...prev, files: prev.files.map(f => f.id === file.id ? {...f, paperType: e.target.value as any, paperSize: e.target.value === 'glossy' ? 'A4' : 'A4', photoPaperSize: e.target.value === 'glossy' ? (f.photoPaperSize || '4x6') : undefined} : f)} : prev)} className="w-full rounded-lg border border-[#D4DDD5] bg-white px-2 py-2 text-xs">
                          <option value="ordinary">Ordinary Paper</option><option value="glossy">Photo Paper — Glossy</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] text-[#5A6E64]">Paper Size</label>
                        <select value={file.paperType === 'glossy' ? (file.photoPaperSize || '4x6') : file.paperSize} onChange={e => setSelectedOrder(prev => prev ? {...prev, files: prev.files.map(f => f.id === file.id ? (f.paperType === 'glossy' ? {...f, photoPaperSize: e.target.value} : {...f, paperSize: e.target.value as PaperSize}) : f)} : prev)} className="w-full rounded-lg border border-[#D4DDD5] bg-white px-2 py-2 text-xs">
                          {(file.paperType === 'glossy' ? [{v:'4x6',t:'4×6 Photo'},{v:'5x7',t:'5×7 Photo'},{v:'A4',t:'A4 Photo'}] : [{v:'A4',t:'A4'},{v:'Letter',t:'Letter'},{v:'Legal',t:'Legal'},{v:'A3',t:'A3'}]).map(o => <option key={o.v} value={o.v}>{o.t}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] text-[#5A6E64]">Print Color</label>
                        <select value={file.printType} onChange={e => setSelectedOrder(prev => prev ? {...prev, files: prev.files.map(f => f.id === file.id ? {...f, printType: e.target.value as any} : f)} : prev)} className="w-full rounded-lg border border-[#D4DDD5] bg-white px-2 py-2 text-xs"><option value="bw">Black & White</option><option value="color">Color</option></select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] text-[#5A6E64]">Sides</label>
                        <select value={file.duplex === 'single' ? 'single' : 'back_to_back'} onChange={e => setSelectedOrder(prev => prev ? {...prev, files: prev.files.map(f => f.id === file.id ? {...f, duplex: e.target.value as any} : f)} : prev)} className="w-full rounded-lg border border-[#D4DDD5] bg-white px-2 py-2 text-xs"><option value="single">Single-Sided</option><option value="back_to_back">Back-to-Back (+ surcharge)</option></select>
                      </div>
                      <label className="flex items-center gap-2 text-xs text-[#20352A]"><input type="checkbox" checked={file.borderless} onChange={e => setSelectedOrder(prev => prev ? {...prev, files: prev.files.map(f => f.id === file.id ? {...f, borderless: e.target.checked} : f)} : prev)} /> Borderless</label>
                      <div className="space-y-1">
                        <label className="text-[11px] text-[#5A6E64]">Quality</label>
                        <select value={file.quality} onChange={e => setSelectedOrder(prev => prev ? {...prev, files: prev.files.map(f => f.id === file.id ? {...f, quality: e.target.value as any} : f)} : prev)} className="w-full rounded-lg border border-[#D4DDD5] bg-white px-2 py-2 text-xs"><option value="standard">Standard</option><option value="high">High Quality</option></select>
                      </div>
                    </div>
                  </div>
                ))}
                <button type="button" disabled={isSavingOptions} onClick={handleSavePrintOptions} className="w-full rounded-xl bg-[#23664B] px-4 py-2.5 text-xs font-bold text-white transition-all hover:bg-[#1b513b] hover:shadow-md disabled:opacity-60">
                  {isSavingOptions ? 'Saving & recalculating…' : 'Save Print Options & Recalculate Total'}
                </button>
              </div>
            )}

            {/* Files list */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#23664B]">
                Documents ({selectedOrder.files.length})
              </span>
              {selectedOrder.files.map((file, idx) => {
                const isBackToBack = file.duplex !== 'single';
                const isGlossy = file.paperType === 'glossy';
                return (
                  <div key={file.id || idx} className="p-3.5 rounded-xl border border-[#D4DDD5] flex items-start justify-between text-xs gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-[#20352A]">{idx + 1}. {file.fileName}</p>
                        {isGlossy && (
                          <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                            Glossy Photo
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#5A6E64] flex flex-wrap items-center gap-1.5">
                        <span>{file.pageCount} pgs × {file.copies} copies</span>
                        <span>•</span>
                        <span>{isGlossy ? `Photo: ${file.photoPaperSize || file.paperSize}` : `Paper: ${file.paperSize}`}</span>
                        <span>•</span>
                        <span>{file.printType === 'color' ? 'Full Color' : 'B&W'}</span>
                        <span>•</span>
                        <span className={isBackToBack ? 'font-semibold text-[#23664B]' : ''}>
                          {isBackToBack ? 'Back-to-Back (+₱5)' : 'Single-Sided'}
                        </span>
                        {file.borderless && <span>• Borderless (+₱5)</span>}
                        {file.quality === 'high' && <span>• High Quality (+₱10)</span>}
                      </div>
                      <p className="text-[11px] font-extrabold text-[#23664B]">
                        Subtotal: ₱{file.subtotal.toFixed(2)}
                      </p>
                    </div>
                    <a
                      href={`/api/orders/${selectedOrder.id}/files/${file.id}`}
                      download={file.fileName}
                      className="px-2.5 py-1.5 rounded-lg bg-[#eef4f1] text-[#23664B] font-semibold text-[11px] hover:bg-[#d6e6df] shrink-0"
                    >
                      Download
                    </a>
                  </div>
                );
              })}
            </div>

            {/* Audit History Log */}
            {selectedOrder.statusHistory && selectedOrder.statusHistory.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-[#E2E7E2]">
                <span className="text-xs font-bold text-[#20352A]">Status Audit History:</span>
                <div className="space-y-1 text-[11px] text-[#5A6E64]">
                  {selectedOrder.statusHistory.map((sh, idx) => (
                    <div key={idx} className="flex justify-between border-b border-[#F7F8F5] pb-0.5">
                      <span><strong>{sh.status.toUpperCase()}</strong> by {sh.changedBy} {sh.note ? `— "${sh.note}"` : ''}</span>
                      <span>{new Date(sh.timestamp).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Controls */}
            <div className="pt-2 border-t border-[#E2E7E2] flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleDelete(selectedOrder.id)}
                className="inline-flex items-center gap-1 text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Order</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-2 rounded-xl bg-[#20352A] text-white text-xs font-semibold hover:bg-[#23664B]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Walk-in Order Modal */}
      {showWalkInModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 border border-[#D4DDD5] shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#E2E7E2] pb-3">
              <h3 className="font-bold text-base text-[#20352A]">Create Walk-In Order</h3>
              <button
                type="button"
                onClick={() => setShowWalkInModal(false)}
                className="text-[#5A6E64] hover:text-[#20352A] font-bold text-lg"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateWalkIn} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#20352A]">Customer Name</label>
                <input
                  type="text"
                  required
                  value={walkInName}
                  onChange={e => setWalkInName(e.target.value)}
                  placeholder="e.g. John Walk-in"
                  className="w-full text-xs py-2.5 px-3 rounded-xl bg-[#F7F8F5] border border-[#D4DDD5]"
                />
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[#5A6E64]">Pages</label>
                  <input
                    type="number"
                    min="1"
                    value={walkInPages}
                    onChange={e => setWalkInPages(parseInt(e.target.value) || 1)}
                    className="w-full py-1.5 px-2 rounded-lg bg-[#F7F8F5] border border-[#D4DDD5] font-bold text-center"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[#5A6E64]">Copies</label>
                  <input
                    type="number"
                    min="1"
                    value={walkInCopies}
                    onChange={e => setWalkInCopies(parseInt(e.target.value) || 1)}
                    className="w-full py-1.5 px-2 rounded-lg bg-[#F7F8F5] border border-[#D4DDD5] font-bold text-center"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[#5A6E64]">Paper</label>
                  <select
                    value={walkInSize}
                    onChange={e => setWalkInSize(e.target.value as PaperSize)}
                    className="w-full py-1.5 px-2 rounded-lg bg-[#F7F8F5] border border-[#D4DDD5]"
                  >
                    <option value="Letter">Letter</option>
                    <option value="A4">A4</option>
                    <option value="Legal">Legal</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#23664B] text-white text-xs font-bold hover:bg-[#1b523c] cursor-pointer"
                >
                  Generate Queue Ticket
                </button>
                <button
                  type="button"
                  onClick={() => setShowWalkInModal(false)}
                  className="py-2.5 px-4 rounded-xl bg-[#F7F8F5] text-[#5A6E64] text-xs font-semibold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
