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

async function parseJsonResponse<T = any>(res: Response): Promise<T> {
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch (_e) {
    // If the serverless host returned HTML/plain text (e.g. Vercel 500, 504, 413, 502)
    if (res.status === 413) {
      throw new Error('Upload size exceeds the serverless payload limit (4.5MB). Please compress large photos or upload documents separately.');
    }
    if (res.status === 504 || res.status === 502) {
      throw new Error('Server request timed out. Please check your internet connection and try again.');
    }
    if (!res.ok) {
      throw new Error(`Server returned error (${res.status}). Please try again or contact Maxin counter staff.`);
    }
    throw new Error('Server returned an unexpected response format.');
  }

  if (!res.ok) {
    const errorMsg = json?.error?.message || json?.error || `Request failed with status ${res.status}`;
    throw new Error(errorMsg);
  }

  return json as T;
}

export async function fetchSettings(): Promise<{
  pricing: PricingSettings;
  shops: ShopLocation[];
  telegramConfigured: boolean;
}> {
  try {
    const res = await fetch('/api/settings');
    if (res.ok) {
      return await parseJsonResponse(res);
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
  clientRequestId?: string;
  binding: string;
  instructions?: string;
  files: Array<{
    fileName: string;
    fileSize: number;
    fileType: string;
    fileData?: string;
    pageCount: number;
    copies: number;
    paperSize?: string;
    paperType?: string;
    photoPaperSize?: string;
    printType: string;
    orientation: string;
    duplex: string;
    borderless?: boolean;
    quality?: string;
  }>;
}): Promise<{ 
  success: boolean; 
  orderId?: string; 
  queueNumber?: string; 
  trackingUrl?: string; 
  order: PrintOrder; 
  error?: string 
}> {
  const res = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return await parseJsonResponse(res);
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
  return await parseJsonResponse(res);
}

const DEVICE_ID_KEY = 'printdrop_device_id';

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function getDeviceName(): string {
  const ua = navigator.userAgent;
  let browser = 'Browser';
  if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edge')) browser = 'Edge';

  let os = 'Device';
  if (ua.includes('Mac')) os = 'Mac';
  else if (ua.includes('Win')) os = 'Windows PC';
  else if (ua.includes('iPhone')) os = 'iPhone';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('Linux')) os = 'Linux';

  return `${os} (${browser})`;
}

export async function adminLogin(
  username: string,
  password: string
): Promise<{
  success: boolean;
  token?: string;
  username?: string;
  requireApproval?: boolean;
  requestId?: string;
  message?: string;
  isPrimary?: boolean;
  device?: any;
}> {
  const deviceId = getDeviceId();
  const deviceName = getDeviceName();

  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, deviceId, deviceName }),
  });
  const data = await parseJsonResponse(res);
  if (data.token) {
    setAdminToken(data.token);
  }
  return data;
}

export async function pollDeviceApprovalStatus(
  requestId?: string,
  deviceId?: string
): Promise<{
  approved: boolean;
  status: string;
  token?: string;
  device?: any;
}> {
  const params = new URLSearchParams();
  if (requestId) params.set('requestId', requestId);
  if (deviceId) params.set('deviceId', deviceId);

  const res = await fetch(`/api/admin/device-approval/status?${params.toString()}`);
  const data = await parseJsonResponse(res);
  if (data.token) {
    setAdminToken(data.token);
  }
  return data;
}

export async function fetchAuthorizedDevices(): Promise<any[]> {
  const res = await fetch('/api/admin/devices', {
    headers: getAuthHeaders(),
  });
  const data = await parseJsonResponse(res);
  return data.devices || [];
}

export async function approveDeviceApi(deviceId: string): Promise<void> {
  const res = await fetch('/api/admin/devices/approve', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ deviceId }),
  });
  await parseJsonResponse(res);
}

export async function revokeDeviceApi(deviceId: string): Promise<void> {
  const res = await fetch('/api/admin/devices/revoke', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ deviceId }),
  });
  await parseJsonResponse(res);
}

export async function recoverDeviceApi(masterKey: string): Promise<{ success: boolean; token: string }> {
  const deviceId = getDeviceId();
  const deviceName = getDeviceName();

  const res = await fetch('/api/admin/devices/recover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ masterKey, deviceId, deviceName }),
  });
  const data = await parseJsonResponse(res);
  if (data.token) {
    setAdminToken(data.token);
  }
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
  return await parseJsonResponse(res);
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
  const data = await parseJsonResponse(res);
  return data.order;
}

export async function retryTelegramDelivery(orderId: string): Promise<any> {
  const res = await fetch(`/api/admin/orders/${orderId}/retry-telegram`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  return await parseJsonResponse(res);
}

export async function deleteOrderApi(orderId: string): Promise<void> {
  const res = await fetch(`/api/admin/orders/${orderId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  await parseJsonResponse(res);
}

export async function getAdminStats(): Promise<OrderStats> {
  const res = await fetch('/api/admin/stats', {
    headers: getAuthHeaders(),
  });
  return await parseJsonResponse(res);
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
  return await parseJsonResponse(res);
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
