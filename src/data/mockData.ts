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
  duplexDiscountPercent: 10,
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
        printType: 'bw',
        orientation: 'portrait',
        duplex: 'double_long',
        subtotal: 108.00,
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
        printType: 'color',
        orientation: 'landscape',
        duplex: 'single',
        subtotal: 40.00,
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
    totalPrice: 153.00,
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
        printType: 'bw',
        orientation: 'portrait',
        duplex: 'single',
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
        printType: 'color',
        orientation: 'portrait',
        duplex: 'double_long',
        subtotal: 216.00,
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
    totalPrice: 221.00,
    telegramStatus: 'delivered',
    isDemo: true,
  },
];

export function calculateFileSubtotal(params: {
  pages: number;
  copies: number;
  paperSize: string;
  printType: string;
  duplex: string;
  pricing?: PricingSettings;
}): number {
  const pages = Math.max(1, params.pages);
  const copies = Math.max(1, params.copies);
  const pricing = params.pricing || DEFAULT_PRICING;

  const sizeKey = (params.paperSize in pricing.pagePrices ? params.paperSize : 'A4') as keyof typeof pricing.pagePrices;
  const rates = pricing.pagePrices[sizeKey] || pricing.pagePrices.A4;
  let perPageRate = params.printType === 'color' ? rates.color : rates.bw;

  // Duplex discount if double-sided
  if (params.duplex !== 'single') {
    const discount = (pricing.duplexDiscountPercent || 10) / 100;
    perPageRate = perPageRate * (1 - discount);
  }

  const subtotal = perPageRate * pages * copies;
  return Number(subtotal.toFixed(2));
}

export function calculateOrderPrice(params: {
  files: Array<{
    pages: number;
    copies: number;
    paperSize: string;
    printType: string;
    duplex: string;
  }>;
  binding: string;
  pricing?: PricingSettings;
}): number {
  const pricing = params.pricing || DEFAULT_PRICING;
  let filesTotal = 0;

  for (const f of params.files) {
    filesTotal += calculateFileSubtotal({
      ...f,
      pricing,
    });
  }

  const bindingKey = (params.binding in pricing.bindingPrices ? params.binding : 'none') as keyof typeof pricing.bindingPrices;
  const bindingFee = pricing.bindingPrices[bindingKey] || 0;

  const total = filesTotal + bindingFee;
  return Number(total.toFixed(2));
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
