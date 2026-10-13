import { PrintOrder, OrderStatus, PricingSettings, ShopLocation, OrderStats } from '../types/print';
import { DEFAULT_PRICING, SHOPS } from '../data/mockData';

const TOKEN_KEY = 'printdrop_admin_jwt';

export function getAdminToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAdminToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

function getAuthHeaders(): HeadersInit {
  const token = getAdminToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchSettings(): Promise<{
  pricing: PricingSettings;
  shops: ShopLocation[];
  telegramConfigured: boolean;
}> {
  try {
    const res = await fetch('/api/settings');
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('[API] Could not fetch settings from server, using defaults:', e);
  }
  return {
    pricing: DEFAULT_PRICING,
    shops: SHOPS,
    telegramConfigured: false,
  };
}

export async function submitOrder(payload: {
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  shopId: string;
  binding: string;
  instructions?: string;
  files: Array<{
    fileName: string;
    fileSize: number;
    fileType: string;
    fileData?: string;
    pageCount: number;
    copies: number;
    paperSize: string;
    printType: string;
    orientation: string;
    duplex: string;
  }>;
}): Promise<{ success: boolean; order: PrintOrder; error?: string }> {
  const res = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to submit order');
  }
  return data;
}

export async function trackOrder(
  query: string,
  token?: string,
  phone?: string
): Promise<{ order: PrintOrder; verified: boolean }> {
  const params = new URLSearchParams({ q: query });
  if (token) params.set('token', token);
  if (phone) params.set('phone', phone);

  const res = await fetch(`/api/orders/track?${params.toString()}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Order not found');
  }
  return data;
}

export async function adminLogin(
  username: string,
  password: string
): Promise<{ success: boolean; token: string; username: string }> {
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Login failed');
  }
  setAdminToken(data.token);
  return data;
}

export async function checkAdminAuth(): Promise<boolean> {
  const token = getAdminToken();
  if (!token) return false;
  try {
    const res = await fetch('/api/admin/me', {
      headers: getAuthHeaders(),
    });
    return res.ok;
  } catch (_) {
    return false;
  }
}

export async function adminLogout(): Promise<void> {
  try {
    await fetch('/api/admin/logout', {
      method: 'POST',
      headers: getAuthHeaders(),
    });
  } catch (_) {}
  setAdminToken(null);
}

export async function getAdminOrders(params: {
  tab?: string;
  shop?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{
  orders: PrintOrder[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const query = new URLSearchParams();
  if (params.tab) query.set('tab', params.tab);
  if (params.shop) query.set('shop', params.shop);
  if (params.search) query.set('search', params.search);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));

  const res = await fetch(`/api/admin/orders?${query.toString()}`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch admin orders');
  }
  return data;
}

export async function updateOrderStatusApi(
  orderId: string,
  status: OrderStatus,
  note?: string
): Promise<PrintOrder> {
  const res = await fetch(`/api/admin/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ status, note }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update order status');
  }
  return data.order;
}

export async function retryTelegramDelivery(orderId: string): Promise<any> {
  const res = await fetch(`/api/admin/orders/${orderId}/retry-telegram`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  return await res.json();
}

export async function deleteOrderApi(orderId: string): Promise<void> {
  const res = await fetch(`/api/admin/orders/${orderId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to delete order');
  }
}

export async function getAdminStats(): Promise<OrderStats> {
  const res = await fetch('/api/admin/stats', {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error('Failed to fetch stats');
  }
  return await res.json();
}

export async function updateSettingsApi(payload: {
  pricing?: Partial<PricingSettings>;
  shops?: ShopLocation[];
}): Promise<any> {
  const res = await fetch('/api/admin/settings', {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return await res.json();
}

export async function getTelegramStatusApi(): Promise<{
  configured: boolean;
  hasToken: boolean;
  hasChatId: boolean;
}> {
  const res = await fetch('/api/telegram/status', {
    headers: getAuthHeaders(),
  });
  return await res.json();
}

export async function testTelegramApi(): Promise<{
  success: boolean;
  message: string;
  botInfo?: any;
}> {
  const res = await fetch('/api/telegram/test', {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  return await res.json();
}

export async function triggerCleanupApi(): Promise<any> {
  const res = await fetch('/api/admin/cleanup', {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  return await res.json();
}

export function getFileDownloadUrl(orderId: string, fileId: string, token?: string): string {
  const url = new URL(`/api/orders/${orderId}/files/${fileId}`, window.location.origin);
  if (token) url.searchParams.set('token', token);
  return url.toString();
}

export function getZipDownloadUrl(orderId: string): string {
  return `/api/admin/orders/${orderId}/download-zip`;
}
