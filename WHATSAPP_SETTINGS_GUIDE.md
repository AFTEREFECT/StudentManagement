# دليل إعدادات واتساب

## التخزين المستخدم: localStorage

تم تغيير نظام حفظ إعدادات واتساب إلى **localStorage** لضمان الحفظ الدائم.

## المميزات

### ✅ الحفظ الدائم
- البيانات محفوظة في `localStorage`
- لن تضيع حتى لو أغلقت المتصفح
- لن تضيع حتى لو مسحت IndexedDB
- لن تضيع حتى لو أعدت تحميل الصفحة

### ✅ البساطة
- نظام بسيط وموثوق
- لا يحتاج إلى IndexedDB معقد
- سريع في القراءة والكتابة

### ✅ التوافقية
- يعمل على جميع المتصفحات الحديثة
- متوافق مع جميع الأجهزة

## البيانات المحفوظة

يتم حفظ البيانات التالية:

```json
{
  "instance_id": "68F7F1D4912EE",
  "access_token": "••••••••••••",
  "is_active": true
}
```

## المفتاح المستخدم

```
whatsapp_config
```

## كيفية الاختبار

### 1. افتح DevTools (F12)
### 2. اذهب إلى Console
### 3. جرب الأوامر التالية:

```javascript
// عرض الإعدادات المحفوظة
console.log(JSON.parse(localStorage.getItem('whatsapp_config')));

// حفظ إعدادات تجريبية
localStorage.setItem('whatsapp_config', JSON.stringify({
  instance_id: 'TEST-123',
  access_token: 'TOKEN-456',
  is_active: true
}));

// حذف الإعدادات
localStorage.removeItem('whatsapp_config');
```

## الملفات المعدلة

### 1. `/src/components/WhatsAppSettings.tsx`
- `loadSettings()` - يقرأ من localStorage
- `handleSave()` - يحفظ في localStorage

### 2. `/src/utils/database.ts`
- `getWhatsAppSettings()` - يقرأ من localStorage بدلاً من IndexedDB

## الاستخدام في الصفحات الأخرى

جميع الصفحات التي تستخدم واتساب ستحصل على الإعدادات من localStorage:

```typescript
const settings = await dbManager.getWhatsAppSettings();
// settings.instanceId
// settings.apiKey
// settings.isActive
```

## ملاحظات مهمة

⚠️ **localStorage لا يُمسح إلا في الحالات التالية:**
- مسح بيانات المتصفح يدوياً (Clear browsing data)
- استخدام وضع التصفح الخفي (Incognito)
- استخدام أدوات تنظيف مثل CCleaner

✅ **localStorage يبقى في الحالات التالية:**
- إعادة تحميل الصفحة
- إغلاق وفتح المتصفح
- إعادة تشغيل الكمبيوتر
- تحديث المتصفح
- مسح IndexedDB أو الكوكيز العادية

## الأمان

🔒 البيانات محفوظة محلياً في جهاز المستخدم فقط
🔒 لا يتم إرسالها إلى أي خادم
🔒 كل مستخدم لديه إعداداته الخاصة

## استكشاف الأخطاء

### المشكلة: الإعدادات لا تُحفظ
**الحل:**
1. افتح DevTools (F12)
2. اذهب إلى Application → Local Storage
3. تأكد من وجود `whatsapp_config`
4. تحقق من Console للأخطاء

### المشكلة: الإعدادات تختفي
**الحل:**
1. تأكد أنك لا تستخدم وضع التصفح الخفي
2. تأكد من عدم استخدام برامج تنظيف تلقائية
3. تحقق من إعدادات المتصفح (لا يمسح localStorage تلقائياً)

## الدعم

للمساعدة أو الاستفسارات:
📧 afterefectss@gmail.com
