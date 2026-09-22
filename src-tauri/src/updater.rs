use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

// ===================================================================
// Offline Update — تحديث التطبيق بدون إنترنت وبدون إلغاء التثبيت
// -------------------------------------------------------------------
// التطبيق يُوزَّع كـ NSIS Setup.exe. تشغيل Setup.exe أحدث فوق تثبيت
// قائم يستبدل ملفات البرنامج في Program Files ويُبقي:
//
//   • قاعدة البيانات (AppData\Roaming\com.personal.expensemanager\expenses.db)
//   • مجلد النسخ الاحتياطية الذي اختاره المستخدم
//
// لأن أياً منهما لا يقع داخل مجلد التثبيت. الوحدة دي بتدي المستخدم
// الطريق ده من داخل التطبيق: يختار الملف من القرص/الفلاشة، نتحقق منه،
// ناخد نسخة احتياطية، نشغّل المثبّت، ونقفل التطبيق حتى لا يمنع استبدال
// الملفات المفتوحة.
//
// لا يوجد أي اتصال بالشبكة في هذا الملف — ولا في أي مكان آخر بالتطبيق.
// ===================================================================

#[derive(Serialize, Deserialize)]
pub struct UpdateFileInfo {
    pub path: String,
    pub file_name: String,
    pub size_bytes: u64,
    /// وقت تعديل الملف بصيغة ISO تقريبية (UTC) — للتفرقة بين نسختين بنفس الاسم
    pub modified: Option<String>,
    /// هل الاسم يشير لنسخة محمولة (Portable) بدل المثبّت؟
    pub is_portable: bool,
}

#[derive(Serialize, Deserialize)]
pub struct AppPaths {
    pub version: String,
    pub app_data_dir: String,
    pub db_path: String,
    pub exe_path: String,
    pub install_dir: String,
}

/// معلومات التثبيت الحالي: الإصدار ومكان البيانات ومكان البرنامج.
/// المستخدم محتاج يشوف المسارين بعينه قبل ما يثق إن التحديث مش هيمسح بياناته.
#[tauri::command]
pub fn get_app_paths(app: AppHandle) -> Result<AppPaths, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Could not resolve the app data folder: {e}"))?;

    let db_path = crate::db::get_db_path(&app_data_dir);

    let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
    let install_dir = exe_path
        .parent()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();

    Ok(AppPaths {
        version: app.package_info().version.to_string(),
        app_data_dir: app_data_dir.to_string_lossy().to_string(),
        db_path: db_path.to_string_lossy().to_string(),
        exe_path: exe_path.to_string_lossy().to_string(),
        install_dir,
    })
}

fn describe(path: &std::path::Path) -> Result<UpdateFileInfo, String> {
    let meta = std::fs::metadata(path)
        .map_err(|_| "That file is no longer available. Pick it again.".to_string())?;

    if !meta.is_file() {
        return Err("Pick the update file itself, not a folder.".into());
    }

    let file_name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    let ext_ok = path
        .extension()
        .map(|e| e.eq_ignore_ascii_case("exe"))
        .unwrap_or(false);
    if !ext_ok {
        return Err("The update file must be the .exe installer downloaded for this app.".into());
    }

    // مثبّت حقيقي حجمه عشرات الميجابايت. أي ملف أصغر من 2 ميجا هو على الأرجح
    // ملف مقطوع أو اختصار، وتشغيله كان هيفشل بعد ما المستخدم يقفل التطبيق.
    if meta.len() < 2 * 1024 * 1024 {
        return Err("That file is too small to be a valid installer — it may be incomplete.".into());
    }

    let modified = meta.modified().ok().and_then(|t| {
        t.duration_since(std::time::UNIX_EPOCH)
            .ok()
            .map(|d| d.as_secs().to_string())
    });

    let lower = file_name.to_lowercase();

    Ok(UpdateFileInfo {
        path: path.to_string_lossy().to_string(),
        file_name,
        size_bytes: meta.len(),
        modified,
        is_portable: lower.contains("portable"),
    })
}

/// يفتح File Picker حقيقي مقيّداً بملفات exe ويرجّع معلومات الملف المختار.
#[tauri::command]
pub async fn pick_update_file(app: AppHandle) -> Result<Option<UpdateFileInfo>, String> {
    use tauri_plugin_dialog::DialogExt;

    let picked = app
        .dialog()
        .file()
        .add_filter("Application installer", &["exe"])
        .blocking_pick_file();

    let Some(file) = picked else { return Ok(None) };

    let path = file
        .into_path()
        .map_err(|e| format!("Could not read the selected file path: {e}"))?;

    describe(&path).map(Some)
}

/// إعادة فحص الملف قبل التشغيل مباشرةً.
///
/// بين لحظة الاختيار ولحظة الضغط على "Install" ممكن تكون الفلاشة اتفصلت أو
/// الملف اتمسح. الفحص الثاني ده هو الفرق بين رسالة خطأ واضحة والتطبيق بيقفل
/// نفسه على أمل مثبّت مش هيشتغل.
#[tauri::command]
pub fn inspect_update_file(path: String) -> Result<UpdateFileInfo, String> {
    describe(std::path::Path::new(&path))
}

/// يشغّل المثبّت ثم يُغلق التطبيق.
///
/// الترتيب مهم: NSIS لا يقدر يستبدل exe مفتوح، فلو قفلنا بعد ما المثبّت بدأ
/// فعلاً يكون كل شيء جاهز. التأخير القصير يدي المثبّت وقت يرسم أول نافذة قبل
/// ما نافذتنا تختفي، وإلا المستخدم بيشوف التطبيق بيقفل وشاشة فاضية للحظة
/// فيفتكر إنه كراش.
#[tauri::command]
pub fn run_update_installer(app: AppHandle, path: String) -> Result<(), String> {
    let info = describe(std::path::Path::new(&path))?;

    if info.is_portable {
        return Err(
            "That looks like the Portable build. Close the app and replace the portable .exe manually, \
             or pick the Setup installer instead."
                .into(),
        );
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new(&info.path)
            .spawn()
            .map_err(|e| format!("Windows refused to start the installer: {e}"))?;

        let handle = app.clone();
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(1200));
            handle.exit(0);
        });
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = &app;
        return Err("Installing an update from a file is supported on Windows only.".into());
    }

    #[allow(unreachable_code)]
    Ok(())
}
