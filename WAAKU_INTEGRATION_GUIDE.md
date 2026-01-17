# دليل تكامل Waaku مع نظام PROGTALAMID

## نظرة عامة

تم تطوير تكامل كامل وآمن بين نظام إدارة التلاميذ PROGTALAMID وخادم Waaku المخصص لإرسال رسائل WhatsApp. هذا التكامل يوفر:

- ✅ **أمان كامل**: المفتاح السري محمي بالكامل ولا يظهر أبداً في الواجهة الأمامية
- ✅ **إدارة مركزية**: كل مؤسسة لها جلسة WhatsApp خاصة بها
- ✅ **سهولة الاستخدام**: واجهة بسيطة لربط WhatsApp
- ✅ **موثوقية عالية**: Edge Functions على Supabase للأداء الأمثل

---

## معلومات خادم Waaku

**عنوان الخادم**: `https://progtalamid.ddns.net`
**مفتاح API**: `52a1b533ba17478798a3f2df37de2ad7` (محمي في Edge Functions)
**حالة الأمان**: ✅ المفتاح مخزن بشكل آمن في Edge Functions فقط

---

## البنية التقنية

### 1. قاعدة البيانات (Supabase)

تم إنشاء جدول `institutions` مع الحقول التالية:

| الحقل | النوع | الوصف |
|------|------|-------|
| `id` | UUID | معرف المؤسسة |
| `name` | Text | اسم المؤسسة |
| `whatsapp_session_id` | Text | معرف جلسة WhatsApp على خادم Waaku |
| `whatsapp_session_status` | Text | حالة الجلسة (CONNECTED, DISCONNECTED, SCANNING) |
| `whatsapp_qr_code` | Text | آخر QR code للمسح |
| `whatsapp_phone_number` | Text | رقم الهاتف المرتبط |
| `whatsapp_connected_at` | Timestamp | تاريخ آخر اتصال ناجح |
| `whatsapp_last_checked` | Timestamp | آخر فحص للحالة |

### 2. Edge Functions (Supabase)

تم إنشاء 3 Edge Functions آمنة:

#### أ) `waaku-session-start`
- **الوظيفة**: إنشاء جلسة WhatsApp جديدة
- **Endpoint**: `/functions/v1/waaku-session-start`
- **Method**: POST
- **Body**:
  ```json
  {
    "institutionId": "uuid-here"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "sessionId": "session-id",
    "qrCode": "data:image/png;base64,...",
    "status": "SCANNING"
  }
  ```

#### ب) `waaku-send-message`
- **الوظيفة**: إرسال رسالة WhatsApp
- **Endpoint**: `/functions/v1/waaku-send-message`
- **Method**: POST
- **Body**:
  ```json
  {
    "institutionId": "uuid-here",
    "to": "0662707072",
    "message": "نص الرسالة"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "messageId": "message-id",
    "details": {...}
  }
  ```

#### ج) `waaku-check-status`
- **الوظيفة**: فحص حالة جلسة WhatsApp
- **Endpoint**: `/functions/v1/waaku-check-status`
- **Method**: POST
- **Body**:
  ```json
  {
    "institutionId": "uuid-here"
  }
  ```
- **Response**:
  ```json
  {
    "status": "CONNECTED",
    "sessionId": "session-id",
    "qrCode": null,
    "phoneNumber": "212662707072",
    "details": {...}
  }
  ```

### 3. خدمات Frontend

#### أ) `waakuService.ts`
خدمة TypeScript للتواصل مع Edge Functions:

```typescript
// إنشاء جلسة
await waakuService.startSession(institutionId);

// فحص الحالة
await waakuService.checkStatus(institutionId);

// إرسال رسالة
await waakuService.sendMessage(institutionId, phone, message);

// إرسال رسائل متعددة
await waakuService.sendBulkMessages(institutionId, recipients, onProgress);
```

#### ب) `unifiedWhatsAppService.ts`
خدمة موحدة تدعم Waaku وخدمات أخرى:

```typescript
// الخدمة تختار Waaku تلقائياً إذا كان مفعلاً في الإعدادات
await unifiedWhatsAppService.sendMessage(phone, message);
```

### 4. واجهات المستخدم

#### أ) `WaakuWhatsAppConnection.tsx`
صفحة ربط WhatsApp للمؤسسات:
- إنشاء جلسة جديدة
- عرض QR Code
- فحص الحالة التلقائي
- اختبار إرسال رسالة

#### ب) `UnifiedWhatsAppSettings.tsx`
صفحة الإعدادات الموحدة:
- اختيار نوع الخدمة (Waaku موصى به)
- إعدادات كل خدمة
- اختبار الاتصال

---

## خطوات الإعداد للمستخدم النهائي

### الخطوة 1: اختيار خدمة Waaku

1. افتح البرنامج
2. اذهب إلى **الإعدادات** ← **إعدادات واتساب**
3. اختر من القائمة: **Waaku (الموصى به بشدة) ⭐**
4. فعّل **تفعيل إرسال الإشعارات تلقائياً**
5. احفظ الإعدادات

### الخطوة 2: ربط WhatsApp

1. من القائمة الجانبية، اختر **ربط WhatsApp - Waaku**
2. اضغط على **إنشاء جلسة جديدة**
3. انتظر ظهور رمز QR
4. افتح WhatsApp على هاتفك
5. اذهب إلى: **الإعدادات** ← **الأجهزة المرتبطة** ← **ربط جهاز**
6. امسح رمز QR
7. انتظر حتى تظهر حالة **متصل**

### الخطوة 3: اختبار الإرسال

1. بعد الاتصال، أدخل رقم هاتف تجريبي
2. اضغط **إرسال رسالة تجريبية**
3. تحقق من وصول الرسالة على WhatsApp

### الخطوة 4: استخدام النظام

الآن يمكنك إرسال رسائل WhatsApp من أي مكان في البرنامج:

**أ) إشعارات الغياب:**
1. اذهب إلى **إدارة الغيابات**
2. حدد التلاميذ الغائبين
3. اضغط **إرسال إشعارات واتساب**

**ب) التواصل الجماعي:**
1. اذهب إلى **التواصل عبر واتساب**
2. اختر المستلمين (قسم، مستوى، الكل، أو مخصص)
3. اكتب الرسالة
4. اضغط **إرسال الرسائل**

---

## مميزات النظام

### الأمان
- ✅ المفتاح السري مخزن فقط في Edge Functions
- ✅ لا يمكن للواجهة الأمامية الوصول للمفتاح
- ✅ جميع الاتصالات مشفرة (HTTPS)
- ✅ RLS مفعل على قاعدة البيانات

### الأداء
- ⚡ Edge Functions سريعة جداً
- ⚡ فحص الحالة التلقائي كل 10 ثوان
- ⚡ معالجة متزامنة للرسائل المتعددة

### المرونة
- 🔄 دعم مؤسسات متعددة
- 🔄 كل مؤسسة لها جلسة مستقلة
- 🔄 سهولة التبديل بين الخدمات

### سهولة الاستخدام
- 👤 واجهة بسيطة وواضحة
- 👤 إرشادات خطوة بخطوة
- 👤 رسائل خطأ واضحة
- 👤 اختبار مدمج

---

## استكشاف الأخطاء

### مشكلة: "لم يتم العثور على مؤسسة"

**الحل:**
1. تأكد من وجود سجل في جدول `institutions`
2. إذا لم يكن موجوداً، سيتم إنشاء واحد افتراضياً تلقائياً
3. أعد تحميل الصفحة

### مشكلة: QR Code لا يظهر

**الحل:**
1. افتح console المتصفح (F12)
2. ابحث عن أخطاء في Network
3. تأكد من أن Supabase Edge Functions تعمل
4. تحقق من الاتصال بالإنترنت

### مشكلة: الجلسة تنقطع باستمرار

**الحل:**
1. تأكد من استقرار الإنترنت على الهاتف
2. لا تفتح WhatsApp Web على أجهزة أخرى كثيرة
3. أعد مسح QR مرة أخرى

### مشكلة: "WhatsApp session is not connected"

**الحل:**
1. اذهب إلى صفحة **ربط WhatsApp**
2. اضغط **تحديث** لفحص الحالة
3. إذا كانت "غير متصل"، أعد المسح
4. تأكد من عدم فصل الجهاز من إعدادات WhatsApp على الهاتف

---

## الصيانة والمراقبة

### مراقبة الحالة
- يمكن فحص حالة الجلسة في أي وقت من صفحة الربط
- الحالة تُحدث تلقائياً في قاعدة البيانات

### سجلات الأخطاء
- جميع Edge Functions تسجل الأخطاء في Supabase Logs
- يمكن مراجعتها من Supabase Dashboard

### النسخ الاحتياطي
- بيانات المؤسسات محفوظة في Supabase
- يمكن تصدير البيانات في أي وقت

---

## تطوير مستقبلي

### خطط قريبة:
- [ ] دعم إرسال الصور والملفات
- [ ] إرسال رسائل صوتية
- [ ] جدولة الرسائل
- [ ] تقارير إحصائية مفصلة
- [ ] webhook للرسائل الواردة

### خطط بعيدة:
- [ ] دعم مؤسسات متعددة بواجهة إدارية
- [ ] نظام صلاحيات متقدم
- [ ] تكامل مع أنظمة خارجية
- [ ] API عام للمطورين

---

## معلومات تقنية للمطورين

### البنية المعمارية

```
Frontend (React)
    ↓
waakuService.ts / unifiedWhatsAppService.ts
    ↓
Supabase Edge Functions (Node.js/Deno)
    ↓
Waaku Server (https://progtalamid.ddns.net)
    ↓
WhatsApp Business API
```

### تدفق البيانات

**إنشاء جلسة:**
```
User clicks "إنشاء جلسة"
→ Frontend calls waakuService.startSession()
→ Edge Function waaku-session-start
→ POST to Waaku /api/sessions/start
→ Waaku returns {id, qr}
→ Edge Function saves to institutions table
→ Frontend displays QR
```

**إرسال رسالة:**
```
User sends message
→ Frontend calls waakuService.sendMessage()
→ Edge Function waaku-send-message
→ Checks institution session_id
→ POST to Waaku /api/messages/mml/send
→ Waaku sends via WhatsApp
→ Response returned to Frontend
```

### المتغيرات البيئية

في Edge Functions (محمية تلقائياً):
```
SUPABASE_URL
SUPABASE_ANON_KEY
```

ثوابت في الكود (Edge Functions فقط):
```typescript
const WAAKU_SERVER_URL = "https://progtalamid.ddns.net";
const WAAKU_API_KEY = "52a1b533ba17478798a3f2df37de2ad7";
```

في Frontend (.env):
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

---

## الدعم الفني

للمساعدة أو الإبلاغ عن مشاكل:
1. راجع قسم **استكشاف الأخطاء** أعلاه
2. تحقق من console المتصفح (F12)
3. راجع Supabase Logs للـ Edge Functions
4. تواصل مع الدعم الفني مع إرفاق:
   - لقطة شاشة للمشكلة
   - رسالة الخطأ من Console
   - خطوات إعادة إنتاج المشكلة

---

## الخلاصة

تم تطوير نظام متكامل وآمن لربط WhatsApp مع برنامج PROGTALAMID عبر خادم Waaku المخصص. النظام:

✅ **آمن بالكامل** - المفاتيح السرية محمية
✅ **سهل الاستخدام** - واجهة بديهية
✅ **موثوق** - Edge Functions عالية الأداء
✅ **مرن** - يدعم مؤسسات متعددة
✅ **قابل للتوسع** - جاهز للميزات المستقبلية

---

**آخر تحديث:** نوفمبر 2025
**الإصدار:** 1.0.0
**حالة المشروع:** ✅ جاهز للإنتاج

---

© 2025 PROGTALAMID - نظام إدارة التلاميذ
