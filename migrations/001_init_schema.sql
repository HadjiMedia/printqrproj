-- ====================================================================
-- PrintDrop — Neon PostgreSQL Initial Schema Migration
-- ====================================================================
-- This migration initializes tables for orders, order files, status
-- audit trails, admin credentials, trusted devices, sessions, and settings.
-- ====================================================================

-- 1. Admin Users & Credentials
CREATE TABLE IF NOT EXISTS printdrop_admins (
  id VARCHAR(64) PRIMARY KEY,
  username VARCHAR(64) UNIQUE NOT NULL,
  password_hash VARCHAR(256) NOT NULL,
  salt VARCHAR(64) NOT NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'staff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Trusted Devices & Approval Requests
CREATE TABLE IF NOT EXISTS printdrop_devices (
  id VARCHAR(64) PRIMARY KEY,
  device_id VARCHAR(128) UNIQUE NOT NULL,
  device_name VARCHAR(128) NOT NULL,
  user_agent TEXT,
  ip_address VARCHAR(64),
  status VARCHAR(32) NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'revoked'
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  request_id VARCHAR(64) UNIQUE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_devices_device_id ON printdrop_devices(device_id);
CREATE INDEX IF NOT EXISTS idx_devices_request_id ON printdrop_devices(request_id);

-- 3. Print Orders
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
  status VARCHAR(32) NOT NULL DEFAULT 'waiting', -- 'waiting' | 'printing' | 'ready' | 'completed' | 'cancelled'
  status_message TEXT,
  total_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  telegram_status VARCHAR(32) NOT NULL DEFAULT 'pending',
  telegram_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_orders_queue_number ON printdrop_orders(queue_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON printdrop_orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON printdrop_orders(created_at DESC);

-- 4. Order Files & Document Specifications
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

CREATE INDEX IF NOT EXISTS idx_order_files_order_id ON printdrop_order_files(order_id);

-- 5. Order Status History Log
CREATE TABLE IF NOT EXISTS printdrop_status_history (
  id SERIAL PRIMARY KEY,
  order_id VARCHAR(32) NOT NULL REFERENCES printdrop_orders(id) ON DELETE CASCADE,
  status VARCHAR(32) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by VARCHAR(64) NOT NULL,
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_status_history_order_id ON printdrop_status_history(order_id);

-- 6. Dynamic Shop Settings (Pricing & Store Intake)
CREATE TABLE IF NOT EXISTS printdrop_settings (
  key VARCHAR(64) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Audit Logs
CREATE TABLE IF NOT EXISTS printdrop_audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor VARCHAR(64) NOT NULL,
  action VARCHAR(64) NOT NULL,
  details TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON printdrop_audit_logs(timestamp DESC);

-- 8. Admin Sessions
CREATE TABLE IF NOT EXISTS printdrop_admin_sessions (
  token VARCHAR(128) PRIMARY KEY,
  username VARCHAR(64) NOT NULL,
  device_id VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON printdrop_admin_sessions(expires_at);

-- 9. Daily Queue Number Counters
CREATE TABLE IF NOT EXISTS printdrop_queue_counters (
  counter_date VARCHAR(32) PRIMARY KEY,
  current_number INT NOT NULL DEFAULT 1045
);
