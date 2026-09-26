# تعديلات 2.10.0

## ١. إصلاح استرجاع النسخة الاحتياطية (`import_backup_json`)

كانت الدالة تحذف تسعة جداول وتستورد أربعة. الميزانيات وأهداف الادخار
والمصروفات المتكررة والفئات الفرعية والوسوم كانت تُمسح صامتة عند كل
استرجاع، رغم وجودها كاملة في ملف النسخة نفسه.

**ما تغيّر:**

- كل العملية داخل `conn.transaction()` واحدة تنتهي بـ `tx.commit()`.
  أي فشل في المنتصف يُلغي الـ transaction عند الـ drop وترجع قاعدة
  البيانات كما كانت بالضبط.
- تُستورد كل الجداول، بترتيب يحترم المفاتيح الأجنبية:
  `categories` ← `sub_categories` ← `payment_methods` ← `tags`
  ← `recurring_expenses` ← `expenses` ← `expense_tags` ← `budgets`
  ← `savings_goals` ← `planned_purchases`.

**مشكلتان إضافيتان ظهرتا أثناء العمل:**

- `DELETE FROM expense_tags` كان ناقصاً من كتلة الحذف. تحت
  `PRAGMA foreign_keys = ON` كان حذف `expenses` أو `tags` سيفشل لو كان
  جدول الربط مستخدَماً. أُضيف في `import_backup_json` و`delete_all_data`.
- الكود القديم كان يمرّر `created_at` كـ `NULL` صراحةً لو غاب من الملف.
  `DEFAULT` في SQLite لا يعمل إلا لو العمود محذوف من الـ `INSERT` أصلاً،
  لا لو مُرِّر `NULL`. النتيجة كسر قيد `NOT NULL`. الحل: دالة `ts()`
  ترجّع الوقت الحالي كبديل.

**للاختبار:** صدّر نسخة ← أنشئ ميزانية وهدف ادخار ← استرجع النسخة ←
افتح Settings → Budgets و Savings. يجب أن يعود كل شيء كما كان وقت التصدير.

---

## ٢. جدول `tags` — وُصِّل بدل حذف التبويب

جدول الربط `expense_tags` كان موجوداً في `001_initial.sql` منذ البداية،
فقط لم يستعمله أي كود. لا حاجة لأي migration جديدة.

**Backend (`commands.rs`):**

- `tag_ids: Vec<String>` في `Expense` (بـ `#[serde(default)]` حتى لا يفشل
  أي استدعاء قديم لا يرسل المفتاح) وفي `ExpenseWithDetails`.
- `group_concat` في `get_expenses` و`get_deleted_expenses`.
- `sync_expense_tags()` تُستدعى من `add_expense` و`update_expense`.
- تنظيف الربط في `permanently_delete_expense` و`delete_tag`.
- `expense_tags` في التصدير والاستيراد.

**Frontend:**

- مكوّن جديد `src/components/TagPicker.tsx` — شرائح قابلة للنقر + إنشاء
  وسم جديد من نفس المكان بدل الذهاب إلى Settings والعودة.
- مُدمج في `AddExpense` و`EditExpenseModal`.
- شرائح الوسوم تظهر بجوار الاسم في جدول `AllExpenses`.

---

## ٣. نافذة الإضافة السريعة

كانت تظهر ملتصقة بأعلى الصفحة ومقصوصة. السبب لم يكن في النافذة:
`QuickAddModal` يُستدعى من داخل `<header>` الذي يحمل `backdropFilter`،
وأي عنصر فيه `backdrop-filter` (أو `filter` أو `transform`) يصير
containing block لكل أبنائه ذوي `position: fixed`. فكانت طبقة الخلفية
`inset: 0` تتقيّد بارتفاع الهيدر (62px) بدل الشاشة كلها.

الحل: `createPortal` إلى `document.body`، تماماً مثل `EditExpenseModal`.

---

## ٤. تكبير الخط — لا زووم

كان السطر:

```css
html { zoom: var(--app-font-scale); }
```

وهذا تكبير صفحة لا تكبير خط: يكبّر النصوص والحشو والأيقونات والحدود معاً،
وهو أيضاً ما كان يجبر `DropdownPortal` على قسمة إحداثيات
`getBoundingClientRect` على معامل التكبير.

**ما تغيّر:**

- حُذف `zoom` نهائياً.
- **٢٣١ مقاس خط سطري** في ملفات `.tsx` و**١٥ في ملفات CSS** تحوّلت إلى
  `calc(Npx * var(--app-font-scale, 1))`.
- الحشو والأيقونات وعرض الأعمدة وإحداثيات العناصر العائمة لا تتحرك إطلاقاً.
- نُظّفت قسمة الـ zoom من `DropdownPortal`.
- رُفع الحد الأقصى من 1.4 إلى 1.5 لأن التكبير لم يعد يشمل التخطيط.

**فائدة جانبية:** منزلق "نصوص المستخدم" (`--ar-font-scale`) لم يكن يعمل
أصلاً على معظم العناصر، لأن `style={{fontSize}}` السطري يهزم قاعدة
`.bidi-auto` في ملف CSS. أُصلح بضرب المعاملين معاً في ٩ مواضع.

**استثناءات مقصودة:**

- `AXIS_TICK` في `ChartsPro.tsx:37` وسطر `244`: هذه خصائص SVG
  (presentation attributes) ولا تقبل `calc()` مع `var()`.
- خيارات ApexCharts النصية في `DailySpendingChart.tsx`: المكتبة تفسّرها
  بنفسها ولا تفهم `calc()`.

**النتيجة:** تسميات محاور الرسوم البيانية لن تكبر مع المنزلق. نقص واعٍ،
وحلّه يحتاج قراءة المقياس من JS وتمريره كرقم لكل مكوّن رسم.

---

## ما لم يُنفَّذ

### التشفير (SQLCipher)

لم يُلمس، والمشكلة معمارية لا مجرد feature في `Cargo.toml`:

- `password_hash` مخزّن **داخل** `expenses.db` نفسه. لو شُفِّر الملف بمفتاح
  مشتق من كلمة السر، فأنت تحتاج فتح الملف لتعرف هل توجد كلمة سر أصلاً.
- كلمة السر اختيارية (`password_enabled` = 0 افتراضياً). فما المفتاح عند
  تعطيلها؟
- يحتاج الحل: مفتاح في Windows Credential Manager أو ملف منفصل لبيانات
  المصادقة، بالإضافة لمسار ترحيل قواعد البيانات الموجودة غير المشفّرة.

قرار مستقل يستحق جلسة خاصة.

### `REAL` → `INTEGER` للمبالغ

متروك كما طُلب. يُضمّ لأول migration كبيرة قادمة.

---

## قبل الاعتماد

هذه التعديلات كُتبت في بيئة **بلا `cargo` وبلا `node_modules`**، فلم يجرِ
أي تحقق من البناء. شغّل محلياً:

```bash
npm install
npm run build          # يتحقق من TypeScript
npm run tauri build    # يتحقق من Rust
```

الأجزاء الأكثر عرضة لخطأ ترجمة: `commands.rs` (الـ transaction والـ borrow
checker)، وسطور `tag_ids` في ملفات الواجهة.
