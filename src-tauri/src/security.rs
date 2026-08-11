use argon2::password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;

/// تشفير كلمة مرور جديدة (تُستخدم عند تفعيل القفل أو تغيير الباسورد)
pub fn hash_password(plain: &str) -> String {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    argon2
        .hash_password(plain.as_bytes(), &salt)
        .expect("فشل تشفير كلمة المرور")
        .to_string()
}

/// التحقق من كلمة المرور عند فتح التطبيق (Login / Unlock)
pub fn verify_password(plain: &str, hash: &str) -> bool {
    let parsed_hash = match PasswordHash::new(hash) {
        Ok(h) => h,
        Err(_) => return false,
    };
    Argon2::default()
        .verify_password(plain.as_bytes(), &parsed_hash)
        .is_ok()
}

/// توليد Recovery Code بصيغة XXXXXX-XXXXXX (أحرف كبيرة وأرقام، بدون أحرف ملتبسة مثل O/0 أو I/1)
pub fn generate_recovery_code() -> String {
    use rand_core::{OsRng, RngCore};
    const CHARSET: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let mut rng = OsRng;
    let mut gen_part = |len: usize| -> String {
        (0..len)
            .map(|_| {
                let idx = (rng.next_u32() as usize) % CHARSET.len();
                CHARSET[idx] as char
            })
            .collect()
    };
    format!("{}-{}", gen_part(6), gen_part(6))
}

/// توليد Expense ID احترافي بصيغة EXP-YYMMDD-XXXXXX، يُستخدم عند استيراد سجلات
/// بدون id (JSON خارجي، Excel، CSV) — date بصيغة YYYY-MM-DD
pub fn generate_expense_id(date: &str) -> String {
    use rand_core::{OsRng, RngCore};
    const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let date_part: String = date.chars().filter(|c| *c != '-').collect();
    let date_part = if date_part.len() >= 6 { date_part[2..8].to_string() } else { "000000".to_string() };
    let mut rng = OsRng;
    let random_part: String = (0..6)
        .map(|_| {
            let idx = (rng.next_u32() as usize) % CHARSET.len();
            CHARSET[idx] as char
        })
        .collect();
    format!("EXP-{}-{}", date_part, random_part)
}
