# دليل التثبيت والإعداد

## متطلبات النظام

### الحد الأدنى
- Node.js 18.0.0 أو أحدث
- npm 8.0.0 أو أحدث
- متصفح حديث (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- ذاكرة RAM: 2GB
- مساحة قرص صلب: 500MB

### الموصى به
- Node.js 20.0.0 أو أحدث
- npm 10.0.0 أو أحدث
- متصفح Chrome أو Edge (للأداء الأمثل)
- ذاكرة RAM: 4GB أو أكثر
- مساحة قرص صلب: 2GB

## خطوات التثبيت

### 1. تحميل المشروع

```bash
# إذا كان لديك Git
git clone [repository-url]
cd student-management-system

# أو تحميل ملف ZIP وفك الضغط
```

### 2. تثبيت المتطلبات

```bash
# تثبيت جميع المكتبات المطلوبة
npm install

# في حالة وجود مشاكل، جرب:
npm install --legacy-peer-deps
```

### 3. التشغيل الأولي

```bash
# تشغيل الخادم المحلي
npm run dev

# سيفتح المتصفح تلقائياً على:
# http://localhost:5173
```

## الإعداد المتقدم

### 1. إعداد الشبكة المحلية

لتمكين الوصول من الهواتف الذكية:

```bash
# تشغيل على جميع واجهات الشبكة
npm run dev -- --host 0.0.0.0 --port 5173
```

### 2. إعداد جدار الحماية

#### Windows
```cmd
# السماح للمنفذ 5173
netsh advfirewall firewall add rule name="Student Management System" dir=in action=allow protocol=TCP localport=5173
```

#### macOS
```bash
# إضافة استثناء لجدار الحماية
sudo pfctl -f /etc/pf.conf
```

#### Linux (Ubuntu/Debian)
```bash
# السماح للمنفذ 5173
sudo ufw allow 5173
sudo ufw reload
```

### 3. إعداد HTTPS (اختياري)

لتمكين HTTPS للأمان الإضافي:

```bash
# تثبيت mkcert
npm install -g mkcert

# إنشاء شهادات محلية
mkcert -install
mkcert localhost 127.0.0.1 ::1 [your-local-ip]

# تشغيل مع HTTPS
npm run dev -- --https --cert ./localhost.pem --key ./localhost-key.pem
```

## التحقق من التثبيت

### 1. فحص المتطلبات

```bash
# فحص إصدار Node.js
node --version
# يجب أن يكون 18.0.0 أو أحدث

# فحص إصدار npm
npm --version
# يجب أن يكون 8.0.0 أو أحدث

# فحص المكتبات المثبتة
npm list --depth=0
```

### 2. اختبار الوظائف الأساسية

1. **فتح التطبيق**: تأكد من فتح الصفحة الرئيسية
2. **لوحة التحكم**: تحقق من ظهور الإحصائيات
3. **إضافة تلميذ**: جرب إضافة تلميذ جديد
4. **استيراد Excel**: جرب استيراد ملف Excel تجريبي
5. **التقارير**: تأكد من عمل التقارير والطباعة

### 3. اختبار الشبكة المحلية

```bash
# الحصول على عنوان IP المحلي
# Windows
ipconfig | findstr IPv4

# macOS/Linux
ifconfig | grep inet

# اختبار الوصول من جهاز آخر
# افتح المتصفح واذهب إلى:
# http://[YOUR-IP]:5173
```

## حل المشاكل الشائعة

### 1. مشاكل التثبيت

#### خطأ في npm install
```bash
# تنظيف الكاش
npm cache clean --force

# حذف node_modules وإعادة التثبيت
rm -rf node_modules package-lock.json
npm install
```

#### مشاكل في المكتبات
```bash
# تثبيت مع تجاهل تعارضات الإصدارات
npm install --legacy-peer-deps

# أو استخدام yarn بدلاً من npm
npm install -g yarn
yarn install
```

### 2. مشاكل التشغيل

#### المنفذ مستخدم
```bash
# تغيير المنفذ
npm run dev -- --port 3000

# أو قتل العملية المستخدمة للمنفذ
# Windows
netstat -ano | findstr :5173
taskkill /PID [PID] /F

# macOS/Linux
lsof -ti:5173 | xargs kill -9
```

#### مشاكل في قاعدة البيانات
1. افتح التطبيق
2. اذهب إلى الإعدادات
3. اضغط "تهيئة قاعدة البيانات"
4. أعد تحميل الصفحة

### 3. مشاكل الشبكة

#### لا يمكن الوصول من الهاتف
1. تأكد من أن الكمبيوتر والهاتف على نفس الشبكة
2. تحقق من إعدادات جدار الحماية
3. جرب تعطيل جدار الحماية مؤقتاً
4. استخدم عنوان IP الصحيح

#### مشاكل في الكاميرا
1. تأكد من السماح للمتصفح بالوصول للكاميرا
2. جرب متصفح Chrome (الأفضل للكاميرا)
3. تحقق من إعدادات الخصوصية
4. أعد تشغيل المتصفح

## البناء للإنتاج

### 1. بناء المشروع

```bash
# بناء المشروع للإنتاج
npm run build

# سيتم إنشاء مجلد dist مع الملفات المحسنة
```

### 2. اختبار البناء

```bash
# معاينة البناء محلياً
npm run preview

# سيفتح على http://localhost:4173
```

### 3. النشر على خادم ويب

```bash
# نسخ ملفات البناء إلى خادم الويب
cp -r dist/* /var/www/html/

# أو رفع إلى خدمة استضافة
# مثل Netlify, Vercel, GitHub Pages
```

## إعداد بيئة التطوير

### 1. محرر النصوص الموصى به

**Visual Studio Code** مع الإضافات التالية:
- ES7+ React/Redux/React-Native snippets
- TypeScript Importer
- Tailwind CSS IntelliSense
- Arabic Language Pack

### 2. إعدادات VS Code

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "emmet.includeLanguages": {
    "typescript": "html",
    "typescriptreact": "html"
  }
}
```

### 3. اختصارات مفيدة

```bash
# تشغيل سريع
npm start

# فحص الأخطاء
npm run lint

# إصلاح الأخطاء تلقائياً
npm run lint -- --fix

# بناء وتشغيل
npm run build && npm run preview
```

## الصيانة الدورية

### 1. تحديث المكتبات

```bash
# فحص التحديثات المتاحة
npm outdated

# تحديث جميع المكتبات
npm update

# تحديث مكتبة محددة
npm install package-name@latest
```

### 2. تنظيف النظام

```bash
# تنظيف ملفات البناء
npm run clean

# تنظيف كاش npm
npm cache clean --force

# إعادة تثبيت نظيفة
rm -rf node_modules package-lock.json
npm install
```

### 3. مراقبة الأداء

```bash
# تحليل حجم البناء
npm run build -- --analyze

# فحص الأمان
npm audit

# إصلاح مشاكل الأمان
npm audit fix
```

## النسخ الاحتياطية

### 1. نسخ احتياطي للمشروع

```bash
# ضغط المشروع بالكامل
tar -czf student-management-backup-$(date +%Y%m%d).tar.gz .

# أو باستخدام zip
zip -r student-management-backup-$(date +%Y%m%d).zip . -x node_modules/\* dist/\*
```

### 2. نسخ احتياطي للبيانات

- استخدم "تصدير قاعدة البيانات" من واجهة التطبيق
- احفظ ملف `.db` في مكان آمن
- اعمل نسخة احتياطية أسبوعية على الأقل

### 3. استعادة النسخ الاحتياطية

```bash
# فك ضغط النسخة الاحتياطية
tar -xzf student-management-backup-YYYYMMDD.tar.gz

# أو
unzip student-management-backup-YYYYMMDD.zip

# إعادة تثبيت المتطلبات
npm install

# تشغيل المشروع
npm run dev
```

## الأمان والحماية

### 1. حماية البيانات
- جميع البيانات محفوظة محلياً
- لا يتم إرسال أي بيانات خارجياً
- تشفير البيانات الحساسة
- نسخ احتياطية آمنة

### 2. حماية الشبكة
- استخدم شبكة WiFi آمنة
- فعّل جدار الحماية
- راقب الاتصالات الواردة
- استخدم كلمات مرور قوية للشبكة

### 3. حماية النظام
- حدّث نظام التشغيل دورياً
- استخدم برنامج مكافحة فيروسات
- اعمل نسخ احتياطية منتظمة
- راقب استخدام الذاكرة والمعالج

---

**للحصول على المساعدة**: راجع ملف TROUBLESHOOTING.md أو افتح issue في المستودع.