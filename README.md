# PrintDrop — Smart Printing Management System

PrintDrop is a production-grade, contactless QR-based printing management system for physical printing shops. Customers scan a shop counter QR code from their mobile device, upload multiple documents and photos, configure individual printing options, receive an atomic queue ticket, and track their printing status in real time.

Staff manage incoming print jobs from a live admin dashboard, receive instant notifications with actual file attachments in their private Telegram group, and benefit from automatic temporary file cleanup that eliminates server disk clutter.

---

## Architecture Overview

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons
- **Backend:** Node.js Express server (`server.ts`) with custom REST APIs (`/api/*`)
- **Database & Storage:** Neon/PostgreSQL for durable production orders, statuses, and settings; local JSON storage is only a development fallback
- **Temporary Upload Storage:** `data/uploads/` with automated lifecycle cleanup
- **Telegram Integration:** Direct Telegram Bot API client uploading documents/photos to staff Telegram channels
- **ZIP Bundler:** Built-in zero-dependency ZIP archive generator using Node `zlib`

---

## Order Lifecycle & Automatic Temporary File Cleanup (Section H)

PrintDrop implements a strict file lifecycle to prevent hosting disk exhaustion:

1. **Upload & Ingestion:** Customer uploads one or multiple documents (PDF, DOCX, JPG, PNG). Files are temporarily saved to `data/uploads/`.
2. **Order Creation:** Server recalculates pricing based on shop rate cards, assigns an atomic queue number (`A-01`), and generates a cryptographically secure tracking token.
3. **Telegram Delivery:** Server formats the order summary and uploads each actual document attachment to the shop's private Telegram staff group.
4. **Immediate Disk Cleanup:** Once Telegram confirms delivery (`message_id` and `file_id` recorded), the local file on the server disk is **deleted immediately** (`fs.unlinkSync`), freeing website hosting storage.
5. **Preserved History:** Order metadata, customer name, queue ticket, file specs, and total price remain permanently recorded in the database.
6. **Recovery Window:** In the event that Telegram is unconfigured or a network failure occurs, the local file is retained for a 24-hour recovery window allowing staff to download it directly from the dashboard.
7. **Scheduled Pruning:** A background worker runs every 30 minutes to clean orphaned or expired uploads.

---

## Environment Variables (`.env`)

Copy `.env.example` to `.env`:

```bash
# Public URL of the application (used in QR codes and staff links)
APP_URL="https://your-domain.com"

# Required in production: connection string from your Neon/PostgreSQL database
# Add the real value to Vercel Project Settings > Environment Variables for Production
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"

# Telegram Bot API Token (from @BotFather)
TELEGRAM_BOT_TOKEN="123456789:ABCdefGhIJKlmNoPQRstuvWxyz"

# Telegram Staff Group / Channel Chat ID
TELEGRAM_CHAT_ID="-1001234567890"

# Staff Dashboard Password
ADMIN_PASSWORD="printdrop2025"

# Server Port
PORT=3000
NODE_ENV="development"
```

---

## Telegram Bot Setup Guide

1. Open Telegram and search for `@BotFather`.
2. Send `/newbot`, choose a name (e.g., `My Shop Print Bot`) and a username ending in `bot` (e.g., `MyShopPrintDropBot`).
3. Copy the HTTP API token into `TELEGRAM_BOT_TOKEN`.
4. Create a private group for your print counter staff (e.g., `PrintDrop Staff Group`).
5. Add your new bot to the group and promote it to **Admin** (with permission to post messages).
6. Obtain your group chat ID (e.g. by adding `@RawDataBot` to the group or sending a test message and checking `https://api.telegram.org/bot<TOKEN>/getUpdates`). Chat IDs for supergroups start with `-100`.
7. Enter this ID into `TELEGRAM_CHAT_ID`.
8. Open the Staff Dashboard → **Telegram Bot Setup** tab and click **"Send Real Telegram Test Notification"** to verify connection.

---

## Available Commands to Run

### Development Mode (Full-Stack Express + Vite)
```bash
npm run dev
```

### Production Build & Launch
```bash
npm run build
npm start
```

### Run Verification Test Suite
```bash
npx tsx tests/printdrop.test.ts
```

---

## Default Pricing Rate Card (Philippine Peso ₱)

Configurable live in the Staff Dashboard:

| Paper Size | Black & White | Full Color |
|---|---|---|
| **Short / Letter** | ₱3.00 / page | ₱6.00 / page |
| **A4 Standard** | ₱5.00 / page | ₱8.00 / page |
| **Long / Legal** | ₱7.00 / page | ₱10.00 / page |
| **A3 Large Format** | ₱12.00 / page | ₱20.00 / page |

- **Duplex Discount:** 10% discount on sheet printing
- **Binding Add-ons:** Staple (₱5.00), Spiral Ring (₱35.00), Booklet (₱45.00)

---

## Security Features

- **Server-Side Authentication:** Protected staff API endpoints with session tokens.
- **Privacy Masking:** Customer phone numbers and raw file download links are masked unless accessed with a valid tracking token or admin session.
- **Sanitized Uploads:** File paths are sanitized against directory traversal attacks.
- **Secrets Isolation:** Telegram tokens and admin passwords exist exclusively on the server and are never included in client JavaScript bundles.
