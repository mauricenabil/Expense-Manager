use rusqlite::Connection;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

pub struct Db(pub Mutex<Connection>);

/// مسار قاعدة البيانات داخل مجلد بيانات التطبيق (AppData)
/// مثال على ويندوز: C:\Users\<user>\AppData\Roaming\com.personal.expensemanager\expenses.db
pub fn get_db_path(app_data_dir: &PathBuf) -> PathBuf {
    if !app_data_dir.exists() {
        fs::create_dir_all(app_data_dir).expect("فشل إنشاء مجلد بيانات التطبيق");
    }
    app_data_dir.join("expenses.db")
}

/// تهيئة الاتصال + تفعيل إعدادات الاستقرار + تشغيل الـ Migrations
pub fn init_db(db_path: &PathBuf) -> Connection {
    let conn = Connection::open(db_path).expect("فشل فتح قاعدة البيانات");

    // إعدادات الاستقرار والأداء
    conn.execute_batch(
        "
        PRAGMA foreign_keys = ON;
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        ",
    )
    .expect("فشل تطبيق إعدادات PRAGMA");

    run_migrations(&conn);

    conn
}

/// نظام Migrations مرقّم - كل ملف يُشغَّل مرة واحدة فقط
/// يدعم التطوير المستقبلي: أضف 002_xyz.sql وسيُشغَّل تلقائياً عند التحديث القادم
fn run_migrations(conn: &Connection) {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
        [],
    )
    .unwrap();

    // قائمة الـ migrations المضمَّنة في التطبيق وقت البناء (compile-time include)
    let migrations: Vec<(i32, &str)> = vec![
        (1, include_str!("../migrations/001_initial.sql")),
        (2, include_str!("../migrations/002_recovery_code.sql")),
        (3, include_str!("../migrations/003_pinning.sql")),
        // (4, include_str!("../migrations/004_xxx.sql")),  <-- أضف هنا مستقبلاً
    ];

    for (version, sql) in migrations {
        let already_applied: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = ?1)",
                [version],
                |row| row.get(0),
            )
            .unwrap_or(false);

        if !already_applied {
            conn.execute_batch(sql)
                .unwrap_or_else(|e| panic!("فشل تطبيق migration رقم {}: {}", version, e));
            conn.execute(
                "INSERT INTO schema_migrations (version) VALUES (?1)",
                [version],
            )
            .unwrap();
        }
    }
}
