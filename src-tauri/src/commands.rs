use crate::db::Db;
use crate::security;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

// ===================================================================
// Models (متوافقة مع TypeScript types في الواجهة)
// ===================================================================

#[derive(Serialize, Deserialize)]
pub struct Category {
    pub id: String,
    pub name: String,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub sort_order: i32,
}

#[derive(Serialize, Deserialize)]
pub struct PaymentMethod {
    pub id: String,
    pub name: String,
    pub icon: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct SubCategory {
    pub id: String,
    pub category_id: String,
    pub name: String,
}

#[derive(Serialize, Deserialize)]
pub struct Tag {
    pub id: String,
    pub name: String,
}

#[derive(Serialize, Deserialize)]
pub struct Budget {
    pub id: String,
    pub category_id: Option<String>,
    pub category_name: Option<String>,
    pub amount: f64,
    pub period: String,
    pub pinned: bool,
}

#[derive(Serialize, Deserialize)]
pub struct SavingsGoal {
    pub id: String,
    pub name: String,
    pub target_amount: f64,
    pub current_amount: f64,
    pub target_date: Option<String>,
    pub pinned: bool,
}

#[derive(Serialize, Deserialize)]
pub struct RecurringExpense {
    pub id: String,
    pub name: String,
    pub amount: f64,
    pub category_id: Option<String>,
    pub payment_method_id: Option<String>,
    pub frequency: String,
    pub next_due_date: String,
    pub is_active: bool,
}

#[derive(Serialize, Deserialize)]
pub struct Expense {
    pub id: String,
    pub name: String,
    pub date: String,
    pub amount: f64,
    pub category_id: Option<String>,
    pub sub_category_id: Option<String>,
    pub payment_method_id: Option<String>,
    pub description: Option<String>,
    /// معرّفات الوسوم المرتبطة. serde(default) حتى لا يفشل أي استدعاء قديم
    /// لا يرسل المفتاح أصلاً (مثل استيراد CSV) بدل أن يفشل الصف كله.
    #[serde(default)]
    pub tag_ids: Vec<String>,
}

#[derive(Serialize, Deserialize)]
pub struct ExpenseWithDetails {
    pub id: String,
    pub name: String,
    pub date: String,
    pub amount: f64,
    pub category_id: Option<String>,
    pub category_name: Option<String>,
    pub category_color: Option<String>,
    pub sub_category_id: Option<String>,
    pub payment_method_id: Option<String>,
    pub payment_method_name: Option<String>,
    pub description: Option<String>,
    pub tag_ids: Vec<String>,
}

#[derive(Serialize, Deserialize)]
pub struct DashboardSummary {
    pub total_today: f64,
    pub total_this_month: f64,
    pub total_this_year: f64,
    pub expense_count_this_month: i64,
    pub daily_average: f64,
    pub biggest_expense: f64,
    pub top_category: Option<String>,
}

// ===================================================================
// Helper: تسجيل أي عملية في activity_log (Audit Trail)
// ===================================================================
/// pub(crate) لأن وحدة planned تسجّل في نفس السجل.
pub(crate) fn log_activity(conn: &rusqlite::Connection, action: &str, table: &str, record_id: &str) {
    let _ = conn.execute(
        "INSERT INTO activity_log (id, action_type, table_name, record_id) VALUES (?1, ?2, ?3, ?4)",
        params![Uuid::new_v4().to_string(), action, table, record_id],
    );
}

// ===================================================================
// Categories
// ===================================================================

#[tauri::command]
pub fn get_categories(db: State<Db>) -> Result<Vec<Category>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, icon, color, sort_order FROM categories WHERE deleted_at IS NULL ORDER BY sort_order")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(Category {
                id: row.get(0)?,
                name: row.get(1)?,
                icon: row.get(2)?,
                color: row.get(3)?,
                sort_order: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_category(db: State<Db>, name: String, icon: Option<String>, color: Option<String>) -> Result<String, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO categories (id, name, icon, color) VALUES (?1, ?2, ?3, ?4)",
        params![id, name, icon, color],
    )
    .map_err(|e| e.to_string())?;
    log_activity(&conn, "category_added", "categories", &id);
    Ok(id)
}

#[tauri::command]
pub fn update_category(db: State<Db>, id: String, name: String, icon: Option<String>, color: Option<String>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE categories SET name = ?1, icon = ?2, color = ?3 WHERE id = ?4",
        params![name, icon, color, id],
    )
    .map_err(|e| e.to_string())?;
    log_activity(&conn, "category_updated", "categories", &id);
    Ok(())
}

/// حذف ناعم فقط (Soft Delete) - حماية للبيانات التاريخية المرتبطة بمصروفات قديمة
#[tauri::command]
pub fn delete_category(db: State<Db>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE categories SET deleted_at = datetime('now') WHERE id = ?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    log_activity(&conn, "category_deleted", "categories", &id);
    Ok(())
}

// ===================================================================
// Payment Methods
// ===================================================================

#[tauri::command]
pub fn get_payment_methods(db: State<Db>) -> Result<Vec<PaymentMethod>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, icon FROM payment_methods WHERE deleted_at IS NULL ORDER BY sort_order")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(PaymentMethod {
                id: row.get(0)?,
                name: row.get(1)?,
                icon: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_payment_method(db: State<Db>, name: String, icon: Option<String>) -> Result<String, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO payment_methods (id, name, icon) VALUES (?1, ?2, ?3)",
        params![id, name, icon],
    )
    .map_err(|e| e.to_string())?;
    log_activity(&conn, "payment_method_added", "payment_methods", &id);
    Ok(id)
}

#[tauri::command]
pub fn update_payment_method(db: State<Db>, id: String, name: String, icon: Option<String>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE payment_methods SET name = ?1, icon = ?2 WHERE id = ?3",
        params![name, icon, id],
    )
    .map_err(|e| e.to_string())?;
    log_activity(&conn, "payment_method_updated", "payment_methods", &id);
    Ok(())
}

#[tauri::command]
pub fn delete_payment_method(db: State<Db>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE payment_methods SET deleted_at = datetime('now') WHERE id = ?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    log_activity(&conn, "payment_method_deleted", "payment_methods", &id);
    Ok(())
}

// ===================================================================
// Sub Categories
// ===================================================================

#[tauri::command]
pub fn get_sub_categories(db: State<Db>) -> Result<Vec<SubCategory>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, category_id, name FROM sub_categories WHERE deleted_at IS NULL ORDER BY name")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(SubCategory {
                id: row.get(0)?,
                category_id: row.get(1)?,
                name: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_sub_category(db: State<Db>, category_id: String, name: String) -> Result<String, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO sub_categories (id, category_id, name) VALUES (?1, ?2, ?3)",
        params![id, category_id, name],
    )
    .map_err(|e| e.to_string())?;
    log_activity(&conn, "sub_category_added", "sub_categories", &id);
    Ok(id)
}

#[tauri::command]
pub fn update_sub_category(db: State<Db>, id: String, name: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("UPDATE sub_categories SET name = ?1 WHERE id = ?2", params![name, id])
        .map_err(|e| e.to_string())?;
    log_activity(&conn, "sub_category_updated", "sub_categories", &id);
    Ok(())
}

#[tauri::command]
pub fn delete_sub_category(db: State<Db>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE sub_categories SET deleted_at = datetime('now') WHERE id = ?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    log_activity(&conn, "sub_category_deleted", "sub_categories", &id);
    Ok(())
}

// ===================================================================
// Tags
// ===================================================================

#[tauri::command]
pub fn get_tags(db: State<Db>) -> Result<Vec<Tag>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name FROM tags ORDER BY name")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_tag(db: State<Db>, name: String) -> Result<String, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT OR IGNORE INTO tags (id, name) VALUES (?1, ?2)",
        params![id, name],
    )
    .map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
pub fn delete_tag(db: State<Db>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM expense_tags WHERE tag_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM tags WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// يحوّل ناتج group_concat (نص مفصول بفواصل أو NULL) إلى قائمة معرّفات.
fn split_ids(raw: Option<String>) -> Vec<String> {
    raw.map(|s| {
        s.split(',')
            .map(|p| p.trim())
            .filter(|p| !p.is_empty())
            .map(|p| p.to_string())
            .collect()
    })
    .unwrap_or_default()
}

/// يُعيد كتابة روابط الوسوم لمصروف واحد: حذف القديم ثم إدراج الجديد.
/// OR IGNORE يتجاهل أي tag_id غير موجود بدل أن يُفشل حفظ المصروف كله.
fn sync_expense_tags(
    conn: &rusqlite::Connection,
    expense_id: &str,
    tag_ids: &[String],
) -> Result<(), String> {
    conn.execute("DELETE FROM expense_tags WHERE expense_id = ?1", params![expense_id])
        .map_err(|e| e.to_string())?;
    for tag_id in tag_ids {
        conn.execute(
            "INSERT OR IGNORE INTO expense_tags (expense_id, tag_id)
             SELECT ?1, ?2 WHERE EXISTS (SELECT 1 FROM tags WHERE id = ?2)",
            params![expense_id, tag_id],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ===================================================================
// Expenses
// ===================================================================

#[tauri::command]
pub fn get_expenses(db: State<Db>, limit: i64, offset: i64) -> Result<Vec<ExpenseWithDetails>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT e.id, e.name, e.date, e.amount, e.category_id, c.name, c.color,
                    e.sub_category_id, e.payment_method_id, p.name, e.description,
                    (SELECT group_concat(tag_id) FROM expense_tags WHERE expense_id = e.id)
             FROM expenses e
             LEFT JOIN categories c ON c.id = e.category_id
             LEFT JOIN payment_methods p ON p.id = e.payment_method_id
             WHERE e.deleted_at IS NULL
             ORDER BY e.date DESC, e.created_at DESC
             LIMIT ?1 OFFSET ?2",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![limit, offset], |row| {
            Ok(ExpenseWithDetails {
                id: row.get(0)?,
                name: row.get(1)?,
                date: row.get(2)?,
                amount: row.get(3)?,
                category_id: row.get(4)?,
                category_name: row.get(5)?,
                category_color: row.get(6)?,
                sub_category_id: row.get(7)?,
                payment_method_id: row.get(8)?,
                payment_method_name: row.get(9)?,
                description: row.get(10)?,
                tag_ids: split_ids(row.get(11)?),
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// نفس get_expenses لكن تشمل سجلات Recycle Bin (deleted_at IS NOT NULL) - تُستخدم في شاشة سلة المهملات
#[tauri::command]
pub fn get_deleted_expenses(db: State<Db>) -> Result<Vec<ExpenseWithDetails>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT e.id, e.name, e.date, e.amount, e.category_id, c.name, c.color,
                    e.sub_category_id, e.payment_method_id, p.name, e.description,
                    (SELECT group_concat(tag_id) FROM expense_tags WHERE expense_id = e.id)
             FROM expenses e
             LEFT JOIN categories c ON c.id = e.category_id
             LEFT JOIN payment_methods p ON p.id = e.payment_method_id
             WHERE e.deleted_at IS NOT NULL
             ORDER BY e.deleted_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(ExpenseWithDetails {
                id: row.get(0)?,
                name: row.get(1)?,
                date: row.get(2)?,
                amount: row.get(3)?,
                category_id: row.get(4)?,
                category_name: row.get(5)?,
                category_color: row.get(6)?,
                sub_category_id: row.get(7)?,
                payment_method_id: row.get(8)?,
                payment_method_name: row.get(9)?,
                description: row.get(10)?,
                tag_ids: split_ids(row.get(11)?),
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn permanently_delete_expense(db: State<Db>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM expense_tags WHERE expense_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM expenses WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    log_activity(&conn, "expense_permanently_deleted", "expenses", &id);
    Ok(())
}

#[tauri::command]
pub fn add_expense(db: State<Db>, expense: Expense) -> Result<String, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let id = if expense.id.is_empty() { Uuid::new_v4().to_string() } else { expense.id };

    conn.execute(
        "INSERT INTO expenses (id, name, date, amount, category_id, sub_category_id, payment_method_id, description)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            id, expense.name, expense.date, expense.amount,
            expense.category_id, expense.sub_category_id,
            expense.payment_method_id, expense.description
        ],
    )
    .map_err(|e| e.to_string())?;

    sync_expense_tags(&conn, &id, &expense.tag_ids)?;
    log_activity(&conn, "expense_added", "expenses", &id);
    Ok(id)
}

#[tauri::command]
pub fn update_expense(db: State<Db>, expense: Expense) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE expenses SET name=?1, date=?2, amount=?3, category_id=?4, sub_category_id=?5,
         payment_method_id=?6, description=?7 WHERE id = ?8",
        params![
            expense.name, expense.date, expense.amount, expense.category_id,
            expense.sub_category_id, expense.payment_method_id, expense.description, expense.id
        ],
    )
    .map_err(|e| e.to_string())?;
    sync_expense_tags(&conn, &expense.id, &expense.tag_ids)?;
    log_activity(&conn, "expense_updated", "expenses", &expense.id);
    Ok(())
}

/// حذف ناعم -> يظهر في Recycle Bin، يمكن استرجاعه
#[tauri::command]
pub fn soft_delete_expense(db: State<Db>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("UPDATE expenses SET deleted_at = datetime('now') WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    log_activity(&conn, "expense_deleted", "expenses", &id);
    Ok(())
}

#[tauri::command]
pub fn restore_expense(db: State<Db>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("UPDATE expenses SET deleted_at = NULL WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    log_activity(&conn, "expense_restored", "expenses", &id);
    Ok(())
}

// ===================================================================
// Dashboard
// ===================================================================

#[tauri::command]
pub fn get_dashboard_summary(db: State<Db>) -> Result<DashboardSummary, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let total_today: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE date = date('now') AND deleted_at IS NULL",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let total_this_month: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM expenses
             WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now') AND deleted_at IS NULL",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let total_this_year: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM expenses
             WHERE strftime('%Y', date) = strftime('%Y', 'now') AND deleted_at IS NULL",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let expense_count_this_month: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM expenses
             WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now') AND deleted_at IS NULL",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let biggest_expense: f64 = conn
        .query_row(
            "SELECT COALESCE(MAX(amount), 0) FROM expenses
             WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now') AND deleted_at IS NULL",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let top_category: Option<String> = conn
        .query_row(
            "SELECT c.name FROM expenses e JOIN categories c ON c.id = e.category_id
             WHERE strftime('%Y-%m', e.date) = strftime('%Y-%m', 'now') AND e.deleted_at IS NULL
             GROUP BY c.id ORDER BY SUM(e.amount) DESC LIMIT 1",
            [],
            |r| r.get(0),
        )
        .ok();

    let days_passed = chrono::Local::now().format("%d").to_string().parse::<f64>().unwrap_or(1.0);
    let daily_average = if days_passed > 0.0 { total_this_month / days_passed } else { 0.0 };

    Ok(DashboardSummary {
        total_today,
        total_this_month,
        total_this_year,
        expense_count_this_month,
        daily_average,
        biggest_expense,
        top_category,
    })
}

// ===================================================================
// Security (Argon2id - تشفير حقيقي في طبقة Rust، أبداً في الواجهة)
// ===================================================================

#[tauri::command]
pub fn is_password_enabled(db: State<Db>) -> Result<bool, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let enabled: i32 = conn
        .query_row("SELECT password_enabled FROM security WHERE id = 1", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    Ok(enabled == 1)
}

#[tauri::command]
pub fn set_password(db: State<Db>, new_password: String) -> Result<String, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let hash = security::hash_password(&new_password);

    // توليد Recovery Code: مجموعتين من 6 أحرف/أرقام عشوائية، مثل ABCD12-EF34GH
    let recovery_code = security::generate_recovery_code();
    let recovery_hash = security::hash_password(&recovery_code);

    conn.execute(
        "UPDATE security SET password_hash = ?1, password_enabled = 1, recovery_code_hash = ?2, last_changed_at = datetime('now') WHERE id = 1",
        params![hash, recovery_hash],
    )
    .map_err(|e| e.to_string())?;
    log_activity(&conn, "password_changed", "security", "1");

    // يُعاد للمستخدم مرة واحدة فقط هنا؛ لا يمكن استرجاعه لاحقاً لأن قاعدة البيانات تخزن الـ hash فقط
    Ok(recovery_code)
}

/// إعادة تعيين الباسورد عبر Recovery Code بدلاً من الباسورد القديم (لمن نسي كلمة السر)
#[tauri::command]
pub fn reset_password_with_recovery_code(db: State<Db>, recovery_code: String, new_password: String) -> Result<String, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let stored_hash: Option<String> = conn
        .query_row("SELECT recovery_code_hash FROM security WHERE id = 1", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;

    let valid = match &stored_hash {
        Some(h) => security::verify_password(&recovery_code.trim().to_uppercase(), h),
        None => false,
    };
    if !valid {
        return Err("Invalid recovery code.".to_string());
    }

    let new_hash = security::hash_password(&new_password);
    let new_recovery_code = security::generate_recovery_code();
    let new_recovery_hash = security::hash_password(&new_recovery_code);

    conn.execute(
        "UPDATE security SET password_hash = ?1, recovery_code_hash = ?2, last_changed_at = datetime('now') WHERE id = 1",
        params![new_hash, new_recovery_hash],
    )
    .map_err(|e| e.to_string())?;
    log_activity(&conn, "password_reset_via_recovery", "security", "1");

    Ok(new_recovery_code)
}

#[tauri::command]
pub fn verify_password(db: State<Db>, password: String) -> Result<bool, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let hash: Option<String> = conn
        .query_row("SELECT password_hash FROM security WHERE id = 1", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;

    match hash {
        Some(h) => Ok(security::verify_password(&password, &h)),
        None => Ok(true), // لا يوجد باسورد مفعّل = دخول مفتوح
    }
}

#[tauri::command]
pub fn disable_password(db: State<Db>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE security SET password_hash = NULL, password_enabled = 0 WHERE id = 1",
        [],
    )
    .map_err(|e| e.to_string())?;
    log_activity(&conn, "password_disabled", "security", "1");
    Ok(())
}

#[tauri::command]
pub fn get_auto_lock_minutes(db: State<Db>) -> Result<Option<i64>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.query_row("SELECT auto_lock_minutes FROM security WHERE id = 1", [], |r| r.get(0))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_auto_lock_minutes(db: State<Db>, minutes: Option<i64>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("UPDATE security SET auto_lock_minutes = ?1 WHERE id = 1", params![minutes])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ===================================================================
// Budgets
// ===================================================================

#[tauri::command]
pub fn get_budgets(db: State<Db>) -> Result<Vec<Budget>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT b.id, b.category_id, c.name, b.amount, b.period, b.pinned
             FROM budgets b LEFT JOIN categories c ON c.id = b.category_id
             WHERE b.deleted_at IS NULL",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(Budget {
                id: row.get(0)?,
                category_id: row.get(1)?,
                category_name: row.get(2)?,
                amount: row.get(3)?,
                period: row.get(4)?,
                pinned: row.get::<_, i32>(5)? == 1,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn toggle_budget_pin(db: State<Db>, id: String, pinned: bool) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE budgets SET pinned = ?1 WHERE id = ?2",
        params![if pinned { 1 } else { 0 }, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn set_budget(db: State<Db>, category_id: Option<String>, amount: f64, period: String) -> Result<String, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO budgets (id, category_id, amount, period, start_date) VALUES (?1, ?2, ?3, ?4, date('now'))",
        params![id, category_id, amount, period],
    )
    .map_err(|e| e.to_string())?;
    log_activity(&conn, "budget_changed", "budgets", &id);
    Ok(id)
}

#[tauri::command]
pub fn delete_budget(db: State<Db>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("UPDATE budgets SET deleted_at = datetime('now') WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn is_budgets_enabled(db: State<Db>) -> Result<bool, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let val: String = conn
        .query_row("SELECT value FROM app_settings WHERE key = 'budgets_enabled'", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    Ok(val == "1")
}

#[tauri::command]
pub fn set_budgets_enabled(db: State<Db>, enabled: bool) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO app_settings (key, value) VALUES ('budgets_enabled', ?1)
         ON CONFLICT(key) DO UPDATE SET value = ?1",
        params![if enabled { "1" } else { "0" }],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ===================================================================
// Savings Goals
// ===================================================================

#[tauri::command]
pub fn get_savings_goals(db: State<Db>) -> Result<Vec<SavingsGoal>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, target_amount, current_amount, target_date, pinned FROM savings_goals WHERE deleted_at IS NULL")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(SavingsGoal {
                id: row.get(0)?,
                name: row.get(1)?,
                target_amount: row.get(2)?,
                current_amount: row.get(3)?,
                target_date: row.get(4)?,
                pinned: row.get::<_, i32>(5)? == 1,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn toggle_savings_goal_pin(db: State<Db>, id: String, pinned: bool) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE savings_goals SET pinned = ?1 WHERE id = ?2",
        params![if pinned { 1 } else { 0 }, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn create_savings_goal(db: State<Db>, name: String, target_amount: f64, target_date: Option<String>) -> Result<String, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO savings_goals (id, name, target_amount, target_date) VALUES (?1, ?2, ?3, ?4)",
        params![id, name, target_amount, target_date],
    )
    .map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
pub fn update_savings_goal_progress(db: State<Db>, id: String, current_amount: f64) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("UPDATE savings_goals SET current_amount = ?1 WHERE id = ?2", params![current_amount, id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_savings_goal(db: State<Db>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("UPDATE savings_goals SET deleted_at = datetime('now') WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ===================================================================
// Recurring Expenses (تأكيد يدوي - لا توليد آلي)
// ===================================================================

#[tauri::command]
pub fn get_recurring_expenses(db: State<Db>) -> Result<Vec<RecurringExpense>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, name, amount, category_id, payment_method_id, frequency, next_due_date, is_active
             FROM recurring_expenses WHERE deleted_at IS NULL",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(RecurringExpense {
                id: row.get(0)?,
                name: row.get(1)?,
                amount: row.get(2)?,
                category_id: row.get(3)?,
                payment_method_id: row.get(4)?,
                frequency: row.get(5)?,
                next_due_date: row.get(6)?,
                is_active: row.get::<_, i32>(7)? == 1,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_recurring_expense(
    db: State<Db>, name: String, amount: f64, category_id: Option<String>,
    payment_method_id: Option<String>, frequency: String, start_date: String,
) -> Result<String, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO recurring_expenses (id, name, amount, category_id, payment_method_id, frequency, start_date, next_due_date)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)",
        params![id, name, amount, category_id, payment_method_id, frequency, start_date],
    )
    .map_err(|e| e.to_string())?;
    Ok(id)
}

/// تأكيد المعاملة المتكررة يدوياً => تُنشئ Expense فعلي وتحرّك next_due_date للمرة القادمة
#[tauri::command]
pub fn confirm_recurring_expense(db: State<Db>, recurring_id: String, date: String) -> Result<String, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let (name, amount, category_id, payment_method_id, frequency): (String, f64, Option<String>, Option<String>, String) = conn
        .query_row(
            "SELECT name, amount, category_id, payment_method_id, frequency FROM recurring_expenses WHERE id = ?1",
            params![recurring_id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)),
        )
        .map_err(|e| e.to_string())?;

    let expense_id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO expenses (id, name, date, amount, category_id, payment_method_id, recurring_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![expense_id, name, date, amount, category_id, payment_method_id, recurring_id],
    )
    .map_err(|e| e.to_string())?;

    let next_due = match frequency.as_str() {
        "daily" => "date(next_due_date, '+1 day')",
        "weekly" => "date(next_due_date, '+7 day')",
        "monthly" => "date(next_due_date, '+1 month')",
        _ => "date(next_due_date, '+1 year')",
    };
    conn.execute(
        &format!("UPDATE recurring_expenses SET next_due_date = {} WHERE id = ?1", next_due),
        params![recurring_id],
    )
    .map_err(|e| e.to_string())?;

    log_activity(&conn, "expense_added", "expenses", &expense_id);
    Ok(expense_id)
}

#[tauri::command]
pub fn delete_recurring_expense(db: State<Db>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("UPDATE recurring_expenses SET deleted_at = datetime('now') WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ===================================================================
// Activity Log (للعرض في الواجهة)
// ===================================================================

#[derive(Serialize, Deserialize)]
pub struct ActivityLogEntry {
    pub id: String,
    pub action_type: String,
    pub table_name: Option<String>,
    pub created_at: String,
}

#[tauri::command]
pub fn get_activity_log(db: State<Db>, limit: i64) -> Result<Vec<ActivityLogEntry>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, action_type, table_name, created_at FROM activity_log ORDER BY created_at DESC LIMIT ?1")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![limit], |row| {
            Ok(ActivityLogEntry {
                id: row.get(0)?,
                action_type: row.get(1)?,
                table_name: row.get(2)?,
                created_at: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

// ===================================================================
// Backup & Restore (JSON كامل لكل قاعدة البيانات)
// ===================================================================

#[tauri::command]
pub fn export_backup_json(db: State<Db>) -> Result<String, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let dump_table = |table: &str, cols: &str| -> Result<Vec<serde_json::Value>, String> {
        let sql = format!("SELECT {} FROM {}", cols, table);
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let col_names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
        let n = col_names.len();
        let rows = stmt
            .query_map([], |row| {
                let mut obj = serde_json::Map::new();
                for i in 0..n {
                    let val: rusqlite::types::Value = row.get(i)?;
                    let json_val = match val {
                        rusqlite::types::Value::Null => serde_json::Value::Null,
                        rusqlite::types::Value::Integer(n) => serde_json::json!(n),
                        rusqlite::types::Value::Real(f) => serde_json::json!(f),
                        rusqlite::types::Value::Text(s) => serde_json::json!(s),
                        rusqlite::types::Value::Blob(_) => serde_json::Value::Null,
                    };
                    obj.insert(col_names[i].clone(), json_val);
                }
                Ok(serde_json::Value::Object(obj))
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    };

    let backup = serde_json::json!({
        "version": 1,
        "exported_at": chrono::Local::now().to_rfc3339(),
        "categories": dump_table("categories", "*")?,
        "sub_categories": dump_table("sub_categories", "*")?,
        "payment_methods": dump_table("payment_methods", "*")?,
        "tags": dump_table("tags", "*")?,
        "expenses": dump_table("expenses", "id,name,date,amount,category_id,sub_category_id,payment_method_id,description,recurring_id,created_at,updated_at,deleted_at")?,
        "expense_tags": dump_table("expense_tags", "*")?,
        "budgets": dump_table("budgets", "*")?,
        "savings_goals": dump_table("savings_goals", "*")?,
        "recurring_expenses": dump_table("recurring_expenses", "*")?,
        "planned_purchases": dump_table("planned_purchases", "*")?,
    });

    log_activity(&conn, "backup_created", "app", "-");
    serde_json::to_string_pretty(&backup).map_err(|e| e.to_string())
}

/// استرجاع نسخة احتياطية.
///
/// كل العملية داخل transaction واحدة: الحذف والاستيراد يثبتان معاً أو لا يحدث
/// أي منهما. لو فشل أي INSERT في المنتصف (صف تالف، مبلغ غير رقمي، مفتاح أجنبي
/// مكسور) يُلغى الـ transaction تلقائياً عند الـ drop وتعود قاعدة البيانات
/// كما كانت تماماً قبل الاسترجاع.
///
/// وتُستورد كل الجداول الموجودة في ملف النسخة، لا ثلاثة منها فقط. ترتيب
/// الإدراج يحترم المفاتيح الأجنبية: الفئات ثم الفئات الفرعية ثم طرق الدفع
/// ثم الوسوم ثم المتكررة ثم المصروفات ثم الربط ثم الباقي.
#[tauri::command]
pub fn import_backup_json(db: State<Db>, json_data: String) -> Result<(), String> {
    let data: serde_json::Value = serde_json::from_str(&json_data).map_err(|e| e.to_string())?;
    let mut conn = db.0.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // وقت افتراضي لأي created_at ناقص في الملف. تمرير NULL صراحةً يكسر قيد
    // NOT NULL لأن DEFAULT في SQLite لا يعمل إلا لو العمود محذوف من الـ INSERT.
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let ts = |v: &serde_json::Value| -> String { v.as_str().unwrap_or(&now).to_string() };

    // expense_tags أولاً: هو الطرف التابع لكل من expenses و tags،
    // وبدون حذفه يفشل حذفهما تحت PRAGMA foreign_keys = ON.
    tx.execute_batch(
        "DELETE FROM expense_tags; DELETE FROM planned_purchases; DELETE FROM expenses;
         DELETE FROM budgets; DELETE FROM savings_goals; DELETE FROM recurring_expenses;
         DELETE FROM sub_categories; DELETE FROM categories;
         DELETE FROM payment_methods; DELETE FROM tags;",
    )
    .map_err(|e| e.to_string())?;

    /* ---------- Categories ---------- */
    if let Some(rows) = data["categories"].as_array() {
        for c in rows {
            tx.execute(
                "INSERT INTO categories (id, name, icon, color, sort_order, created_at, deleted_at)
                 VALUES (?1,?2,?3,?4,?5,?6,?7)",
                params![
                    c["id"].as_str(), c["name"].as_str(), c["icon"].as_str(), c["color"].as_str(),
                    c["sort_order"].as_i64().unwrap_or(0), ts(&c["created_at"]), c["deleted_at"].as_str()
                ],
            ).map_err(|e| e.to_string())?;
        }
    }

    /* ---------- Sub categories ---------- */
    if let Some(rows) = data["sub_categories"].as_array() {
        for s in rows {
            tx.execute(
                "INSERT INTO sub_categories (id, category_id, name, created_at, deleted_at)
                 VALUES (?1,?2,?3,?4,?5)",
                params![
                    s["id"].as_str(), s["category_id"].as_str(), s["name"].as_str(),
                    ts(&s["created_at"]), s["deleted_at"].as_str()
                ],
            ).map_err(|e| e.to_string())?;
        }
    }

    /* ---------- Payment methods ---------- */
    if let Some(rows) = data["payment_methods"].as_array() {
        for p in rows {
            tx.execute(
                "INSERT INTO payment_methods (id, name, icon, sort_order, created_at, deleted_at)
                 VALUES (?1,?2,?3,?4,?5,?6)",
                params![
                    p["id"].as_str(), p["name"].as_str(), p["icon"].as_str(),
                    p["sort_order"].as_i64().unwrap_or(0), ts(&p["created_at"]), p["deleted_at"].as_str()
                ],
            ).map_err(|e| e.to_string())?;
        }
    }

    /* ---------- Tags ---------- */
    if let Some(rows) = data["tags"].as_array() {
        for t in rows {
            tx.execute(
                "INSERT INTO tags (id, name) VALUES (?1,?2)",
                params![t["id"].as_str(), t["name"].as_str()],
            ).map_err(|e| e.to_string())?;
        }
    }

    /* ---------- Recurring expenses (قبل المصروفات: recurring_id يشير إليها) ---------- */
    if let Some(rows) = data["recurring_expenses"].as_array() {
        for r in rows {
            let start = r["start_date"].as_str().unwrap_or("").to_string();
            tx.execute(
                "INSERT INTO recurring_expenses
                    (id, name, amount, category_id, sub_category_id, payment_method_id,
                     frequency, start_date, end_date, next_due_date, is_active, created_at, deleted_at)
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)",
                params![
                    r["id"].as_str(), r["name"].as_str(), r["amount"].as_f64().unwrap_or(0.0),
                    r["category_id"].as_str(), r["sub_category_id"].as_str(), r["payment_method_id"].as_str(),
                    r["frequency"].as_str().unwrap_or("monthly"), start,
                    r["end_date"].as_str(),
                    r["next_due_date"].as_str().unwrap_or(r["start_date"].as_str().unwrap_or("")),
                    r["is_active"].as_i64().unwrap_or(1),
                    ts(&r["created_at"]), r["deleted_at"].as_str()
                ],
            ).map_err(|e| e.to_string())?;
        }
    }

    /* ---------- Expenses ---------- */
    if let Some(rows) = data["expenses"].as_array() {
        for e in rows {
            let date = e["date"].as_str().unwrap_or("").to_string();
            // لو الـ id غير موجود أو فارغ (ملف JSON خارجي بدون IDs) نولّد واحداً بصيغة EXP-YYMMDD-XXXXXX.
            // أما الـ IDs الصحيحة الموجودة بالفعل (نسخ احتياطية حقيقية) فتبقى كما هي بدون أي تغيير.
            let id: String = match e["id"].as_str() {
                Some(s) if !s.trim().is_empty() => s.to_string(),
                _ => security::generate_expense_id(&date),
            };
            tx.execute(
                "INSERT INTO expenses (id, name, date, amount, category_id, sub_category_id, payment_method_id, description, recurring_id, created_at, updated_at, deleted_at)
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)",
                params![
                    id, e["name"].as_str(), date, e["amount"].as_f64(),
                    e["category_id"].as_str(), e["sub_category_id"].as_str(), e["payment_method_id"].as_str(),
                    e["description"].as_str(), e["recurring_id"].as_str(),
                    ts(&e["created_at"]), ts(&e["updated_at"]), e["deleted_at"].as_str()
                ],
            ).map_err(|err| err.to_string())?;
        }
    }

    /* ---------- Expense ↔ Tag links ---------- */
    if let Some(rows) = data["expense_tags"].as_array() {
        for l in rows {
            // INSERT OR IGNORE: نسخة فيها ربط لمصروف تم توليد id جديد له
            // (ملف خارجي بلا IDs) لن توقف الاسترجاع كله بسبب مفتاح أجنبي مكسور.
            tx.execute(
                "INSERT OR IGNORE INTO expense_tags (expense_id, tag_id)
                 SELECT ?1, ?2 WHERE EXISTS (SELECT 1 FROM expenses WHERE id = ?1)
                              AND EXISTS (SELECT 1 FROM tags WHERE id = ?2)",
                params![l["expense_id"].as_str(), l["tag_id"].as_str()],
            ).map_err(|e| e.to_string())?;
        }
    }

    /* ---------- Budgets ---------- */
    if let Some(rows) = data["budgets"].as_array() {
        for b in rows {
            tx.execute(
                "INSERT INTO budgets (id, category_id, amount, period, start_date, created_at, deleted_at, pinned)
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
                params![
                    b["id"].as_str(), b["category_id"].as_str(), b["amount"].as_f64().unwrap_or(0.0),
                    b["period"].as_str().unwrap_or("monthly"),
                    b["start_date"].as_str().unwrap_or(&now[..10]),
                    ts(&b["created_at"]), b["deleted_at"].as_str(),
                    b["pinned"].as_i64().unwrap_or(0)
                ],
            ).map_err(|e| e.to_string())?;
        }
    }

    /* ---------- Savings goals ---------- */
    if let Some(rows) = data["savings_goals"].as_array() {
        for g in rows {
            tx.execute(
                "INSERT INTO savings_goals (id, name, target_amount, current_amount, target_date, created_at, deleted_at, pinned)
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
                params![
                    g["id"].as_str(), g["name"].as_str(),
                    g["target_amount"].as_f64().unwrap_or(0.0),
                    g["current_amount"].as_f64().unwrap_or(0.0),
                    g["target_date"].as_str(), ts(&g["created_at"]), g["deleted_at"].as_str(),
                    g["pinned"].as_i64().unwrap_or(0)
                ],
            ).map_err(|e| e.to_string())?;
        }
    }

    /* ---------- Planned purchases (بعد المصروفات: converted_expense_id يشير إليها) ---------- */
    if let Some(rows) = data["planned_purchases"].as_array() {
        for p in rows {
            tx.execute(
                "INSERT INTO planned_purchases
                    (id, name, estimated_amount, category_id, payment_method_id, target_date,
                     priority, notes, status, converted_expense_id, purchased_at, created_at, deleted_at)
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)",
                params![
                    p["id"].as_str(), p["name"].as_str(), p["estimated_amount"].as_f64(),
                    p["category_id"].as_str(), p["payment_method_id"].as_str(), p["target_date"].as_str(),
                    p["priority"].as_i64().unwrap_or(2), p["notes"].as_str(),
                    p["status"].as_str().unwrap_or("planned"), p["converted_expense_id"].as_str(),
                    p["purchased_at"].as_str(), ts(&p["created_at"]), p["deleted_at"].as_str()
                ],
            ).map_err(|e| e.to_string())?;
        }
    }

    log_activity(&tx, "backup_restored", "app", "-");
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

/* ============================================================
   Splash Screen — يُستدعى من الواجهة بعد أول رسم كامل لـ React
   لإظهار النافذة الرئيسية بسلاسة وإغلاق نافذة splash المؤقتة
   ============================================================ */
#[tauri::command]
pub async fn close_splashscreen(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    // نوقف مؤقّت الثماني ثوانٍ: الواجهة وصلت لأول رسم كامل فلا حاجة له
    if let Some(guard) = app.try_state::<crate::SplashGuard>() {
        guard.0.store(true, std::sync::atomic::Ordering::Relaxed);
    }
    if let Some(splash) = app.get_webview_window("splashscreen") {
        let _ = splash.close();
    }
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.set_focus();
    }
    Ok(())
}

#[tauri::command]
pub fn delete_all_data(db: State<Db>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute_batch(
        "DELETE FROM expense_tags; DELETE FROM planned_purchases; DELETE FROM expenses;
         DELETE FROM budgets; DELETE FROM savings_goals;
         DELETE FROM recurring_expenses; DELETE FROM sub_categories;
         DELETE FROM categories; DELETE FROM payment_methods; DELETE FROM tags;
         DELETE FROM activity_log;",
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/* ============================================================
   Backup Location & File System — لاختيار مكان حفظ النسخ الاحتياطية
   والكتابة الفعلية على القرص (بدل الاعتماد على تنزيل المتصفح فقط)
   ============================================================ */

/// يفتح Folder Picker حقيقي من نظام Windows ويرجع المسار المختار (أو None لو المستخدم ألغى)
#[tauri::command]
pub async fn pick_backup_folder(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let folder = app.dialog().file().blocking_pick_folder();
    Ok(folder.map(|p| p.to_string()))
}

/// يفتح مجلد معيّن في File Explorer الخاص بويندوز
#[tauri::command]
pub fn open_folder_in_explorer(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = &path; // تجنّب تحذير unused في أنظمة التطوير غير ويندوز
    }
    Ok(())
}

/// يتحقق أن المجلد موجود وقابل للكتابة فعلياً (وليس مجرد افتراض)، عبر محاولة كتابة ملف اختبار صغير وحذفه فوراً.
/// هذا يغطي كل الحالات الخطرة: المجلد محذوف، القرص الخارجي مفصول، أو صلاحيات الكتابة غير متاحة.
#[tauri::command]
pub fn check_folder_writable(path: String) -> Result<bool, String> {
    let dir = std::path::Path::new(&path);
    if !dir.exists() || !dir.is_dir() {
        return Ok(false);
    }
    let test_file = dir.join(".expense_manager_write_test.tmp");
    match std::fs::write(&test_file, b"test") {
        Ok(_) => {
            let _ = std::fs::remove_file(&test_file); // تنظيف فوري، تجاهل خطأ الحذف لو حصل (غير مؤثر)
            Ok(true)
        }
        Err(_) => Ok(false),
    }
}

/// يكتب ملف Backup فعلياً في المسار المحدد. يتحقق أولاً من إمكانية الكتابة
/// فيرجع رسالة خطأ واضحة بدل Crash لو المجلد غير متاح (محذوف/قرص خارجي مفصول/بدون صلاحية).
#[tauri::command]
pub fn write_backup_file(folder: String, filename: String, content: Vec<u8>) -> Result<String, String> {
    let dir = std::path::Path::new(&folder);
    if !dir.exists() || !dir.is_dir() {
        return Err(format!("Backup folder is not available: {}", folder));
    }
    let full_path = dir.join(&filename);
    std::fs::write(&full_path, content)
        .map_err(|e| format!("Failed to write backup file (folder may be read-only or disconnected): {}", e))?;
    Ok(full_path.to_string_lossy().to_string())
}

/// إعدادات عامة للتطبيق (key-value) — تُستخدم لحفظ مسار مجلد الـ Backup بشكل دائم عبر إعادة التشغيل
#[tauri::command]
pub fn get_app_setting(db: State<Db>, key: String) -> Result<Option<String>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.query_row("SELECT value FROM app_settings WHERE key = ?1", params![key], |r| r.get(0))
        .map_err(|e| e.to_string())
        .or(Ok(None))
}

#[tauri::command]
pub fn set_app_setting(db: State<Db>, key: String, value: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO app_settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
