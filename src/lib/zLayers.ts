/**
 * نظام Z-Index مركزي موحّد لكل التطبيق.
 *
 * بدلاً من أرقام عشوائية متناثرة في كل مكوّن (10، 50، 100، 200...) واللي بتسبب
 * تعارضات (Dropdown يظهر خلف كارت، أو Modal خلف Dropdown)، كل عنصر عائم في
 * التطبيق لازم ياخد قيمته من هنا فقط.
 *
 * الترتيب من الأقل للأعلى يعكس الأولوية البصرية المنطقية:
 * المحتوى العادي < الكروت اللي بتتفاعل (hover) < الـ Sidebar الثابت < الهيدر
 * < أي عنصر عائم (Dropdown/Popover/Tooltip) < الإشعارات (Toast) < النوافذ
 * المنبثقة (Modal) < أعلى مستوى ممكن (Command Palette، لازم يفضل فوق أي حاجة).
 */
export const Z = {
  base: 1,
  card: 2,
  stickyNav: 30,
  sidebar: 50,
  header: 40,
  dropdown: 300,
  toast: 500,
  modal: 1000,
  commandPalette: 1100,
} as const;

export type ZLayer = keyof typeof Z;
