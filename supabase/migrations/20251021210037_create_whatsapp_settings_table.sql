/*
  # إنشاء جدول إعدادات واتساب
  
  1. جدول جديد
    - `whatsapp_settings`
      - `id` (uuid, primary key)
      - `instance_id` (text) - معرف Instance من Whapi
      - `access_token` (text) - رمز الوصول
      - `is_active` (boolean) - حالة التفعيل
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. الأمان
    - تمكين RLS على الجدول
    - إضافة سياسات للسماح بالقراءة والكتابة للجميع (لأنه إعدادات عامة)
*/

-- إنشاء الجدول
CREATE TABLE IF NOT EXISTS whatsapp_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id text NOT NULL,
  access_token text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- تمكين RLS
ALTER TABLE whatsapp_settings ENABLE ROW LEVEL SECURITY;

-- سياسة السماح بالقراءة للجميع
CREATE POLICY "Allow public read access"
  ON whatsapp_settings
  FOR SELECT
  USING (true);

-- سياسة السماح بالإدراج للجميع
CREATE POLICY "Allow public insert"
  ON whatsapp_settings
  FOR INSERT
  WITH CHECK (true);

-- سياسة السماح بالتحديث للجميع
CREATE POLICY "Allow public update"
  ON whatsapp_settings
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- سياسة السماح بالحذف للجميع
CREATE POLICY "Allow public delete"
  ON whatsapp_settings
  FOR DELETE
  USING (true);