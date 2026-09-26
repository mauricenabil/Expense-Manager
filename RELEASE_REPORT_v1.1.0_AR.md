# تقرير شامل: من مجلد الكود إلى تطبيق سطح مكتب جاهز — الإصدار v1.1.0

هذا التقرير هو الطريق الكامل: رفع المشروع على GitHub، بناء `Setup.exe` تلقائياً،
التثبيت، التحديث، ومعالجة الأخطاء الشائعة. مكتوب بترتيب تنفيذي — نفّذ من فوق لتحت.

> الدليل المختصر الأقدم موجود في `DEPLOYMENT_GUIDE_AR.md`. التقرير ده أحدث منه
> وبيغطّي حاجات مش موجودة هناك (الأيقونة، ترقيم الإصدار، البناء المحلي، تشخيص الأخطاء).

---

## 0. ملخّص سريع (لو مستعجل)

```bash
# داخل مجلد المشروع بعد فك الضغط
git init
git add .
git commit -m "Expense Manager v1.1.0"
git branch -M main
git remote add origin https://github.com/USERNAME/expense-manager.git
git push -u origin main
```

بعد الـ push: تبويب **Actions** على GitHub بيشتغل لوحده → بعد ٨-١٢ دقيقة تلاقي
`Setup.exe` جاهز في تبويب **Releases** تحت الوسم `app-v1.1.0`.

---

## 1. ما الذي ستحصل عليه بالضبط

| الملف | إيه هو | إمتى تستخدمه |
|---|---|---|
| `Expense Manager_1.1.0_x64-setup.exe` | مثبّت NSIS كامل | الاستخدام العادي: بيعمل اختصار على سطح المكتب وفي Start |
| `ExpenseManager-Portable.exe` | الملف التنفيذي الخام | تشغيل من فلاشة بدون تثبيت |

الاتنين بيتبنوا على سيرفر **ويندوز حقيقي** من GitHub، فمش محتاج تنزّل Rust ولا
Visual Studio على جهازك إطلاقاً.

---

## 2. المتطلبات قبل ما تبدأ

| المتطلب | ليه | ملاحظة |
|---|---|---|
| حساب GitHub | مكان الكود والبناء | مجاني |
| Git على جهازك | لرفع الكود بالأوامر | اختياري — فيه طريقة رفع بالسحب والإفلات |
| ويندوز 10/11 | تشغيل التطبيق النهائي | ويندوز 7/8 محتاج تثبيت WebView2 Runtime يدوياً |

مش محتاج: Node، Rust، مساحة كبيرة، ولا إنترنت أثناء **استخدام** التطبيق.

---

## 3. رفع المشروع على GitHub

### 3.1 إنشاء المستودع

1. من https://github.com اضغط **+** → **New repository**.
2. الاسم: `expense-manager`.
3. اختار **Private** (بياناتك وكودك خاصين) أو **Public** لو عايز تشاركه.
4. **ما تفعّلش** أي من `Add a README` / `Add .gitignore` / `Choose a license` —
   المشروع فيه ملفاته جاهزة، وأي ملف تلقائي هيعمل تعارض وقت أول `push`.
5. **Create repository**.

### 3.2 الرفع — الطريقة الأولى: Git (موصى بها)

افتح Terminal أو CMD جوّه مجلد المشروع بعد فك الضغط:

```bash
git init
git add .
git commit -m "Expense Manager v1.1.0"
git branch -M main
git remote add origin https://github.com/USERNAME/expense-manager.git
git push -u origin main
```

استبدل `USERNAME` باسم حسابك.

**عن تسجيل الدخول:** GitHub ما بيقبلش الباسورد العادي في الـ push من ٢٠٢١.
لو طلب منك بيانات، استخدم **Personal Access Token**:
Settings → Developer settings → Personal access tokens → Tokens (classic) →
Generate new token → فعّل صلاحية **repo** → انسخ التوكن واستخدمه مكان الباسورد.
(أو ثبّت **GitHub CLI** واعمل `gh auth login` مرة واحدة وخلاص.)

### 3.3 الرفع — الطريقة الثانية: بدون أوامر

في صفحة المستودع الفاضي، اضغط **uploading an existing file** واسحب **محتويات**
المجلد (مش المجلد نفسه) → **Commit changes**.

⚠️ المتصفح بيتجاهل المجلدات المخفية أحياناً. اتأكد إن مجلد **`.github`** اترفع —
من غيره مفيش بناء تلقائي خالص. لو مش ظاهر، اعمله يدوياً:
**Add file → Create new file** واكتب في خانة الاسم:
`.github/workflows/build.yml` ثم الصق محتوى الملف من المشروع.

### 3.4 ملفات لازم تكون موجودة بعد الرفع

```
.github/workflows/build.yml      ← البناء التلقائي (الأهم)
package.json                     ← "version": "1.1.0"
src-tauri/tauri.conf.json        ← "version": "1.1.0"
src-tauri/Cargo.toml             ← version = "1.1.0"
src-tauri/icons/                 ← الأيقونة الجديدة بكل مقاساتها
src/                             ← كود الواجهة
```

`node_modules` و `dist` و `src-tauri/target` **مش** المفروض يترفعوا — `.gitignore`
بيستبعدهم تلقائياً، وده مقصود (بيتبنوا على السيرفر).

---

## 4. البناء التلقائي على GitHub Actions

### 4.1 إيه اللي بيحصل

ملف `.github/workflows/build.yml` بيشتغل عند **كل push على main** (أو يدوياً)، وبيعمل:

1. يجيب سيرفر `windows-latest` مجاني.
2. يثبّت Node (أحدث LTS) و Rust stable.
3. `npm install` ثم `npm run build` (فحص TypeScript + بناء الواجهة).
4. `tauri-action` يبني Rust وينتج مثبّت NSIS.
5. ينشئ **Release** تلقائياً بالوسم `app-v1.1.0` والعنوان `Expense Manager v1.1.0`.
6. يرفع نسخة إضافية في **Artifacts** (فيها كمان الـ Portable).

رقم `1.1.0` بييجي من `src-tauri/tauri.conf.json` — الوسم نفسه مكتوب في الـ workflow
كـ `app-v__VERSION__` وGitHub بيبدّل `__VERSION__` بالرقم الحقيقي.

### 4.2 التشغيل والمتابعة

1. تبويب **Actions**. لو ظهرت رسالة تفعيل، اضغط
   **I understand my workflows, go ahead and enable them**.
2. لو ما اشتغلش لوحده: اختار **Build Windows Desktop App** من الشمال →
   **Run workflow** → **Run workflow**.
3. 🟡 دائرة صفراء = شغّال (٨-١٢ دقيقة أول مرة، أسرع بعد كده)،
   ✅ = نجح، ❌ = فشل (راجع القسم ٨).

### 4.3 تحميل الناتج

- **Releases** (الأسهل): الصفحة الرئيسية للمستودع → **Releases** من الجانب →
  `Expense Manager v1.1.0` → حمّل `...setup.exe`.
- **Actions → آخر بناء ناجح → Artifacts → ExpenseManager-Windows-Build** (ملف ZIP).

---

## 5. التثبيت على ويندوز

1. شغّل `Expense Manager_1.1.0_x64-setup.exe`.
2. هتظهر شاشة **"Windows protected your PC"** — ده طبيعي تماماً لأن التطبيق مش
   موقّع بشهادة Code Signing (شهادة بفلوس سنوياً، مالهاش لازمة لتطبيق شخصي).
   اضغط **More info** → **Run anyway**.
3. كمّل شاشات التثبيت → هتلاقي الاختصار وأيقونة المحفظة الجديدة على سطح المكتب
   وفي قائمة Start.
4. أول تشغيل بيعمل قاعدة البيانات تلقائياً — مفيش أي إعداد مطلوب.

**النسخة المحمولة:** `ExpenseManager-Portable.exe` بيشتغل بالضغط عليه مباشرة،
بدون تثبيت وبدون اختصارات. بياناته بتروح لنفس مكان AppData برضه.

---

## 6. أين تُخزَّن البيانات (مهم جداً)

```
C:\Users\<اسمك>\AppData\Roaming\com.personal.expensemanager\expenses.db
```

- خارج مجلد التثبيت تماماً → التحديث أو إلغاء التثبيت **ما بيلمسهاش**.
- النسخ الاحتياطي التلقائي بيروح للمجلد اللي انت مختاره من Settings → Backup.
- 💡 اعمل Export يدوي كل فترة واحفظه في مكان تاني (فلاشة/سحابة). ده أهم إجراء
  حماية عندك، وأسرع طريق للرجوع لو حصل أي حاجة للجهاز.

---

## 7. إصدار تحديث لاحقاً (الإصدار الثالث وما بعده)

1. عدّل الكود.
2. رفّع الرقم في **أربع** أماكن لازم تتطابق:
   - `package.json` → `"version"`
   - `src-tauri/tauri.conf.json` → `"version"`
   - `src-tauri/Cargo.toml` → `version`
   - `src/lib/version.ts` → `APP_VERSION`

   > لو اختلفوا: شاشة التحديث جوّه التطبيق هتقارن رقماً غير المثبّت فعلاً وتديك
   > نتيجة غلط، واسم ملف الـ Setup هيقول رقماً والـ tag يقول رقماً تاني.

   **قاعدة الترقيم (SemVer):** `major.minor.patch` —
   إصلاحات فقط → `1.1.1` · ميزة جديدة → `1.2.0` · تغيير كبير/إعادة بناء → `2.0.0`.

3. ```bash
   git add .
   git commit -m "v1.2.0: وصف التحديث"
   git push
   ```
4. استنى البناء، حمّل الـ Setup الجديد، وشغّله **فوق** التثبيت القديم مباشرة —
   من غير إلغاء تثبيت. البيانات بتفضل كما هي، والـ migrations بتضيف أي جدول
   أو عمود جديد من غير ما تمسّ الصفوف الموجودة.

⚠️ **ما تلغيش التثبيت قبل التحديث.** ده السيناريو الوحيد اللي ممكن يوصل لفقدان
بيانات لو حد مسح مجلد AppData بعدها يدوياً.

---

## 8. لو البناء فشل ❌ — تشخيص سريع

| رسالة الخطأ | السبب | الحل |
|---|---|---|
| `Resource not accessible by integration` | صلاحية كتابة ناقصة | تأكد إن `permissions: contents: write` موجودة في `build.yml` (موجودة في نسختك)، وإن Settings → Actions → General → Workflow permissions = **Read and write** |
| `TS…: error` أثناء `npm run build` | خطأ TypeScript في الكود | افتح الـ Log، أول سطر فيه اسم الملف ورقم السطر — صلّحه وارفع تاني |
| `failed to bundle project` / NSIS error | غالباً مشكلة في ملفات الأيقونة | تأكد إن `src-tauri/icons/icon.ico` و `icon.png` اترفعوا فعلاً (Git أحياناً بيتجاهل الصور لو `.gitignore` متعدّل) |
| `error: linker link.exe not found` | ظهرت في بناء محلي مش على GitHub | ثبّت Visual Studio Build Tools مع حزمة C++ |
| البناء ما بدأش أصلاً | مجلد `.github` ما اترفعش | راجع ٣.٣ |

طريقة القراءة: **Actions** → البناء الفاشل → الخطوة الحمراء → دوّر على أول كلمة
`error` (مش آخر واحدة — الباقي غالباً نتيجة لها).

---

## 9. بناء محلي على جهازك (اختياري)

لو عايز تجرّب قبل الرفع أو من غير إنترنت لـ GitHub:

```bash
# مرة واحدة
# 1) Node.js LTS من nodejs.org
# 2) Rust من rustup.rs
# 3) Visual Studio Build Tools + "Desktop development with C++"

npm install
npm run tauri dev      # تشغيل تجريبي مع إعادة تحميل حيّة
npm run tauri build    # ينتج Setup.exe في:
                       # src-tauri/target/release/bundle/nsis/
```

للمعاينة في المتصفح بس (بدون Rust): `npm run dev` — بيشتغل بوضع Preview
ببيانات مؤقتة في المتصفح، وبيظهر شريط تحذير أصفر لتفريقه عن النسخة الحقيقية.

---

## 10. الأيقونة الجديدة

الأيقونة اتعملت من الصفر بهوية التطبيق نفسها: خلفية ليلية بتدرّج من عائلة `--bg`،
محفظة بلون `--accent` الـ teal، ورقة نقدية بلون النص، ونقطة مرجانية `--coral`.

```
src-tauri/icons/icon.svg        ← المصدر المتجهي (قابل للتعديل)
src-tauri/icons/icon.ico        ← ويندوز (٧ مقاسات جوّه ملف واحد)
src-tauri/icons/icon.png        ← 512px
src-tauri/icons/128x128.png · 128x128@2x.png · 32x32.png
src-tauri/icons/icon.icns       ← ماك (مش مستخدم في workflow الحالي)
public/app-icon.svg             ← favicon لوضع المتصفح
tools/generate_icons.py         ← السكربت اللي بيولّد كل ده
```

لو حبيت تغيّر التصميم لاحقاً: عدّل `icon.svg`، طابق نفس الإحداثيات في
`tools/generate_icons.py`، ثم:

```bash
pip install pillow numpy
python tools/generate_icons.py
```

`tauri.conf.json` بيشير للملفات دي بأسمائها، فمش محتاج تعدّل أي إعداد.

---

## 11. قائمة فحص نهائية

- [ ] المستودع متعمل والكود مرفوع
- [ ] مجلد `.github/workflows/` ظاهر على GitHub
- [ ] الأرقام الأربعة كلها `1.1.0`
- [ ] تبويب Actions فيه بناء ✅
- [ ] Releases فيه `app-v1.1.0` ومعاه `setup.exe`
- [ ] التطبيق اتثبّت والأيقونة الجديدة ظاهرة على سطح المكتب
- [ ] عملت Export احتياطي أول ما دخلت بياناتك
