import { useAutoBackup } from "../lib/useAutoBackup";

/**
 * ما بيعرض أي UI — مهمته الوحيدة إنه يشغّل فحص النسخة الاحتياطية التلقائية (useAutoBackup)
 * بمجرد ما التطبيق يبدأ، بدل ما ينتظر لحد ما المستخدم يفتح Settings → Backup بنفسه.
 * لازم يتركّب مرة واحدة على مستوى التطبيق (داخل DataStoreProvider) عشان الفحص يحصل
 * فعلياً عند بداية التشغيل مش عند زيارة صفحة معيّنة.
 */
export default function AutoBackupRunner() {
  useAutoBackup();
  return null;
}
