import { ShopLocation, PrintOrder, PricingSettings } from '../types/print';

export const DEFAULT_PRICING: PricingSettings = {
  currency: 'PHP',
  symbol: '₱',
  pagePrices: {
    Letter: { bw: 3, color: 6 },
    A4: { bw: 5, color: 8 },
    Legal: { bw: 7, color: 10 },
    A3: { bw: 12, color: 20 },
  },
  photoPaperPrices: {
    glossy: { bw: 25, color: 35 },
  },
  photoPaperSizes: [
    { id: '4x6', label: '4 × 6 inches (4R)', dimensions: '4 × 6 in', enabled: true },
    { id: '5x7', label: '5 × 7 inches (5R)', dimensions: '5 × 7 in', enabled: true },
    { id: 'A4', label: 'A4 Photo (8.3 × 11.7 in)', dimensions: '8.27 × 11.69 in', enabled: true },
  ],
  surcharges: {
    backToBack: 5,   // +₱5 per document printing job
    borderless: 5,   // +₱5 per document printing job
    highQuality: 10, // +₱10 per document printing job
  },
  optionsConfig: {
    allowBorderlessOnOrdinary: true,
    allowBorderlessOnGlossy: true,
    allowBackToBackOnGlossy: false,
    allowHighQuality: true,
  },
  bindingPrices: {
    none: 0,
    staple: 5,
    spiral: 35,
    booklet: 45,
  },
};

export const MAXIN_SHOP: ShopLocation = {
  id: 'maxin-printing-service',
  name: 'Maxin Printing Service',
  address: '124 Commercial Avenue, Ground Floor',
  counterInfo: 'Main Counter & Express Claim Station',
  phone: '+63 917 888 5678',
  hours: 'Mon - Sat: 8:00 AM - 7:30 PM',
  activeQueueCount: 2,
  avgWaitMins: 3,
  acceptingOrders: true,
};

export const SHOPS: ShopLocation[] = [MAXIN_SHOP];

export const INITIAL_ORDERS: PrintOrder[] = [
  {
    id: 'PD-1046',
    queueNumber: '#1046',
    trackingToken: 'demo-token-1046',
    shopId: 'maxin-printing-service',
    customerName: 'Juan Dela Cruz',
    customerPhone: '+63 917 555 1120',
    customerEmail: 'juan@example.com',
    files: [
      {
        id: 'file-1046-1',
        fileName: 'Capstone_Project_Documentation.pdf',
        fileSize: 3420000,
        fileType: 'application/pdf',
        pageCount: 12,
        copies: 2,
        paperSize: 'A4',
        paperType: 'ordinary',
        printType: 'bw',
        orientation: 'portrait',
        duplex: 'back_to_back',
        borderless: false,
        quality: 'standard',
        baseCost: 120.00,
        surcharges: { backToBack: 5.00, borderless: 0.00, quality: 0.00 },
        subtotal: 125.00,
        telegramStatus: 'delivered',
        isDeletedFromDisk: true,
      },
      {
        id: 'file-1046-2',
        fileName: 'Project_Poster_Overview.pdf',
        fileSize: 1850000,
        fileType: 'application/pdf',
        pageCount: 1,
        copies: 2,
        paperSize: 'A3',
        paperType: 'ordinary',
        printType: 'color',
        orientation: 'landscape',
        duplex: 'single',
        borderless: true,
        quality: 'high',
        baseCost: 40.00,
        surcharges: { backToBack: 0.00, borderless: 5.00, quality: 10.00 },
        subtotal: 55.00,
        telegramStatus: 'delivered',
        isDeletedFromDisk: true,
      },
    ],
    binding: 'staple',
    instructions: 'Please staple top-left corner on the documentation.',
    status: 'printing',
    statusMessage: 'Currently printing your order on high-speed Canon printer',
    statusHistory: [
      { status: 'waiting', timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(), changedBy: 'customer', note: 'Order submitted via QR' },
      { status: 'printing', timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(), changedBy: 'staff', note: 'Printing started by Maxin staff' },
    ],
    createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    totalPrice: 185.00,
    telegramStatus: 'delivered',
    isDemo: true,
  },
  {
    id: 'PD-1045',
    queueNumber: '#1045',
    trackingToken: 'demo-token-1045',
    shopId: 'maxin-printing-service',
    customerName: 'Maria Santos',
    customerPhone: '+63 920 602 9981',
    customerEmail: 'maria.santos@email.com',
    files: [
      {
        id: 'file-1045-1',
        fileName: 'Notarized_Affidavit_Final.docx',
        fileSize: 850000,
        fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        pageCount: 4,
        copies: 3,
        paperSize: 'Legal',
        paperType: 'ordinary',
        printType: 'bw',
        orientation: 'portrait',
        duplex: 'single',
        borderless: false,
        quality: 'standard',
        baseCost: 84.00,
        surcharges: { backToBack: 0.00, borderless: 0.00, quality: 0.00 },
        subtotal: 84.00,
        telegramStatus: 'delivered',
        isDeletedFromDisk: true,
      },
    ],
    binding: 'none',
    instructions: 'Clean crisp legal paper please, no staples.',
    status: 'ready',
    statusMessage: 'Your pages are ready at the counter. Please present Ticket #1045.',
    statusHistory: [
      { status: 'waiting', timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(), changedBy: 'customer' },
      { status: 'printing', timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(), changedBy: 'staff' },
      { status: 'ready', timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(), changedBy: 'staff', note: 'Completed and packed at counter' },
    ],
    createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    totalPrice: 84.00,
    telegramStatus: 'delivered',
    isDemo: true,
  },
  {
    id: 'PD-1044',
    queueNumber: '#1044',
    trackingToken: 'demo-token-1044',
    shopId: 'maxin-printing-service',
    customerName: 'Carlos Ramos',
    customerPhone: '+63 919 481 2244',
    files: [
      {
        id: 'file-1044-1',
        fileName: 'Company_Product_Brochures.pdf',
        fileSize: 5200000,
        fileType: 'application/pdf',
        pageCount: 8,
        copies: 5,
        paperSize: 'Letter',
        paperType: 'ordinary',
        printType: 'color',
        orientation: 'portrait',
        duplex: 'back_to_back',
        borderless: false,
        quality: 'high',
        baseCost: 240.00,
        surcharges: { backToBack: 5.00, borderless: 0.00, quality: 10.00 },
        subtotal: 255.00,
        telegramStatus: 'delivered',
        isDeletedFromDisk: true,
      },
    ],
    binding: 'staple',
    instructions: 'Stapled booklets please.',
    status: 'completed',
    statusMessage: 'Order collected and paid at counter',
    statusHistory: [
      { status: 'waiting', timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(), changedBy: 'customer' },
      { status: 'printing', timestamp: new Date(Date.now() - 40 * 60 * 1000).toISOString(), changedBy: 'staff' },
      { status: 'ready', timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString(), changedBy: 'staff' },
      { status: 'completed', timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(), changedBy: 'staff', note: 'Claimed by Carlos' },
    ],
    createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    totalPrice: 260.00,
    telegramStatus: 'delivered',
    isDemo: true,
  },
];

export interface FileCalculationParams {
  pages: number;
  copies: number;
  paperSize?: string;
  paperType?: string;       // 'ordinary' | 'glossy'
  photoPaperSize?: string;  // '4x6' | '5x7' | 'A4'
  printType: string;        // 'bw' | 'color'
  duplex?: string;          // 'single' | 'back_to_back' | 'double_long' | 'double_short'
  borderless?: boolean;     // true | false
  quality?: string;         // 'standard' | 'high'
  pricing?: PricingSettings;
}

export interface FilePricingBreakdown {
  baseRatePerUnit: number;
  chargeableUnits: number;
  baseCost: number;
  surcharges: {
    backToBack: number;
    borderless: number;
    quality: number;
  };
  totalSurcharges: number;
  subtotal: number;
}

/**
 * Authoritative itemized calculation for an uploaded document/photo.
 * Formula defined in Section 6 of requirements:
 * - Ordinary paper: base rate * chargeable pages * copies + applicable surcharges
 * - Glossy photo paper: photo paper rate * chargeable sheets * copies + applicable surcharges
 * Surcharges (applied once per document printing job):
 * - Back-to-Back: +₱5
 * - Borderless Printing: +₱5
 * - High Quality: +₱10
 */
export function calculateFilePricingBreakdown(params: FileCalculationParams): FilePricingBreakdown {
  const pages = Math.max(1, Math.round(Number(params.pages) || 1));
  const copies = Math.max(1, Math.round(Number(params.copies) || 1));
  const pricing = params.pricing || DEFAULT_PRICING;
  const isColor = params.printType === 'color';
  const isGlossy = params.paperType === 'glossy';

  let baseRatePerUnit = 0;
  let chargeableUnits = 0;
  let baseCost = 0;

  if (isGlossy) {
    // Photo Paper — Glossy rates (Default: B&W ₱25/sheet, Color ₱35/sheet)
    const glossyRates = pricing.photoPaperPrices?.glossy || DEFAULT_PRICING.photoPaperPrices.glossy;
    baseRatePerUnit = isColor ? glossyRates.color : glossyRates.bw;
    // Each photo/page represents physical photo sheets
    chargeableUnits = pages;
    baseCost = Math.round(baseRatePerUnit * 100 * chargeableUnits * copies) / 100;
  } else {
    // Ordinary paper rates (Letter: 3/6, A4: 5/8, Legal: 7/10, A3: 12/20)
    const sizeKey = (params.paperSize && params.paperSize in pricing.pagePrices 
      ? params.paperSize 
      : 'A4') as keyof typeof pricing.pagePrices;
    const rates = pricing.pagePrices[sizeKey] || pricing.pagePrices.A4;
    baseRatePerUnit = isColor ? rates.color : rates.bw;
    chargeableUnits = pages;
    baseCost = Math.round(baseRatePerUnit * 100 * chargeableUnits * copies) / 100;
  }

  // Calculate Surcharges (applied once per document job)
  const isBackToBack = params.duplex === 'back_to_back' || params.duplex === 'double_long' || params.duplex === 'double_short';
  const isBorderless = Boolean(params.borderless);
  const isHighQuality = params.quality === 'high';

  const backToBackFee = isBackToBack ? (pricing.surcharges?.backToBack ?? 5) : 0;
  const borderlessFee = isBorderless ? (pricing.surcharges?.borderless ?? 5) : 0;
  const qualityFee = isHighQuality ? (pricing.surcharges?.highQuality ?? 10) : 0;

  const totalSurcharges = Math.round((backToBackFee + borderlessFee + qualityFee) * 100) / 100;
  const subtotal = Math.round((baseCost + totalSurcharges) * 100) / 100;

  return {
    baseRatePerUnit,
    chargeableUnits,
    baseCost,
    surcharges: {
      backToBack: backToBackFee,
      borderless: borderlessFee,
      quality: qualityFee,
    },
    totalSurcharges,
    subtotal,
  };
}

export function calculateFileSubtotal(params: FileCalculationParams): number {
  return calculateFilePricingBreakdown(params).subtotal;
}

export function calculateOrderPrice(params: {
  files: Array<FileCalculationParams>;
  binding: string;
  pricing?: PricingSettings;
}): number {
  const pricing = params.pricing || DEFAULT_PRICING;
  let filesTotal = 0;

  for (const f of params.files) {
    const breakdown = calculateFilePricingBreakdown({ ...f, pricing });
    filesTotal += breakdown.subtotal;
  }

  const bindingKey = (params.binding in pricing.bindingPrices ? params.binding : 'none') as keyof typeof pricing.bindingPrices;
  const bindingFee = pricing.bindingPrices[bindingKey] || 0;

  const total = Math.round((filesTotal + bindingFee) * 100) / 100;
  return total;
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
