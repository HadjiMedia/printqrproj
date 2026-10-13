export type OrderStatus = 'waiting' | 'printing' | 'ready' | 'completed' | 'cancelled';

export type PaperSize = 'Letter' | 'A4' | 'Legal' | 'A3';
export type PrintType = 'bw' | 'color';
export type Orientation = 'portrait' | 'landscape';
export type DuplexMode = 'single' | 'double_long' | 'double_short';
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

export interface OrderFile {
  id: string;
  fileName: string;
  fileSize: number;       // in bytes
  fileType: string;       // MIME type or extension
  fileData?: string;      // Base64 data URL (for upload or inline preview)
  pageCount: number;
  copies: number;
  paperSize: PaperSize;
  printType: PrintType;
  orientation: Orientation;
  duplex: DuplexMode;
  subtotal: number;
  
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

export interface PricingSettings {
  currency: string;
  symbol: string;
  // Per page prices: [paperSize][printType]
  pagePrices: {
    Letter: { bw: number; color: number };
    A4: { bw: number; color: number };
    Legal: { bw: number; color: number };
    A3: { bw: number; color: number };
  };
  duplexDiscountPercent: number; // e.g. 10%
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
