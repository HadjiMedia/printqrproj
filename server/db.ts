import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PrintOrder, PricingSettings, ShopLocation } from '../src/types/print';
import { DEFAULT_PRICING, MAXIN_SHOP, INITIAL_ORDERS } from '../src/data/mockData';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const UPLOADS_DIR = path.resolve(DATA_DIR, 'uploads');
const DB_FILE = path.resolve(DATA_DIR, 'printdrop_db.json');

interface DatabaseSchema {
  orders: PrintOrder[];
  shops: ShopLocation[];
  pricing: PricingSettings;
  auditLogs: Array<{
    id: string;
    timestamp: string;
    actor: string;
    action: string;
    details: string;
  }>;
  adminSessions: Array<{
    token: string;
    createdAt: string;
    expiresAt: string;
    username: string;
  }>;
  queueCounters: Record<string, { date: string; current: number }>;
}

let dbCache: DatabaseSchema | null = null;

function ensureDirectories() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

export function getUploadsDir(): string {
  ensureDirectories();
  return UPLOADS_DIR;
}

export function initDatabase(): DatabaseSchema {
  ensureDirectories();

  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      dbCache = JSON.parse(raw);
      if (dbCache && Array.isArray(dbCache.orders)) {
        // Ensure single shop is Maxin Printing Service
        dbCache.shops = [MAXIN_SHOP];
        return dbCache;
      }
    } catch (e) {
      console.error('[DB] Failed reading DB file, recreating default:', e);
    }
  }

  // Seed default data for Maxin Printing Service
  dbCache = {
    orders: [...INITIAL_ORDERS],
    shops: [MAXIN_SHOP],
    pricing: { ...DEFAULT_PRICING },
    auditLogs: [
      {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        actor: 'system',
        action: 'INIT_DB',
        details: 'Database initialized for Maxin Printing Service',
      },
    ],
    adminSessions: [],
    queueCounters: {},
  };

  saveDatabase(dbCache);
  return dbCache;
}

export function getDatabase(): DatabaseSchema {
  if (!dbCache) {
    return initDatabase();
  }
  return dbCache;
}

export function saveDatabase(data: DatabaseSchema): void {
  ensureDirectories();
  dbCache = data;

  const tempFile = `${DB_FILE}.${Date.now()}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  try {
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('[DB] Error writing atomic database file:', err);
    if (fs.existsSync(tempFile)) {
      try { fs.unlinkSync(tempFile); } catch (_) {}
    }
  }
}

export function logAudit(actor: string, action: string, details: string): void {
  const db = getDatabase();
  db.auditLogs.unshift({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    actor,
    action,
    details,
  });
  if (db.auditLogs.length > 500) {
    db.auditLogs = db.auditLogs.slice(0, 500);
  }
  saveDatabase(db);
}

// Sequential queue ticketing for Maxin Printing Service (e.g. #1046, #1047, #1048...)
export function generateQueueNumber(_shopId?: string): string {
  const db = getDatabase();
  const todayStr = new Date().toISOString().slice(0, 10);
  const key = `maxin_${todayStr}`;

  // Find highest existing numeric queue ticket (default starting at 1046)
  let highest = 1045;
  for (const o of db.orders) {
    const match = o.queueNumber?.match(/\d+/);
    if (match) {
      const num = parseInt(match[0], 10);
      if (!isNaN(num) && num > highest) {
        highest = num;
      }
    }
  }

  if (!db.queueCounters[key] || db.queueCounters[key].date !== todayStr) {
    db.queueCounters[key] = {
      date: todayStr,
      current: highest + 1,
    };
  } else {
    db.queueCounters[key].current = Math.max(db.queueCounters[key].current + 1, highest + 1);
  }

  const num = db.queueCounters[key].current;
  saveDatabase(db);
  return `#${num}`;
}

export function generateOrderId(): string {
  const db = getDatabase();
  let candidate = '';
  let exists = true;
  while (exists) {
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    candidate = `PD-${randomDigits}`;
    exists = db.orders.some(o => o.id === candidate);
  }
  return candidate;
}

export function generateTrackingToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function createAdminSession(username: string): string {
  const db = getDatabase();
  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  db.adminSessions.push({
    token,
    username,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  });

  saveDatabase(db);
  return token;
}

export function verifyAdminSession(token: string | undefined): boolean {
  if (!token) return false;
  const db = getDatabase();
  const now = new Date().toISOString();
  const session = db.adminSessions.find(s => s.token === token && s.expiresAt > now);
  return Boolean(session);
}

export function deleteAdminSession(token: string | undefined): void {
  if (!token) return;
  const db = getDatabase();
  db.adminSessions = db.adminSessions.filter(s => s.token !== token);
  saveDatabase(db);
}
