# 📋 مرجع سريع - Evolution API v2

## 🎯 المعلومات الأساسية

| المعلومة | القيمة |
|---------|--------|
| **URL** | `http://localhost:8080` |
| **API Key** | `myEvolutionKey2025` |
| **Instance Name** | `school_system` |
| **المنفذ** | `8080` |
| **قاعدة البيانات** | Supabase PostgreSQL |

---

## ⚡ الأوامر الأساسية

### تشغيل الخدمة
```bash
cd evolution-service
docker-compose up -d
```

### إيقاف الخدمة
```bash
docker-compose down
```

### مشاهدة السجلات
```bash
docker-compose logs -f
```

### إعادة تشغيل
```bash
docker-compose restart
```

---

## 🔗 API Endpoints الأساسية

### 1. إنشاء Instance
```bash
POST /instance/create
Headers: { "apikey": "myEvolutionKey2025" }
Body: { "instanceName": "school_system", "qrcode": true }
```

### 2. الحصول على QR Code
```bash
GET /instance/connect/school_system
Headers: { "apikey": "myEvolutionKey2025" }
```

### 3. حالة الاتصال
```bash
GET /instance/connectionState/school_system
Headers: { "apikey": "myEvolutionKey2025" }
```

### 4. إرسال رسالة نصية
```bash
POST /message/sendText/school_system
Headers: { "apikey": "myEvolutionKey2025", "Content-Type": "application/json" }
Body: { "number": "212600000000", "text": "الرسالة" }
```

### 5. إرسال ملف
```bash
POST /message/sendMedia/school_system
Headers: { "apikey": "myEvolutionKey2025", "Content-Type": "application/json" }
Body: { "number": "212600000000", "mediatype": "document", "media": "https://...", "caption": "..." }
```

---

## 💻 أمثلة كود سريعة

### إرسال رسالة (JavaScript/TypeScript)
```typescript
const sendMessage = async (phone: string, text: string) => {
  const response = await fetch('http://localhost:8080/message/sendText/school_system', {
    method: 'POST',
    headers: {
      'apikey': 'myEvolutionKey2025',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ number: phone, text })
  });
  return response.json();
};

// الاستخدام
await sendMessage('212600000000', 'مرحبا');
```

### التحقق من حالة الاتصال
```typescript
const checkConnection = async () => {
  const response = await fetch('http://localhost:8080/instance/connectionState/school_system', {
    headers: { 'apikey': 'myEvolutionKey2025' }
  });
  const data = await response.json();
  return data.state; // 'open', 'close', 'connecting'
};
```

---

## 🔧 تنسيق رقم الهاتف

### ✅ صحيح
```
212600000000     (المغرب)
966500000000     (السعودية)
201000000000     (مصر)
```

### ❌ خطأ
```
+212 6 00 00 00 00
0600000000
212-6-00-00-00-00
```

**القاعدة:** رمز الدولة + الرقم (بدون + أو - أو مسافات)

---

## 🛠️ استكشاف الأخطاء السريع

### الخدمة لا تعمل
```bash
docker ps  # تحقق من الحاوية
docker-compose logs evolution-api  # اقرأ الأخطاء
docker-compose restart  # إعادة تشغيل
```

### خطأ في الاتصال
```bash
curl http://localhost:8080/  # اختبار بسيط
telnet localhost 8080  # اختبار المنفذ
```

### QR Code لا يظهر
```bash
curl http://localhost:8080/instance/connect/school_system \
  -H "apikey: myEvolutionKey2025"
```

### خطأ Database
- تحقق من `.env.evolution`
- تأكد من صحة كلمة المرور
- تحقق من Project ID في Supabase

---

## 📊 حالات Instance

| الحالة | المعنى |
|-------|--------|
| `open` | متصل وجاهز للإرسال ✅ |
| `close` | غير متصل ❌ |
| `connecting` | جاري الاتصال... ⏳ |

---

## 🔐 الأمان

### تغيير API Key (للإنتاج)
1. افتح `.env.evolution`
2. غيّر:
   ```env
   AUTHENTICATION_API_KEY=your_secure_key_here_123456
   ```
3. أعد تشغيل:
   ```bash
   docker-compose restart
   ```

### فتح المنفذ (Firewall)
```bash
# السماح فقط من IP محدد
sudo ufw allow from [IP_ALLOWED] to any port 8080

# أو السماح للجميع (غير آمن)
sudo ufw allow 8080
```

---

## 📚 الملفات المرجعية

| الملف | متى تقرأه |
|------|-----------|
| `START_HERE.md` | البداية - نظرة شاملة |
| `SETUP_GUIDE.md` | الإعداد الأول خطوة بخطوة |
| `COMMANDS.txt` | أوامر جاهزة للنسخ |
| `INTEGRATION_EXAMPLES.md` | أمثلة كود متقدمة |
| `ARCHITECTURE.md` | فهم بنية النظام |
| هذا الملف | مرجع سريع للاستخدام اليومي |

---

## 🎓 سيناريوهات شائعة

### إرسال إشعار غياب
```typescript
const notifyAbsence = async (studentName: string, parentPhone: string, days: number) => {
  const message = `
السلام عليكم
ابنكم/ابنتكم ${studentName} تغيب ${days} يوم
يرجى التواصل مع الإدارة
  `.trim();

  return await sendMessage(parentPhone, message);
};
```

### إرسال تقرير PDF
```typescript
const sendReport = async (phone: string, pdfUrl: string) => {
  const response = await fetch('http://localhost:8080/message/sendMedia/school_system', {
    method: 'POST',
    headers: {
      'apikey': 'myEvolutionKey2025',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      number: phone,
      mediatype: 'document',
      media: pdfUrl,
      caption: 'تقرير الغياب الشهري'
    })
  });
  return response.json();
};
```

### إرسال جماعي مع تأخير
```typescript
const sendBulk = async (contacts: Array<{phone: string, message: string}>) => {
  for (const contact of contacts) {
    await sendMessage(contact.phone, contact.message);
    await new Promise(r => setTimeout(r, 1000)); // انتظار ثانية
  }
};
```

---

## 🌐 الوصول عن بعد

### من جهاز آخر في نفس الشبكة
```
http://[IP_LOCAL]:8080
مثال: http://192.168.1.100:8080
```

### من الإنترنت (يتطلب إعداد)
1. افتح المنفذ 8080 في الراوتر (Port Forwarding)
2. استخدم Domain أو IP عام
3. ⚠️ **احذر**: استخدم HTTPS وغيّر API Key!

---

## 📞 الدعم

- **التوثيق**: https://doc.evolution-api.com
- **GitHub**: https://github.com/EvolutionAPI/evolution-api
- **Discord**: https://evolution-api.com/discord

---

## ✅ Checklist سريع

- [ ] عدّلت `.env.evolution` ببيانات Supabase
- [ ] شغّلت `docker-compose up -d`
- [ ] أنشأت Instance بـ `POST /instance/create`
- [ ] مسحت QR Code من WhatsApp
- [ ] تحققت من الاتصال بـ `GET /instance/connectionState`
- [ ] أرسلت رسالة تجريبية
- [ ] البرنامج يتصل بـ Evolution API

---

**🎉 جاهز للاستخدام!**
