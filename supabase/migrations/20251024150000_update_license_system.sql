/*
  # تحديث وتوحيد نظام التراخيص

  ## نظرة عامة
  تحديث شامل لنظام التراخيص لدعم:
  - أكواد التجريب غير المحدودة
  - أكواد خاصة بالمطور
  - إمكانية إعادة تفعيل الأكواد
  - تسجيل محاولات التفعيل

  ## 1. التحديثات على الجداول الموجودة

  ### subscription_licenses
    - إضافة `is_trial_code` (boolean) - للتمييز بين أكواد التجريب والأكواد الكاملة
    - إضافة `unlimited_uses` (boolean) - للسماح باستخدامات غير محدودة
    - إضافة `developer_only` (boolean) - أكواد خاصة بالمطور
    - إضافة `device_fingerprint` (text) - بصمة الجهاز المفعل عليه
    - إضافة `activated_at` (timestamptz) - تاريخ التفعيل
    - إضافة `can_reactivate` (boolean) - إمكانية إعادة التفعيل

  ## 2. جداول جديدة

  ### activation_logs - سجل محاولات التفعيل
    - `id` (uuid, primary key)
    - `license_key` (text) - الكود المستخدم
    - `device_fingerprint` (text) - بصمة الجهاز
    - `success` (boolean) - نجح التفعيل أم لا
    - `error_message` (text) - رسالة الخطأ إن وجدت
    - `ip_address` (text) - عنوان IP (اختياري)
    - `user_agent` (text) - معلومات المتصفح
    - `created_at` (timestamptz)

  ## 3. الأمان
  - تفعيل RLS على الجداول الجديدة
  - سياسات مناسبة للقراءة والكتابة

  ## 4. بيانات افتراضية
  - إنشاء أكواد تجريبية للمطور
  - إنشاء أكواد للاختبار
*/

-- ============================================
-- 1. تحديث جدول subscription_licenses
-- ============================================

-- إضافة الأعمدة الجديدة
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_licenses' AND column_name = 'is_trial_code'
  ) THEN
    ALTER TABLE subscription_licenses ADD COLUMN is_trial_code boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_licenses' AND column_name = 'unlimited_uses'
  ) THEN
    ALTER TABLE subscription_licenses ADD COLUMN unlimited_uses boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_licenses' AND column_name = 'developer_only'
  ) THEN
    ALTER TABLE subscription_licenses ADD COLUMN developer_only boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_licenses' AND column_name = 'device_fingerprint'
  ) THEN
    ALTER TABLE subscription_licenses ADD COLUMN device_fingerprint text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_licenses' AND column_name = 'activated_at'
  ) THEN
    ALTER TABLE subscription_licenses ADD COLUMN activated_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_licenses' AND column_name = 'can_reactivate'
  ) THEN
    ALTER TABLE subscription_licenses ADD COLUMN can_reactivate boolean DEFAULT false;
  END IF;
END $$;

-- ============================================
-- 2. إنشاء جدول سجل التفعيلات
-- ============================================
CREATE TABLE IF NOT EXISTS activation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key text NOT NULL,
  device_fingerprint text,
  success boolean DEFAULT false,
  error_message text,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- الفهارس
CREATE INDEX IF NOT EXISTS idx_activation_logs_license_key ON activation_logs(license_key);
CREATE INDEX IF NOT EXISTS idx_activation_logs_created_at ON activation_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_subscription_licenses_fingerprint ON subscription_licenses(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_subscription_licenses_trial ON subscription_licenses(is_trial_code);

-- ============================================
-- 3. تفعيل RLS
-- ============================================
ALTER TABLE activation_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. سياسات الأمان
-- ============================================

-- activation_logs: القراءة للمصادق عليهم فقط
CREATE POLICY "Authenticated users can view activation logs"
  ON activation_logs FOR SELECT
  TO authenticated
  USING (true);

-- activation_logs: الكتابة عامة (للسماح بتسجيل المحاولات)
CREATE POLICY "Anyone can insert activation logs"
  ON activation_logs FOR INSERT
  WITH CHECK (true);

-- ============================================
-- 5. إدراج أكواد افتراضية للمطور
-- ============================================

-- الحصول على معرفات الخطط
DO $$
DECLARE
  basic_plan_id uuid;
  pro_plan_id uuid;
  expert_plan_id uuid;
BEGIN
  -- الحصول على معرفات الخطط
  SELECT id INTO basic_plan_id FROM subscription_plans WHERE plan_name = 'Basic' LIMIT 1;
  SELECT id INTO pro_plan_id FROM subscription_plans WHERE plan_name = 'Pro' LIMIT 1;
  SELECT id INTO expert_plan_id FROM subscription_plans WHERE plan_name = 'Expert' LIMIT 1;

  -- إدراج الأكواد التجريبية
  INSERT INTO subscription_licenses (
    license_key,
    plan_id,
    plan_name,
    duration_days,
    max_uses,
    current_uses,
    is_active,
    is_trial_code,
    unlimited_uses,
    developer_only,
    can_reactivate,
    generated_by,
    notes
  ) VALUES
    -- كود تجريبي غير محدود للمطور
    (
      'TRIAL-DEV-UNLIMITED-2025',
      basic_plan_id,
      'Basic',
      7,
      999,
      0,
      true,
      true,
      true,
      true,
      true,
      'system',
      'كود تجريبي غير محدود للمطور - يمكن استخدامه عدة مرات'
    ),
    -- كود تجريبي عادي
    (
      'TRIAL-7DAYS-2025',
      basic_plan_id,
      'Basic',
      7,
      1,
      0,
      true,
      true,
      false,
      false,
      false,
      'system',
      'كود تجريبي لمدة 7 أيام - استخدام واحد'
    ),
    -- كود Basic كامل
    (
      'BASIC-2025-TEST-001',
      basic_plan_id,
      'Basic',
      365,
      1,
      0,
      true,
      false,
      false,
      false,
      false,
      'system',
      'كود Basic لسنة كاملة'
    ),
    -- كود Pro كامل
    (
      'PRO-2025-TEST-001',
      pro_plan_id,
      'Pro',
      365,
      1,
      0,
      true,
      false,
      false,
      false,
      false,
      'system',
      'كود Pro لسنة كاملة'
    ),
    -- كود Expert كامل
    (
      'EXPERT-2025-TEST-001',
      expert_plan_id,
      'Expert',
      365,
      1,
      0,
      true,
      false,
      false,
      false,
      false,
      'system',
      'كود Expert لسنة كاملة'
    )
  ON CONFLICT (license_key) DO UPDATE SET
    is_trial_code = EXCLUDED.is_trial_code,
    unlimited_uses = EXCLUDED.unlimited_uses,
    developer_only = EXCLUDED.developer_only,
    can_reactivate = EXCLUDED.can_reactivate,
    notes = EXCLUDED.notes;
END $$;

-- ============================================
-- 6. دالة للتحقق من صلاحية الكود
-- ============================================
CREATE OR REPLACE FUNCTION check_license_validity(p_license_key text)
RETURNS TABLE (
  is_valid boolean,
  message text,
  license_data jsonb
) AS $$
DECLARE
  v_license record;
  v_is_valid boolean := false;
  v_message text := '';
BEGIN
  -- البحث عن الكود
  SELECT * INTO v_license
  FROM subscription_licenses
  WHERE license_key = p_license_key;

  -- التحقق من وجود الكود
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'الكود غير موجود', '{}'::jsonb;
    RETURN;
  END IF;

  -- التحقق من التفعيل
  IF NOT v_license.is_active THEN
    RETURN QUERY SELECT false, 'الكود غير نشط', row_to_json(v_license)::jsonb;
    RETURN;
  END IF;

  -- التحقق من الصلاحية
  IF v_license.expires_at IS NOT NULL AND v_license.expires_at < now() THEN
    RETURN QUERY SELECT false, 'انتهت صلاحية الكود', row_to_json(v_license)::jsonb;
    RETURN;
  END IF;

  -- التحقق من عدد الاستخدامات (إلا إذا كان غير محدود)
  IF NOT v_license.unlimited_uses THEN
    IF v_license.current_uses >= v_license.max_uses THEN
      RETURN QUERY SELECT false, 'تم استخدام الكود الحد الأقصى من المرات', row_to_json(v_license)::jsonb;
      RETURN;
    END IF;
  END IF;

  -- الكود صالح
  RETURN QUERY SELECT true, 'الكود صالح للاستخدام', row_to_json(v_license)::jsonb;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. دالة لتسجيل محاولة التفعيل
-- ============================================
CREATE OR REPLACE FUNCTION log_activation_attempt(
  p_license_key text,
  p_device_fingerprint text,
  p_success boolean,
  p_error_message text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO activation_logs (
    license_key,
    device_fingerprint,
    success,
    error_message,
    user_agent
  ) VALUES (
    p_license_key,
    p_device_fingerprint,
    p_success,
    p_error_message,
    p_user_agent
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;
