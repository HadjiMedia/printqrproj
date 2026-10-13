import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Pool } from '@neondatabase/serverless';
import { PrintOrder, OrderFile, OrderStatus, PricingSettings, ShopLocation, TrustedDevice } from '../src/types/print';
import { DEFAULT_PRICING, MAXIN_SHOP, INITIAL_ORDERS } from '../src/data/mockData';
import { hashPassword, verifyPassword } from './auth';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const UPLOADS_DIR = path.resolve(DATA_DIR, 'uploads');
const DB_FILE = path.resolve(DATA_DIR, 'printdrop_db.json');

export interface DatabaseSchema {
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
    username: string;
    deviceId?: string;
    createdAt: string;
    expiresAt: string;
  }>;
  devices: TrustedDevice[];
  admins: Array<{
    id: string;
    username: string;
    passwordHash: string;
    salt: string;
    role: string;
  }>;
  queueCounters: Record<string, { date: string; current: number }>;
}

let dbCache: DatabaseSchema | null = null;
let pgPool: Pool | null = null;
let isPgInitialized = false;

function ensureDirectories() {
  if (!fs.existsSync(DATA_DIR)) {
    try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    try { fs.mkdirSync(UPLOADS_DIR, { recursive: true }); } catch (_) {}
  }
}

export function getUploadsDir(): string {
  ensureDirectories();
  return UPLOADS_DIR;
}

export function isNeonConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim().startsWith('postgres'));
}

export function getPgPool(): Pool | null {
  if (!isNeonConfigured()) return null;
  if (!pgPool) {
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL!.trim(),
    });
  }
  return pgPool;
}

/**
 * Initializes Neon PostgreSQL tables or creates local JSON DB fallback.
 */
export async function initDatabase(): Promise<DatabaseSchema> {
  ensureDirectories();

  // 1. Initialize local cache first as reliable sync baseline
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      dbCache = JSON.parse(raw);
    } catch (e) {
      console.warn('[DB] Could not parse local DB file:', e);
    }
  }

  if (!dbCache || !Array.isArray(dbCache.orders)) {
    const defaultStaff = hashPassword(process.env.ADMIN_PASSWORD || 'printdrop2025');
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
      devices: [],
      admins: [
        {
          id: 'admin-default-1',
          username: 'staff',
          passwordHash: defaultStaff.hash,
          salt: defaultStaff.salt,
          role: 'staff',
        },
      ],
      queueCounters: {},
    };
    saveDatabase(dbCache);
  }

  // 2. If Neon PostgreSQL is configured, initialize serverless tables
  if (isNeonConfigured()) {
    try {
      await initNeonSchema();
      console.log('[DB] Neon PostgreSQL connected and initialized successfully.');
    } catch (err) {
      console.error('[DB] Failed connecting to Neon PostgreSQL, continuing with memory/JSON store:', err);
    }
  }

  return dbCache;
}

/**
 * Synchronous accessor for in-memory or local store
 */
export function getDatabase(): DatabaseSchema {
  if (!dbCache) {
    ensureDirectories();
    const defaultStaff = hashPassword(process.env.ADMIN_PASSWORD || 'printdrop2025');
    dbCache = {
      orders: [...INITIAL_ORDERS],
      shops: [MAXIN_SHOP],
      pricing: { ...DEFAULT_PRICING },
      auditLogs: [],
      adminSessions: [],
      devices: [],
      admins: [
        {
          id: 'admin-default-1',
          username: 'staff',
          passwordHash: defaultStaff.hash,
          salt: defaultStaff.salt,
          role: 'staff',
        },
      ],
      queueCounters: {},
    };
  }
  return dbCache;
}

export function saveDatabase(data: DatabaseSchema): void {
  ensureDirectories();
  dbCache = data;

  try {
    const tempFile = `${DB_FILE}.${Date.now()}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    // In read-only serverless filesystems, writing to disk may fail; cache remains in memory
  }
}

// ====================================================================
// Neon PostgreSQL Schema & Migration Runner
// ====================================================================

async function initNeonSchema(): Promise<void> {
  const pool = getPgPool();
  if (!pool || isPgInitialized) return;

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS printdrop_admins (
        id VARCHAR(64) PRIMARY KEY,
        username VARCHAR(64) UNIQUE NOT NULL,
        password_hash VARCHAR(256) NOT NULL,
        salt VARCHAR(64) NOT NULL,
        role VARCHAR(32) NOT NULL DEFAULT 'staff',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS printdrop_devices (
        id VARCHAR(64) PRIMARY KEY,
        device_id VARCHAR(128) UNIQUE NOT NULL,
        device_name VARCHAR(128) NOT NULL,
        user_agent TEXT,
        ip_address VARCHAR(64),
        status VARCHAR(32) NOT NULL DEFAULT 'pending',
        is_primary BOOLEAN NOT NULL DEFAULT FALSE,
        request_id VARCHAR(64) UNIQUE,
        requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        approved_at TIMESTAMPTZ,
        approved_by VARCHAR(64)
      );

      CREATE TABLE IF NOT EXISTS printdrop_orders (
        id VARCHAR(32) PRIMARY KEY,
        queue_number VARCHAR(32) NOT NULL,
        tracking_token VARCHAR(64) NOT NULL,
        shop_id VARCHAR(64) NOT NULL DEFAULT 'maxin-printing-service',
        customer_name VARCHAR(128) NOT NULL,
        customer_phone VARCHAR(64),
        customer_email VARCHAR(128),
        binding VARCHAR(32) NOT NULL DEFAULT 'none',
        instructions TEXT,
        status VARCHAR(32) NOT NULL DEFAULT 'waiting',
        status_message TEXT,
        total_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
        telegram_status VARCHAR(32) NOT NULL DEFAULT 'pending',
        telegram_error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS printdrop_order_files (
        id VARCHAR(64) PRIMARY KEY,
        order_id VARCHAR(32) NOT NULL REFERENCES printdrop_orders(id) ON DELETE CASCADE,
        file_name VARCHAR(256) NOT NULL,
        file_size BIGINT NOT NULL DEFAULT 0,
        file_type VARCHAR(128),
        page_count INT NOT NULL DEFAULT 1,
        copies INT NOT NULL DEFAULT 1,
        paper_size VARCHAR(32) NOT NULL DEFAULT 'A4',
        print_type VARCHAR(32) NOT NULL DEFAULT 'bw',
        orientation VARCHAR(32) NOT NULL DEFAULT 'portrait',
        duplex VARCHAR(32) NOT NULL DEFAULT 'single',
        subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
        disk_path TEXT,
        telegram_status VARCHAR(32) NOT NULL DEFAULT 'pending',
        telegram_file_id VARCHAR(256),
        telegram_error TEXT,
        is_deleted_from_disk BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS printdrop_status_history (
        id SERIAL PRIMARY KEY,
        order_id VARCHAR(32) NOT NULL REFERENCES printdrop_orders(id) ON DELETE CASCADE,
        status VARCHAR(32) NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        changed_by VARCHAR(64) NOT NULL,
        note TEXT
      );

      CREATE TABLE IF NOT EXISTS printdrop_settings (
        key VARCHAR(64) PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS printdrop_audit_logs (
        id VARCHAR(64) PRIMARY KEY,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        actor VARCHAR(64) NOT NULL,
        action VARCHAR(64) NOT NULL,
        details TEXT
      );

      CREATE TABLE IF NOT EXISTS printdrop_admin_sessions (
        token VARCHAR(128) PRIMARY KEY,
        username VARCHAR(64) NOT NULL,
        device_id VARCHAR(128),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL
      );

      CREATE TABLE IF NOT EXISTS printdrop_queue_counters (
        counter_date VARCHAR(32) PRIMARY KEY,
        current_number INT NOT NULL DEFAULT 1045
      );
    `);

    // Seed default admin if missing
    const adminCheck = await client.query('SELECT COUNT(*) FROM printdrop_admins');
    if (parseInt(adminCheck.rows[0].count, 10) === 0) {
      const staffCreds = hashPassword(process.env.ADMIN_PASSWORD || 'printdrop2025');
      await client.query(
        'INSERT INTO printdrop_admins (id, username, password_hash, salt, role) VALUES ($1, $2, $3, $4, $5)',
        ['admin-1', 'staff', staffCreds.hash, staffCreds.salt, 'staff']
      );
    }

    // Seed initial demo orders if table empty
    const orderCheck = await client.query('SELECT COUNT(*) FROM printdrop_orders');
    if (parseInt(orderCheck.rows[0].count, 10) === 0) {
      for (const o of INITIAL_ORDERS) {
        await client.query(
          `INSERT INTO printdrop_orders (
            id, queue_number, tracking_token, shop_id, customer_name, customer_phone, customer_email,
            binding, instructions, status, status_message, total_price, telegram_status, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
          [
            o.id, o.queueNumber, o.trackingToken, o.shopId || 'maxin-printing-service',
            o.customerName, o.customerPhone, o.customerEmail, o.binding, o.instructions,
            o.status, o.statusMessage, o.totalPrice, o.telegramStatus, o.createdAt, o.updatedAt,
          ]
        );

        for (const f of o.files) {
          await client.query(
            `INSERT INTO printdrop_order_files (
              id, order_id, file_name, file_size, file_type, page_count, copies, paper_size,
              print_type, orientation, duplex, subtotal, telegram_status, is_deleted_from_disk
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
            [
              f.id, o.id, f.fileName, f.fileSize, f.fileType, f.pageCount, f.copies, f.paperSize,
              f.printType, f.orientation, f.duplex, f.subtotal, f.telegramStatus, f.isDeletedFromDisk,
            ]
          );
        }

        for (const sh of o.statusHistory) {
          await client.query(
            'INSERT INTO printdrop_status_history (order_id, status, timestamp, changed_by, note) VALUES ($1, $2, $3, $4, $5)',
            [o.id, sh.status, sh.timestamp, sh.changedBy, sh.note]
          );
        }
      }
    }

    isPgInitialized = true;
  } finally {
    client.release();
  }
}

// ====================================================================
// Order & Data Operations (Neon PostgreSQL + Cache Fallback)
// ====================================================================

export async function fetchAllOrders(filter?: {
  tab?: string;
  search?: string;
  limit?: number;
}): Promise<PrintOrder[]> {
  const pool = getPgPool();
  if (pool) {
    try {
      let query = `
        SELECT o.*,
          COALESCE(json_agg(DISTINCT f.*) FILTER (WHERE f.id IS NOT NULL), '[]') AS files,
          COALESCE(json_agg(DISTINCT sh.*) FILTER (WHERE sh.id IS NOT NULL), '[]') AS status_history
        FROM printdrop_orders o
        LEFT JOIN printdrop_order_files f ON f.order_id = o.id
        LEFT JOIN printdrop_status_history sh ON sh.order_id = o.id
      `;
      const conditions: string[] = [];
      const values: any[] = [];

      if (filter?.tab) {
        if (filter.tab === 'waiting') {
          conditions.push(`o.status = 'waiting'`);
        } else if (filter.tab === 'printing') {
          conditions.push(`o.status = 'printing'`);
        } else if (filter.tab === 'ready') {
          conditions.push(`o.status = 'ready'`);
        } else if (filter.tab === 'completed') {
          conditions.push(`o.status = 'completed'`);
        } else if (filter.tab === 'cancelled') {
          conditions.push(`o.status = 'cancelled'`);
        } else if (filter.tab === 'active') {
          conditions.push(`o.status IN ('waiting', 'printing', 'ready')`);
        }
      }

      if (filter?.search) {
        values.push(`%${filter.search.toLowerCase()}%`);
        conditions.push(`(
          LOWER(o.customer_name) LIKE $${values.length} OR
          LOWER(o.id) LIKE $${values.length} OR
          LOWER(o.queue_number) LIKE $${values.length} OR
          LOWER(COALESCE(o.customer_phone, '')) LIKE $${values.length}
        )`);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' GROUP BY o.id ORDER BY o.created_at DESC';

      if (filter?.limit) {
        values.push(filter.limit);
        query += ` LIMIT $${values.length}`;
      }

      const res = await pool.query(query, values);
      return res.rows.map(row => ({
        id: row.id,
        queueNumber: row.queue_number,
        trackingToken: row.tracking_token,
        shopId: row.shop_id,
        customerName: row.customer_name,
        customerPhone: row.customer_phone || undefined,
        customerEmail: row.customer_email || undefined,
        binding: row.binding,
        instructions: row.instructions || undefined,
        status: row.status,
        statusMessage: row.status_message || undefined,
        totalPrice: parseFloat(row.total_price),
        telegramStatus: row.telegram_status,
        createdAt: new Date(row.created_at).toISOString(),
        updatedAt: new Date(row.updated_at).toISOString(),
        completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : undefined,
        files: (row.files || []).map((f: any) => ({
          id: f.id,
          fileName: f.file_name,
          fileSize: parseInt(f.file_size, 10),
          fileType: f.file_type,
          pageCount: f.page_count,
          copies: f.copies,
          paperSize: f.paper_size,
          printType: f.print_type,
          orientation: f.orientation,
          duplex: f.duplex,
          subtotal: parseFloat(f.subtotal),
          diskPath: f.disk_path || undefined,
          telegramStatus: f.telegram_status,
          telegramFileId: f.telegram_file_id || undefined,
          isDeletedFromDisk: f.is_deleted_from_disk,
        })),
        statusHistory: (row.status_history || []).map((sh: any) => ({
          status: sh.status,
          timestamp: new Date(sh.timestamp).toISOString(),
          changedBy: sh.changed_by,
          note: sh.note || undefined,
        })),
      }));
    } catch (err) {
      console.error('[DB] Error querying orders from Neon:', err);
    }
  }

  // Fallback to in-memory/JSON
  const db = getDatabase();
  let orders = [...db.orders];
  if (filter?.tab) {
    if (filter.tab === 'waiting') orders = orders.filter(o => o.status === 'waiting');
    else if (filter.tab === 'printing') orders = orders.filter(o => o.status === 'printing');
    else if (filter.tab === 'ready') orders = orders.filter(o => o.status === 'ready');
    else if (filter.tab === 'completed') orders = orders.filter(o => o.status === 'completed');
    else if (filter.tab === 'cancelled') orders = orders.filter(o => o.status === 'cancelled');
    else if (filter.tab === 'active') orders = orders.filter(o => ['waiting', 'printing', 'ready'].includes(o.status));
  }
  if (filter?.search) {
    const q = filter.search.toLowerCase();
    orders = orders.filter(
      o =>
        o.customerName.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q) ||
        o.queueNumber.toLowerCase().includes(q) ||
        (o.customerPhone && o.customerPhone.includes(q))
    );
  }
  return orders;
}

export async function fetchOrderById(id: string): Promise<PrintOrder | null> {
  const pool = getPgPool();
  if (pool) {
    try {
      const res = await pool.query(`
        SELECT o.*,
          COALESCE(json_agg(DISTINCT f.*) FILTER (WHERE f.id IS NOT NULL), '[]') AS files,
          COALESCE(json_agg(DISTINCT sh.*) FILTER (WHERE sh.id IS NOT NULL), '[]') AS status_history
        FROM printdrop_orders o
        LEFT JOIN printdrop_order_files f ON f.order_id = o.id
        LEFT JOIN printdrop_status_history sh ON sh.order_id = o.id
        WHERE o.id = $1 OR UPPER(o.queue_number) = UPPER($1) OR UPPER(o.queue_number) = UPPER('#' || $1)
        GROUP BY o.id
      `, [id]);

      if (res.rows.length > 0) {
        const row = res.rows[0];
        return {
          id: row.id,
          queueNumber: row.queue_number,
          trackingToken: row.tracking_token,
          shopId: row.shop_id,
          customerName: row.customer_name,
          customerPhone: row.customer_phone || undefined,
          customerEmail: row.customer_email || undefined,
          binding: row.binding,
          instructions: row.instructions || undefined,
          status: row.status,
          statusMessage: row.status_message || undefined,
          totalPrice: parseFloat(row.total_price),
          telegramStatus: row.telegram_status,
          createdAt: new Date(row.created_at).toISOString(),
          updatedAt: new Date(row.updated_at).toISOString(),
          completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : undefined,
          files: (row.files || []).map((f: any) => ({
            id: f.id,
            fileName: f.file_name,
            fileSize: parseInt(f.file_size, 10),
            fileType: f.file_type,
            pageCount: f.page_count,
            copies: f.copies,
            paperSize: f.paper_size,
            printType: f.print_type,
            orientation: f.orientation,
            duplex: f.duplex,
            subtotal: parseFloat(f.subtotal),
            diskPath: f.disk_path || undefined,
            telegramStatus: f.telegram_status,
            telegramFileId: f.telegram_file_id || undefined,
            isDeletedFromDisk: f.is_deleted_from_disk,
          })),
          statusHistory: (row.status_history || []).map((sh: any) => ({
            status: sh.status,
            timestamp: new Date(sh.timestamp).toISOString(),
            changedBy: sh.changed_by,
            note: sh.note || undefined,
          })),
        };
      }
    } catch (err) {
      console.error('[DB] Error querying order by ID from Neon:', err);
    }
  }

  // Memory fallback
  const db = getDatabase();
  const q = id.toUpperCase();
  const found = db.orders.find(
    o =>
      o.id.toUpperCase() === q ||
      o.queueNumber.toUpperCase() === q ||
      `#${o.queueNumber}`.toUpperCase() === q ||
      o.queueNumber.toUpperCase() === `#${q}`
  );
  return found || null;
}

export async function insertOrder(order: PrintOrder): Promise<void> {
  const pool = getPgPool();
  if (pool) {
    try {
      await pool.query(
        `INSERT INTO printdrop_orders (
          id, queue_number, tracking_token, shop_id, customer_name, customer_phone, customer_email,
          binding, instructions, status, status_message, total_price, telegram_status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          order.id, order.queueNumber, order.trackingToken, order.shopId || 'maxin-printing-service',
          order.customerName, order.customerPhone, order.customerEmail, order.binding, order.instructions,
          order.status, order.statusMessage, order.totalPrice, order.telegramStatus, order.createdAt, order.updatedAt,
        ]
      );

      for (const f of order.files) {
        await pool.query(
          `INSERT INTO printdrop_order_files (
            id, order_id, file_name, file_size, file_type, page_count, copies, paper_size,
            print_type, orientation, duplex, subtotal, disk_path, telegram_status, telegram_file_id, is_deleted_from_disk
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
          [
            f.id, order.id, f.fileName, f.fileSize, f.fileType, f.pageCount, f.copies, f.paperSize,
            f.printType, f.orientation, f.duplex, f.subtotal, f.diskPath, f.telegramStatus, f.telegramFileId, f.isDeletedFromDisk,
          ]
        );
      }

      for (const sh of order.statusHistory) {
        await pool.query(
          'INSERT INTO printdrop_status_history (order_id, status, timestamp, changed_by, note) VALUES ($1, $2, $3, $4, $5)',
          [order.id, sh.status, sh.timestamp, sh.changedBy, sh.note]
        );
      }
    } catch (err) {
      console.error('[DB] Error inserting order into Neon:', err);
    }
  }

  // Also update in-memory cache
  const db = getDatabase();
  db.orders.unshift(order);
  saveDatabase(db);
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  note?: string,
  staffName = 'staff'
): Promise<PrintOrder | null> {
  const timestamp = new Date().toISOString();
  const pool = getPgPool();

  if (pool) {
    try {
      await pool.query(
        `UPDATE printdrop_orders
         SET status = $1, status_message = $2, updated_at = $3, completed_at = CASE WHEN $1 = 'completed' THEN $3 ELSE completed_at END
         WHERE id = $4`,
        [status, note || `Status updated to ${status}`, timestamp, orderId]
      );

      await pool.query(
        `INSERT INTO printdrop_status_history (order_id, status, timestamp, changed_by, note)
         VALUES ($1, $2, $3, $4, $5)`,
        [orderId, status, timestamp, staffName, note]
      );
    } catch (err) {
      console.error('[DB] Error updating status in Neon:', err);
    }
  }

  // Sync cache
  const db = getDatabase();
  const order = db.orders.find(o => o.id === orderId);
  if (order) {
    order.status = status;
    order.statusMessage = note || `Status updated to ${status}`;
    order.updatedAt = timestamp;
    if (status === 'completed') order.completedAt = timestamp;
    order.statusHistory.unshift({
      status,
      timestamp,
      changedBy: staffName,
      note,
    });
    saveDatabase(db);
    return order;
  }

  return fetchOrderById(orderId);
}

export async function deleteOrder(orderId: string): Promise<boolean> {
  const pool = getPgPool();
  if (pool) {
    try {
      await pool.query('DELETE FROM printdrop_orders WHERE id = $1', [orderId]);
    } catch (err) {
      console.error('[DB] Error deleting order in Neon:', err);
    }
  }

  const db = getDatabase();
  const idx = db.orders.findIndex(o => o.id === orderId);
  if (idx !== -1) {
    db.orders.splice(idx, 1);
    saveDatabase(db);
    return true;
  }
  return false;
}

// ====================================================================
// Trusted Device Management (Section 4)
// ====================================================================

export async function getDevices(): Promise<TrustedDevice[]> {
  const pool = getPgPool();
  if (pool) {
    try {
      const res = await pool.query('SELECT * FROM printdrop_devices ORDER BY requested_at DESC');
      return res.rows.map(r => ({
        id: r.id,
        deviceId: r.device_id,
        deviceName: r.device_name,
        userAgent: r.user_agent || undefined,
        ipAddress: r.ip_address || undefined,
        status: r.status,
        isPrimary: r.is_primary,
        requestId: r.request_id || undefined,
        requestedAt: new Date(r.requested_at).toISOString(),
        approvedAt: r.approved_at ? new Date(r.approved_at).toISOString() : undefined,
        approvedBy: r.approved_by || undefined,
      }));
    } catch (err) {
      console.error('[DB] Error getting devices from Neon:', err);
    }
  }

  const db = getDatabase();
  return db.devices || [];
}

export async function getDeviceByDeviceId(deviceId: string): Promise<TrustedDevice | null> {
  const pool = getPgPool();
  if (pool) {
    try {
      const res = await pool.query('SELECT * FROM printdrop_devices WHERE device_id = $1', [deviceId]);
      if (res.rows.length > 0) {
        const r = res.rows[0];
        return {
          id: r.id,
          deviceId: r.device_id,
          deviceName: r.device_name,
          userAgent: r.user_agent || undefined,
          ipAddress: r.ip_address || undefined,
          status: r.status,
          isPrimary: r.is_primary,
          requestId: r.request_id || undefined,
          requestedAt: new Date(r.requested_at).toISOString(),
          approvedAt: r.approved_at ? new Date(r.approved_at).toISOString() : undefined,
          approvedBy: r.approved_by || undefined,
        };
      }
      return null;
    } catch (err) {
      console.error('[DB] Error querying device in Neon:', err);
    }
  }

  const db = getDatabase();
  return (db.devices || []).find(d => d.deviceId === deviceId) || null;
}

export async function registerOrRequestDevice(params: {
  deviceId: string;
  deviceName: string;
  userAgent?: string;
  ipAddress?: string;
}): Promise<{ device: TrustedDevice; isNewlyApprovedPrimary: boolean }> {
  const existing = await getDeviceByDeviceId(params.deviceId);
  const allDevices = await getDevices();
  const hasApprovedDevices = allDevices.some(d => d.status === 'approved');

  // If no approved device exists in system yet, the first device is automatically the Primary Approved Device!
  const isPrimary = !hasApprovedDevices;
  const initialStatus = isPrimary ? 'approved' : existing?.status || 'pending';
  const requestId = crypto.randomUUID().slice(0, 8);
  const now = new Date().toISOString();

  const device: TrustedDevice = {
    id: existing?.id || `dev-${crypto.randomBytes(6).toString('hex')}`,
    deviceId: params.deviceId,
    deviceName: params.deviceName || 'Staff Workstation',
    userAgent: params.userAgent,
    ipAddress: params.ipAddress,
    status: initialStatus,
    isPrimary: isPrimary || existing?.isPrimary || false,
    requestId: initialStatus === 'pending' ? requestId : undefined,
    requestedAt: now,
    approvedAt: initialStatus === 'approved' ? now : undefined,
    approvedBy: initialStatus === 'approved' ? 'system-bootstrap' : undefined,
  };

  const pool = getPgPool();
  if (pool) {
    try {
      await pool.query(
        `INSERT INTO printdrop_devices (
          id, device_id, device_name, user_agent, ip_address, status, is_primary, request_id, requested_at, approved_at, approved_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (device_id) DO UPDATE SET
          device_name = EXCLUDED.device_name,
          user_agent = EXCLUDED.user_agent,
          ip_address = EXCLUDED.ip_address,
          request_id = CASE WHEN printdrop_devices.status = 'approved' THEN printdrop_devices.request_id ELSE EXCLUDED.request_id END,
          requested_at = EXCLUDED.requested_at`,
        [
          device.id, device.deviceId, device.deviceName, device.userAgent, device.ipAddress,
          device.status, device.isPrimary, device.requestId, device.requestedAt, device.approvedAt, device.approvedBy,
        ]
      );
    } catch (err) {
      console.error('[DB] Error saving device in Neon:', err);
    }
  }

  // Sync cache
  const db = getDatabase();
  if (!db.devices) db.devices = [];
  const idx = db.devices.findIndex(d => d.deviceId === device.deviceId);
  if (idx !== -1) {
    db.devices[idx] = device;
  } else {
    db.devices.push(device);
  }
  saveDatabase(db);

  return { device, isNewlyApprovedPrimary: isPrimary };
}

export async function approveDevice(deviceId: string, approvedBy = 'primary-admin'): Promise<boolean> {
  const now = new Date().toISOString();
  const pool = getPgPool();
  if (pool) {
    try {
      await pool.query(
        `UPDATE printdrop_devices SET status = 'approved', approved_at = $1, approved_by = $2 WHERE device_id = $3`,
        [now, approvedBy, deviceId]
      );
    } catch (err) {
      console.error('[DB] Error approving device in Neon:', err);
    }
  }

  const db = getDatabase();
  const dev = (db.devices || []).find(d => d.deviceId === deviceId);
  if (dev) {
    dev.status = 'approved';
    dev.approvedAt = now;
    dev.approvedBy = approvedBy;
    saveDatabase(db);
    return true;
  }
  return false;
}

export async function revokeDevice(deviceId: string): Promise<boolean> {
  const pool = getPgPool();
  if (pool) {
    try {
      await pool.query(`UPDATE printdrop_devices SET status = 'revoked' WHERE device_id = $1`, [deviceId]);
      // Invalidate any active sessions for this device
      await pool.query('DELETE FROM printdrop_admin_sessions WHERE device_id = $1', [deviceId]);
    } catch (err) {
      console.error('[DB] Error revoking device in Neon:', err);
    }
  }

  const db = getDatabase();
  const dev = (db.devices || []).find(d => d.deviceId === deviceId);
  if (dev) {
    dev.status = 'revoked';
    db.adminSessions = (db.adminSessions || []).filter(s => s.deviceId !== deviceId);
    saveDatabase(db);
    return true;
  }
  return false;
}

// ====================================================================
// Atomic Queue & ID Helpers
// ====================================================================

export function generateQueueNumber(_shopId?: string): string {
  const db = getDatabase();
  const todayStr = new Date().toISOString().slice(0, 10);
  const key = `maxin_${todayStr}`;

  let highest = 1045;
  for (const o of db.orders) {
    const match = o.queueNumber?.match(/\d+/);
    if (match) {
      const num = parseInt(match[0], 10);
      if (!isNaN(num) && num > highest) highest = num;
    }
  }

  if (!db.queueCounters[key] || db.queueCounters[key].date !== todayStr) {
    db.queueCounters[key] = { date: todayStr, current: highest + 1 };
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

// ====================================================================
// Admin Session Management
// ====================================================================

export async function createAdminSession(username: string, deviceId?: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const pool = getPgPool();
  if (pool) {
    try {
      await pool.query(
        'INSERT INTO printdrop_admin_sessions (token, username, device_id, created_at, expires_at) VALUES ($1, $2, $3, $4, $5)',
        [token, username, deviceId, now.toISOString(), expires.toISOString()]
      );
    } catch (err) {
      console.error('[DB] Error saving session in Neon:', err);
    }
  }

  const db = getDatabase();
  if (!db.adminSessions) db.adminSessions = [];
  db.adminSessions.push({
    token,
    username,
    deviceId,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  });
  saveDatabase(db);

  return token;
}

export async function verifyAdminSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const pool = getPgPool();
  if (pool) {
    try {
      const res = await pool.query(
        'SELECT * FROM printdrop_admin_sessions WHERE token = $1 AND expires_at > NOW()',
        [token]
      );
      if (res.rows.length > 0) return true;
    } catch (err) {
      console.error('[DB] Error verifying session in Neon:', err);
    }
  }

  const db = getDatabase();
  const now = new Date().toISOString();
  const session = (db.adminSessions || []).find(s => s.token === token && s.expiresAt > now);
  return Boolean(session);
}

export async function deleteAdminSession(token: string | undefined): Promise<void> {
  if (!token) return;
  const pool = getPgPool();
  if (pool) {
    try {
      await pool.query('DELETE FROM printdrop_admin_sessions WHERE token = $1', [token]);
    } catch (err) {
      console.error('[DB] Error deleting session in Neon:', err);
    }
  }

  const db = getDatabase();
  db.adminSessions = (db.adminSessions || []).filter(s => s.token !== token);
  saveDatabase(db);
}

export function logAudit(actor: string, action: string, details: string): void {
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  const pool = getPgPool();
  if (pool) {
    pool.query(
      'INSERT INTO printdrop_audit_logs (id, timestamp, actor, action, details) VALUES ($1, $2, $3, $4, $5)',
      [id, timestamp, actor, action, details]
    ).catch(err => console.error('[DB] Error saving audit log in Neon:', err));
  }

  const db = getDatabase();
  if (!db.auditLogs) db.auditLogs = [];
  db.auditLogs.unshift({ id, timestamp, actor, action, details });
  if (db.auditLogs.length > 500) {
    db.auditLogs = db.auditLogs.slice(0, 500);
  }
  saveDatabase(db);
}
