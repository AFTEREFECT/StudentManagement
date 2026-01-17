# دليل البدء السريع - نظام التجربة المجانية

## للمستخدم النهائي

### كيف تبدأ التجربة المجانية؟

1. **افتح البرنامج**
   - ستظهر لك شاشة التفعيل

2. **اضغط على الزر الأخضر**
   - "ابدأ التجربة المجانية - 7 أيام"

3. **البرنامج يعمل فوراً!**
   - لا حاجة لإدخال أي معلومات
   - استخدم جميع الميزات بحرية

### أثناء فترة التجربة

- **شريط أعلى الشاشة** يظهر الأيام المتبقية
- **اللون يتغير**:
  - 🟢 أخضر = أكثر من 5 أيام
  - 🟠 برتقالي = 2-4 أيام
  - 🔴 أحمر = أقل من يومين

### عند انتهاء التجربة

- البرنامج يُغلق تلقائياً
- تظهر شاشة خطط الاشتراك
- **خياراتك**:
  1. اختيار خطة والاشتراك
  2. إدخال كود تفعيل (إذا كان لديك واحد)

---

## للمطور

### الخطوة 1: تطبيق Migration

```bash
# في Supabase Dashboard
1. افتح SQL Editor
2. انسخ محتوى:
   supabase/migrations/20251024170000_create_trial_system.sql
3. نفّذ الـ SQL
4. تأكد من عدم وجود أخطاء
```

### الخطوة 2: التحقق من الجداول

```sql
-- تحقق من إنشاء الجداول
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'trial%' OR table_name = 'user_analytics';

-- يجب أن ترى:
-- - trial_sessions
-- - user_analytics
-- - server_time_checks
```

### الخطوة 3: اختبار الدوال

```sql
-- اختبار دالة بدء التجربة
SELECT start_trial_session(
  'test-fingerprint-123',
  '{"browser": "Chrome", "os": "Windows"}'::jsonb,
  '127.0.0.1',
  7
);

-- اختبار دالة التحقق
SELECT check_trial_validity('test-fingerprint-123');

-- اختبار الإحصائيات
SELECT get_trial_statistics();
```

### الخطوة 4: الوصول للوحة الإحصائيات

1. **افتح البرنامج**
2. **اذهب إلى**: القائمة الجانبية
3. **اضغط على**: "الاشتراكات" → "إحصائيات التجارب"
4. **أدخل كلمة المرور**: `BGA161`

### الخطوة 5: مراقبة الاستخدام

```sql
-- عرض التجارب النشطة
SELECT
  device_fingerprint,
  trial_started_at,
  trial_expires_at,
  session_count,
  EXTRACT(DAY FROM (trial_expires_at - now())) as days_remaining
FROM trial_sessions
WHERE is_expired = false
AND trial_expires_at > now()
ORDER BY trial_started_at DESC;

-- عرض الإحصائيات اليومية
SELECT
  DATE(created_at) as date,
  COUNT(*) as new_trials
FROM trial_sessions
GROUP BY DATE(created_at)
ORDER BY date DESC
LIMIT 7;
```

---

## نصائح مهمة

### للمستخدمين

❌ **لا تستخدم**:
- وضع التصفح الخاص (Incognito)
- VPN أو Proxy
- أجهزة افتراضية

✅ **استخدم**:
- وضع التصفح العادي
- اتصال إنترنت مستقر
- توقيت صحيح للنظام

### للمطور

🔧 **للاختبار**:
```sql
-- حذف جلسة معينة (للاختبار فقط)
DELETE FROM trial_sessions
WHERE device_fingerprint = 'البصمة';

-- إعادة تعيين جلسة
UPDATE trial_sessions
SET
  trial_expires_at = now() + interval '7 days',
  is_expired = false
WHERE device_fingerprint = 'البصمة';
```

📊 **لمراقبة الأداء**:
```sql
-- التجارب في آخر 24 ساعة
SELECT COUNT(*)
FROM trial_sessions
WHERE created_at > now() - interval '24 hours';

-- معدل التحويل
SELECT
  COUNT(*) FILTER (WHERE converted_to_paid = true) * 100.0 / COUNT(*) as conversion_rate
FROM trial_sessions
WHERE is_expired = true OR trial_expires_at < now();
```

---

## استكشاف الأخطاء السريع

### خطأ: "لا يمكن الاتصال بقاعدة البيانات"
**الحل**: تحقق من `.env` وتأكد من صحة:
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY

### خطأ: "الدالة غير موجودة"
**الحل**: تأكد من تطبيق الـ migration بشكل صحيح

### خطأ: "الوضع الخاص غير مسموح"
**الحل**: اطلب من المستخدم استخدام الوضع العادي

---

## الدعم

📧 **البريد الإلكتروني**: progmawarid@gmail.com

💬 **للمساعدة السريعة**: راجع `TRIAL_SYSTEM_GUIDE.md`

---

**جاهز للاستخدام!** 🚀
