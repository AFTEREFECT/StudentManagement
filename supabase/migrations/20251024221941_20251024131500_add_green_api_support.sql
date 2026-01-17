/*
  # إضافة دعم Green API لإعدادات WhatsApp

  ## نظرة عامة
  إضافة دعم Green API كبديل لـ CallMeBot لإرسال رسائل WhatsApp

  ## 1. إنشاء جدول whatsapp_settings (إذا لم يكن موجوداً)
    - `id` (uuid, primary key)
    - `instance_id` (text) - معرف Instance (CallMeBot/Whapi)
    - `access_token` (text) - رمز الوصول
    - `is_active` (boolean) - حالة التفعيل
    - `api_provider` (text) - الخدمة المستخدمة: callmebot أو greenapi
    - `green_api_instance` (text) - رقم Instance الخاص بـ Green API
    - `green_api_token` (text) - التوكن الخاص بـ Green API
    - `green_api_enabled` (boolean) - هل Green API مفعل
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ## 2. الأمان
    - تمكين RLS على الجدول
    - سياسات للسماح بالوصول العام
*/

-- ============================================
-- 1. إنشاء الجدول إذا لم يكن موجوداً
-- ============================================
CREATE TABLE IF NOT EXISTS whatsapp_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id text,
  access_token text,
  is_active boolean DEFAULT true,
  api_provider text DEFAULT 'callmebot' CHECK (api_provider IN ('callmebot', 'greenapi')),
  green_api_instance text,
  green_api_token text,
  green_api_enabled boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- 2. إضافة الأعمدة الجديدة إذا لم تكن موجودة
-- ============================================
DO $$
BEGIN
  -- api_provider
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_settings' AND column_name = 'api_provider'
  ) THEN
    ALTER TABLE whatsapp_settings ADD COLUMN api_provider text DEFAULT 'callmebot' CHECK (api_provider IN ('callmebot', 'greenapi'));
  END IF;

  -- green_api_instance
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_settings' AND column_name = 'green_api_instance'
  ) THEN
    ALTER TABLE whatsapp_settings ADD COLUMN green_api_instance text;
  END IF;

  -- green_api_token
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_settings' AND column_name = 'green_api_token'
  ) THEN
    ALTER TABLE whatsapp_settings ADD COLUMN green_api_token text;
  END IF;

  -- green_api_enabled
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_settings' AND column_name = 'green_api_enabled'
  ) THEN
    ALTER TABLE whatsapp_settings ADD COLUMN green_api_enabled boolean DEFAULT false;
  END IF;
END $$;

-- ============================================
-- 3. الفهارس
-- ============================================
CREATE INDEX IF NOT EXISTS idx_whatsapp_settings_api_provider ON whatsapp_settings(api_provider);
CREATE INDEX IF NOT EXISTS idx_whatsapp_settings_green_enabled ON whatsapp_settings(green_api_enabled);

-- ============================================
-- 4. تفعيل RLS
-- ============================================
ALTER TABLE whatsapp_settings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. سياسات الأمان
-- ============================================
DROP POLICY IF EXISTS "Allow public read access" ON whatsapp_settings;
DROP POLICY IF EXISTS "Allow public insert" ON whatsapp_settings;
DROP POLICY IF EXISTS "Allow public update" ON whatsapp_settings;
DROP POLICY IF EXISTS "Allow public delete" ON whatsapp_settings;

CREATE POLICY "Allow public read access"
  ON whatsapp_settings
  FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert"
  ON whatsapp_settings
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update"
  ON whatsapp_settings
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete"
  ON whatsapp_settings
  FOR DELETE
  USING (true);
