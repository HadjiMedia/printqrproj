-- 002: Idempotent order submission + persisted settings. Non-destructive and safe to re-run.
-- (The app also applies these automatically at startup via initNeonSchema.)

ALTER TABLE printdrop_orders ADD COLUMN IF NOT EXISTS client_request_id VARCHAR(128);

-- Prevents duplicate orders when a request is retried or Submit is clicked twice.
CREATE UNIQUE INDEX IF NOT EXISTS uq_printdrop_orders_client_request_id
  ON printdrop_orders (client_request_id) WHERE client_request_id IS NOT NULL;

-- Pricing/shop settings are stored as JSON rows in printdrop_settings (keys: 'pricing', 'shops').
CREATE TABLE IF NOT EXISTS printdrop_settings (
  key VARCHAR(64) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
