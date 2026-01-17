# 🚀 ابدأ من هنا - Evolution API v2 Setup

## 📌 نظرة سريعة

هذا المجلد يحتوي على **خدمة مستقلة تمامًا** لربط WhatsApp مع نظام إدارة التلاميذ.

**⚠️ هام جداً:**
- هذه الخدمة **لا تمس** أي ملف في المشروع الرئيسي
- البرنامج الأصلي يبقى كما هو بالكامل
- التواصل يتم فقط عبر HTTP API

---

## 📁 محتويات المجلد

| الملف | الوصف |
|------|-------|
| `.env.evolution` | ⚙️ إعدادات Evolution API (عدّل هذا أولاً) |
| `docker-compose.yml` | 🐳 تكوين Docker |
| `SETUP_GUIDE.md` | 📖 دليل الإعداد الكامل خطوة بخطوة |
| `COMMANDS.txt` | 💻 جميع الأوامر الجاهزة للنسخ والتنفيذ |
| `INTEGRATION_EXAMPLES.md` | 💡 أمثلة كود للربط مع البرنامج |
| `ARCHITECTURE.md` | 🏗️ شرح بنية النظام والفصل بين الخدمات |
| `README.md` | 📚 معلومات عامة وتوثيق |

---

## ⚡ الإعداد السريع (5 خطوات)

### 1️⃣ تحديث بيانات Supabase

افتح ملف `.env.evolution` وعدّل هذا السطر:

```env
DATABASE_CONNECTION_URI=postgresql://postgres:[كلمة_المرور]@db.[project-id].supabase.co:5432/postgres?schema=public
```

**كيف أحصل على البيانات؟**
1. ادخل على https://supabase.com/dashboard
2. اختر مشروعك (أو أنشئ مشروع جديد)
3. من القائمة الجانبية: **Settings** → **Database**
4. انسخ:
   - **Host**: `db.xxxxx.supabase.co`
   - **Password**: كلمة المرور

---

### 2️⃣ تشغيل Evolution API

```bash
cd evolution-service
docker-compose up -d
```

**ستظهر رسالة تأكيد:**
```
✔ Container evolution-api-v2  Started
```

---

### 3️⃣ التحقق من نجاح التشغيل

```bash
# مشاهدة السجلات
docker-compose logs -f

# اختبار الاتصال
curl http://localhost:8080/
```

**إذا رأيت استجابة JSON، فالخدمة تعمل! ✅**

---

### 4️⃣ إنشاء Instance وربط WhatsApp

```bash
curl -X POST http://localhost:8080/instance/create \
  -H "Content-Type: application/json" \
  -H "apikey: myEvolutionKey2025" \
  -d '{
    "instanceName": "school_system",
    "qrcode": true
  }'
```

**سيظهر QR Code**، افتح WhatsApp وامسح الكود:
1. افتح WhatsApp
2. الإعدادات → الأجهزة المرتبطة
3. "ربط جهاز"
4. امسح QR Code

---

### 5️⃣ اختبار إرسال رسالة

```bash
curl -X POST http://localhost:8080/message/sendText/school_system \
  -H "Content-Type: application/json" \
  -H "apikey: myEvolutionKey2025" \
  -d '{
    "number": "212600000000",
    "text": "مرحبا، اختبار Evolution API"
  }'
```

**غيّر الرقم لرقم هاتفك** (بالصيغة الدولية بدون + أو مسافات)

---

## 🔗 الربط مع البرنامج

### من داخل نظام إدارة التلاميذ

البرنامج يمكنه الآن إرسال رسائل عبر:

```
URL: http://[IP-SERVER]:8080
API Key: myEvolutionKey2025
Instance: school_system
```

**مثال:**
```typescript
await fetch('http://localhost:8080/message/sendText/school_system', {
  method: 'POST',
  headers: {
    'apikey': 'myEvolutionKey2025',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    number: '212600000000',
    text: 'رسالة من البرنامج'
  })
});
```

**📖 للمزيد من الأمثلة، راجع `INTEGRATION_EXAMPLES.md`**

---

## 🛠️ الأوامر الأساسية

```bash
# إعادة تشغيل
docker-compose restart

# إيقاف
docker-compose down

# مشاهدة السجلات
docker-compose logs -f

# حالة Instance
curl http://localhost:8080/instance/connectionState/school_system \
  -H "apikey: myEvolutionKey2025"
```

---

## ❓ مشاكل شائعة

### المشكلة: لا يعمل Docker
**الحل:**
```bash
# تحقق من تثبيت Docker
docker --version

# إذا لم يكن مثبت:
# Linux: sudo apt install docker.io docker-compose
# Windows/Mac: قم بتحميل Docker Desktop
```

---

### المشكلة: خطأ في الاتصال بـ Supabase
**الحل:**
1. تحقق من صحة كلمة المرور في `.env.evolution`
2. تحقق من Project ID
3. تأكد من فتح الاتصال في Supabase Dashboard

---

### المشكلة: لا يظهر QR Code
**الحل:**
```bash
# احصل على QR Code مباشرة
curl http://localhost:8080/instance/connect/school_system \
  -H "apikey: myEvolutionKey2025"
```

---

## 🔐 الأمان

### للاستخدام في الإنتاج:

1. **غيّر API Key:**
   ```env
   AUTHENTICATION_API_KEY=مفتاح_سري_قوي_هنا
   ```

2. **استخدم HTTPS:**
   ضع Evolution API خلف nginx مع SSL

3. **قيّد الوصول:**
   ```bash
   # في firewall، اسمح فقط بـ IP البرنامج
   sudo ufw allow from [IP_ALLOWED] to any port 8080
   ```

4. **راقب السجلات:**
   ```bash
   docker-compose logs -f evolution-api
   ```

---

## 📚 الخطوة التالية

حسب احتياجك، اقرأ:

| أريد... | اقرأ |
|---------|------|
| إعداد كامل خطوة بخطوة | `SETUP_GUIDE.md` |
| أوامر جاهزة للنسخ | `COMMANDS.txt` |
| أمثلة كود للربط | `INTEGRATION_EXAMPLES.md` |
| فهم بنية النظام | `ARCHITECTURE.md` |
| معلومات عامة | `README.md` |

---

## ✅ تأكيدات مهمة

- ✅ لم يتم تعديل أي ملف في المشروع الأصلي
- ✅ قاعدة بيانات IndexedDB لم تُمس
- ✅ جميع ملفات `src/` كما هي
- ✅ Evolution API في مجلد منفصل تماماً
- ✅ التواصل فقط عبر HTTP API

---

## 💬 الدعم

- **التوثيق الرسمي**: https://doc.evolution-api.com
- **GitHub**: https://github.com/EvolutionAPI/evolution-api
- **Discord**: https://evolution-api.com/discord

---

## 🎉 جاهز!

بمجرد تشغيل Evolution API ومسح QR Code، البرنامج جاهز لإرسال رسائل WhatsApp!

**الملفات الأساسية للبدء:**
1. `.env.evolution` ← **عدّل هذا أولاً**
2. `COMMANDS.txt` ← **نفّذ الأوامر هنا**
3. `INTEGRATION_EXAMPLES.md` ← **للربط مع البرنامج**

---

**🚀 ابدأ الآن!**

```bash
cd evolution-service
# عدّل .env.evolution أولاً، ثم:
docker-compose up -d
```
