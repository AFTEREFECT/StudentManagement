# دليل ربط Evolution API مع Supabase على AWS

## 🎯 المشكلة الأساسية

عند استخدام **Supabase Connection Pooler**، كان يظهر الخطأ:
```
FATAL: Tenant or user not found
```

## ✅ الحل

المشكلة كانت في **صيغة اسم المستخدم**:

### ❌ الصيغة الخاطئة (لن تعمل مع Pooler):
```
postgresql://postgres:PASSWORD@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
```

### ✅ الصيغة الصحيحة (تعمل مع Pooler):
```
postgresql://postgres.benjzaxxkcjwnrfllvel:PASSWORD@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

**الفرق الأساسي:** اسم المستخدم يجب أن يكون `postgres.PROJECT_ID` وليس فقط `postgres`

---

## 📋 الإعدادات الصحيحة

### ملف `.env.evolution` النهائي:

```bash
# Database Configuration (Supabase)
# IMPORTANT: For Pooler mode, username MUST be: postgres.benjzaxxkcjwnrfllvel
DATABASE_PROVIDER=postgresql
DATABASE_CONNECTION_URI=postgresql://postgres.benjzaxxkcjwnrfllvel:PgSbx2025Secure987@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1

# Alternative: Direct Connection (slower but more reliable for testing)
# DATABASE_CONNECTION_URI=postgresql://postgres:PgSbx2025Secure987@db.benjzaxxkcjwnrfllvel.supabase.co:5432/postgres?sslmode=require

# Server Configuration
SERVER_URL=http://localhost:8080
SERVER_PORT=8080

# Authentication
AUTHENTICATION_API_KEY=myEvolutionKey2025

# CORS Configuration
CORS_ORIGIN=*
CORS_METHODS=POST,GET,PUT,DELETE
CORS_CREDENTIALS=true

# Webhook Configuration (Optional)
WEBHOOK_GLOBAL_ENABLED=false
WEBHOOK_GLOBAL_URL=

# Log Configuration
LOG_LEVEL=ERROR
LOG_COLOR=true
LOG_BAILEYS=error

# Storage Configuration
STORE_MESSAGES=true
STORE_MESSAGE_UP=true
STORE_CONTACTS=true
STORE_CHATS=true

# Cleanup Configuration
DEL_INSTANCE=false
DEL_TEMP_INSTANCES=true

# QR Code Configuration
QRCODE_LIMIT=30
QRCODE_COLOR=#198754

# Provider Configuration
PROVIDER_ENABLED=false
PROVIDER_HOST=127.0.0.1
PROVIDER_PORT=5656
PROVIDER_PREFIX=evolution
```

---

## 🔧 خطوات التطبيق على AWS EC2

### 1️⃣ تحميل الملفات إلى السيرفر

```bash
# انتقل إلى مجلد evolution-service
cd /path/to/evolution-service

# تأكد من وجود الملفات
ls -la
```

### 2️⃣ اختبار الاتصال

```bash
# اجعل السكريبت قابل للتنفيذ
chmod +x test-connection.sh

# قم بتشغيل الاختبار
./test-connection.sh
```

**النتيجة المتوقعة:**
```
✓ Pooler connection successful!
PostgreSQL 15.x on x86_64-pc-linux-gnu
```

### 3️⃣ إعادة تشغيل Evolution API

```bash
# إيقاف الحاوية الحالية
docker-compose down

# حذف الحاويات القديمة (اختياري)
docker-compose down -v

# إعادة التشغيل مع الإعدادات الجديدة
docker-compose up -d

# متابعة السجلات
docker-compose logs -f evolution-api
```

### 4️⃣ التحقق من نجاح الاتصال

```bash
# تحقق من حالة الحاوية
docker-compose ps

# تحقق من السجلات للتأكد من عدم وجود أخطاء اتصال
docker-compose logs evolution-api | grep -i "database\|connection\|error"
```

**علامات النجاح:**
- لا توجد رسائل خطأ `P1001` أو `FATAL: Tenant or user not found`
- رسالة تأكيد الاتصال بقاعدة البيانات
- Evolution API يعمل على المنفذ 8080

---

## 🧪 اختبار Evolution API

### اختبار الصحة (Health Check):

```bash
curl http://localhost:8080/
```

**النتيجة المتوقعة:**
```json
{
  "status": "ok",
  "version": "2.1.1"
}
```

### إنشاء Instance جديد:

```bash
curl -X POST http://localhost:8080/instance/create \
  -H "Content-Type: application/json" \
  -H "apikey: myEvolutionKey2025" \
  -d '{
    "instanceName": "test-instance"
  }'
```

---

## 🔍 استكشاف الأخطاء

### المشكلة: `FATAL: Tenant or user not found`

**الحل:**
- تأكد من استخدام الصيغة: `postgres.benjzaxxkcjwnrfllvel` (وليس فقط `postgres`)
- تحقق من صحة كلمة المرور

### المشكلة: `P1001: Can't reach database server`

**الحل:**
1. تحقق من IP السيرفر مضاف في Supabase:
   ```bash
   curl -4 ifconfig.me
   ```
2. اذهب إلى Supabase Dashboard → Settings → Database → Network Restrictions
3. أضف IP السيرفر في قائمة Allowed IPs

### المشكلة: `connection timeout`

**الحل:**
- استخدم Direct Connection بدلاً من Pooler مؤقتاً:
  ```bash
  DATABASE_CONNECTION_URI=postgresql://postgres:PgSbx2025Secure987@db.benjzaxxkcjwnrfllvel.supabase.co:5432/postgres?sslmode=require
  ```

---

## 📊 مقارنة بين Pooler و Direct Connection

| الميزة | Connection Pooler | Direct Connection |
|--------|------------------|-------------------|
| السرعة | ⚡ سريع جداً | 🐢 أبطأ نسبياً |
| الموثوقية | ✅ عالية | ✅ عالية جداً |
| الاتصالات المتزامنة | 🔢 محدودة | 🔢 أكثر مرونة |
| اسم المستخدم | `postgres.PROJECT_ID` | `postgres` |
| المنفذ | 6543 | 5432 |
| SSL | تلقائي | `sslmode=require` |
| **الاستخدام الموصى به** | للإنتاج | للتطوير/الاختبار |

---

## ✅ Checklist النهائي

- [ ] كلمة المرور صحيحة: `PgSbx2025Secure987`
- [ ] Project ID صحيح: `benjzaxxkcjwnrfllvel`
- [ ] اسم المستخدم بالصيغة: `postgres.benjzaxxkcjwnrfllvel`
- [ ] IP السيرفر مضاف في Supabase Network Restrictions
- [ ] ملف `.env.evolution` محدّث
- [ ] Docker Compose تم إعادة تشغيله
- [ ] لا توجد أخطاء في السجلات
- [ ] Evolution API يستجيب على المنفذ 8080

---

## 📞 الدعم

إذا استمرت المشكلة بعد تطبيق جميع الخطوات أعلاه:

1. قم بتشغيل السكريبت `test-connection.sh` وأرسل النتائج
2. أرسل آخر 50 سطر من سجلات Docker:
   ```bash
   docker-compose logs --tail=50 evolution-api
   ```
3. تحقق من إعدادات Supabase Security Rules

---

**تم التحديث:** 26 أكتوبر 2025
**الإصدار:** 1.0
**الحالة:** ✅ جاهز للإنتاج
