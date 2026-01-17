# دليل استخدام Green API

## نظرة عامة

تم إضافة دعم **Green API** كبديل لـ CallMeBot/WhapiPlus لإرسال رسائل WhatsApp في نظام إدارة التلاميذ.

---

## ✅ ما تم إنجازه

### 1. قاعدة البيانات
- ✅ إضافة حقول Green API إلى جدول `whatsapp_settings`:
  - `api_provider` - الخدمة المستخدمة (callmebot أو greenapi)
  - `green_api_instance` - رقم الـ Instance
  - `green_api_token` - التوكن
  - `green_api_enabled` - هل Green API مفعل

### 2. الواجهة
- ✅ تحديث صفحة إعدادات WhatsApp لدعم كلا الخيارين
- ✅ إضافة أزرار تبديل بين CallMeBot و Green API
- ✅ إضافة شعار Green API
- ✅ حقول منفصلة لكل خدمة

### 3. خدمة الإرسال
- ✅ إنشاء `whatsappService.ts` - خدمة موحدة للإرسال
- ✅ دعم تلقائي لاختيار الخدمة المفعلة
- ✅ دالة `sendWhatsAppMessage()` - إرسال رسالة واحدة
- ✅ دالة `sendBulkWhatsAppMessages()` - إرسال متعدد

---

## 🔧 كيفية الاستخدام

### الخطوة 1: الحصول على بيانات Green API

1. سجل في [Green API](https://green-api.com/)
2. أنشئ Instance جديد
3. احصل على:
   - **Instance ID** (مثال: `7107356829`)
   - **API Token** (مثال: `047f9fbc3218430fb30e64a7a29474f8966e84849a474cc89f`)

### الخطوة 2: إعداد البرنامج

1. افتح **إعدادات WhatsApp**
2. اختر **Green API** من الأزرار العلوية
3. أدخل البيانات:
   - **Instance ID**: الرقم الخاص بك
   - **API Token**: التوكن الخاص بك
4. اضغط **حفظ الإعدادات**

### الخطوة 3: اختبار الإرسال

1. في قسم "اختبار الإرسال"
2. أدخل رقم هاتف بالصيغة الدولية (مثال: `212612345678`)
3. اضغط **إرسال تجريبي**
4. يجب أن تصل رسالة تجريبية

---

## 📱 صيغة الأرقام

### Green API
```
212612345678
```
يتم إضافة `@c.us` تلقائياً

### CallMeBot/WhapiPlus
```
212612345678
```
نفس الصيغة

---

## 💻 للمطورين

### استخدام الخدمة الموحدة

```typescript
import { sendWhatsAppMessage } from '../utils/whatsappService';

// إرسال رسالة واحدة
const result = await sendWhatsAppMessage('212612345678', 'مرحباً!');

if (result.success) {
  console.log('تم الإرسال بنجاح');
} else {
  console.error('فشل الإرسال:', result.message);
}
```

### إرسال رسائل متعددة

```typescript
import { sendBulkWhatsAppMessages } from '../utils/whatsappService';

const messages = [
  { phone: '212612345678', message: 'مرحباً محمد' },
  { phone: '212623456789', message: 'مرحباً فاطمة' }
];

const result = await sendBulkWhatsAppMessages(messages);
console.log(`نجح: ${result.success}, فشل: ${result.failed}`);
```

### التبديل بين الخدمات

الخدمة تختار تلقائياً بناءً على الإعدادات:
- إذا `green_api_enabled = true` → استخدام Green API
- إذا `green_api_enabled = false` → استخدام CallMeBot

---

## 🔗 API Reference

### Green API

**Endpoint:**
```
POST https://7103.api.green-api.com/waInstance{instanceId}/sendMessage/{token}
```

**Body:**
```json
{
  "chatId": "212612345678@c.us",
  "message": "نص الرسالة"
}
```

**Response (Success):**
```json
{
  "idMessage": "3EB0C767D097EDAD86C4"
}
```

---

## ⚙️ ملفات النظام

### الملفات المحدثة:
1. `/src/components/WhatsAppSettings.tsx` - واجهة الإعدادات
2. `/src/utils/database.ts` - إضافة حقول Green API
3. `/src/utils/whatsappService.ts` - **جديد** - خدمة الإرسال
4. `/supabase/migrations/20251024131500_add_green_api_support.sql` - Migration

### الملفات التي يمكن تحديثها (اختياري):
- `/src/components/AbsenceManagement.tsx`
- `/src/components/WhatsAppCommunication.tsx`
- `/src/components/CredentialsManagement.tsx`

**التحديث:** استبدل استدعاءات API المباشرة بـ:
```typescript
import { sendWhatsAppMessage } from '../utils/whatsappService';
```

---

## 🎯 المزايا

### Green API
✅ واجهة API واضحة ومباشرة
✅ دعم فني جيد
✅ استقرار عالي
✅ توثيق شامل

### CallMeBot/WhapiPlus
✅ سهل الإعداد
✅ لا يحتاج تسجيل معقد
✅ مجاني للاستخدام الخفيف

---

## 🛠️ استكشاف الأخطاء

### المشكلة: "بيانات Green API غير مكتملة"
**الحل:** تأكد من إدخال Instance ID و Token بشكل صحيح

### المشكلة: "فشل الإرسال عبر Green API"
**الحل:**
1. تحقق من Instance ID و Token
2. تأكد من أن Instance نشط في لوحة Green API
3. تحقق من صيغة رقم الهاتف

### المشكلة: لا تصل الرسائل
**الحل:**
1. جرب رقمك الشخصي أولاً
2. تأكد من أن WhatsApp مفعل على الرقم
3. تحقق من الصيغة الدولية للرقم

---

## 📞 الدعم

للمساعدة في Green API:
- الموقع: https://green-api.com/
- التوثيق: https://green-api.com/docs/
- الدعم: support@green-api.com

للمساعدة في البرنامج:
- البريد: progmawarid@gmail.com

---

## ✨ الخلاصة

✅ دعم كامل لـ Green API
✅ خيار التبديل بين الخدمات
✅ واجهة موحدة للإرسال
✅ سهل الاستخدام والتكامل

**ابدأ الآن بإرسال رسائل WhatsApp بسهولة!** 🚀
