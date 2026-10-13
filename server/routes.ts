import { Router, Request, Response, NextFunction } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { 
  getDatabase, 
  saveDatabase, 
  generateOrderId, 
  generateQueueNumber, 
  generateTrackingToken, 
  getUploadsDir, 
  createAdminSession, 
  verifyAdminSession, 
  deleteAdminSession, 
  logAudit 
} from './db';
import { calculateFileSubtotal, calculateOrderPrice } from '../src/data/mockData';
import { PrintOrder, OrderFile, OrderStatus, PricingSettings } from '../src/types/print';
import { dispatchOrderToTelegram, testTelegramConnection, isTelegramConfigured, downloadFileFromTelegram } from './telegram';
import { createZipArchive } from './zip';
import { runFileCleanup } from './cleanup';

const router = Router();

// Middleware: Admin Authentication
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token || !verifyAdminSession(token)) {
    return res.status(401).json({ error: 'Unauthorized: Valid admin session token required.' });
  }
  next();
}

// ----------------------------------------------------------------------
// PUBLIC CUSTOMER ROUTES
// ----------------------------------------------------------------------

// 1. Get Shop & Pricing Settings
router.get('/settings', (_req: Request, res: Response) => {
  const db = getDatabase();
  res.json({
    pricing: db.pricing,
    shops: db.shops,
    telegramConfigured: isTelegramConfigured(),
  });
});

// 2. Submit New Print Order
router.post('/orders', async (req: Request, res: Response) => {
  try {
    const { customerName, customerPhone, customerEmail, shopId, files, binding, instructions } = req.body;

    if (!customerName || typeof customerName !== 'string' || !customerName.trim()) {
      return res.status(400).json({ error: 'Customer name is required.' });
    }

    const targetShopId = 'maxin-printing-service';

    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'At least one document or photo must be uploaded.' });
    }

    const db = getDatabase();
    const shop = db.shops[0] || { name: 'Maxin Printing Service', acceptingOrders: true };

    if (!shop.acceptingOrders) {
      return res.status(403).json({ error: 'Maxin Printing Service is currently paused and not accepting new orders.' });
    }

    const uploadsDir = getUploadsDir();
    const processedFiles: OrderFile[] = [];

    // Process and validate each file and calculate server-side pricing
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const fileId = `file-${crypto.randomBytes(6).toString('hex')}`;
      const safeName = (f.fileName || `document_${i + 1}.pdf`).replace(/[^a-zA-Z0-9._-]/g, '_');
      const diskPath = path.join(uploadsDir, `${fileId}_${safeName}`);

      let fileSize = Number(f.fileSize) || 0;

      // Save base64 payload to temporary disk file
      if (f.fileData && typeof f.fileData === 'string' && f.fileData.startsWith('data:')) {
        const base64Content = f.fileData.split(',')[1];
        if (base64Content) {
          const buffer = Buffer.from(base64Content, 'base64');
          fs.writeFileSync(diskPath, buffer);
          fileSize = buffer.length;
        }
      }

      const pageCount = Math.max(1, parseInt(f.pageCount) || 1);
      const copies = Math.max(1, parseInt(f.copies) || 1);
      const paperSize = ['Letter', 'A4', 'Legal', 'A3'].includes(f.paperSize) ? f.paperSize : 'A4';
      const printType = f.printType === 'color' ? 'color' : 'bw';
      const orientation = f.orientation === 'landscape' ? 'landscape' : 'portrait';
      const duplex = ['double_long', 'double_short'].includes(f.duplex) ? f.duplex : 'single';

      const subtotal = calculateFileSubtotal({
        pages: pageCount,
        copies,
        paperSize,
        printType,
        duplex,
        pricing: db.pricing,
      });

      processedFiles.push({
        id: fileId,
        fileName: safeName,
        fileSize,
        fileType: f.fileType || 'application/octet-stream',
        // In order to conserve client bandwidth, don't store huge base64 in json
        fileData: undefined,
        pageCount,
        copies,
        paperSize,
        printType,
        orientation,
        duplex,
        subtotal,
        telegramStatus: isTelegramConfigured() ? 'pending' : 'not_configured',
        isDeletedFromDisk: false,
        diskPath,
      });
    }

    const validBinding = ['none', 'staple', 'spiral', 'booklet'].includes(binding) ? binding : 'none';

    // Calculate total on server
    const totalPrice = calculateOrderPrice({
      files: processedFiles.map(pf => ({
        pages: pf.pageCount,
        copies: pf.copies,
        paperSize: pf.paperSize,
        printType: pf.printType,
        duplex: pf.duplex,
      })),
      binding: validBinding,
      pricing: db.pricing,
    });

    const orderId = generateOrderId();
    const queueNumber = generateQueueNumber(shopId);
    const trackingToken = generateTrackingToken();
    const nowIso = new Date().toISOString();

    const newOrder: PrintOrder = {
      id: orderId,
      queueNumber,
      trackingToken,
      shopId: targetShopId,
      customerName: customerName.trim(),
      customerPhone: customerPhone ? String(customerPhone).trim() : undefined,
      customerEmail: customerEmail ? String(customerEmail).trim() : undefined,
      files: processedFiles,
      binding: validBinding,
      instructions: instructions ? String(instructions).trim() : undefined,
      status: 'waiting',
      statusMessage: `Order received at Maxin Printing Service. Queue Ticket ${queueNumber}`,
      statusHistory: [
        {
          status: 'waiting',
          timestamp: nowIso,
          changedBy: 'customer',
          note: 'Order submitted via Shop Web/QR',
        },
      ],
      createdAt: nowIso,
      updatedAt: nowIso,
      totalPrice,
      telegramStatus: isTelegramConfigured() ? 'pending' : 'not_configured',
      isDemo: false,
    };

    db.orders.unshift(newOrder);
    saveDatabase(db);
    logAudit('customer', 'ORDER_CREATED', `Order ${orderId} (Ticket #${queueNumber}) created with ${processedFiles.length} file(s). Total: ₱${totalPrice.toFixed(2)}`);

    // Asynchronously dispatch to Telegram in background
    if (isTelegramConfigured()) {
      setTimeout(() => {
        dispatchOrderToTelegram(orderId).catch(err => {
          console.error(`[TELEGRAM] Async dispatch error for order ${orderId}:`, err);
        });
      }, 50);
    }

    // Return created order to customer
    res.status(201).json({
      success: true,
      order: newOrder,
    });
  } catch (err: any) {
    console.error('[API] Order submission error:', err);
    res.status(500).json({ error: 'Server error processing print order: ' + (err?.message || err) });
  }
});

// 3. Customer Status Tracking
router.get('/orders/track', (req: Request, res: Response) => {
  const query = String(req.query.q || req.query.id || req.query.order || '').trim().toUpperCase();
  const token = String(req.query.token || '').trim();
  const phone = String(req.query.phone || '').trim();

  if (!query) {
    return res.status(400).json({ error: 'Query parameter (Order ID or Queue #) is required.' });
  }

  const db = getDatabase();
  const order = db.orders.find(
    o =>
      o.id.toUpperCase() === query ||
      o.queueNumber.toUpperCase() === query ||
      `#${o.queueNumber}`.toUpperCase() === query ||
      o.queueNumber.toUpperCase() === `#${query}`
  );

  if (!order) {
    return res.status(404).json({ error: 'Order not found with provided ticket or ID.' });
  }

  const isVerified =
    (token && order.trackingToken === token) ||
    (phone && order.customerPhone && order.customerPhone.replace(/\D/g, '').endsWith(phone.replace(/\D/g, '')));

  // If verified by token or phone, return full details including file download URLs
  if (isVerified) {
    return res.json({
      order,
      verified: true,
    });
  }

  // Section G Privacy requirement: If queried publicly without token, mask personal details
  const maskedPhone = order.customerPhone
    ? order.customerPhone.replace(/(\+?\d{2,4})\d+(\d{3})/, '$1••••$2')
    : undefined;

  const sanitizedOrder: Partial<PrintOrder> = {
    id: order.id,
    queueNumber: order.queueNumber,
    shopId: order.shopId,
    customerName: order.customerName,
    customerPhone: maskedPhone,
    status: order.status,
    statusMessage: order.statusMessage,
    statusHistory: order.statusHistory,
    totalPrice: order.totalPrice,
    binding: order.binding,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    completedAt: order.completedAt,
    // Return files without disk paths or private tokens
    files: order.files.map(f => ({
      id: f.id,
      fileName: f.fileName,
      fileSize: f.fileSize,
      fileType: f.fileType,
      pageCount: f.pageCount,
      copies: f.copies,
      paperSize: f.paperSize,
      printType: f.printType,
      orientation: f.orientation,
      duplex: f.duplex,
      subtotal: f.subtotal,
      telegramStatus: f.telegramStatus,
      isDeletedFromDisk: f.isDeletedFromDisk,
    })),
  };

  res.json({
    order: sanitizedOrder,
    verified: false,
  });
});

// 4. Download Specific File
router.get('/orders/:id/files/:fileId', async (req: Request, res: Response) => {
  const { id, fileId } = req.params;
  const token = String(req.query.token || '').trim();
  const authHeader = req.headers.authorization || '';
  const adminToken = authHeader.replace(/^Bearer\s+/i, '').trim();

  const isAdmin = verifyAdminSession(adminToken);

  const db = getDatabase();
  const order = db.orders.find(o => o.id === id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  // Authorization check
  if (!isAdmin && order.trackingToken !== token) {
    return res.status(403).json({ error: 'Unauthorized: Valid tracking token or staff session required.' });
  }

  const file = order.files.find(f => f.id === fileId);
  if (!file) {
    return res.status(404).json({ error: 'File not found in this order.' });
  }

  // 1. Try local disk
  if (file.diskPath && fs.existsSync(file.diskPath)) {
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.fileName)}"`);
    res.setHeader('Content-Type', file.fileType || 'application/octet-stream');
    return fs.createReadStream(file.diskPath).pipe(res);
  }

  // 2. If file was cleaned up from disk because it was sent to Telegram, try recovering via Telegram getFile
  if (file.telegramFileId && isTelegramConfigured()) {
    const recovered = await downloadFileFromTelegram(file.telegramFileId);
    if (recovered) {
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.fileName)}"`);
      res.setHeader('Content-Type', file.fileType || 'application/octet-stream');
      return res.send(recovered.buffer);
    }
  }

  // 3. Fallback manifest document if file was removed from storage
  const manifest = `PRINTDROP VERIFIED PRINT MANIFEST\n` +
    `Order ID: ${order.id}\nQueue Ticket: #${order.queueNumber}\n` +
    `File: ${file.fileName} (${file.pageCount} pages, ${file.copies} copies, ${file.paperSize}, ${file.printType})\n` +
    `Status: Delivered to Telegram Bot / Local disk cleanup complete.`;

  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.fileName)}.txt"`);
  res.setHeader('Content-Type', 'text/plain');
  res.send(manifest);
});

// ----------------------------------------------------------------------
// PROTECTED ADMIN ROUTES
// ----------------------------------------------------------------------

// 5. Admin Authentication: Login
router.post('/admin/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  const configuredPassword = (process.env.ADMIN_PASSWORD || 'printdrop2025').trim();

  // Accept configured password or default demo staff password
  const isValid =
    (password === configuredPassword || password === 'printdrop') &&
    (username === 'admin' || username === 'staff');

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid staff username or password.' });
  }

  const token = createAdminSession(username || 'staff');
  logAudit(username || 'staff', 'ADMIN_LOGIN', 'Staff logged into management console.');

  res.json({
    success: true,
    token,
    username: username || 'staff',
  });
});

// 6. Admin Authentication: Verify Session
router.get('/admin/me', requireAdmin, (req: Request, res: Response) => {
  res.json({ authenticated: true });
});

// 7. Admin Authentication: Logout
router.post('/admin/logout', (req: Request, res: Response) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  deleteAdminSession(token);
  res.json({ success: true });
});

// 8. Admin: List Orders with Tabs & Filters
router.get('/admin/orders', requireAdmin, (req: Request, res: Response) => {
  const db = getDatabase();
  const { tab = 'all', shop = 'all', search = '', limit = '100', page = '1' } = req.query;

  let filtered = [...db.orders];

  // Tab filter
  if (tab === 'waiting') filtered = filtered.filter(o => o.status === 'waiting');
  else if (tab === 'printing') filtered = filtered.filter(o => o.status === 'printing');
  else if (tab === 'ready') filtered = filtered.filter(o => o.status === 'ready');
  else if (tab === 'completed') filtered = filtered.filter(o => o.status === 'completed');
  else if (tab === 'cancelled') filtered = filtered.filter(o => o.status === 'cancelled');
  else if (tab === 'active') filtered = filtered.filter(o => ['waiting', 'printing', 'ready'].includes(o.status));

  // Shop filter
  if (shop !== 'all') {
    filtered = filtered.filter(o => o.shopId === shop);
  }

  // Search filter
  if (search) {
    const q = String(search).toLowerCase();
    filtered = filtered.filter(
      o =>
        o.customerName.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q) ||
        o.queueNumber.toLowerCase().includes(q) ||
        (o.customerPhone && o.customerPhone.includes(q)) ||
        o.files.some(f => f.fileName.toLowerCase().includes(q))
    );
  }

  const pageNum = Math.max(1, parseInt(String(page)) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(String(limit)) || 50));
  const totalCount = filtered.length;
  const paginated = filtered.slice((pageNum - 1) * pageSize, pageNum * pageSize);

  res.json({
    orders: paginated,
    totalCount,
    page: pageNum,
    pageSize,
    totalPages: Math.ceil(totalCount / pageSize),
  });
});

// 9. Admin: Update Order Status
router.patch('/admin/orders/:id/status', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, note, staffName = 'staff' } = req.body;

  const validStatuses: OrderStatus[] = ['waiting', 'printing', 'ready', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  const db = getDatabase();
  const order = db.orders.find(o => o.id === id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  const oldStatus = order.status;
  order.status = status;
  order.updatedAt = new Date().toISOString();

  if (status === 'completed') {
    order.completedAt = new Date().toISOString();
  }

  let statusMsg = note;
  if (!statusMsg) {
    if (status === 'waiting') statusMsg = 'Queued for processing';
    else if (status === 'printing') statusMsg = 'Printing in progress by staff';
    else if (status === 'ready') statusMsg = 'Ready for pickup at counter';
    else if (status === 'completed') statusMsg = 'Order completed and collected';
    else if (status === 'cancelled') statusMsg = 'Order cancelled';
  }
  order.statusMessage = statusMsg;

  order.statusHistory.unshift({
    status,
    timestamp: new Date().toISOString(),
    changedBy: staffName,
    note: note || undefined,
  });

  saveDatabase(db);
  logAudit(staffName, 'STATUS_CHANGE', `Order ${order.id} (#${order.queueNumber}) updated from ${oldStatus} to ${status}`);

  res.json({ success: true, order });
});

// 10. Admin: Retry Telegram Delivery
router.post('/admin/orders/:id/retry-telegram', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await dispatchOrderToTelegram(id);
  res.json(result);
});

// 11. Admin: Download All Files as ZIP
router.get('/admin/orders/:id/download-zip', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  const order = db.orders.find(o => o.id === id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  const zipEntries: Array<{ name: string; data: Buffer }> = [];

  for (const f of order.files) {
    if (f.diskPath && fs.existsSync(f.diskPath)) {
      zipEntries.push({
        name: f.fileName,
        data: fs.readFileSync(f.diskPath),
      });
    } else if (f.telegramFileId && isTelegramConfigured()) {
      const recovered = await downloadFileFromTelegram(f.telegramFileId);
      if (recovered) {
        zipEntries.push({
          name: f.fileName,
          data: recovered.buffer,
        });
      }
    } else {
      // Add text manifest entry for the file
      zipEntries.push({
        name: `${f.fileName}.specs.txt`,
        data: Buffer.from(`File: ${f.fileName}\nPages: ${f.pageCount}\nCopies: ${f.copies}\nPaper: ${f.paperSize}\nPrint Type: ${f.printType}`),
      });
    }
  }

  if (zipEntries.length === 0) {
    return res.status(404).json({ error: 'No files available to package in ZIP.' });
  }

  const zipBuffer = createZipArchive(zipEntries);
  res.setHeader('Content-Disposition', `attachment; filename="PrintDrop_${order.queueNumber}_${order.id}.zip"`);
  res.setHeader('Content-Type', 'application/zip');
  res.send(zipBuffer);
});

// 12. Admin: Delete Order
router.delete('/admin/orders/:id', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  const index = db.orders.findIndex(o => o.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  const [removed] = db.orders.splice(index, 1);

  // Clean files from disk if remaining
  for (const f of removed.files) {
    if (f.diskPath && fs.existsSync(f.diskPath)) {
      try { fs.unlinkSync(f.diskPath); } catch (_) {}
    }
  }

  saveDatabase(db);
  logAudit('admin', 'ORDER_DELETED', `Deleted order ${id} (#${removed.queueNumber})`);
  res.json({ success: true });
});

// 13. Admin: Statistics Dashboard Summary
router.get('/admin/stats', requireAdmin, (_req: Request, res: Response) => {
  const db = getDatabase();
  const todayStr = new Date().toISOString().slice(0, 10);

  const stats = {
    total: db.orders.length,
    waiting: 0,
    printing: 0,
    ready: 0,
    completed: 0,
    cancelled: 0,
    telegramFailures: 0,
    todayRevenue: 0,
    totalPages: 0,
  };

  db.orders.forEach(o => {
    if (o.status === 'waiting') stats.waiting++;
    else if (o.status === 'printing') stats.printing++;
    else if (o.status === 'ready') stats.ready++;
    else if (o.status === 'completed') stats.completed++;
    else if (o.status === 'cancelled') stats.cancelled++;

    if (o.telegramStatus === 'failed') {
      stats.telegramFailures++;
    }

    if (o.status !== 'cancelled') {
      // Completed orders count toward revenue
      if (o.status === 'completed' && o.completedAt?.startsWith(todayStr)) {
        stats.todayRevenue += o.totalPrice || 0;
      }
      stats.totalPages += o.files.reduce((acc, f) => acc + f.pageCount * f.copies, 0);
    }
  });

  stats.todayRevenue = Number(stats.todayRevenue.toFixed(2));
  res.json(stats);
});

// 14. Admin: Export CSV
router.get('/admin/export-csv', requireAdmin, (_req: Request, res: Response) => {
  const db = getDatabase();
  const headers = ['Order ID', 'Queue Ticket', 'Customer Name', 'Phone', 'Branch', 'Files Count', 'Total Price', 'Status', 'Created At', 'Completed At'];
  const rows = db.orders.map(o => [
    `"${o.id}"`,
    `"${o.queueNumber}"`,
    `"${o.customerName.replace(/"/g, '""')}"`,
    `"${(o.customerPhone || '').replace(/"/g, '""')}"`,
    `"${o.shopId}"`,
    o.files.length,
    o.totalPrice.toFixed(2),
    `"${o.status}"`,
    `"${o.createdAt}"`,
    `"${o.completedAt || ''}"`,
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  res.setHeader('Content-Disposition', `attachment; filename="PrintDrop_Orders_${new Date().toISOString().slice(0, 10)}.csv"`);
  res.setHeader('Content-Type', 'text/csv');
  res.send(csv);
});

// 15. Admin: Update Pricing & Shop Settings
router.patch('/admin/settings', requireAdmin, (req: Request, res: Response) => {
  const { pricing, shops } = req.body;
  const db = getDatabase();

  if (pricing && typeof pricing === 'object') {
    db.pricing = { ...db.pricing, ...pricing };
  }

  if (Array.isArray(shops)) {
    db.shops = shops;
  }

  saveDatabase(db);
  logAudit('admin', 'SETTINGS_UPDATED', 'Updated shop pricing or accepting order statuses.');
  res.json({ success: true, pricing: db.pricing, shops: db.shops });
});

// 16. Telegram: Status & Real Test Ping
router.get('/telegram/status', requireAdmin, (_req: Request, res: Response) => {
  res.json({
    configured: isTelegramConfigured(),
    hasToken: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    hasChatId: Boolean(process.env.TELEGRAM_CHAT_ID),
  });
});

router.post('/telegram/test', requireAdmin, async (_req: Request, res: Response) => {
  const result = await testTelegramConnection();
  res.json(result);
});

// 17. Admin: Manual File Cleanup Trigger
router.post('/admin/cleanup', requireAdmin, (_req: Request, res: Response) => {
  const result = runFileCleanup();
  res.json({ success: true, ...result });
});

export default router;
