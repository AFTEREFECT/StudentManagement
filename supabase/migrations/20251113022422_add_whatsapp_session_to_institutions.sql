/*
  # إضافة دعم جلسات WhatsApp للمؤسسات
  
  إضافة حقول لإدارة جلسات WhatsApp عبر خادم Waaku
  
  ## التغييرات
  
  1. **إنشاء جدول المؤسسات إذا لم يكن موجوداً**:
     - `institutions` - جدول المؤسسات التعليمية
     
  2. **إضافة أعمدة جلسة WhatsApp**:
     - `whatsapp_session_id` (text) - معرف جلسة WhatsApp على خادم Waaku
     - `whatsapp_session_status` (text) - حالة الجلسة (CONNECTED, DISCONNECTED, SCANNING)
     - `whatsapp_qr_code` (text) - آخر QR code تم استقباله
     - `whatsapp_phone_number` (text) - رقم الهاتف المرتبط بالجلسة
     - `whatsapp_connected_at` (timestamptz) - تاريخ آخر اتصال ناجح
     - `whatsapp_last_checked` (timestamptz) - آخر مرة تم فحص الحالة
     
  3. **الأمان**:
     - RLS مُفعّل
     - السياسات تسمح للجميع بالقراءة والتعديل (سيتم تحسينها لاحقاً حسب نظام المصادقة)
*/

-- إنشاء جدول المؤسسات إذا لم يكن موجوداً
CREATE TABLE IF NOT EXISTS institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE,
  address text,
  phone text,
  email text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- إضافة أعمدة WhatsApp إلى جدول المؤسسات
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'institutions' AND column_name = 'whatsapp_session_id'
  ) THEN
    ALTER TABLE institutions ADD COLUMN whatsapp_session_id text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'institutions' AND column_name = 'whatsapp_session_status'
  ) THEN
    ALTER TABLE institutions ADD COLUMN whatsapp_session_status text DEFAULT 'DISCONNECTED';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'institutions' AND column_name = 'whatsapp_qr_code'
  ) THEN
    ALTER TABLE institutions ADD COLUMN whatsapp_qr_code text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'institutions' AND column_name = 'whatsapp_phone_number'
  ) THEN
    ALTER TABLE institutions ADD COLUMN whatsapp_phone_number text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'institutions' AND column_name = 'whatsapp_connected_at'
  ) THEN
    ALTER TABLE institutions ADD COLUMN whatsapp_connected_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'institutions' AND column_name = 'whatsapp_last_checked'
  ) THEN
    ALTER TABLE institutions ADD COLUMN whatsapp_last_checked timestamptz;
  END IF;
END $$;

-- تمكين RLS
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;

-- سياسات الوصول (مبدئية - يمكن تخصيصها لاحقاً)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'institutions' AND policyname = 'Allow public read access to institutions'
  ) THEN
    CREATE POLICY "Allow public read access to institutions"
      ON institutions
      FOR SELECT
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'institutions' AND policyname = 'Allow public insert to institutions'
  ) THEN
    CREATE POLICY "Allow public insert to institutions"
      ON institutions
      FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'institutions' AND policyname = 'Allow public update to institutions'
  ) THEN
    CREATE POLICY "Allow public update to institutions"
      ON institutions
      FOR UPDATE
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'institutions' AND policyname = 'Allow public delete from institutions'
  ) THEN
    CREATE POLICY "Allow public delete from institutions"
      ON institutions
      FOR DELETE
      USING (true);
  END IF;
END $$;

-- إنشاء فهارس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_institutions_whatsapp_session_id ON institutions(whatsapp_session_id);
CREATE INDEX IF NOT EXISTS idx_institutions_whatsapp_session_status ON institutions(whatsapp_session_status);

-- إضافة تعليقات
COMMENT ON TABLE institutions IS 'جدول المؤسسات التعليمية مع دعم جلسات WhatsApp عبر Waaku';
COMMENT ON COLUMN institutions.whatsapp_session_id IS 'معرف الجلسة على خادم Waaku';
COMMENT ON COLUMN institutions.whatsapp_session_status IS 'حالة الجلسة: CONNECTED, DISCONNECTED, SCANNING';
COMMENT ON COLUMN institutions.whatsapp_qr_code IS 'آخر QR code للمسح';
COMMENT ON COLUMN institutions.whatsapp_phone_number IS 'رقم WhatsApp المرتبط';

-- إدراج مؤسسة افتراضية إذا كان الجدول فارغاً
INSERT INTO institutions (name, code)
SELECT 'المؤسسة الافتراضية', 'DEFAULT'
WHERE NOT EXISTS (SELECT 1 FROM institutions);
