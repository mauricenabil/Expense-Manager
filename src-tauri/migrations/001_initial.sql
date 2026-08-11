-- ============================================
-- Migration 001: Initial Schema
-- Personal Expense Manager
-- ============================================

PRAGMA foreign_keys = ON;

-- ============================================
-- App Info (نسخة التطبيق وقاعدة البيانات)
-- ============================================
CREATE TABLE IF NOT EXISTS app_info (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    app_version TEXT NOT NULL,
    db_version INTEGER NOT NULL DEFAULT 1,
    build_date TEXT NOT NULL
);

-- ============================================
-- Settings (Key-Value عام لأي إعداد مستقبلي)
-- ============================================
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
    -- أمثلة: theme=dark, budgets_enabled=1, auto_lock_minutes=10
);

-- ============================================
-- Security
-- ============================================
CREATE TABLE IF NOT EXISTS security (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    password_hash TEXT,
    password_enabled INTEGER NOT NULL DEFAULT 0,
    auto_lock_minutes INTEGER DEFAULT NULL,
    last_changed_at TEXT
);

-- ============================================
-- Categories
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    color TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS sub_categories (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL REFERENCES categories(id),
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
);

-- ============================================
-- Payment Methods (تُختار مثل التصنيف بالضبط)
-- ============================================
CREATE TABLE IF NOT EXISTS payment_methods (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
);

-- ============================================
-- Tags (Many-to-Many)
-- ============================================
CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

-- ============================================
-- Expenses (الجدول المحوري - بدون Accounts)
-- ============================================
CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    date TEXT NOT NULL,                     -- YYYY-MM-DD
    amount REAL NOT NULL CHECK (amount > 0),

    category_id TEXT NOT NULL REFERENCES categories(id),
    sub_category_id TEXT REFERENCES sub_categories(id),
    payment_method_id TEXT NOT NULL REFERENCES payment_methods(id),

    description TEXT,
    recurring_id TEXT REFERENCES recurring_expenses(id),

    -- Generated columns (بدون تكرار بيانات يدوي)
    day   INTEGER GENERATED ALWAYS AS (CAST(strftime('%d', date) AS INTEGER)) VIRTUAL,
    month INTEGER GENERATED ALWAYS AS (CAST(strftime('%m', date) AS INTEGER)) VIRTUAL,
    year  INTEGER GENERATED ALWAYS AS (CAST(strftime('%Y', date) AS INTEGER)) VIRTUAL,

    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS expense_tags (
    expense_id TEXT NOT NULL REFERENCES expenses(id),
    tag_id TEXT NOT NULL REFERENCES tags(id),
    PRIMARY KEY (expense_id, tag_id)
);

-- ============================================
-- Recurring Expenses (تأكيد يدوي - لا توليد تلقائي)
-- ============================================
CREATE TABLE IF NOT EXISTS recurring_expenses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    amount REAL NOT NULL,
    category_id TEXT REFERENCES categories(id),
    sub_category_id TEXT REFERENCES sub_categories(id),
    payment_method_id TEXT REFERENCES payment_methods(id),
    frequency TEXT NOT NULL CHECK (frequency IN ('daily','weekly','monthly','yearly')),
    start_date TEXT NOT NULL,
    end_date TEXT,
    next_due_date TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
);

-- ============================================
-- Budgets
-- ============================================
CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY,
    category_id TEXT REFERENCES categories(id),   -- NULL = General Budget
    amount REAL NOT NULL,
    period TEXT NOT NULL DEFAULT 'monthly' CHECK (period IN ('monthly','yearly')),
    start_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
);

-- ============================================
-- Savings Goals (تتبع يدوي، بدون ربط بحساب)
-- ============================================
CREATE TABLE IF NOT EXISTS savings_goals (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    target_amount REAL NOT NULL,
    current_amount REAL NOT NULL DEFAULT 0,
    target_date TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
);

-- ============================================
-- Activity Log
-- ============================================
CREATE TABLE IF NOT EXISTS activity_log (
    id TEXT PRIMARY KEY,
    action_type TEXT NOT NULL,      -- expense_added / expense_updated / expense_deleted / backup_created ...
    table_name TEXT,
    record_id TEXT,
    details TEXT,                   -- JSON snapshot
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================
-- Monthly Snapshots (Cache للتقارير السريعة)
-- ============================================
CREATE TABLE IF NOT EXISTS monthly_snapshots (
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    total_spending REAL NOT NULL,
    expense_count INTEGER NOT NULL,
    top_category_id TEXT,
    avg_daily_spending REAL,
    generated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (month, year)
);

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_payment ON expenses(payment_method_id);
CREATE INDEX IF NOT EXISTS idx_expenses_deleted ON expenses(deleted_at);
CREATE INDEX IF NOT EXISTS idx_subcat_category ON sub_categories(category_id);

-- ============================================
-- Seed Data (بيانات افتراضية أولية)
-- ============================================
INSERT OR IGNORE INTO app_info (id, app_version, db_version, build_date)
VALUES (1, '1.0.0', 1, datetime('now'));

INSERT OR IGNORE INTO security (id, password_enabled) VALUES (1, 0);

INSERT OR IGNORE INTO app_settings (key, value) VALUES
    ('theme', 'dark'),
    ('budgets_enabled', '1'),
    ('currency', 'EGP');

INSERT OR IGNORE INTO categories (id, name, icon, color, sort_order) VALUES
    ('cat-food',      'Food & Dining',    'utensils',   '#4DA3FF', 1),
    ('cat-transport', 'Transportation',   'car',        '#FF9F4D', 2),
    ('cat-shopping',  'Shopping',         'shopping-bag','#FF4D9F', 3),
    ('cat-bills',     'Bills & Utilities','file-text',  '#4DFFB0', 4),
    ('cat-health',    'Health',           'heart',      '#FF4D4D', 5),
    ('cat-entertain', 'Entertainment',    'film',       '#B04DFF', 6),
    ('cat-other',     'Other',            'more-horizontal', '#8AA0BD', 99);

INSERT OR IGNORE INTO payment_methods (id, name, icon, sort_order) VALUES
    ('pm-cash',     'Cash',          'banknote', 1),
    ('pm-visa',     'Visa Card',     'credit-card', 2),
    ('pm-wallet',   'Mobile Wallet', 'smartphone', 3),
    ('pm-transfer', 'Bank Transfer','landmark', 4);
