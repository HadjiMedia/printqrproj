export type OrderStatus = 'waiting' | 'printing' | 'ready' | 'completed' | 'cancelled';

export type PaperSize = 'Letter' | 'A4' | 'Legal' | 'A3';
export type PaperType = 'ordinary' | 'glossy';
export type PrintType = 'bw' | 'color';
export type Orientation = 'portrait' | 'landscape';
export type DuplexMode = 'single' | 'back_to_back' | 'double_long' | 'double_short';
export type PrintQuality = 'standard' | 'high';
export type BindingOption = 'none' | 'staple' | 'spiral' | 'booklet';

export interface ShopLocation {
  id: string;
  name: string;
  address: string;
  counterInfo: string;
  phone: string;
  hours: string;
  activeQueueCount: number;
  avgWaitMins: number;
  acceptingOrders: boolean;
}

export interface OrderFileSurcharges {
  backToBack: number;   // +₱5 if back_to_back
  borderless: number;   // +₱5 if borderless
  quality: number;      // +₱10 if high quality
}

export interface OrderFile {
  id: string;
  fileName: string;
  fileSize: number;       // in bytes
  fileType: string;       // MIME type or extension
  fileData?: string;      // Base64 data URL (for upload or inline preview)
  pageCount: number;
  copies: number;
  paperSize: PaperSize;
  paperType: PaperType;   // 'ordinary' | 'glossy'
  photoPaperSize?: string;// '4x6' | '5x7' | 'A4'
  printType: PrintType;
  orientation: Orientation;
  duplex: DuplexMode;     // 'single' | 'back_to_back'
  borderless: boolean;    // true = +₱5 surcharge
  quality: PrintQuality;  // 'standard' (₱0) | 'high' (+₱10)
  
  // Itemized Pricing Breakdown
  baseCost: number;       // Base rate * chargeable sheets * copies
  surcharges: OrderFileSurcharges;
  subtotal: number;       // baseCost + surcharges sum
  
  // Telegram & file storage lifecycle
  telegramStatus: 'pending' | 'delivered' | 'failed' | 'not_configured';
  telegramFileId?: string;
  telegramMessageId?: number;
  telegramError?: string;
  isDeletedFromDisk: boolean;
  diskPath?: string;
}

export interface StatusHistoryEntry {
  status: OrderStatus;
  timestamp: string;      // ISO string
  changedBy: string;      // "customer" | "staff" | "system"
  note?: string;
}

export interface PrintOrder {
  id: string;             // e.g. "PD-8492"
  queueNumber: string;    // e.g. "#1046"
  trackingToken: string;  // Secure token for customer tracking and file access
  shopId?: string;        // defaults to "maxin-printing-service"
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  clientRequestId?: string; // Idempotency key to prevent duplicate orders
  
  // Multiple files
  files: OrderFile[];

  // Order-level finishing & instructions
  binding: BindingOption;
  instructions?: string;

  // Order status & history
  status: OrderStatus;
  statusMessage?: string;
  statusHistory: StatusHistoryEntry[];
  createdAt: string;      // ISO string
  updatedAt: string;      // ISO string
  completedAt?: string;   // ISO string

  // Pricing
  totalPrice: number;     // Total in ₱ (Philippine Peso)

  // Delivery / Telegram
  telegramStatus: 'pending' | 'delivered' | 'failed' | 'not_configured';
  telegramDeliveryError?: string;
  telegramNotified?: boolean;

  isDemo?: boolean;
}

export interface PhotoPaperSizeOption {
  id: string;
  label: string;
  dimensions: string;
  enabled: boolean;
}

export interface PricingSettings {
  currency: string;
  symbol: string;
  // Per page prices for ordinary paper: [paperSize][printType]
  pagePrices: {
    Letter: { bw: number; color: number };
    A4: { bw: number; color: number };
    Legal: { bw: number; color: number };
    A3: { bw: number; color: number };
  };
  // Photo Paper — Glossy rates (per sheet)
  photoPaperPrices: {
    glossy: { bw: number; color: number }; // Default: bw: 25, color: 35
  };
  photoPaperSizes: PhotoPaperSizeOption[];
  // Flat surcharges per document printing job
  surcharges: {
    backToBack: number;   // ₱5
    borderless: number;   // ₱5
    highQuality: number;  // ₱10
  };
  optionsConfig: {
    allowBorderlessOnOrdinary: boolean;
    allowBorderlessOnGlossy: boolean;
    allowBackToBackOnGlossy: boolean;
    allowHighQuality: boolean;
  };
  duplexDiscountPercent?: number; // Deprecated, preserved for backward-compat
  bindingPrices: {
    none: number;
    staple: number;
    spiral: number;
    booklet: number;
  };
}

export interface TelegramConfig {
  enabled: boolean;
  botUsername: string;
  botTokenConfigured: boolean;
  chatIdConfigured: boolean;
  lastWebhookPing?: string;
  autoDeleteAfterDelivery: boolean;
}

export interface OrderStats {
  total: number;
  waiting: number;
  printing: number;
  ready: number;
  completed: number;
  cancelled: number;
  telegramFailures: number;
  todayRevenue: number;
  totalPages: number;
}

export interface TrustedDevice {
  id: string;
  deviceId: string;
  deviceName: string;
  userAgent?: string;
  ipAddress?: string;
  status: 'pending' | 'approved' | 'revoked';
  isPrimary: boolean;
  requestId?: string;
  requestedAt: string;
  approvedAt?: string;
  approvedBy?: string;
}
