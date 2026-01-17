# 📚 فهرس التوثيق - Evolution API v2

## 🎯 من أين أبدأ؟

```
👉 ابدأ من هنا: START_HERE.md
```

---

## 📖 الدليل الكامل

### 1. للمبتدئين - البداية

| الملف | الوصف | متى تقرأه |
|------|-------|-----------|
| **START_HERE.md** | 🚀 نقطة البداية - نظرة شاملة سريعة | **ابدأ من هنا أولاً** |
| **SETUP_GUIDE.md** | 📖 دليل الإعداد الكامل خطوة بخطوة | عند الإعداد الأول |
| **QUICK_REFERENCE.md** | ⚡ مرجع سريع - المعلومات الأساسية | للاستخدام اليومي |

### 2. للتطبيق العملي

| الملف | الوصف | متى تقرأه |
|------|-------|-----------|
| **COMMANDS.txt** | 💻 جميع الأوامر جاهزة للنسخ | عند التنفيذ الفعلي |
| **INTEGRATION_EXAMPLES.md** | 💡 أمثلة كود للربط مع البرنامج | عند برمجة الربط |
| **README.md** | 📚 معلومات عامة وتوثيق | للمراجعة العامة |

### 3. للفهم المتقدم

| الملف | الوصف | متى تقرأه |
|------|-------|-----------|
| **ARCHITECTURE.md** | 🏗️ بنية النظام والفصل بين الخدمات | لفهم الهندسة |
| **docker-compose.yml** | 🐳 تكوين Docker | للمطورين المتقدمين |
| **.env.evolution** | ⚙️ ملف الإعدادات (عدّل هذا!) | **قبل التشغيل** |

---

## 🗂️ التنظيم حسب الموضوع

### 🚀 الإعداد والتشغيل
1. `START_HERE.md` - نظرة عامة
2. `SETUP_GUIDE.md` - خطوات مفصلة
3. `COMMANDS.txt` - الأوامر المباشرة
4. `.env.evolution` - التكوين

### 💻 البرمجة والربط
1. `INTEGRATION_EXAMPLES.md` - أمثلة كود
2. `QUICK_REFERENCE.md` - API سريع
3. `README.md` - التوثيق العام

### 🏗️ الهندسة والبنية
1. `ARCHITECTURE.md` - شرح معماري كامل
2. `docker-compose.yml` - بنية Docker

---

## 📋 سيناريوهات الاستخدام

### "أريد تشغيل Evolution API الآن"
```
1. START_HERE.md (اقرأ الـ 5 خطوات)
2. عدّل .env.evolution
3. انسخ الأوامر من COMMANDS.txt
4. نفّذ
```

### "أريد ربط Evolution مع برنامجي"
```
1. INTEGRATION_EXAMPLES.md (اقرأ الأمثلة)
2. QUICK_REFERENCE.md (للمرجع السريع)
3. ابدأ البرمجة
```

### "أريد فهم كيف يعمل النظام"
```
1. README.md (نظرة عامة)
2. ARCHITECTURE.md (التفاصيل المعمارية)
3. SETUP_GUIDE.md (التفاصيل التقنية)
```

### "عندي مشكلة في التشغيل"
```
1. QUICK_REFERENCE.md → قسم "استكشاف الأخطاء"
2. COMMANDS.txt → قسم "أوامر الصيانة"
3. راجع docker-compose logs
```

---

## 🎓 مسار التعلم المقترح

### المستوى 1: المبتدئ (30 دقيقة)
1. **START_HERE.md** (10 دقائق)
2. عدّل **.env.evolution** (5 دقائق)
3. نفّذ الأوامر من **COMMANDS.txt** (10 دقائق)
4. امسح QR Code واختبر إرسال رسالة (5 دقائق)

### المستوى 2: المطبّق (ساعة)
1. **INTEGRATION_EXAMPLES.md** (20 دقيقة)
2. **QUICK_REFERENCE.md** (15 دقيقة)
3. اكتب كود ربط في برنامجك (25 دقيقة)

### المستوى 3: المتقدم (ساعتان)
1. **ARCHITECTURE.md** (45 دقيقة)
2. **SETUP_GUIDE.md** (30 دقيقة)
3. راجع **docker-compose.yml** (15 دقيقة)
4. تخصيص متقدم (30 دقيقة)

---

## 📊 ملخص سريع للملفات

```
evolution-service/
│
├── START_HERE.md ⭐          ← نقطة البداية الرئيسية
├── INDEX.md (هذا الملف)     ← الفهرس
│
├── 📖 التوثيق الأساسي
│   ├── SETUP_GUIDE.md        ← دليل الإعداد الكامل
│   ├── QUICK_REFERENCE.md    ← مرجع سريع
│   └── README.md             ← معلومات عامة
│
├── 💻 التطبيق العملي
│   ├── COMMANDS.txt          ← أوامر جاهزة
│   └── INTEGRATION_EXAMPLES.md ← أمثلة كود
│
├── 🏗️ المتقدم
│   └── ARCHITECTURE.md       ← بنية النظام
│
└── ⚙️ الإعدادات
    ├── .env.evolution        ← ملف التكوين (عدّل!)
    ├── docker-compose.yml    ← تكوين Docker
    └── .gitignore            ← Git ignore
```

---

## 🎯 Quick Start (أسرع طريقة)

```bash
# 1. عدّل .env.evolution
nano .env.evolution
# (ضع بيانات Supabase)

# 2. شغّل
cd evolution-service
docker-compose up -d

# 3. أنشئ Instance
curl -X POST http://localhost:8080/instance/create \
  -H "Content-Type: application/json" \
  -H "apikey: myEvolutionKey2025" \
  -d '{"instanceName": "school_system", "qrcode": true}'

# 4. امسح QR Code من WhatsApp

# 5. اختبر
curl -X POST http://localhost:8080/message/sendText/school_system \
  -H "apikey: myEvolutionKey2025" \
  -H "Content-Type: application/json" \
  -d '{"number": "212600000000", "text": "test"}'
```

**🎉 جاهز!**

---

## 🔗 روابط خارجية مفيدة

- **التوثيق الرسمي**: https://doc.evolution-api.com
- **GitHub**: https://github.com/EvolutionAPI/evolution-api
- **Discord Community**: https://evolution-api.com/discord
- **Supabase Docs**: https://supabase.com/docs

---

## ❓ الأسئلة الشائعة

### "أي ملف أقرأ أولاً؟"
→ **START_HERE.md**

### "أين الأوامر الجاهزة؟"
→ **COMMANDS.txt**

### "كيف أربط مع برنامجي؟"
→ **INTEGRATION_EXAMPLES.md**

### "أريد فهم البنية؟"
→ **ARCHITECTURE.md**

### "عندي مشكلة، أين الحل؟"
→ **QUICK_REFERENCE.md** (قسم استكشاف الأخطاء)

---

## 📌 ملاحظات مهمة

### ✅ ما تم تنفيذه
- خدمة Evolution API مستقلة تماماً
- لا يوجد أي تعديل على المشروع الأصلي
- جميع الملفات في مجلد `evolution-service/`
- التواصل فقط عبر HTTP API

### ⚠️ تحذيرات
- **لا تعدل** أي ملف خارج هذا المجلد
- **غيّر API Key** قبل الإنتاج
- **استخدم HTTPS** في الإنتاج
- **احمِ المنفذ 8080** بـ Firewall

---

## 🎉 خلاصة

### للبداية السريعة (5 دقائق):
```
START_HERE.md → COMMANDS.txt
```

### للاستخدام اليومي:
```
QUICK_REFERENCE.md
```

### للربط مع البرنامج:
```
INTEGRATION_EXAMPLES.md
```

### للفهم العميق:
```
ARCHITECTURE.md → SETUP_GUIDE.md
```

---

**🚀 ابدأ من: START_HERE.md**
