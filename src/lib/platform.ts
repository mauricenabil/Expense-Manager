/**
 * يفحص هل التطبيق يعمل داخل نافذة Tauri الحقيقية أم في متصفح عادي.
 * Tauri v2 يحقن كائن __TAURI_INTERNALS__ على window عند التشغيل داخل التطبيق.
 */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
