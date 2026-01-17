# هندسة النظام - Evolution API v2 Integration

## 📐 نظرة عامة على البنية

```
┌─────────────────────────────────────────────────────────────┐
│                  Student Management System                  │
│                     (المشروع الرئيسي)                        │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Frontend (React + TypeScript + IndexedDB)          │  │
│  │  - إدارة التلاميذ                                    │  │
│  │  - تتبع الغياب                                       │  │
│  │  - إنشاء التقارير                                    │  │
│  │  - واجهة المستخدم                                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓ HTTP API                         │
└─────────────────────────────────────────────────────────────┘
                             ↓
                    ┌────────────────┐
                    │   HTTP Call    │
                    │   Port: 8080   │
                    └────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────┐
│              Evolution API v2 Service                       │
│                  (خدمة مستقلة)                              │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Docker Container                                    │  │
│  │  - Evolution API v2.1.1                             │  │
│  │  - Port: 8080                                       │  │
│  │  - API Key: myEvolutionKey2025                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Supabase PostgreSQL                                │  │
│  │  - تخزين جلسات WhatsApp                            │  │
│  │  - حفظ الرسائل                                      │  │
│  │  - إدارة Instances                                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  WhatsApp Connection                                │  │
│  │  - Baileys Library                                  │  │
│  │  - QR Code Authentication                           │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔒 مبادئ الفصل والاستقلالية

### ✅ ما تم فصله بالكامل

1. **قاعدة البيانات**
   - Evolution API ← Supabase PostgreSQL
   - Student System ← IndexedDB (محلي في المتصفح)
   - **لا يوجد تداخل أو مشاركة بيانات**

2. **الكود والملفات**
   - Evolution API ← `/evolution-service/`
   - Student System ← `/src/`, `/public/`, إلخ
   - **لا توجد تعديلات على المشروع الأصلي**

3. **الإعدادات**
   - Evolution API ← `.env.evolution`
   - Student System ← `.env` (الأصلي)
   - **كل خدمة لها إعداداتها المنفصلة**

4. **التشغيل**
   - Evolution API ← Docker (Port 8080)
   - Student System ← Vite Dev Server (Port 5173)
   - **كل خدمة تعمل بشكل مستقل**

---

## 🔄 تدفق البيانات

### إرسال رسالة من البرنامج

```
1. المستخدم ينقر "إرسال إشعار غياب"
         ↓
2. Frontend يجهز البيانات من IndexedDB
         ↓
3. Frontend يرسل HTTP POST إلى Evolution API
   URL: http://[SERVER_IP]:8080/message/sendText/school_system
   Headers: { apikey: "myEvolutionKey2025" }
   Body: { number, text }
         ↓
4. Evolution API يستقبل الطلب
         ↓
5. Evolution API يتحقق من صحة API Key
         ↓
6. Evolution API يرسل الرسالة عبر WhatsApp
         ↓
7. Evolution API يحفظ سجل الرسالة في Supabase
         ↓
8. Evolution API يعيد Response للـ Frontend
         ↓
9. Frontend يعرض رسالة نجاح/فشل للمستخدم
```

---

## 📦 المكونات والمسؤوليات

### Student Management System (المشروع الرئيسي)

**المسؤوليات:**
- إدارة بيانات التلاميذ والمعلمين
- تتبع الحضور والغياب
- إنشاء التقارير والإحصائيات
- واجهة المستخدم
- **فقط** إرسال طلبات HTTP لـ Evolution API

**لا يقوم بـ:**
- إدارة اتصال WhatsApp مباشرة
- تخزين بيانات WhatsApp
- معالجة بروتوكولات WhatsApp

**التقنيات:**
- React 18
- TypeScript
- IndexedDB (sql.js)
- Tailwind CSS
- Vite

---

### Evolution API Service (الخدمة المستقلة)

**المسؤوليات:**
- إدارة اتصال WhatsApp
- إرسال واستقبال الرسائل
- إدارة Instances المتعددة
- تخزين جلسات WhatsApp في Supabase
- توفير REST API للتطبيقات الخارجية

**لا يقوم بـ:**
- إدارة بيانات التلاميذ
- إنشاء التقارير
- واجهة مستخدم (يوفر فقط API)

**التقنيات:**
- Evolution API v2.1.1
- Docker
- PostgreSQL (Supabase)
- Baileys (WhatsApp Library)
- Node.js

---

## 🌐 نقاط الاتصال (API Endpoints)

### الأساسيات

| Endpoint | Method | الوصف |
|----------|--------|-------|
| `/instance/create` | POST | إنشاء instance جديد |
| `/instance/connect/{instance}` | GET | الحصول على QR Code |
| `/instance/connectionState/{instance}` | GET | حالة الاتصال |
| `/message/sendText/{instance}` | POST | إرسال رسالة نصية |
| `/message/sendMedia/{instance}` | POST | إرسال ملف |

**جميع الطلبات تتطلب:**
```json
Headers: {
  "apikey": "myEvolutionKey2025"
}
```

---

## 🔐 الأمان

### طبقات الحماية

1. **Authentication**
   - API Key مطلوب لجميع الطلبات
   - يجب تغيير الـ API Key الافتراضي في الإنتاج

2. **Network Security**
   - استخدم HTTPS في الإنتاج
   - قيّد الوصول للمنفذ 8080 للعناوين الموثوقة فقط
   - استخدم Firewall لحماية Docker

3. **Database Security**
   - اتصال مشفر بـ Supabase (SSL)
   - بيانات الاعتماد في `.env.evolution` (لا تشاركها)
   - Row Level Security في Supabase

4. **Separation of Concerns**
   - لا يوجد وصول مباشر بين قواعد البيانات
   - كل خدمة معزولة في container أو بيئة خاصة

---

## 📊 إدارة البيانات

### Student System Data (IndexedDB)
```
- students (التلاميذ)
- teachers (المعلمون)
- absences (الغياب)
- schedules (الجداول)
- settings (الإعدادات)
```
**التخزين:** محلي في متصفح المستخدم

---

### Evolution API Data (Supabase)
```
- instances (Instances الـ WhatsApp)
- messages (سجل الرسائل)
- sessions (الجلسات)
- webhooks (إعدادات Webhook)
```
**التخزين:** Supabase PostgreSQL (سحابي)

---

## 🚀 التوسع والتطوير المستقبلي

### إضافة خدمات جديدة

يمكن إضافة خدمات أخرى بنفس النمط:

```
Student System
      ↓
[HTTP API Calls]
      ↓
┌─────────────┬──────────────┬──────────────┐
│ Evolution   │  Email       │  SMS         │
│ API         │  Service     │  Service     │
└─────────────┴──────────────┴──────────────┘
```

كل خدمة:
- في مجلد منفصل
- Docker container خاص
- قاعدة بيانات مستقلة (أو Supabase منفصل)
- API Key خاص

---

### Scaling Evolution API

للمؤسسات الكبيرة:

1. **Multiple Instances**
   - instance لكل فرع/قسم
   - يمكن إدارتهم من نفس Evolution API

2. **Load Balancing**
   - استخدم nginx أو HAProxy
   - وزّع الطلبات على عدة containers

3. **Monitoring**
   - Prometheus + Grafana
   - مراقبة السجلات والأداء

---

## 🛠️ Troubleshooting Architecture

### مشكلة: البرنامج لا يتصل بـ Evolution API

**الأسباب المحتملة:**
1. Evolution API غير مشغّل
   ```bash
   docker ps  # تحقق من الحاوية
   ```

2. خطأ في عنوان URL أو API Key
   - تحقق من الإعدادات في واجهة البرنامج

3. Firewall يمنع الاتصال
   ```bash
   telnet [SERVER_IP] 8080
   ```

4. CORS issue (إذا كان على نطاقات مختلفة)
   - تحقق من إعدادات CORS في `.env.evolution`

---

### مشكلة: Evolution API لا يتصل بـ Supabase

**الأسباب المحتملة:**
1. خطأ في connection string
   - تحقق من `.env.evolution`

2. Supabase لا يسمح بالاتصال من IP الخادم
   - ادخل على Supabase Dashboard → Settings → Database
   - أضف IP الخادم للقائمة البيضاء

3. كلمة مرور خاطئة
   - تأكد من password في connection string

---

## 📝 ملاحظات مهمة للمطورين

### ✅ افعل

- استخدم HTTP API للتواصل بين الخدمات
- احتفظ بكل خدمة في مجلد منفصل
- استخدم متغيرات البيئة للإعدادات
- اكتب documentation واضح
- اختبر كل خدمة بشكل مستقل

### ❌ لا تفعل

- لا تدمج Evolution API في كود المشروع الأصلي
- لا تشارك قواعد البيانات بين الخدمات
- لا تخزن API Keys في الكود
- لا تعدل المشروع الأصلي لإضافة خدمات جديدة
- لا تستخدم متغيرات عامة (globals)

---

## 🎯 الخلاصة

**هذه بنية Microservices بسيطة:**

- كل خدمة مستقلة ومنفصلة
- التواصل عبر HTTP REST API فقط
- لا يوجد تداخل في البيانات أو الكود
- سهولة الصيانة والتطوير
- قابلة للتوسع مستقبلاً

**النتيجة:**
- المشروع الأصلي آمن وغير متأثر
- Evolution API يعمل بشكل مستقل
- سهولة إضافة خدمات جديدة
- مرونة في الاستضافة والإدارة
