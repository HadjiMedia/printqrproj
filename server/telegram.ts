import fs from 'node:fs';
import path from 'node:path';
import { PrintOrder, OrderFile } from '../src/types/print';
import { getDatabase, saveDatabase, logAudit, getPgPool, fetchOrderById } from './db';

const TELEGRAM_API_BASE = 'https://api.telegram.org';

function getBotToken(): string {
  return (process.env.TELEGRAM_BOT_TOKEN || '').trim();
}

function getChatId(): string {
  return (process.env.TELEGRAM_CHAT_ID || '').trim();
}

function getAppUrl(): string {
  return (process.env.APP_URL || 'https://printdrop.local').trim();
}

export function isTelegramConfigured(): boolean {
  return Boolean(getBotToken() && getChatId());
}

export async function testTelegramConnection(): Promise<{
  success: boolean;
  message: string;
  botInfo?: { id: number; first_name: string; username: string };
}> {
  const token = getBotToken();
  const chatId = getChatId();

  if (!token) {
    return {
      success: false,
      message: 'TELEGRAM_BOT_TOKEN is not configured on the server. Please set it in .env or environment variables.',
    };
  }

  if (!chatId) {
    return {
      success: false,
      message: 'TELEGRAM_CHAT_ID is not configured on the server. Please set it in .env or environment variables.',
    };
  }

  try {
    // 1. Verify Bot Token with getMe
    const meRes = await fetch(`${TELEGRAM_API_BASE}/bot${token}/getMe`);
    const meData = await meRes.json();

    if (!meRes.ok || !meData.ok) {
      return {
        success: false,
        message: `Telegram Bot verification failed: ${meData.description || 'Invalid token'}`,
      };
    }

    // 2. Send a real test message to the configured Chat ID
    const testMsg = `🔔 *PrintDrop Telegram Integration Test*\n━━━━━━━━━━━━━━━━━━━━\n✅ Connection verified successfully!\n🏪 Server URL: \`${getAppUrl()}\`\n⏰ Time: ${new Date().toLocaleString()}\n\n_Your PrintDrop shop bot is ready to receive customer print orders and documents._`;

    const sendRes = await fetch(`${TELEGRAM_API_BASE}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: testMsg,
        parse_mode: 'Markdown',
      }),
    });

    const sendData = await sendRes.json();
    if (!sendRes.ok || !sendData.ok) {
      return {
        success: false,
        message: `Bot verified (${meData.result.username}), but sending to chat ${chatId} failed: ${sendData.description || 'Forbidden or chat not found'}`,
        botInfo: meData.result,
      };
    }

    logAudit('telegram', 'TEST_PING_SUCCESS', `Ping sent to chat ${chatId} via @${meData.result.username}`);

    return {
      success: true,
      message: `Successfully connected to Telegram Bot @${meData.result.username} and sent test notification to Chat ${chatId}!`,
      botInfo: meData.result,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Network error reaching Telegram API: ${err?.message || err}`,
    };
  }
}

/**
 * Dispatches order notification and actual customer files to Telegram.
 * Implements Section H: Automatic Temporary File Cleanup upon confirmed delivery.
 */
export async function dispatchOrderToTelegram(orderOrId: string | PrintOrder): Promise<{
  deliveredFiles: number;
  totalFiles: number;
  overallStatus: 'delivered' | 'failed' | 'not_configured';
  error?: string;
}> {
  const token = getBotToken();
  const chatId = getChatId();

  let order: PrintOrder | null = null;
  if (typeof orderOrId === 'string') {
    order = await fetchOrderById(orderOrId);
  } else {
    order = orderOrId;
  }

  if (!order) {
    return { deliveredFiles: 0, totalFiles: 0, overallStatus: 'failed', error: 'Order not found' };
  }

  const db = getDatabase();
  const cachedOrder = db.orders.find(o => o.id === order!.id);

  if (!token || !chatId) {
    order.telegramStatus = 'not_configured';
    order.telegramDeliveryError = 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not configured in server environment.';
    if (cachedOrder) cachedOrder.telegramStatus = 'not_configured';
    saveDatabase(db);
    return { deliveredFiles: 0, totalFiles: order.files.length, overallStatus: 'not_configured' };
  }

  const shopName = 'Maxin Printing Service';
  const adminUrl = `${getAppUrl()}/?tab=admin`;

  try {
    // 1. Send Order Header Summary
    const filesSummary = order.files
      .map(
        (f, idx) =>
          `  ${idx + 1}. *${f.fileName}* (${f.pageCount} pgs, ${f.copies}x, ${f.paperSize}, ${f.printType.toUpperCase()}, ${f.duplex !== 'single' ? 'Duplex' : '1-sided'})`
      )
      .join('\n');

    const headerText =
      `🖨️ *NEW PRINT ORDER* — *[#${order.queueNumber}]*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📋 *Order ID:* \`${order.id}\`\n` +
      `👤 *Customer:* ${order.customerName}\n` +
      `📞 *Phone:* ${order.customerPhone || 'N/A'}\n` +
      `🏪 *Branch:* ${shopName}\n` +
      `💰 *Total Due:* ₱${order.totalPrice.toFixed(2)}\n` +
      `📎 *Finishing:* ${order.binding.toUpperCase()}\n` +
      `📝 *Instructions:* ${order.instructions || 'Standard print'}\n\n` +
      `📄 *Documents (${order.files.length}):*\n${filesSummary}\n\n` +
      `🔗 [Open Staff Dashboard](${adminUrl})`;

    const headerRes = await fetch(`${TELEGRAM_API_BASE}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: headerText,
        parse_mode: 'Markdown',
      }),
    });

    const headerData = await headerRes.json();
    if (!headerRes.ok || !headerData.ok) {
      throw new Error(`Telegram header send failed: ${headerData.description || 'Unknown error'}`);
    }

    // 2. Deliver Each File as an Attachment & Perform Automatic Disk Cleanup
    let deliveredCount = 0;

    for (let i = 0; i < order.files.length; i++) {
      const file = order.files[i];

      // If already delivered, skip re-uploading
      if (file.telegramStatus === 'delivered') {
        deliveredCount++;
        continue;
      }

      let fileBuffer: Buffer | null = null;

      // Check if file is on disk
      if (file.diskPath && fs.existsSync(file.diskPath)) {
        fileBuffer = fs.readFileSync(file.diskPath);
      } else if (file.fileData && file.fileData.startsWith('data:')) {
        // Fallback from base64
        const parts = file.fileData.split(',');
        fileBuffer = Buffer.from(parts[1], 'base64');
      }

      if (!fileBuffer) {
        file.telegramStatus = 'failed';
        file.telegramError = 'File data not found on disk or memory';
        continue;
      }

      // Build multipart/form-data using standard Node.js Blob & FormData
      const formData = new FormData();
      formData.append('chat_id', chatId);
      const blob = new Blob([new Uint8Array(fileBuffer)], { type: file.fileType || 'application/octet-stream' });
      formData.append('document', blob, file.fileName);

      const caption =
        `📄 [Ticket #${order.queueNumber}] File ${i + 1}/${order.files.length}: ${file.fileName}\n` +
        `Specs: ${file.copies} copy(s), ${file.paperSize}, ${file.printType.toUpperCase()}, ${file.duplex}\n` +
        `Pages: ${file.pageCount} | Subtotal: ₱${file.subtotal.toFixed(2)}`;
      formData.append('caption', caption);

      const docRes = await fetch(`${TELEGRAM_API_BASE}/bot${token}/sendDocument`, {
        method: 'POST',
        body: formData,
      });

      const docData = await docRes.json();

      if (docRes.ok && docData.ok) {
        file.telegramStatus = 'delivered';
        file.telegramMessageId = docData.result.message_id;
        file.telegramFileId = docData.result.document?.file_id;
        file.telegramError = undefined;
        deliveredCount++;

        // CRITICAL SECTION H REQUIREMENT:
        // Delete the temporary website local disk copy once Telegram upload succeeded
        if (file.diskPath && fs.existsSync(file.diskPath)) {
          try {
            fs.unlinkSync(file.diskPath);
            file.isDeletedFromDisk = true;
            console.log(`[CLEANUP] Deleted temporary local file after confirmed Telegram delivery: ${file.fileName}`);
          } catch (delErr) {
            console.warn(`[CLEANUP] Could not unlink ${file.diskPath}:`, delErr);
          }
        }
        // Also clear memory base64 to save RAM
        file.fileData = undefined;
      } else {
        file.telegramStatus = 'failed';
        file.telegramError = docData.description || 'Upload failed';
        console.error(`[TELEGRAM] Failed uploading file ${file.fileName}:`, docData);
      }
    }

    // 3. Update Order Level Delivery Status
    if (deliveredCount === order.files.length) {
      order.telegramStatus = 'delivered';
      order.telegramDeliveryError = undefined;
      logAudit('telegram', 'ORDER_DELIVERED', `Order ${order.id} (#${order.queueNumber}) all ${deliveredCount} files delivered to Telegram and cleaned from disk.`);
    } else {
      order.telegramStatus = 'failed';
      order.telegramDeliveryError = `Delivered ${deliveredCount} of ${order.files.length} files. Review individual file errors.`;
      logAudit('telegram', 'ORDER_PARTIAL_DELIVERY', `Order ${order.id} delivered ${deliveredCount}/${order.files.length} files.`);
    }

    const pool = getPgPool();
    if (pool) {
      try {
        await pool.query(
          `UPDATE printdrop_orders SET telegram_status = $1, telegram_error = $2 WHERE id = $3`,
          [order.telegramStatus, order.telegramDeliveryError, order.id]
        );
        for (const f of order.files) {
          await pool.query(
            `UPDATE printdrop_order_files SET telegram_status = $1, telegram_file_id = $2, is_deleted_from_disk = $3 WHERE id = $4`,
            [f.telegramStatus, f.telegramFileId, f.isDeletedFromDisk, f.id]
          );
        }
      } catch (pgErr) {
        console.error('[Telegram] Failed syncing status to Neon:', pgErr);
      }
    }

    saveDatabase(db);

    return {
      deliveredFiles: deliveredCount,
      totalFiles: order.files.length,
      overallStatus: order.telegramStatus,
      error: order.telegramDeliveryError,
    };
  } catch (err: any) {
    order.telegramStatus = 'failed';
    order.telegramDeliveryError = err?.message || String(err);
    saveDatabase(db);
    logAudit('telegram', 'ORDER_DELIVERY_ERROR', `Error delivering order ${order.id}: ${order.telegramDeliveryError}`);
    return {
      deliveredFiles: 0,
      totalFiles: order.files.length,
      overallStatus: 'failed',
      error: order.telegramDeliveryError,
    };
  }
}

/**
 * Recovers a file directly from Telegram using getFile if the local copy was already deleted.
 */
export async function downloadFileFromTelegram(fileId: string): Promise<{ buffer: Buffer; fileName?: string } | null> {
  const token = getBotToken();
  if (!token || !fileId) return null;

  try {
    const fileRes = await fetch(`${TELEGRAM_API_BASE}/bot${token}/getFile?file_id=${fileId}`);
    const fileData = await fileRes.json();
    if (!fileRes.ok || !fileData.ok || !fileData.result?.file_path) {
      return null;
    }

    const downloadUrl = `${TELEGRAM_API_BASE}/file/bot${token}/${fileData.result.file_path}`;
    const dlRes = await fetch(downloadUrl);
    if (!dlRes.ok) return null;

    const arrayBuffer = await dlRes.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      fileName: path.basename(fileData.result.file_path),
    };
  } catch (e) {
    console.error('[TELEGRAM] Error retrieving file from Telegram:', e);
    return null;
  }
}
