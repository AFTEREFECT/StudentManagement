/*
  # نظام إدارة الاشتراكات - BGAstudents Subscription System

  ## نظرة عامة
  نظام شامل لإدارة الاشتراكات مع 3 مستويات (Basic, Pro, Expert)

  ## 1. الجداول الجديدة
  
  ### subscription_plans - خطط الاشتراك
    - `id` (uuid, primary key)
    - `plan_name` (text) - اسم الخطة (Basic, Pro, Expert)
    - `plan_name_ar` (text) - الاسم بالعربية
    - `description` (text) - وصف الخطة
    - `features` (jsonb) - قائمة الميزات
    - `price_monthly` (numeric) - السعر الشهري
    - `price_yearly` (numeric) - السعر السنوي
    - `is_active` (boolean) - نشطة
    - `display_order` (integer) - ترتيب العرض
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ### subscriptions - الاشتراكات
    - `id` (uuid, primary key)
    - `institution_id` (text) - معرف المؤسسة
    - `institution_name` (text) - اسم المؤسسة
    - `plan_id` (uuid) - معرف الخطة
    - `plan_name` (text) - اسم الخطة
    - `status` (text) - الحالة (active, expired, suspended, trial)
    - `start_date` (date) - تاريخ البداية
    - `end_date` (date) - تاريخ الانتهاء
    - `trial_end_date` (date) - نهاية الفترة التجريبية
    - `is_trial` (boolean) - فترة تجريبية
    - `auto_renew` (boolean) - تجديد تلقائي
    - `payment_method` (text) - طريقة الدفع
    - `notes` (text) - ملاحظات
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ### subscription_licenses - رموز الترخيص
    - `id` (uuid, primary key)
    - `license_key` (text, unique) - مفتاح الترخيص
    - `plan_id` (uuid) - معرف الخطة
    - `plan_name` (text) - اسم الخطة
    - `duration_days` (integer) - مدة الصلاحية بالأيام
    - `max_uses` (integer) - عدد مرات الاستخدام
    - `current_uses` (integer) - الاستخدامات الحالية
    - `is_active` (boolean) - نشط
    - `generated_by` (text) - تم إنشاؤه بواسطة
    - `notes` (text) - ملاحظات
    - `created_at` (timestamptz)
    - `expires_at` (timestamptz)

  ### subscription_history - سجل الاشتراكات
    - `id` (uuid, primary key)
    - `subscription_id` (uuid) - معرف الاشتراك
    - `action` (text) - الإجراء (activated, renewed, suspended, expired)
    - `previous_status` (text) - الحالة السابقة
    - `new_status` (text) - الحالة الجديدة
    - `changed_by` (text) - تم التغيير بواسطة
    - `details` (jsonb) - تفاصيل إضافية
    - `created_at` (timestamptz)

  ### institution_settings - إعدادات المؤسسة
    - `id` (uuid, primary key)
    - `institution_id` (text, unique) - معرف المؤسسة
    - `institution_name` (text) - اسم المؤسسة
    - `subscription_id` (uuid) - معرف الاشتراك الحالي
    - `config` (jsonb) - إعدادات إضافية
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ## 2. الأمان (Row Level Security)
  - تم تفعيل RLS على جميع الجداول
  - سياسات القراءة العامة
  - سياسات الكتابة للمستخدمين المصادق عليهم

  ## 3. الفهارس
  - فهارس على الأعمدة المستخدمة بكثرة للأداء الأمثل

  ## 4. الخطط المبدئية
  يتم إنشاء 3 خطط افتراضية:
  - Basic: الميزات الأساسية
  - Pro: الميزات المتقدمة + واتساب
  - Expert: جميع الميزات + الروائز
*/

-- ============================================
-- 1. جدول خطط الاشتراك
-- ============================================
CREATE TABLE IF NOT EXISTS subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_name text NOT NULL UNIQUE,
  plan_name_ar text NOT NULL,
  description text,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  price_monthly numeric(10,2) DEFAULT 0,
  price_yearly numeric(10,2) DEFAULT 0,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- 2. جدول الاشتراكات
-- ============================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id text NOT NULL,
  institution_name text NOT NULL,
  plan_id uuid REFERENCES subscription_plans(id) ON DELETE RESTRICT,
  plan_name text NOT NULL,
  status text NOT NULL DEFAULT 'trial' CHECK (status IN ('active', 'expired', 'suspended', 'trial')),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  trial_end_date date,
  is_trial boolean DEFAULT false,
  auto_renew boolean DEFAULT false,
  payment_method text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- 3. جدول رموز الترخيص
-- ============================================
CREATE TABLE IF NOT EXISTS subscription_licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key text NOT NULL UNIQUE,
  plan_id uuid REFERENCES subscription_plans(id) ON DELETE RESTRICT,
  plan_name text NOT NULL,
  duration_days integer NOT NULL DEFAULT 30,
  max_uses integer DEFAULT 1,
  current_uses integer DEFAULT 0,
  is_active boolean DEFAULT true,
  generated_by text,
  notes text,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

-- ============================================
-- 4. جدول سجل الاشتراكات
-- ============================================
CREATE TABLE IF NOT EXISTS subscription_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE CASCADE,
  action text NOT NULL,
  previous_status text,
  new_status text,
  changed_by text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- 5. جدول إعدادات المؤسسة
-- ============================================
CREATE TABLE IF NOT EXISTS institution_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id text NOT NULL UNIQUE,
  institution_name text NOT NULL,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  config jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- الفهارس للأداء
-- ============================================
CREATE INDEX IF NOT EXISTS idx_subscriptions_institution_id ON subscriptions(institution_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_end_date ON subscriptions(end_date);
CREATE INDEX IF NOT EXISTS idx_licenses_key ON subscription_licenses(license_key);
CREATE INDEX IF NOT EXISTS idx_licenses_active ON subscription_licenses(is_active);
CREATE INDEX IF NOT EXISTS idx_history_subscription_id ON subscription_history(subscription_id);
CREATE INDEX IF NOT EXISTS idx_institution_settings_id ON institution_settings(institution_id);

-- ============================================
-- تفعيل Row Level Security
-- ============================================
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE institution_settings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- سياسات الأمان
-- ============================================

-- subscription_plans: قراءة عامة
CREATE POLICY "Anyone can view subscription plans"
  ON subscription_plans FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can manage plans"
  ON subscription_plans FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- subscriptions: قراءة عامة، كتابة للمصادق عليهم
CREATE POLICY "Anyone can view subscriptions"
  ON subscriptions FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert subscriptions"
  ON subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update subscriptions"
  ON subscriptions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete subscriptions"
  ON subscriptions FOR DELETE
  TO authenticated
  USING (true);

-- subscription_licenses: قراءة وإدارة للمصادق عليهم
CREATE POLICY "Authenticated users can view licenses"
  ON subscription_licenses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage licenses"
  ON subscription_licenses FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- subscription_history: قراءة عامة، كتابة للمصادق عليهم
CREATE POLICY "Anyone can view history"
  ON subscription_history FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert history"
  ON subscription_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- institution_settings: قراءة عامة، كتابة للمصادق عليهم
CREATE POLICY "Anyone can view institution settings"
  ON institution_settings FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can manage institution settings"
  ON institution_settings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- إدراج الخطط الافتراضية
-- ============================================
INSERT INTO subscription_plans (plan_name, plan_name_ar, description, features, price_monthly, price_yearly, display_order, is_active)
VALUES 
  (
    'Basic',
    'أساسي',
    'الخطة الأساسية لإدارة المؤسسة التعليمية',
    '["إدارة التلاميذ والمستويات والأقسام", "استيراد اللوائح من Excel", "تدبير البنية التربوية", "تتبع الدخول المدرسي", "تدبير الوافدين وطلب الملفات", "تدبير المغادرين وإرسال الملفات", "إدارة الأكواد السرية لمسار", "استيراد جداول الحصص من progmawarid", "طباعة جداول الحصص حسب الأقسام", "تدبير الغياب الطريقة العادية", "طباعة أوراق السماح بالدخول", "توليد مختلف مطبوعات الاشتغال", "توليد أوراق الغياب واللوائح"]'::jsonb,
    150.00,
    990.00,
    1,
    true
  ),
  (
    'Pro',
    'محترف',
    'جميع ميزات Basic + إرسال رسائل واتساب',
    '["جميع ميزات الخطة الأساسية", "إرسال رسائل واتساب لأولياء الأمور", "إشعارات الغياب عبر واتساب", "إشعارات السلوك عبر واتساب", "خدمة تواصل حسب التلميذ", "خدمة تواصل حسب القسم", "خدمة تواصل حسب المستوى", "إرسال الأكواد السرية أوتوماتيكياً", "نماذج رسائل قابلة للتخصيص", "سجل الرسائل المرسلة"]'::jsonb,
    199.00,
    1990.00,
    2,
    true
  ),
  (
    'Expert',
    'خبير',
    'جميع الميزات + نظام تصحيح الروائز',
    '["جميع ميزات Pro", "نظام تصحيح الروائز التلقائي", "إنشاء قوالب الروائز", "مسح ضوئي للأوراق", "تصحيح تلقائي مع حساب النقط", "نماذج PDF مع QR Code", "إحصائيات وتحليل النتائج", "إدارة متقدمة للامتحانات", "تقارير مفصلة للأساتذة"]'::jsonb,
    299.00,
    2990.00,
    3,
    true
  )
ON CONFLICT (plan_name) DO NOTHING;
