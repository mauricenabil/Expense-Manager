-- ============================================================
-- Migration 004: Planned Purchases (التخطيط للشراء)
-- ------------------------------------------------------------
-- المستخدم يسجّل شيئاً ينوي شراءه + سعره المتوقّع، وعند الشراء
-- الفعلي يضغط زراً واحداً فيتحوّل السجل إلى مصروف حقيقي في جدول
-- expenses، مع الاحتفاظ بأثر التحويل للرجوع إليه.
--
-- converted_expense_id يحمل معرّف المصروف الناتج، فنمنع التحويل
-- مرتين ونستطيع فتح المصروف من شاشة التخطيط مباشرة.
-- ============================================================

CREATE TABLE IF NOT EXISTS planned_purchases (
    id                   TEXT PRIMARY KEY,
    name                 TEXT NOT NULL,
    estimated_amount     REAL NOT NULL CHECK (estimated_amount > 0),
    category_id          TEXT,
    payment_method_id    TEXT,
    target_date          TEXT,             -- YYYY-MM-DD، تاريخ الشراء المستهدف (اختياري)
    priority             INTEGER NOT NULL DEFAULT 2,  -- 1 منخفضة، 2 عادية، 3 عالية
    notes                TEXT,
    status               TEXT NOT NULL DEFAULT 'planned'
                           CHECK (status IN ('planned', 'purchased', 'cancelled')),
    converted_expense_id TEXT,
    purchased_at         TEXT,
    created_at           TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at           TEXT,

    FOREIGN KEY (category_id)       REFERENCES categories(id)      ON DELETE SET NULL,
    FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE SET NULL,
    FOREIGN KEY (converted_expense_id) REFERENCES expenses(id)     ON DELETE SET NULL
);

-- الاستعلام الأساسي في الواجهة: الخطط النشطة مرتّبة بالأولوية ثم التاريخ
CREATE INDEX IF NOT EXISTS idx_planned_status
    ON planned_purchases(status, deleted_at);

CREATE INDEX IF NOT EXISTS idx_planned_target_date
    ON planned_purchases(target_date);
