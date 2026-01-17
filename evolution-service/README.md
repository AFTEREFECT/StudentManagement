# Evolution API v2 - Standalone Service

هذه خدمة مستقلة تمامًا عن نظام إدارة التلاميذ الرئيسي.

## التثبيت والإعداد

### 1. تحديث ملف `.env.evolution`

افتح الملف `.env.evolution` وقم بتحديث القيم التالية:

```env
DATABASE_CONNECTION_URI=postgresql://postgres:[كلمة_المرور]@db.[project-id].supabase.co:5432/postgres?schema=public
```

استبدل:
- `[كلمة_المرور]` بكلمة مرور قاعدة البيانات من Supabase
- `[project-id]` بمعرف المشروع من Supabase

### 2. تشغيل الخدمة

```bash
cd evolution-service
docker-compose up -d
```

### 3. التحقق من التشغيل

```bash
docker-compose logs -f
```

### 4. اختبار الاتصال

```bash
curl http://localhost:8080/
```

## الربط مع نظام إدارة التلاميذ

### من داخل البرنامج، يمكنك إرسال رسائل عبر:

```typescript
const response = await fetch('http://[SERVER_IP]:8080/message/sendText/[INSTANCE_NAME]', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': 'myEvolutionKey2025'
  },
  body: JSON.stringify({
    number: '2126XXXXXXXX',
    text: 'مرحبا بك في منظومتنا التعليمية!'
  })
});
```

## الأوامر المفيدة

```bash
# إيقاف الخدمة
docker-compose down

# إعادة تشغيل الخدمة
docker-compose restart

# مشاهدة السجلات
docker-compose logs -f evolution-api

# حذف الخدمة بالكامل (مع البيانات)
docker-compose down -v
```

## المعلومات المهمة

- **المنفذ**: 8080
- **API Key**: myEvolutionKey2025
- **قاعدة البيانات**: Supabase PostgreSQL
- **التوثيق الكامل**: https://doc.evolution-api.com

## ملاحظات الأمان

1. **لا تشارك API Key مع أحد**
2. **تأكد من فتح المنفذ 8080 فقط للعناوين الموثوقة**
3. **استخدم HTTPS في الإنتاج**
4. **قم بتغيير API Key الافتراضي**

## إنشاء Instance جديد

```bash
curl -X POST http://localhost:8080/instance/create \
  -H "Content-Type: application/json" \
  -H "apikey: myEvolutionKey2025" \
  -d '{
    "instanceName": "school_system",
    "qrcode": true
  }'
```

سيعود لك QR Code لمسحه من WhatsApp.

## الحصول على QR Code

```bash
curl http://localhost:8080/instance/connect/school_system \
  -H "apikey: myEvolutionKey2025"
```

---

**هام**: هذه الخدمة مستقلة تمامًا. لا تقم بتعديل أي ملفات في المجلد الرئيسي للمشروع.
