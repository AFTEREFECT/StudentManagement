import React from 'react';
import {
  Database,
  Shield,
  Zap,
  FileText,
  Users,
  Download,
  Upload,
  Printer,
  BarChart3,
  Globe,
  Wifi,
  Lock,
  CheckCircle,
  MessageCircle,
  Mail,
  AlertCircle,
  User,
  Award,
  Target,
  BookOpen,
  Send,
  ExternalLink,
  Chrome,
  RefreshCw,
  Clock
} from 'lucide-react';

const AboutProgram: React.FC = () => {
  // Social media links configuration
  const socialLinks = [
    {
      id: 'whatsapp',
      name: 'مجموعة WhatsApp الرسمية',
      description: 'للدعم الفني والاستفسارات العاجلة والدعم الفني',
      url: 'https://chat.whatsapp.com/E8i3wi2ArKjF8eWja85U4f',
      icon: MessageCircle,
      color: 'bg-green-600',
      hoverColor: 'hover:bg-green-700',
      gradientFrom: 'from-green-50',
      gradientTo: 'to-green-100',
      borderColor: 'border-green-200'
    },
    {
      id: 'telegram',
      name: 'قناة Telegram الرسمية',
      description: 'للحصول على آخر التحديثات والإشعارات أولاً بأول',
      url: 'https://t.me/BARMAJIYATO',
      icon: Send,
      color: 'bg-blue-600',
      hoverColor: 'hover:bg-blue-700',
      gradientFrom: 'from-blue-50',
      gradientTo: 'to-blue-100',
      borderColor: 'border-blue-200'
    }
  ];

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-2xl shadow-2xl p-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="bg-white p-4 rounded-xl">
            <Users className="w-12 h-12 text-blue-600" />
          </div>
          <div>
            <h1 className="text-4xl font-bold">نظام progTalamid</h1>
            <p className="text-xl mt-2 text-blue-100">نظام إدارة شامل للمؤسسات التعليمية</p>
          </div>
        </div>
        <p className="text-lg leading-relaxed text-blue-50">
          هو تطبيق محلي حديث صُمم لإدارة بيانات التلاميذ والإجراءات التربوية والإدارية للمؤسسات التعليمية،
          ويعمل بكفاءة عالية مباشرة من متصفحك دون الحاجة لاتصال بالإنترنت. يهدف البرنامج إلى تسهيل
          كل العمليات المدرسية المتعلقة بالتلاميذ بطريقة مرنة، آمنة، وسهلة الاستخدام.
        </p>
      </div>


   {/* قنوات الدعم */}
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <div className="flex items-center gap-3 mb-6">
          <MessageCircle className="w-8 h-8 text-blue-600" />
          <h2 className="text-3xl font-bold text-gray-800">قنوات الدعم والمساعدة</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-8">
          {[
            { icon: Clock, text: 'تحديثات منتظمة لتحسين الميزات والاستجابة لمقترحات المؤسسات' },
            { icon: MessageCircle, text: 'دعم فني مباشر وسريع من خلال قنوات التواصل الخاصة بالبرنامج' },
            { icon: Users, text: 'مشاركة الخبرات بين مستخدمي النظام عبر مجموعات رسمية' }
          ].map((support, index) => (
            <div key={index} className="p-5 bg-blue-50 rounded-xl border-2 border-blue-200 hover:shadow-md transition-shadow">
              <div className="flex justify-center mb-3">
                <support.icon className="w-8 h-8 text-blue-600" />
              </div>
              <p className="text-gray-700 leading-relaxed text-center text-sm">{support.text}</p>
            </div>
          ))}
        </div>

        {/* مجموعات التواصل */}
        <div className="grid md:grid-cols-2 gap-6">
          {socialLinks.map((social) => {
            const Icon = social.icon;
            return (
              <div key={social.id} className={`bg-gradient-to-br ${social.gradientFrom} ${social.gradientTo} rounded-2xl shadow-lg overflow-hidden border-2 ${social.borderColor}`}>
                <div className="p-8 text-center">
                  <div className="flex justify-center mb-4">
                    <div className={`${social.color} p-5 rounded-full shadow-lg`}>
                      <Icon className="w-12 h-12 text-white" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-3">{social.name}</h3>
                  <p className="text-gray-700 mb-6 text-sm">{social.description}</p>
                  <a
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`w-full ${social.color} text-white px-8 py-3 rounded-xl font-bold ${social.hoverColor} transition-colors shadow-md flex items-center justify-center gap-2`}
                  >
                    <ExternalLink className="w-5 h-5" />
                    انضم الآن
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* سياسة الانضمام للمجموعات */}
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <div className="flex items-center gap-3 mb-6">
          <Users className="w-8 h-8 text-blue-600" />
          <h2 className="text-3xl font-bold text-gray-800">سياسة الانضمام للمجموعات</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* القواعد العامة */}
          <div className="bg-blue-50 rounded-xl p-6 border-2 border-blue-200">
            <h3 className="text-xl font-bold text-blue-800 mb-4 text-center">القواعد العامة:</h3>
            <div className="space-y-3">
              {[
                'احترام جميع الأعضاء والمشرفين',
                'التركيز على المواضيع التربوية والتقنية',
                'عدم نشر محتوى غير مناسب أو إعلانات',
                'استخدام اللغة العربية في التواصل'
              ].map((rule, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-white rounded-lg">
                  <div className="flex-shrink-0 mt-0.5">
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                  </div>
                  <p className="text-gray-700 text-sm">{rule}</p>
                </div>
              ))}
            </div>
          </div>

          {/* طرق التواصل المفضلة */}
          <div className="bg-green-50 rounded-xl p-6 border-2 border-green-200">
            <h3 className="text-xl font-bold text-green-800 mb-4 text-center">طرق التواصل المفضلة:</h3>
            <div className="space-y-3">
              {[
                { icon: MessageCircle, text: 'WhatsApp: للاستفسارات العاجلة والدعم الفني', color: 'text-green-600' },
                { icon: Send, text: 'Telegram: للإعلانات والتحديثات الرسمية', color: 'text-blue-600' },
                { icon: Mail, text: 'البريد الإلكتروني: للاستفسارات التفصيلية', color: 'text-purple-600' }
              ].map((contact, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-white rounded-lg">
                  <contact.icon className={`w-5 h-5 ${contact.color} flex-shrink-0 mt-0.5`} />
                  <p className="text-gray-700 text-sm">{contact.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ملاحظة هامة */}
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-yellow-700 flex-shrink-0 mt-1" />
            <div>
              <h4 className="font-bold text-yellow-800 mb-2">ملاحظة هامّة:</h4>
              <p className="text-gray-700 leading-relaxed text-sm">
                يرجى قراءة قواعد المجموعة قبل الانضمام. يحتفظ فريق progTalamid بحق في إزالة أي عضو لا يتقيّد بالنظام الداخلي للمجموعة.
              </p>
            </div>
          </div>
        </div>
      </div>





      
      {/* طبيعة الاشتغال */}
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <div className="flex items-center gap-3 mb-6">
          <Zap className="w-8 h-8 text-orange-600" />
          <h2 className="text-3xl font-bold text-gray-800">طبيعة الاشتغال</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* التخزين المحلي */}
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border-2 border-green-200">
            <div className="flex justify-center mb-4">
              <div className="bg-green-600 p-4 rounded-full">
                <Database className="w-10 h-10 text-white" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-green-800 text-center mb-3">التخزين المحلي</h3>
            <p className="text-gray-700 leading-relaxed text-center">
              كل معطيات التلاميذ، الأقسام، اللوائح، الحركية... تُخزَّن على جهاز المستخدم مباشرة
              اعتماداً على قاعدة بيانات محلية مستقلة، ولن يتم إرسال أي بيانات لأي خادم خارجي.
            </p>
          </div>

          {/* العمل دون اتصال */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border-2 border-blue-200">
            <div className="flex justify-center mb-4">
              <div className="bg-blue-600 p-4 rounded-full">
                <Wifi className="w-10 h-10 text-white" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-blue-800 text-center mb-3">العمل دون اتصال</h3>
            <p className="text-gray-700 leading-relaxed text-center">
              استعمال النظام يتم بالكامل بدون الحاجة للانترنت بعد التثبيت أو التفعيل الأول،
              ممّا يضمن الاستمرارية في كل الظروف.
            </p>
          </div>

          {/* خصوصية عالية */}
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl border-2 border-purple-200">
            <div className="flex justify-center mb-4">
              <div className="bg-purple-600 p-4 rounded-full">
                <Shield className="w-10 h-10 text-white" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-purple-800 text-center mb-3">خصوصية عالية</h3>
            <p className="text-gray-700 leading-relaxed text-center">
              لا يتطلب النظام فتح حساب أو تسجيل الدخول، لضمان سرية بيانات التلاميذ والمؤسسة.
            </p>
          </div>
        </div>
      </div>

      {/* من مميزات النظام */}
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <div className="flex items-center gap-3 mb-6">
          <CheckCircle className="w-8 h-8 text-green-600" />
          <h2 className="text-3xl font-bold text-gray-800">من مميزات النظام</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {[
            { icon: Upload, text: 'استيراد وتصدير بيانات التلاميذ وملفاتهم', color: 'text-blue-600', bg: 'bg-blue-50' },
            { icon: Printer, text: 'إعداد وطباعة اللوائح الرسمية بجودة عالية مع احترام قوالب المؤسسة', color: 'text-green-600', bg: 'bg-green-50' },
            { icon: Users, text: 'تدبير حركة التلاميذ الوافدين والمغادرين وتتبعها بطريقة شاملة', color: 'text-purple-600', bg: 'bg-purple-50' },
            { icon: FileText, text: 'توليد وثائق إدارية (لوائح – شواهد – تقارير...)', color: 'text-orange-600', bg: 'bg-orange-50' },
            { icon: BarChart3, text: 'تعدد مستويات التدبير: دعم أكثر من مستوى وقسم داخل نفس المؤسسة', color: 'text-pink-600', bg: 'bg-pink-50' },
            { icon: Download, text: 'قابلية التصدير السريع نحو Excel والطباعة المباشرة', color: 'text-indigo-600', bg: 'bg-indigo-50' },
            { icon: Zap, text: 'واجهة سهلة الاستخدام، وشروحات مدمجة', color: 'text-yellow-600', bg: 'bg-yellow-50' }
          ].map((feature, index) => (
            <div key={index} className={`flex items-start gap-4 p-4 ${feature.bg} rounded-xl hover:shadow-md transition-shadow border border-gray-200`}>
              <div className="flex-shrink-0 mt-1">
                <feature.icon className={`w-6 h-6 ${feature.color}`} />
              </div>
              <p className="text-gray-700 leading-relaxed">{feature.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* حلول للمشاكل التقنية */}
      <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl shadow-lg p-8 border-2 border-yellow-200">
        <div className="flex items-center gap-3 mb-6">
          <AlertCircle className="w-8 h-8 text-orange-600" />
          <h2 className="text-3xl font-bold text-gray-800">حلول للمشاكل التقنية</h2>
        </div>

        <div className="space-y-3">
          {[
            { icon: Chrome, text: 'يُفضّل استعمال أحدث نسخة من Chrome أو Firefox' },
            { icon: RefreshCw, text: 'عند ظهور أي خطأ، ينصح بمسح بيانات الموقع من إعدادات المتصفح' },
            { icon: Lock, text: 'ينصح بتجربة النافذة السرية/الخفية إذا ظهرت مشاكل مؤقتة' },
            { icon: RefreshCw, text: 'إعادة تشغيل المتصفح بالكامل في حالة المشاكل غير المعروفة' }
          ].map((solution, index) => (
            <div key={index} className="flex items-start gap-3 p-4 bg-white rounded-lg shadow-sm">
              <solution.icon className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <p className="text-gray-700">{solution.text}</p>
            </div>
          ))}
        </div>
      </div>

   
      {/* عن المطور */}
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-6 rounded-full shadow-xl">
                <User className="w-16 h-16 text-white" />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-gray-800 mb-2">محمد بادو</h2>
            <p className="text-xl text-blue-600 font-semibold">مطور ومدرب أنظمة الموارد البشرية</p>
          </div>

          <div className="space-y-4">
            {/* الخبرة */}
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-6 rounded-xl border-2 border-blue-200">
              <div className="flex items-start gap-4">
                <div className="bg-blue-600 p-3 rounded-full flex-shrink-0">
                  <BookOpen className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-blue-800 mb-2">الخبرة والتخصص</h3>
                  <p className="text-gray-700 leading-relaxed">
                    خبرة واسعة في تطوير أنظمة إدارة الموارد البشرية والتدريب على استخدام التقنيات الحديثة
                    في القطاع التعليمي
                  </p>
                </div>
              </div>
            </div>

            {/* المؤهلات */}
            <div className="bg-gradient-to-r from-green-50 to-green-100 p-6 rounded-xl border-2 border-green-200">
              <div className="flex items-start gap-4">
                <div className="bg-green-600 p-3 rounded-full flex-shrink-0">
                  <Award className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-green-800 mb-2">المؤهلات</h3>
                  <p className="text-gray-700 leading-relaxed">
                    متخصص في تطوير الحلول التقنية للمؤسسات التعليمية وأنظمة قواعد البيانات
                  </p>
                </div>
              </div>
            </div>

            {/* الهدف */}
            <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-6 rounded-xl border-2 border-purple-200">
              <div className="flex items-start gap-4">
                <div className="bg-purple-600 p-3 rounded-full flex-shrink-0">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-purple-800 mb-2">الهدف</h3>
                  <p className="text-gray-700 leading-relaxed">
                    تسهيل عمل الإداريين في المؤسسات التعليمية من خلال أنظمة تقنية متطورة وسهلة الاستخدام
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Note */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-xl p-6 text-center">
        <p className="text-gray-700 leading-relaxed mb-2">
          لأي استفسار تفصيلي أو اقتراح، يرجى التواصل عبر البريد الإلكتروني المخصص للدعم الفني
        </p>
        <p className="text-lg font-bold text-blue-600 mt-3">
          شكراً لاستخدامكم نظام progTalamid
        </p>
      </div>
    </div>
  );
};

export default AboutProgram;
