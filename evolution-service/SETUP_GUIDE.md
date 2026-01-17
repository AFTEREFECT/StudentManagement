# دليل الإعداد السريع - Evolution API v2

## الخطوات المطلوبة

### 1️⃣ الحصول على بيانات Supabase

1. افتح لوحة تحكم Supabase: https://supabase.com/dashboard
2. اختر مشروعك أو أنشئ مشروع جديد
3. من القائمة الجانبية، اختر **Settings** > **Database**
4. انسخ القيم التالية:
   - **Host**: `db.[project-id].supabase.co`
   - **Database name**: `postgres`
   - **Port**: `5432`
   - **User**: `postgres`
   - **Password**: [كلمة المرور]

### 2️⃣ تحديث ملف الإعدادات

افتح الملف `.env.evolution` في هذا المجلد وعدّل السطر:

```env
DATABASE_CONNECTION_URI=postgresql://postgres:[PASSWORD]@db.[PROJECT_ID].supabase.co:5432/postgres?schema=public
```

**مثال**:
```env
DATABASE_CONNECTION_URI=postgresql://postgres:mySecretPassword123@db.abcdefghijklmn.supabase.co:5432/postgres?schema=public
```

### 3️⃣ التأكد من تثبيت Docker

```bash
docker --version
docker-compose --version
```

إذا لم يكن مثبتًا، قم بتثبيته من: https://docs.docker.com/get-docker/

### 4️⃣ تشغيل Evolution API

```bash
cd evolution-service
docker-compose up -d
```

### 5️⃣ التحقق من نجاح التشغيل

```bash
# مشاهدة السجلات
docker-compose logs -f

# اختبار الاتصال
curl http://localhost:8080/
```

يجب أن ترى استجابة من Evolution API.

### 6️⃣ إنشاء Instance واتصال WhatsApp

```bash
curl -X POST http://localhost:8080/instance/create \
  -H "Content-Type: application/json" \
  -H "apikey: myEvolutionKey2025" \
  -d '{
    "instanceName": "school_system",
    "qrcode": true,
    "integration": "WHATSAPP-BAILEYS"
  }'
```

سيعود لك response يحتوي على QR Code. قم بمسحه من تطبيق WhatsApp:
1. افتح WhatsApp
2. اذهب إلى الإعدادات > الأجهزة المرتبطة
3. امسح QR Code

---

## الربط مع برنامج إدارة التلاميذ

### إضافة Evolution API للبرنامج

في إعدادات WhatsApp داخل البرنامج، أضف:

- **نوع الخدمة**: Evolution API v2
- **URL الخادم**: `http://[IP_SERVER]:8080`
- **API Key**: `myEvolutionKey2025`
- **Instance Name**: `school_system`

### مثال كود للإرسال (مرجعي فقط)

```typescript
// هذا الكود موجود بالفعل في البرنامج - لا حاجة لإضافته
const sendMessage = async (phone: string, message: string) => {
  const response = await fetch(`${evolutionURL}/message/sendText/${instanceName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': 'myEvolutionKey2025'
    },
    body: JSON.stringify({
      number: phone,
      text: message
    })
  });
  return response.json();
};
```

---

## استكشاف الأخطاء

### المشكلة: لا يمكن الاتصال بـ Evolution API

```bash
# تحقق من حالة الحاوية
docker ps

# تحقق من السجلات
docker-compose logs evolution-api

# أعد تشغيل الخدمة
docker-compose restart
```

### المشكلة: خطأ في الاتصال بقاعدة البيانات

- تأكد من صحة كلمة المرور والـ Project ID في `.env.evolution`
- تحقق من أن قاعدة Supabase تعمل
- تأكد من السماح بالاتصالات من IP الخادم في إعدادات Supabase

### المشكلة: QR Code لا يظهر

```bash
curl http://localhost:8080/instance/qrcode/school_system \
  -H "apikey: myEvolutionKey2025"
```

---

## معلومات مهمة

### الملفات المهمة
- `.env.evolution` - إعدادات Evolution API
- `docker-compose.yml` - تكوين Docker
- هذا الملف (`SETUP_GUIDE.md`) - دليل الإعداد

### لا تلمس هذه الملفات
- أي ملف في المجلد الرئيسي للمشروع
- `package.json` في المجلد الرئيسي
- أي ملف في `src/` أو `public/`

### البيانات الحساسة
- **API Key**: `myEvolutionKey2025` (قم بتغييره في الإنتاج)
- **Database Password**: محفوظ في `.env.evolution`

---

## الدعم والتوثيق

- **التوثيق الرسمي**: https://doc.evolution-api.com
- **GitHub**: https://github.com/EvolutionAPI/evolution-api
- **مجتمع Discord**: https://evolution-api.com/discord

---

✅ **بعد إتمام هذه الخطوات، ستكون Evolution API جاهزة للعمل بشكل مستقل تمامًا**
