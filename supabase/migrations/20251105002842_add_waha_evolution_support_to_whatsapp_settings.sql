/*
  # تحديث جدول إعدادات واتساب لدعمahw و Evolution API
  
  تحديث جدول whatsapp_settings لإضافة دعم كامل لخدمتيahw و Evolution API
  
  ## التغييرات
  
  1. **إضافة أعمدة جديدة لخدمةahw**:
     - `service_type` (text) - نوع الخدمة: 'waha', 'evolution', 'green_api', 'callmebot'
     - `waha_server_url` (text) - عنوان خادمahw
     - `waha_api_key` (text) - مفتاح API لخادمahw
     - `waha_session_name` (text) - اسم الجلسة فيahw (مثل: default)
     
  2. **إضافة أعمدة جديدة لخدمة Evolution API**:
     - `evolution_api_url` (text) - عنوان خادم Evolution API
     - `evolution_instance_name` (text) - اسم المثيل (instance)
     - `evolution_api_key` (text) - مفتاح API للمثيل
     
  3. **الأعمدة الموجودة (Green API / CallMeBot)**:
     - `instance_id` - يبقى للاستخدام مع CallMeBot/WhapiPlus
     - `access_token` - يبقى للاستخدام مع CallMeBot/WhapiPlus
     - `green_api_instance` - معرف instance لـ Green API
     - `green_api_token` - توكن Green API
     - `green_api_enabled` - تفعيل Green API
     - `waha_enabled` - تفعيلahw
     
  4. **الأمان**:
     - RLS مُفعّل مسبقاً
     - السياسات الموجودة تستمر في العمل
*/

-- إضافة أعمدة service_type إذا لم يكن موجوداً
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_settings' AND column_name = 'service_type'
  ) THEN
    ALTER TABLE whatsapp_settings ADD COLUMN service_type text DEFAULT 'waha';
  END IF;
END $$;

-- إضافة أعمدةahw
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_settings' AND column_name = 'waha_server_url'
  ) THEN
    ALTER TABLE whatsapp_settings ADD COLUMNahw_server_url text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_settings' AND column_name = 'waha_api_key'
  ) THEN
    ALTER TABLE whatsapp_settings ADD COLUMNahw_api_key text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_settings' AND column_name = 'waha_session_name'
  ) THEN
    ALTER TABLE whatsapp_settings ADD COLUMNahw_session_name text DEFAULT 'default';
  END IF;
END $$;

-- إضافة أعمدة Evolution API
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_settings' AND column_name = 'evolution_api_url'
  ) THEN
    ALTER TABLE whatsapp_settings ADD COLUMN evolution_api_url text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_settings' AND column_name = 'evolution_instance_name'
  ) THEN
    ALTER TABLE whatsapp_settings ADD COLUMN evolution_instance_name text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_settings' AND column_name = 'evolution_api_key'
  ) THEN
    ALTER TABLE whatsapp_settings ADD COLUMN evolution_api_key text;
  END IF;
END $$;

-- إضافة أعمدة إضافية إذا لم تكن موجودة
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_settings' AND column_name = 'green_api_instance'
  ) THEN
    ALTER TABLE whatsapp_settings ADD COLUMN green_api_instance text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_settings' AND column_name = 'green_api_token'
  ) THEN
    ALTER TABLE whatsapp_settings ADD COLUMN green_api_token text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_settings' AND column_name = 'green_api_enabled'
  ) THEN
    ALTER TABLE whatsapp_settings ADD COLUMN green_api_enabled boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_settings' AND column_name = 'waha_enabled'
  ) THEN
    ALTER TABLE whatsapp_settings ADD COLUMNahw_enabled boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_settings' AND column_name = 'waha_session_id'
  ) THEN
    ALTER TABLE whatsapp_settings ADD COLUMNahw_session_id uuid;
  END IF;
END $$;

-- إنشاء فهرس على service_type لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_whatsapp_settings_service_type ON whatsapp_settings(service_type);

-- إضافة تعليق على الجدول
COMMENT ON TABLE whatsapp_settings IS 'جدول إعدادات خدمات WhatsApp - يدعمahw, Evolution API, Green API, وCallMeBot';
COMMENT ON COLUMN whatsapp_settings.service_type IS 'نوع الخدمة:ahw, evolution, green_api, callmebot';
COMMENT ON COLUMN whatsapp_settings.waha_server_url IS 'عنوان خادمahw (مثل: https://api.progtalamid.com)';
COMMENT ON COLUMN whatsapp_settings.waha_api_key IS 'مفتاح API لخادمahw';
COMMENT ON COLUMN whatsapp_settings.waha_session_name IS 'اسم الجلسة فيahw (مثل: default)';
COMMENT ON COLUMN whatsapp_settings.evolution_api_url IS 'عنوان خادم Evolution API';
COMMENT ON COLUMN whatsapp_settings.evolution_instance_name IS 'اسم المثيل في Evolution API';
COMMENT ON COLUMN whatsapp_settings.evolution_api_key IS 'مفتاح API للمثيل في Evolution API';