import fs from 'node:fs';
import path from 'node:path';
import { getDatabase, saveDatabase, getUploadsDir, logAudit } from './db';

const RECOVERY_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const ORPHAN_AGE_MS = 2 * 60 * 60 * 1000;       // 2 hours

export function runFileCleanup(): {
  deletedDeliveredCount: number;
  deletedOrphanCount: number;
  retainedFailedCount: number;
  freedBytes: number;
} {
  const uploadsDir = getUploadsDir();
  const db = getDatabase();

  let deletedDeliveredCount = 0;
  let deletedOrphanCount = 0;
  let retainedFailedCount = 0;
  let freedBytes = 0;

  if (!fs.existsSync(uploadsDir)) {
    return { deletedDeliveredCount: 0, deletedOrphanCount: 0, retainedFailedCount: 0, freedBytes: 0 };
  }

  const existingFiles = fs.readdirSync(uploadsDir);
  const now = Date.now();

  // 1. Check all registered files in database
  for (const order of db.orders) {
    for (const file of order.files) {
      if (file.diskPath && fs.existsSync(file.diskPath)) {
        const stats = fs.statSync(file.diskPath);

        // If file was confirmed delivered to Telegram, clean it up immediately
        if (file.telegramStatus === 'delivered') {
          try {
            freedBytes += stats.size;
            fs.unlinkSync(file.diskPath);
            file.isDeletedFromDisk = true;
            deletedDeliveredCount++;
          } catch (err) {
            console.error(`[CLEANUP] Could not delete delivered file ${file.diskPath}:`, err);
          }
        } else if (file.telegramStatus === 'failed') {
          // Check age against recovery window
          const fileAge = now - stats.mtimeMs;
          if (fileAge > RECOVERY_WINDOW_MS) {
            try {
              freedBytes += stats.size;
              fs.unlinkSync(file.diskPath);
              file.isDeletedFromDisk = true;
              deletedDeliveredCount++;
            } catch (err) {
              console.error(`[CLEANUP] Could not delete expired failed file ${file.diskPath}:`, err);
            }
          } else {
            retainedFailedCount++;
          }
        }
      }
    }
  }

  // 2. Identify orphaned files in uploads directory not tracked in DB
  const trackedDiskPaths = new Set(
    db.orders.flatMap(o => o.files.map(f => f.diskPath).filter(Boolean))
  );

  for (const fileName of existingFiles) {
    const fullPath = path.join(uploadsDir, fileName);
    if (!trackedDiskPaths.has(fullPath)) {
      try {
        const stats = fs.statSync(fullPath);
        if (now - stats.mtimeMs > ORPHAN_AGE_MS) {
          freedBytes += stats.size;
          fs.unlinkSync(fullPath);
          deletedOrphanCount++;
        }
      } catch (_) {}
    }
  }

  saveDatabase(db);

  if (deletedDeliveredCount > 0 || deletedOrphanCount > 0) {
    logAudit(
      'cleanup',
      'CLEANUP_COMPLETED',
      `Deleted ${deletedDeliveredCount} delivered files and ${deletedOrphanCount} orphans. Freed ${(freedBytes / 1024 / 1024).toFixed(2)} MB.`
    );
  }

  return {
    deletedDeliveredCount,
    deletedOrphanCount,
    retainedFailedCount,
    freedBytes,
  };
}

export function startCleanupScheduler(): void {
  // Run on startup
  try {
    runFileCleanup();
  } catch (e) {
    console.error('[CLEANUP] Startup cleanup error:', e);
  }

  // Run every 30 minutes
  setInterval(() => {
    try {
      runFileCleanup();
    } catch (e) {
      console.error('[CLEANUP] Scheduled cleanup error:', e);
    }
  }, 30 * 60 * 1000);
}
