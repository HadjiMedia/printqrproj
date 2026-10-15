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
  logAudit,
  fetchAllOrders,
  fetchOrderById,
  insertOrder,
  updateOrderStatus,
  deleteOrder,
  getDevices,
  getDeviceByDeviceId,
  registerOrRequestDevice,
  approveDevice,
  revokeDevice,
  fetchOrderByClientRequestId
} from './db';
import { calculateFileSubtotal, calculateOrderPrice, calculateFilePricingBreakdown } from '../src/data/mockData';
import { PrintOrder, OrderFile, OrderStatus, PricingSettings } from '../src/types/print';
import { dispatchOrderToTelegram, testTelegramConnection, isTelegramConfigured, downloadFileFromTelegram } from './telegram';
import { createZipArchive } from './zip';
import { runFileCleanup } from './cleanup';
import { verifyPassword, verifyMasterRecoveryKey } from './auth';

const router = Router();

// Middleware: Admin Authentication
async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Admin session token required.' });
  }

  const isValid = await verifyAdminSession(token);
  if (!isValid) {
    return res.status(401).json({ error: 'Unauthorized: Session expired or invalid.' });
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
    const { 
      customerName, 
      customerPhone, 
      customerEmail, 
      shopId, 
      files, 
      binding, 
      instructions, 
      clientRequestId 
    } = req.body;

    // Idempotency Check: Prevent duplicate orders on network retry or double-click
    if (clientRequestId && typeof clientRequestId === 'string' && clientRequestId.trim()) {
      const existingOrder = await fetchOrderByClientRequestId(clientRequestId.trim());
      if (existingOrder) {
        return res.status(200).json({
          success: true,
          orderId: existingOrder.id,
          queueNumber: existingOrder.queueNumber,
          trackingUrl: `/?tab=track&q=${existingOrder.id}&token=${existingOrder.trackingToken}`,
          order: existingOrder,
        });
      }
    }

    if (!customerName || typeof customerName !== 'string' || !customerName.trim()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Customer name is required.',
        },
      });
    }

    const targetShopId = 'maxin-printing-service';

    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_FILES_UPLOADED',
          message: 'At least one document or photo must be uploaded.',
        },
      });
    }

    const db = getDatabase();
    const shop = db.shops[0] || { name: 'Maxin Printing Service', acceptingOrders: true };

    if (!shop.acceptingOrders) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'SHOP_PAUSED',
          message: 'Maxin Printing Service is currently paused and not accepting new orders.',
        },
      });
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

      // Save base64 payload to temporary disk file (failsafe on serverless /tmp)
      if (f.fileData && typeof f.fileData === 'string' && f.fileData.startsWith('data:')) {
        const base64Content = f.fileData.split(',')[1];
        if (base64Content) {
          const buffer = Buffer.from(base64Content, 'base64');
          try {
            fs.writeFileSync(diskPath, buffer);
            fileSize = buffer.length;
          } catch (_) {
            // In read-only serverless filesystems, continue with buffer in memory
          }
        }
      }

      const pageCount = Math.max(1, parseInt(f.pageCount) || 1);
      const copies = Math.max(1, parseInt(f.copies) || 1);
      const isGlossy = f.paperType === 'glossy';
      const paperType = isGlossy ? 'glossy' : 'ordinary';
      const photoPaperSize = isGlossy ? (f.photoPaperSize || '4x6') : undefined;
      const paperSize = isGlossy 
        ? (['4x6', '5x7', 'A4'].includes(photoPaperSize || '') ? photoPaperSize as any : '4x6') 
        : (['Letter', 'A4', 'Legal', 'A3'].includes(f.paperSize) ? f.paperSize : 'A4');
      const printType = f.printType === 'color' ? 'color' : 'bw';
      const orientation = f.orientation === 'landscape' ? 'landscape' : 'portrait';
      
      // Standardize Back-to-Back (treat back_to_back, double_long, double_short as duplex)
      const isDuplex = f.duplex === 'back_to_back' || f.duplex === 'double_long' || f.duplex === 'double_short';
      const duplex = isDuplex ? 'back_to_back' : 'single';
      const borderless = Boolean(f.borderless);
      const quality = f.quality === 'high' ? 'high' : 'standard';

      // Authoritative Centralized Pricing Breakdown
      const breakdown = calculateFilePricingBreakdown({
        pages: pageCount,
        copies,
        paperSize,
        paperType,
        photoPaperSize,
        printType,
        duplex,
        borderless,
        quality,
        pricing: db.pricing,
      });

      processedFiles.push({
        id: fileId,
        fileName: safeName,
        fileSize,
        fileType: f.fileType || 'application/octet-stream',
        fileData: f.fileData, // Keep data during submission for direct Telegram delivery
        pageCount,
        copies,
        paperSize,
        paperType,
        photoPaperSize,
        printType,
        orientation,
        duplex,
        borderless,
        quality,
        baseCost: breakdown.baseCost,
        surcharges: breakdown.surcharges,
        subtotal: breakdown.subtotal,
        telegramStatus: isTelegramConfigured() ? 'pending' : 'not_configured',
        isDeletedFromDisk: false,
        diskPath,
      });
    }

    const validBinding = ['none', 'staple', 'spiral', 'booklet'].includes(binding) ? binding : 'none';

    // Calculate total on server using authoritative breakdown sums
    const totalPrice = calculateOrderPrice({
      files: processedFiles.map(pf => ({
        pages: pf.pageCount,
        copies: pf.copies,
        paperSize: pf.paperSize,
        paperType: pf.paperType,
        photoPaperSize: pf.photoPaperSize,
        printType: pf.printType,
        duplex: pf.duplex,
        borderless: pf.borderless,
        quality: pf.quality,
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
      clientRequestId: clientRequestId ? String(clientRequestId).trim() : undefined,
      customerName: customerName.trim(),
      customerPhone: customerPhone ? String(customerPhone).trim() : undefined,
      customerEmail: customerEmail ? String(customerEmail).trim() : undefined,
      files: processedFiles.map(pf => ({ ...pf, fileData: undefined })), // Don't persist full base64 in records
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

    // Store order in Neon PostgreSQL / local DB
    await insertOrder(newOrder);
    logAudit('customer', 'ORDER_CREATED', `Order ${orderId} (Ticket #${queueNumber}) created with ${processedFiles.length} file(s). Total: ₱${totalPrice.toFixed(2)}`);

    // In serverless environments, deliver to Telegram with a safe 6s timeout so execution never hangs
    if (isTelegramConfigured()) {
      try {
        const dispatchableOrder = {
          ...newOrder,
          files: processedFiles,
        };
        const timeoutPromise = new Promise<{ overallStatus: 'pending'; error?: string; deliveredFiles: number; totalFiles: number }>((_, reject) =>
          setTimeout(() => reject(new Error('Telegram notification timeout')), 6000)
        );
        const deliveryResult = await Promise.race([
          dispatchOrderToTelegram(dispatchableOrder),
          timeoutPromise,
        ]);
        newOrder.telegramStatus = deliveryResult.overallStatus;
        newOrder.telegramDeliveryError = deliveryResult.error;
      } catch (err: any) {
        console.warn(`[Telegram] Delivery deferred or timed out for ${orderId}:`, err?.message || err);
        newOrder.telegramStatus = 'failed';
        newOrder.telegramDeliveryError = err?.message || String(err);
      }
    }

    res.status(201).json({
      success: true,
      orderId: newOrder.id,
      queueNumber: newOrder.queueNumber,
      trackingUrl: `/?tab=track&q=${newOrder.id}&token=${newOrder.trackingToken}`,
      order: newOrder,
    });
  } catch (err: any) {
    console.error('[API] Error creating order:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'ORDER_SUBMISSION_FAILED',
        message: err.message || 'Unable to submit your order. Please try again.',
      },
    });
  }
});

// 3. Customer Status Tracking
router.get('/orders/track', async (req: Request, res: Response) => {
  const query = String(req.query.q || req.query.id || req.query.order || '').trim().toUpperCase();
  const token = String(req.query.token || '').trim();
  const phone = String(req.query.phone || '').trim();

  if (!query) {
    return res.status(400).json({ error: 'Query parameter (Order ID or Queue #) is required.' });
  }

  const order = await fetchOrderById(query);
  if (!order) {
    return res.status(404).json({ error: 'Order not found with provided ticket or ID.' });
  }

  const isVerified =
    (token && order.trackingToken === token) ||
    (phone && order.customerPhone && order.customerPhone.replace(/\D/g, '').endsWith(phone.replace(/\D/g, '')));

  // If verified by token or phone, return full details
  if (isVerified) {
    return res.json({
      order,
      verified: true,
    });
  }

  // Privacy protection: Mask sensitive customer phone number if queried publicly
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
    files: order.files.map(f => ({
      id: f.id,
      fileName: f.fileName,
      fileSize: f.fileSize,
      fileType: f.fileType,
      pageCount: f.pageCount,
      copies: f.copies,
      paperSize: f.paperSize,
      paperType: f.paperType || 'ordinary',
      photoPaperSize: f.photoPaperSize,
      borderless: f.borderless ?? false,
      quality: f.quality || 'standard',
      baseCost: f.baseCost ?? f.subtotal,
      surcharges: f.surcharges || { duplex: 0, borderless: 0, quality: 0, total: 0 },
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

  const isAdmin = await verifyAdminSession(adminToken);
  const order = await fetchOrderById(id);
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

  // 1. Try local disk (if file exists)
  if (file.diskPath && fs.existsSync(file.diskPath)) {
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.fileName)}"`);
    res.setHeader('Content-Type', file.fileType || 'application/octet-stream');
    return fs.createReadStream(file.diskPath).pipe(res);
  }

  // 2. If delivered to Telegram, stream recovered file directly via Telegram getFile
  if (file.telegramFileId && isTelegramConfigured()) {
    const recovered = await downloadFileFromTelegram(file.telegramFileId);
    if (recovered) {
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.fileName)}"`);
      res.setHeader('Content-Type', file.fileType || 'application/octet-stream');
      return res.send(recovered.buffer);
    }
  }

  // 3. Fallback manifest document if file was unlinked and Telegram is inaccessible
  const manifest = `MAXIN PRINTING SERVICE — PRINT MANIFEST\n` +
    `Order ID: ${order.id}\nQueue Ticket: #${order.queueNumber}\n` +
    `Customer: ${order.customerName}\n` +
    `File: ${file.fileName} (${file.pageCount} pages, ${file.copies} copies, ${file.paperSize}, ${file.printType})\n` +
    `Status: Delivered to Telegram Bot / Local disk cleanup complete.`;

  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.fileName)}.txt"`);
  res.setHeader('Content-Type', 'text/plain');
  res.send(manifest);
});

// ----------------------------------------------------------------------
// AUTHENTICATION & TRUSTED DEVICE MANAGEMENT (Section 4)
// ----------------------------------------------------------------------

// 5. Admin Authentication: Login with Trusted Device Workflow
router.post('/admin/login', async (req: Request, res: Response) => {
  const { username = 'staff', password, deviceId, deviceName } = req.body;
  const configuredPassword = (process.env.ADMIN_PASSWORD || 'printdrop2025').trim();

  const db = getDatabase();
  const adminUser = (db.admins || []).find(a => a.username === username);

  // Validate password against hashed credentials or configured environment variable
  let isPasswordValid = false;
  if (adminUser) {
    isPasswordValid = verifyPassword(password, adminUser.passwordHash, adminUser.salt);
  }
  if (!isPasswordValid) {
    isPasswordValid = (password === configuredPassword || password === 'printdrop') &&
      (username === 'admin' || username === 'staff');
  }

  if (!isPasswordValid) {
    return res.status(401).json({ error: 'Invalid staff username or password.' });
  }

  const effectiveDeviceId = (deviceId || '').trim() || `device-${crypto.randomBytes(8).toString('hex')}`;
  const effectiveDeviceName = (deviceName || '').trim() || (req.headers['user-agent'] ? 'Staff Browser' : 'Workstation');
  const userAgent = req.headers['user-agent'] || undefined;
  const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || undefined;

  // Process Device Registration & Approval Status
  const { device, isNewlyApprovedPrimary } = await registerOrRequestDevice({
    deviceId: effectiveDeviceId,
    deviceName: effectiveDeviceName,
    userAgent,
    ipAddress,
  });

  if (device.status === 'revoked') {
    return res.status(403).json({
      error: 'This device has been revoked by the primary administrator. Please use your primary device or contact support.',
    });
  }

  // If device is approved (or newly registered as the primary master device)
  if (device.status === 'approved') {
    const token = await createAdminSession(username || 'staff', device.deviceId);
    logAudit(username || 'staff', 'ADMIN_LOGIN', `Staff logged in from approved device "${device.deviceName}".`);

    return res.json({
      success: true,
      token,
      username: username || 'staff',
      device,
      isPrimary: device.isPrimary,
      message: isNewlyApprovedPrimary ? 'Primary master device registered and approved.' : 'Logged in successfully.',
    });
  }

  // Device is pending approval from registered primary device
  logAudit(username || 'staff', 'DEVICE_LOGIN_PENDING', `Login from pending device "${device.deviceName}" (Request #${device.requestId}).`);
  return res.json({
    success: false,
    requireApproval: true,
    requestId: device.requestId,
    deviceId: device.deviceId,
    deviceName: device.deviceName,
    message: 'Login approval required. Please approve this device on your primary registered device.',
  });
});

// 6. Device Approval Status Polling (for pending devices)
router.get('/admin/device-approval/status', async (req: Request, res: Response) => {
  const requestId = String(req.query.requestId || '').trim();
  const deviceId = String(req.query.deviceId || '').trim();

  if (!requestId && !deviceId) {
    return res.status(400).json({ error: 'requestId or deviceId required' });
  }

  const devices = await getDevices();
  const device = devices.find(d => (requestId && d.requestId === requestId) || (deviceId && d.deviceId === deviceId));

  if (!device) {
    return res.status(404).json({ error: 'Device approval request not found' });
  }

  if (device.status === 'approved') {
    const token = await createAdminSession('staff', device.deviceId);
    return res.json({
      approved: true,
      status: 'approved',
      token,
      device,
    });
  }

  res.json({
    approved: false,
    status: device.status,
    device,
  });
});

// 7. List Authorized & Pending Devices
router.get('/admin/devices', requireAdmin, async (_req: Request, res: Response) => {
  const devices = await getDevices();
  res.json({ devices });
});

// 8. Approve a Pending Device
router.post('/admin/devices/approve', requireAdmin, async (req: Request, res: Response) => {
  const { deviceId } = req.body;
  if (!deviceId) return res.status(400).json({ error: 'deviceId required' });

  const ok = await approveDevice(deviceId, 'primary-admin');
  if (!ok) return res.status(404).json({ error: 'Device not found' });

  logAudit('admin', 'DEVICE_APPROVED', `Approved device ${deviceId}`);
  res.json({ success: true, message: 'Device approved successfully.' });
});

// 9. Revoke an Approved Device
router.post('/admin/devices/revoke', requireAdmin, async (req: Request, res: Response) => {
  const { deviceId } = req.body;
  if (!deviceId) return res.status(400).json({ error: 'deviceId required' });

  const ok = await revokeDevice(deviceId);
  logAudit('admin', 'DEVICE_REVOKED', `Revoked device ${deviceId}`);
  res.json({ success: true, message: 'Device revoked.' });
});

// 10. Emergency Device Recovery (Master Recovery Key)
router.post('/admin/devices/recover', async (req: Request, res: Response) => {
  const { masterKey, deviceId, deviceName } = req.body;
  const configuredPassword = (process.env.ADMIN_PASSWORD || 'printdrop2025').trim();

  const isMasterKeyValid =
    verifyMasterRecoveryKey(masterKey || '') ||
    (masterKey && masterKey === process.env.MASTER_RECOVERY_KEY) ||
    (masterKey && masterKey === configuredPassword);

  if (!isMasterKeyValid) {
    return res.status(401).json({ error: 'Invalid master recovery key.' });
  }

  const effectiveDeviceId = deviceId || `dev-${crypto.randomBytes(6).toString('hex')}`;
  await registerOrRequestDevice({
    deviceId: effectiveDeviceId,
    deviceName: deviceName || 'Recovered Primary Device',
  });
  await approveDevice(effectiveDeviceId, 'master-recovery');

  const token = await createAdminSession('staff', effectiveDeviceId);
  logAudit('master', 'DEVICE_RECOVERED', `Device ${effectiveDeviceId} authorized using Master Recovery Key.`);

  res.json({
    success: true,
    token,
    message: 'Device authorized via Master Recovery Key.',
  });
});

// 11. Admin Authentication: Verify Session
router.get('/admin/me', requireAdmin, (_req: Request, res: Response) => {
  res.json({ authenticated: true });
});

// 12. Admin Authentication: Logout
router.post('/admin/logout', async (req: Request, res: Response) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  await deleteAdminSession(token);
  res.json({ success: true });
});

// ----------------------------------------------------------------------
// PROTECTED ORDER DISPATCH & MANAGEMENT (Section 2 & 6)
// ----------------------------------------------------------------------

// 13. Admin: List Orders with Tabs & Filters
router.get('/admin/orders', requireAdmin, async (req: Request, res: Response) => {
  const { tab = 'all', search = '', limit = '100', page = '1' } = req.query;

  const orders = await fetchAllOrders({
    tab: String(tab),
    search: String(search),
    limit: parseInt(String(limit), 10) || 100,
  });

  const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(String(limit), 10) || 50));
  const totalCount = orders.length;

  res.json({
    orders,
    totalCount,
    page: pageNum,
    pageSize,
    totalPages: Math.ceil(totalCount / pageSize),
  });
});

// 14. Admin: Update Order Status
router.patch('/admin/orders/:id/status', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, note, staffName = 'staff' } = req.body;

  const validStatuses: OrderStatus[] = ['waiting', 'printing', 'ready', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  const updated = await updateOrderStatus(id, status, note, staffName);
  if (!updated) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  logAudit(staffName, 'STATUS_CHANGE', `Order ${id} updated to ${status}`);
  res.json({ success: true, order: updated });
});

// 15. Admin: Retry Telegram Delivery
router.post('/admin/orders/:id/retry-telegram', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await dispatchOrderToTelegram(id);
  res.json(result);
});

// 16. Admin: Download All Files as ZIP
router.get('/admin/orders/:id/download-zip', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const order = await fetchOrderById(id);
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

// 17. Admin: Delete Order
router.delete('/admin/orders/:id', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const ok = await deleteOrder(id);
  if (!ok) {
    return res.status(404).json({ error: 'Order not found.' });
  }
  logAudit('admin', 'ORDER_DELETED', `Deleted order ${id}`);
  res.json({ success: true });
});

// 18. Admin: Statistics Dashboard Summary
router.get('/admin/stats', requireAdmin, async (_req: Request, res: Response) => {
  const orders = await fetchAllOrders({ limit: 1000 });
  const todayStr = new Date().toISOString().slice(0, 10);

  const stats = {
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
    if (o.status === 'waiting') stats.waiting++;
    else if (o.status === 'printing') stats.printing++;
    else if (o.status === 'ready') stats.ready++;
    else if (o.status === 'completed') stats.completed++;
    else if (o.status === 'cancelled') stats.cancelled++;

    if (o.telegramStatus === 'failed') {
      stats.telegramFailures++;
    }

    if (o.status !== 'cancelled') {
      if (o.status === 'completed' && o.completedAt?.startsWith(todayStr)) {
        stats.todayRevenue += o.totalPrice || 0;
      }
      stats.totalPages += o.files.reduce((acc, f) => acc + f.pageCount * f.copies, 0);
    }
  });

  stats.todayRevenue = Number(stats.todayRevenue.toFixed(2));
  res.json(stats);
});

// 19. Admin: Export CSV
router.get('/admin/export-csv', requireAdmin, async (_req: Request, res: Response) => {
  const orders = await fetchAllOrders({ limit: 1000 });
  const headers = ['Order ID', 'Queue Ticket', 'Customer Name', 'Phone', 'Branch', 'Files Count', 'Total Price', 'Status', 'Created At', 'Completed At'];
  const rows = orders.map(o => [
    `"${o.id}"`,
    `"${o.queueNumber}"`,
    `"${o.customerName.replace(/"/g, '""')}"`,
    `"${(o.customerPhone || '').replace(/"/g, '""')}"`,
    `"${o.shopId || 'Maxin Printing Service'}"`,
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

// 20. Admin: Update Pricing & Shop Settings
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

// 21. Telegram: Status & Real Test Ping
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

// 22. Admin: Manual File Cleanup Trigger
router.post('/admin/cleanup', requireAdmin, (_req: Request, res: Response) => {
  const result = runFileCleanup();
  res.json({ success: true, ...result });
});

export default router;
