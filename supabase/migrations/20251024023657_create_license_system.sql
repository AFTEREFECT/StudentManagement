/*
  # نظام إدارة التراخيص والأمان

  1. جداول جديدة
    - `licenses` - جدول التراخيص للتحقق من صحة الأكواد

  2. الأمان
    - تفعيل RLS
    - سياسات القراءة والتحديث

  3. ملاحظات
    - يستخدم فقط للتحقق من الأكواد ومنع التكرار
    - كل كود يمكن استخدامه على جهاز واحد فقط
*/

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

CREATE INDEX IF NOT EXISTS idx_licenses_key ON licenses(license_key);
CREATE INDEX IF NOT EXISTS idx_licenses_fingerprint ON licenses(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_licenses_activated ON licenses(is_activated);

ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "السماح بقراءة التراخيص للتحقق"
  ON licenses
  FOR SELECT
  USING (true);

CREATE POLICY "السماح بتحديث التفعيل"
  ON licenses
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

INSERT INTO licenses (license_key, expires_at, notes) VALUES
  ('DEMO-2025-STUDENT-DB-001', '2026-12-31', 'كود تجريبي للاختبار'),
  ('GSAIP-2025-PREMIUM-001', '2026-06-30', 'اشتراك سنوي'),
  ('GSAIP-2025-BASIC-001', '2025-12-31', 'اشتراك أساسي')
ON CONFLICT (license_key) DO NOTHING;

CREATE OR REPLACE FUNCTION update_licenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_licenses_updated_at ON licenses;
CREATE TRIGGER set_licenses_updated_at
  BEFORE UPDATE ON licenses
  FOR EACH ROW
  EXECUTE FUNCTION update_licenses_updated_at();
