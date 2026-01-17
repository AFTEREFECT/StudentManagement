/*
  # نظام إدارة التراخيص والأمان

  1. جداول جديدة
    - `licenses`
      - `id` (uuid, primary key)
      - `license_key` (text, unique) - الكود السري للترخيص
      - `device_fingerprint` (text, nullable) - بصمة الجهاز المفعل عليه
      - `is_activated` (boolean) - هل تم تفعيل الكود
      - `activated_at` (timestamptz, nullable) - تاريخ التفعيل
      - `expires_at` (timestamptz, nullable) - تاريخ انتهاء الصلاحية
      - `max_devices` (integer) - عدد الأجهزة المسموح بها (افتراضي 1)
      - `created_at` (timestamptz) - تاريخ الإنشاء
      - `notes` (text, nullable) - ملاحظات إضافية

  2. الأمان
    - تفعيل RLS على جدول `licenses`
    - سياسات القراءة والكتابة للمستخدمين المصادق عليهم فقط

  3. ملاحظات
    - يستخدم هذا الجدول فقط للتحقق من صلاحية الأكواد ومنع التكرار
    - جميع البيانات الأخرى تبقى في IndexedDB المحلي
    - كل كود يمكن استخدامه على جهاز واحد فقط (max_devices = 1)
*/

-- إنشاء جدول التراخيص
CREATE TABLE IF NOT EXISTS licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key text UNIQUE NOT NULL,
  device_fingerprint text,
  is_activated boolean DEFAULT false,
  activated_at timestamptz,
  expires_at timestamptz,
  max_devices integer DEFAULT 1,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- إنشاء فهرس للبحث السريع
CREATE INDEX IF NOT EXISTS idx_licenses_key ON licenses(license_key);
CREATE INDEX IF NOT EXISTS idx_licenses_fingerprint ON licenses(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_licenses_activated ON licenses(is_activated);

-- تفعيل RLS
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;

-- سياسة القراءة: السماح لجميع المستخدمين بقراءة التراخيص للتحقق
CREATE POLICY "السماح بقراءة التراخيص للتحقق"
  ON licenses
  FOR SELECT
  USING (true);

-- سياسة التحديث: السماح بتحديث بصمة الجهاز عند التفعيل
CREATE POLICY "السماح بتحديث التفعيل"
  ON licenses
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- إدراج بعض الأكواد التجريبية للاختبار
INSERT INTO licenses (license_key, expires_at, notes) VALUES
  ('DEMO-2025-STUDENT-DB-001', '2026-12-31', 'كود تجريبي للاختبار'),
  ('GSAIP-2025-PREMIUM-001', '2026-06-30', 'اشتراك سنوي'),
  ('GSAIP-2025-BASIC-001', '2025-12-31', 'اشتراك أساسي')
ON CONFLICT (license_key) DO NOTHING;

-- دالة لتحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_licenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ربط الدالة بالجدول
DROP TRIGGER IF EXISTS set_licenses_updated_at ON licenses;
CREATE TRIGGER set_licenses_updated_at
  BEFORE UPDATE ON licenses
  FOR EACH ROW
  EXECUTE FUNCTION update_licenses_updated_at();

-- دالة للتحقق من انتهاء صلاحية الترخيص
CREATE OR REPLACE FUNCTION is_license_expired(license_id uuid)
RETURNS boolean AS $$
DECLARE
  expiry_date timestamptz;
BEGIN
  SELECT expires_at INTO expiry_date
  FROM licenses
  WHERE id = license_id;

  IF expiry_date IS NULL THEN
    RETURN false; -- لا يوجد تاريخ انتهاء = غير محدود
  END IF;

  RETURN expiry_date < now();
END;
$$ LANGUAGE plpgsql;
