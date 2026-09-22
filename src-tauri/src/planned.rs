use crate::db::Db;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

// ===================================================================
// Planned Purchases — التخطيط للشراء
// -------------------------------------------------------------------
// وحدة مستقلة عن commands.rs عمداً: الميزة قائمة بذاتها، وفصلها يخلي
// commands.rs (أكثر من 1100 سطر بالفعل) قابلاً للقراءة.
// ===================================================================

#[derive(Serialize, Deserialize)]
pub struct PlannedPurchase {
    pub id: String,
    pub name: String,
    pub estimated_amount: f64,
    pub category_id: Option<String>,
    pub category_name: Option<String>,
    pub category_color: Option<String>,
    pub payment_method_id: Option<String>,
    pub payment_method_name: Option<String>,
    pub target_date: Option<String>,
    pub priority: i32,
    pub notes: Option<String>,
    pub status: String,
    pub converted_expense_id: Option<String>,
    pub purchased_at: Option<String>,
    pub created_at: String,
}

#[derive(Serialize, Deserialize)]
pub struct PlannedPurchaseInput {
    pub name: String,
    pub estimated_amount: f64,
    pub category_id: Option<String>,
    pub payment_method_id: Option<String>,
    pub target_date: Option<String>,
    pub priority: i32,
    pub notes: Option<String>,
}

/// تحقّق مشترك بين الإنشاء والتعديل.
/// الرسائل هنا تُعرَض للمستخدم كما هي، فهي مكتوبة بلغة الواجهة لا بلغة قاعدة البيانات.
fn validate(input: &PlannedPurchaseInput) -> Result<(), String> {
    if input.name.trim().is_empty() {
        return Err("Enter a name for what you plan to buy.".into());
    }
    if input.name.trim().chars().count() > 120 {
        return Err("Keep the name under 120 characters.".into());
    }
    if !input.estimated_amount.is_finite() {
        return Err("Enter a valid price.".into());
    }
    if input.estimated_amount <= 0.0 {
        return Err("Enter a price greater than zero.".into());
    }
    if input.estimated_amount > 1_000_000_000.0 {
        return Err("That price is too large to record.".into());
    }
    if let Some(d) = &input.target_date {
        if !d.is_empty() && d.len() != 10 {
            return Err("Use the date format YYYY-MM-DD.".into());
        }
    }
    if !(1..=3).contains(&input.priority) {
        return Err("Priority must be low, normal, or high.".into());
    }
    Ok(())
}

const SELECT_SQL: &str = "
    SELECT p.id, p.name, p.estimated_amount,
           p.category_id, c.name, c.color,
           p.payment_method_id, m.name,
           p.target_date, p.priority, p.notes, p.status,
           p.converted_expense_id, p.purchased_at, p.created_at
    FROM planned_purchases p
    LEFT JOIN categories      c ON c.id = p.category_id
    LEFT JOIN payment_methods m ON m.id = p.payment_method_id
    WHERE p.deleted_at IS NULL
    ORDER BY
        CASE p.status WHEN 'planned' THEN 0 WHEN 'purchased' THEN 1 ELSE 2 END,
        p.priority DESC,
        COALESCE(p.target_date, '9999-12-31') ASC,
        p.created_at DESC
";

#[tauri::command]
pub fn get_planned_purchases(db: State<Db>) -> Result<Vec<PlannedPurchase>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(SELECT_SQL).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(PlannedPurchase {
                id: r.get(0)?,
                name: r.get(1)?,
                estimated_amount: r.get(2)?,
                category_id: r.get(3)?,
                category_name: r.get(4)?,
                category_color: r.get(5)?,
                payment_method_id: r.get(6)?,
                payment_method_name: r.get(7)?,
                target_date: r.get(8)?,
                priority: r.get(9)?,
                notes: r.get(10)?,
                status: r.get(11)?,
                converted_expense_id: r.get(12)?,
                purchased_at: r.get(13)?,
                created_at: r.get(14)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_planned_purchase(db: State<Db>, input: PlannedPurchaseInput) -> Result<String, String> {
    validate(&input)?;
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let target = input.target_date.filter(|d| !d.is_empty());

    conn.execute(
        "INSERT INTO planned_purchases
            (id, name, estimated_amount, category_id, payment_method_id, target_date, priority, notes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            id,
            input.name.trim(),
            input.estimated_amount,
            input.category_id,
            input.payment_method_id,
            target,
            input.priority,
            input.notes.filter(|n| !n.trim().is_empty()),
        ],
    )
    .map_err(|e| e.to_string())?;

    crate::commands::log_activity(&conn, "planned_added", "planned_purchases", &id);
    Ok(id)
}

#[tauri::command]
pub fn update_planned_purchase(
    db: State<Db>,
    id: String,
    input: PlannedPurchaseInput,
) -> Result<(), String> {
    validate(&input)?;
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    // خطة تحوّلت بالفعل لمصروف لا تُعدّل — وإلا انفصل السعر المخطط عن
    // المصروف المسجّل وأصبحت مقارنة "المتوقّع مقابل الفعلي" كذباً.
    let status: String = conn
        .query_row(
            "SELECT status FROM planned_purchases WHERE id = ?1 AND deleted_at IS NULL",
            params![id],
            |r| r.get(0),
        )
        .map_err(|_| "That plan no longer exists.".to_string())?;
    if status == "purchased" {
        return Err("This plan was already converted to an expense. Edit the expense instead.".into());
    }

    conn.execute(
        "UPDATE planned_purchases
         SET name = ?1, estimated_amount = ?2, category_id = ?3, payment_method_id = ?4,
             target_date = ?5, priority = ?6, notes = ?7
         WHERE id = ?8",
        params![
            input.name.trim(),
            input.estimated_amount,
            input.category_id,
            input.payment_method_id,
            input.target_date.filter(|d| !d.is_empty()),
            input.priority,
            input.notes.filter(|n| !n.trim().is_empty()),
            id,
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// تحويل خطة إلى مصروف حقيقي.
///
/// `actual_amount` اختياري: لو المستخدم اشترى بسعر مختلف عن المتوقّع
/// نسجّل السعر الفعلي في المصروف ونُبقي السعر المتوقّع في الخطة، فيظل
/// فرق التقدير قابلاً للقياس لاحقاً.
///
/// العمليتان (إدراج المصروف + تحديث الخطة) داخل transaction واحدة:
/// انقطاع الكهرباء بينهما كان سيترك مصروفاً بلا خطة أو خطة بلا مصروف.
#[tauri::command]
pub fn convert_planned_to_expense(
    db: State<Db>,
    id: String,
    date: String,
    actual_amount: Option<f64>,
) -> Result<String, String> {
    let mut conn = db.0.lock().map_err(|e| e.to_string())?;

    if date.len() != 10 {
        return Err("Use the date format YYYY-MM-DD.".into());
    }
    if let Some(a) = actual_amount {
        if !a.is_finite() || a <= 0.0 {
            return Err("Enter the amount you actually paid.".into());
        }
    }

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let (name, estimated, category_id, payment_method_id, status): (
        String, f64, Option<String>, Option<String>, String,
    ) = tx
        .query_row(
            "SELECT name, estimated_amount, category_id, payment_method_id, status
             FROM planned_purchases WHERE id = ?1 AND deleted_at IS NULL",
            params![id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)),
        )
        .map_err(|_| "That plan no longer exists.".to_string())?;

    if status == "purchased" {
        return Err("This plan was already converted to an expense.".into());
    }

    let amount = actual_amount.unwrap_or(estimated);
    let expense_id = Uuid::new_v4().to_string();

    tx.execute(
        "INSERT INTO expenses (id, name, date, amount, category_id, payment_method_id, description)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            expense_id,
            name,
            date,
            amount,
            category_id,
            payment_method_id,
            Some("Converted from a planned purchase"),
        ],
    )
    .map_err(|e| e.to_string())?;

    tx.execute(
        "UPDATE planned_purchases
         SET status = 'purchased', converted_expense_id = ?1, purchased_at = datetime('now')
         WHERE id = ?2",
        params![expense_id, id],
    )
    .map_err(|e| e.to_string())?;

    crate::commands::log_activity(&tx, "planned_converted", "planned_purchases", &id);
    crate::commands::log_activity(&tx, "expense_added", "expenses", &expense_id);

    tx.commit().map_err(|e| e.to_string())?;
    Ok(expense_id)
}

#[tauri::command]
pub fn cancel_planned_purchase(db: State<Db>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE planned_purchases SET status = 'cancelled'
         WHERE id = ?1 AND status = 'planned'",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn restore_planned_purchase(db: State<Db>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE planned_purchases SET status = 'planned'
         WHERE id = ?1 AND status = 'cancelled'",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_planned_purchase(db: State<Db>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE planned_purchases SET deleted_at = datetime('now') WHERE id = ?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
