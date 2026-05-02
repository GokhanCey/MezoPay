const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "mezopay.db");

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent performance
db.pragma("journal_mode = WAL");

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS merchants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet TEXT NOT NULL UNIQUE,
    api_key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    webhook_url TEXT DEFAULT '',
    on_chain_id INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    merchant_id INTEGER NOT NULL,
    on_chain_plan_id INTEGER DEFAULT 0,
    name TEXT NOT NULL,
    price TEXT NOT NULL,
    plan_type TEXT NOT NULL CHECK(plan_type IN ('ONE_TIME', 'SUBSCRIPTION', 'PAY_PER_USE')),
    billing_interval INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (merchant_id) REFERENCES merchants(id)
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_id TEXT UNIQUE,
    plan_id INTEGER NOT NULL,
    payer TEXT NOT NULL,
    merchant TEXT NOT NULL,
    amount TEXT NOT NULL,
    tx_hash TEXT DEFAULT '',
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'failed')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (plan_id) REFERENCES plans(id)
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    on_chain_sub_id INTEGER DEFAULT 0,
    plan_id INTEGER NOT NULL,
    subscriber TEXT NOT NULL,
    merchant TEXT NOT NULL,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'cancelled')),
    next_payment_due DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (plan_id) REFERENCES plans(id)
  );

  CREATE TABLE IF NOT EXISTS webhooks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    merchant_id INTEGER NOT NULL,
    url TEXT NOT NULL,
    secret TEXT NOT NULL,
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (merchant_id) REFERENCES merchants(id)
  );

  CREATE INDEX IF NOT EXISTS idx_merchants_wallet ON merchants(wallet);
  CREATE INDEX IF NOT EXISTS idx_merchants_api_key ON merchants(api_key);
  CREATE INDEX IF NOT EXISTS idx_plans_merchant ON plans(merchant_id);
  CREATE INDEX IF NOT EXISTS idx_payments_plan ON payments(plan_id);
  CREATE INDEX IF NOT EXISTS idx_payments_payer ON payments(payer);
  CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON subscriptions(plan_id);
  CREATE INDEX IF NOT EXISTS idx_subscriptions_subscriber ON subscriptions(subscriber);
`);

module.exports = db;
