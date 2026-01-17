import React, { useState, useEffect } from 'react';
import { Smartphone, QrCode, Copy, CheckCircle, Wifi, Globe, Download } from 'lucide-react';
import QRCodeLib from 'qrcode';

const QRCodeGenerator: React.FC = () => {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [localUrl, setLocalUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [networkInfo, setNetworkInfo] = useState<string>('');

  useEffect(() => {
    generateQRCode();
    getNetworkInfo();
  }, []);

  // الحصول على عنوان URL المحلي
  const getLocalUrl = () => {
    // الحصول على عنوان IP المحلي للشبكة
    const protocol = window.location.protocol;
    const port = window.location.port || '5173';
    
    // محاولة الحصول على IP المحلي من الشبكة
    // في بيئة التطوير، استخدم عنوان IP المحلي
    const hostname = window.location.hostname;
    
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      // في حالة localhost، نحتاج لاستخدام IP الفعلي للشبكة
      // سنعرض تعليمات للمستخدم للحصول على IP يدوياً
      return `${protocol}//[YOUR_LOCAL_IP]:${port}`;
    }
    
    return `${protocol}//${hostname}:${port}`;
  };

  // الحصول على معلومات الشبكة
  const getNetworkInfo = () => {
    const url = getLocalUrl();
    setLocalUrl(url);
    
    // معلومات إضافية عن الشبكة
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (connection) {
      setNetworkInfo(`نوع الاتصال: ${connection.effectiveType || 'غير معروف'}`);
    }
  };

  // توليد QR Code
  const generateQRCode = async () => {
    try {
      const url = getLocalUrl();
      const qrDataUrl = await QRCodeLib.toDataURL(url, {
        width: 300,
        margin: 2,
        color: {
          dark: '#1e40af',  // أزرق داكن
          light: '#ffffff'  // أبيض
        },
        errorCorrectionLevel: 'M'
      });
      setQrCodeUrl(qrDataUrl);
    } catch (error) {
      console.error('خطأ في توليد QR Code:', error);
    }
  };

  // نسخ الرابط
  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(localUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('خطأ في النسخ:', error);
    }
  };

  // تحميل QR Code كصورة
  const downloadQRCode = () => {
    const link = document.createElement('a');
    link.download = 'qr-code-student-management.png';
    link.href = qrCodeUrl;
    link.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="p-6 max-w-4xl mx-auto">
        {/* عنوان الصفحة */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-3">
            QR Code للتجربة على الموبايل
          </h1>
          <p className="text-gray-600 text-lg">امسح الكود للوصول للبرنامج على هاتفك مباشرة</p>
          <div className="mt-4 w-24 h-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full mx-auto"></div>
        </div>

        {/* بطاقة QR Code الرئيسية */}
        <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-100 mb-8">
          <div className="text-center">
            {/* QR Code */}
            <div className="bg-gradient-to-r from-blue-100 to-purple-100 p-8 rounded-2xl mb-6 inline-block">
              {qrCodeUrl ? (
                <img 
                  src={qrCodeUrl} 
                  alt="QR Code" 
                  className="w-64 h-64 mx-auto rounded-xl shadow-lg"
                />
              ) : (
                <div className="w-64 h-64 bg-gray-200 rounded-xl flex items-center justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
              )}
            </div>

            {/* معلومات الرابط */}
            <div className="bg-gray-50 p-6 rounded-xl mb-6">
              <div className="flex items-center justify-center gap-3 mb-4">
                <Globe className="w-6 h-6 text-blue-600" />
                <h3 className="text-xl font-semibold text-gray-900">رابط التطبيق</h3>
              </div>
              
              <div className="bg-white p-4 rounded-lg border border-gray-200 mb-4">
                <code className="text-blue-600 font-mono text-lg break-all">
                  {localUrl}
                </code>
              </div>
              
              <button
                onClick={copyUrl}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg transition-all duration-200 mx-auto ${
                  copied 
                    ? 'bg-green-600 text-white' 
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {copied ? (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    تم النسخ!
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5" />
                    نسخ الرابط
                  </>
                )}
              </button>
            </div>

            {/* أزرار الإجراءات */}
            <div className="flex gap-4 justify-center">
              <button
                onClick={downloadQRCode}
                className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200"
              >
                <Download className="w-5 h-5" />
                تحميل QR Code
              </button>
              
              <button
                onClick={generateQRCode}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
              >
                <QrCode className="w-5 h-5" />
                إعادة توليد
              </button>
            </div>
          </div>
        </div>

        {/* تعليمات الاستخدام */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-blue-50 p-6 rounded-xl border border-blue-200">
            <div className="flex items-center gap-3 mb-4">
              <Smartphone className="w-8 h-8 text-blue-600" />
              <h3 className="text-xl font-semibold text-blue-900">خطوات التجربة على الموبايل</h3>
            </div>
            <div className="space-y-3 text-blue-800">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
                <p>افتح تطبيق الكاميرا على هاتفك</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
                <p>وجه الكاميرا نحو QR Code أعلاه</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
                <p>اضغط على الرابط الذي سيظهر</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">4</div>
                <p>انتقل لصفحة "نظام الروائز" وجرب المسح</p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 p-6 rounded-xl border border-green-200">
            <div className="flex items-center gap-3 mb-4">
              <QrCode className="w-8 h-8 text-green-600" />
              <h3 className="text-xl font-semibold text-green-900">نصائح للمسح الأمثل</h3>
            </div>
            <div className="space-y-3 text-green-800">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">✓</div>
                <p>تأكد من وضوح الإضاءة على الورقة</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">✓</div>
                <p>ضع الورقة على سطح مستوٍ</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">✓</div>
                <p>تأكد من ظهور النقط السوداء الأربع</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">✓</div>
                <p>انتظر حتى تصبح النقط خضراء</p>
              </div>
            </div>
          </div>
        </div>

        {/* معلومات تقنية */}
        <div className="bg-white p-6 rounded-xl border border-gray-100">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">معلومات تقنية</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Wifi className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-gray-700">حالة الاتصال:</span>
                <span className="text-green-600 font-semibold">متصل</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-purple-600" />
                <span className="font-medium text-gray-700">البروتوكول:</span>
                <span className="text-gray-900">{window.location.protocol}</span>
              </div>
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-green-600" />
                <span className="font-medium text-gray-700">متوافق مع:</span>
                <span className="text-gray-900">جميع الهواتف الذكية</span>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-700">المنفذ:</span>
                <span className="text-gray-900">{window.location.port || '80'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-700">الشبكة:</span>
                <span className="text-gray-900">{networkInfo || 'محلية'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-700">الحالة:</span>
                <span className="text-green-600 font-semibold">جاهز للاستخدام</span>
              </div>
            </div>
          </div>
        </div>

        {/* تحذيرات مهمة */}
        <div className="mt-8 bg-yellow-50 p-6 rounded-xl border border-yellow-200">
          <h3 className="text-lg font-semibold text-yellow-900 mb-4">ملاحظات مهمة</h3>
          <div className="space-y-2 text-yellow-800">
            <p>• <strong>نفس الشبكة:</strong> تأكد أن الهاتف والكمبيوتر على نفس شبكة WiFi</p>
            <p>• <strong>الأمان:</strong> هذا رابط محلي آمن لا يخرج من شبكتك</p>
            <p>• <strong>السرعة:</strong> التطبيق سيعمل بسرعة عالية لأنه محلي</p>
            <p>• <strong>الخصوصية:</strong> جميع البيانات تبقى على جهازك</p>
            <p>• <strong>الكاميرا:</strong> ستحتاج للسماح للمتصفح بالوصول للكاميرا</p>
          </div>
        </div>

        {/* إرشادات استكشاف الأخطاء */}
        <div className="mt-6 bg-red-50 p-6 rounded-xl border border-red-200">
          <h3 className="text-lg font-semibold text-red-900 mb-4">خطوات حل مشكلة الاتصال:</h3>
          <div className="space-y-2 text-red-800">
            <div className="bg-white p-4 rounded border border-red-200">
              <h4 className="font-bold text-red-900 mb-2">الخطوة 1: إعادة تشغيل الخادم</h4>
              <p className="text-sm">أوقف الخادم (Ctrl+C) ثم شغله مرة أخرى بـ npm run dev</p>
            </div>
            
            <div className="bg-white p-4 rounded border border-red-200">
              <h4 className="font-bold text-red-900 mb-2">الخطوة 2: تحقق من الشبكة</h4>
              <p className="text-sm">تأكد أن الكمبيوتر والهاتف على نفس شبكة WiFi</p>
            </div>
            
            <div className="bg-white p-4 rounded border border-red-200">
              <h4 className="font-bold text-red-900 mb-2">الخطوة 3: استخدم IP يدوياً</h4>
              <p className="text-sm">احصل على عنوان IP من التعليمات أعلاه واستخدمه مع المنفذ 5173</p>
            </div>
            
            <div className="bg-white p-4 rounded border border-red-200">
              <h4 className="font-bold text-red-900 mb-2">الخطوة 4: تعطيل جدار الحماية مؤقتاً</h4>
              <p className="text-sm">قد يحجب جدار الحماية المنفذ 5173</p>
            </div>
          </div>
          
          <div className="mt-4 bg-green-100 p-4 rounded border border-green-300">
            <h4 className="font-bold text-green-900 mb-2">✅ إذا نجح الاتصال:</h4>
            <p className="text-sm text-green-800">ستظهر لك نفس واجهة البرنامج على الهاتف مع إمكانية استخدام نظام الروائز بالكاميرا</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QRCodeGenerator;