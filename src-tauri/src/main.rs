// منع ظهور نافذة Console سوداء خلف التطبيق على ويندوز في نسخة Release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;
mod commands;
mod security;

use db::Db;
use std::sync::Mutex;
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // مسار قاعدة البيانات داخل AppData الخاص بالمستخدم (وليس داخل مجلد التطبيق)
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("تعذر تحديد مسار بيانات التطبيق");

            let db_path = db::get_db_path(&app_data_dir);
            let conn = db::init_db(&db_path);

            app.manage(Db(Mutex::new(conn)));

            // شبكة أمان: لو الواجهة لأي سبب غير متوقع لم تطلب إغلاق splash خلال 8 ثوانٍ
            // (مثال: خطأ JS مبكر يمنع React من الإقلاع)، نظهر النافذة الرئيسية تلقائياً
            // بدل ما يفضل المستخدم يشوف splash معلّقة للأبد بدون أي تفاعل ممكن.
            let app_handle = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_secs(8));
                if let Some(main) = app_handle.get_webview_window("main") {
                    if let Ok(false) = main.is_visible() {
                        let _ = main.show();
                        let _ = main.set_focus();
                        if let Some(splash) = app_handle.get_webview_window("splashscreen") {
                            let _ = splash.close();
                        }
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Backup Location & File System
            commands::pick_backup_folder,
            commands::open_folder_in_explorer,
            commands::check_folder_writable,
            commands::write_backup_file,
            commands::get_app_setting,
            commands::set_app_setting,
            commands::close_splashscreen,
            // Categories
            commands::get_categories,
            commands::create_category,
            commands::update_category,
            commands::delete_category,
            // Payment Methods
            commands::get_payment_methods,
            commands::create_payment_method,
            commands::update_payment_method,
            commands::delete_payment_method,
            // Sub Categories
            commands::get_sub_categories,
            commands::create_sub_category,
            commands::update_sub_category,
            commands::delete_sub_category,
            // Tags
            commands::get_tags,
            commands::create_tag,
            commands::delete_tag,
            // Expenses
            commands::get_expenses,
            commands::get_deleted_expenses,
            commands::add_expense,
            commands::update_expense,
            commands::soft_delete_expense,
            commands::restore_expense,
            commands::permanently_delete_expense,
            // Dashboard
            commands::get_dashboard_summary,
            // Security
            commands::is_password_enabled,
            commands::set_password,
            commands::verify_password,
            commands::reset_password_with_recovery_code,
            commands::disable_password,
            commands::get_auto_lock_minutes,
            commands::set_auto_lock_minutes,
            // Budgets
            commands::get_budgets,
            commands::set_budget,
            commands::delete_budget,
            commands::is_budgets_enabled,
            commands::set_budgets_enabled,
            commands::toggle_budget_pin,
            // Savings Goals
            commands::get_savings_goals,
            commands::create_savings_goal,
            commands::update_savings_goal_progress,
            commands::delete_savings_goal,
            commands::toggle_savings_goal_pin,
            // Recurring Expenses
            commands::get_recurring_expenses,
            commands::create_recurring_expense,
            commands::confirm_recurring_expense,
            commands::delete_recurring_expense,
            // Activity Log
            commands::get_activity_log,
            // Backup & Restore
            commands::export_backup_json,
            commands::import_backup_json,
            commands::delete_all_data,
        ])
        .run(tauri::generate_context!())
        .expect("خطأ أثناء تشغيل تطبيق Tauri");
}
