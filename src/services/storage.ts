import { PrintOrder, OrderStatus, OrderStats, TelegramConfig } from '../types/print';
import { INITIAL_ORDERS } from '../data/mockData';

const STORAGE_KEY = 'printdrop_orders_v2';
const TELEGRAM_CONFIG_KEY = 'printdrop_telegram_cfg_v2';

type ChangeListener = () => void;
const listeners = new Set<ChangeListener>();

function notifyChange() {
  listeners.forEach(fn => {
    try {
      fn();
    } catch (e) {
      console.error('Listener notification error:', e);
    }
  });
}

export function subscribeToOrders(listener: ChangeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getOrders(): PrintOrder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_ORDERS));
      return INITIAL_ORDERS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return INITIAL_ORDERS;
  } catch (e) {
    return INITIAL_ORDERS;
  }
}

export function saveOrders(orders: PrintOrder[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    notifyChange();
  } catch (e) {
    console.error('Error saving orders to localStorage:', e);
  }
}

export function getOrderById(query: string): PrintOrder | undefined {
  if (!query) return undefined;
  const clean = query.trim().toUpperCase();
  const orders = getOrders();
  
  return orders.find(
    o => o.id.toUpperCase() === clean || 
         o.queueNumber.toUpperCase() === clean ||
         o.queueNumber.toUpperCase() === `#${clean}` ||
         `#${o.queueNumber}`.toUpperCase() === clean
  );
}

export function addOrder(newOrder: PrintOrder): PrintOrder {
  const current = getOrders();
  const updated = [newOrder, ...current];
  saveOrders(updated);
  return newOrder;
}

export function updateOrderStatus(orderId: string, status: OrderStatus, message?: string): PrintOrder | undefined {
  const current = getOrders();
  let updatedOrder: PrintOrder | undefined;

  const updated = current.map(order => {
    if (order.id === orderId) {
      let defaultMsg = message;
      if (!defaultMsg) {
        if (status === 'waiting') defaultMsg = 'Order received in queue';
        else if (status === 'printing') defaultMsg = 'Document sent to high-speed printer';
        else if (status === 'ready') defaultMsg = 'Ready for pickup at counter';
        else if (status === 'completed') defaultMsg = 'Collected by customer';
        else if (status === 'cancelled') defaultMsg = 'Order cancelled';
      }

      updatedOrder = {
        ...order,
        status,
        statusMessage: defaultMsg,
        updatedAt: new Date().toISOString(),
        completedAt: status === 'completed' ? new Date().toISOString() : order.completedAt,
      };
      return updatedOrder;
    }
    return order;
  });

  if (updatedOrder) {
    saveOrders(updated);
  }
  return updatedOrder;
}

export function deleteOrder(orderId: string): boolean {
  const current = getOrders();
  const filtered = current.filter(o => o.id !== orderId);
  if (filtered.length !== current.length) {
    saveOrders(filtered);
    return true;
  }
  return false;
}

export function resetToDemoOrders(): void {
  saveOrders(INITIAL_ORDERS);
}

export function generateOrderId(): string {
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `PD-${randomNum}`;
}

export function generateQueueNumber(): string {
  const orders = getOrders();
  let highest = 15;
  orders.forEach(o => {
    const match = o.queueNumber.match(/A-(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > highest) highest = num;
    }
  });
  return `A-${String(highest + 1).padStart(2, '0')}`;
}

export function getOrderStats(): OrderStats {
  const orders = getOrders();
  const stats: OrderStats = {
    total: orders.length,
    waiting: 0,
    printing: 0,
    ready: 0,
    completed: 0,
    cancelled: 0,
    telegramFailures: 0,
    todayRevenue: 0,
    totalPages: 0,
  };

  orders.forEach(o => {
    if (o.status === 'waiting') stats.waiting += 1;
    else if (o.status === 'printing') stats.printing += 1;
    else if (o.status === 'ready') stats.ready += 1;
    else if (o.status === 'completed') stats.completed += 1;
    else if (o.status === 'cancelled') stats.cancelled += 1;

    if (o.telegramStatus === 'failed') stats.telegramFailures += 1;

    if (o.status !== 'cancelled') {
      stats.todayRevenue += o.totalPrice || 0;
      stats.totalPages += o.files.reduce((acc, f) => acc + f.pageCount * f.copies, 0);
    }
  });

  stats.todayRevenue = Number(stats.todayRevenue.toFixed(2));
  return stats;
}

export function getTelegramConfig(): TelegramConfig {
  try {
    const raw = localStorage.getItem(TELEGRAM_CONFIG_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading telegram config:', e);
  }
  return {
    enabled: false,
    botUsername: '@PrintDropBot',
    botTokenConfigured: false,
    chatIdConfigured: false,
    autoDeleteAfterDelivery: true,
  };
}

export function saveTelegramConfig(config: TelegramConfig): void {
  try {
    localStorage.setItem(TELEGRAM_CONFIG_KEY, JSON.stringify(config));
    notifyChange();
  } catch (e) {
    console.error('Error saving telegram config:', e);
  }
}
