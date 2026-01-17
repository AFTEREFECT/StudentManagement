/*
  # نظام تدبير الغيابات والإشعارات

  ## الجداول الجديدة
  
  ### 1. `whatsapp_settings` - إعدادات واتساب API
    - `id` (uuid, primary key)
    - `instance_id` (text) - معرف النسخة
    - `access_token` (text) - رمز الوصول
    - `is_active` (boolean) - حالة التفعيل
    - `created_at` (timestamp)
    - `updated_at` (timestamp)

  ### 2. `message_templates` - نماذج الرسائل الجاهزة
    - `id` (uuid, primary key)
    - `name` (text) - اسم النموذج
    - `content` (text) - محتوى الرسالة
    - `category` (text) - الفئة (غياب، تأخر، مخالفة...)
    - `created_at` (timestamp)
    - `updated_at` (timestamp)

  ### 3. `absences` - سجل الغيابات
    - `id` (uuid, primary key)
    - `student_id` (text) - معرف التلميذ
    - `date` (date) - تاريخ الغياب
    - `period` (text) - الحصة
    - `subject` (text) - المادة
    - `time_from` (text) - الوقت من
    - `time_to` (text) - الوقت إلى
    - `room` (text) - القاعة
    - `status` (text) - الحالة (غائب، متأخر، مخالفة)
    - `reason` (text) - سبب الغياب
    - `notified` (boolean) - تم الإشعار
    - `created_at` (timestamp)

  ### 4. `notifications_log` - سجل الإشعارات المرسلة
    - `id` (uuid, primary key)
    - `student_id` (text) - معرف التلميذ
    - `phone_number` (text) - رقم الهاتف
    - `message` (text) - الرسالة
    - `status` (text) - حالة الإرسال (success, failed, pending)
    - `response` (jsonb) - استجابة API
    - `sent_at` (timestamp)

  ### 5. `permit_tickets` - أوراق السماح بالدخول
    - `id` (uuid, primary key)
    - `student_id` (text) - معرف التلميذ
    - `absence_id` (uuid) - معرف الغياب
    - `issue_date` (date) - تاريخ الإصدار
    - `issued_by` (text) - أصدرت من طرف
    - `printed` (boolean) - تمت الطباعة
    - `created_at` (timestamp)

  ## الأمان
  - تفعيل RLS على جميع الجداول
  - سياسات الوصول للمستخدمين المصادقين فقط
*/

-- جدول إعدادات واتساب
CREATE TABLE IF NOT EXISTS whatsapp_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id text NOT NULL,
  access_token text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE whatsapp_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read settings"
  ON whatsapp_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert settings"
  ON whatsapp_settings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update settings"
  ON whatsapp_settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete settings"
  ON whatsapp_settings FOR DELETE
  TO authenticated
  USING (true);

-- جدول نماذج الرسائل
CREATE TABLE IF NOT EXISTS message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  content text NOT NULL,
  category text DEFAULT 'عام',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read templates"
  ON message_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert templates"
  ON message_templates FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update templates"
  ON message_templates FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete templates"
  ON message_templates FOR DELETE
  TO authenticated
  USING (true);

-- جدول الغيابات
CREATE TABLE IF NOT EXISTS absences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL,
  date date NOT NULL,
  period text NOT NULL,
  subject text DEFAULT '',
  time_from text DEFAULT '',
  time_to text DEFAULT '',
  room text DEFAULT '',
  status text DEFAULT 'غائب',
  reason text DEFAULT '',
  notified boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE absences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read absences"
  ON absences FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert absences"
  ON absences FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update absences"
  ON absences FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete absences"
  ON absences FOR DELETE
  TO authenticated
  USING (true);

-- جدول سجل الإشعارات
CREATE TABLE IF NOT EXISTS notifications_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL,
  phone_number text NOT NULL,
  message text NOT NULL,
  status text DEFAULT 'pending',
  response jsonb DEFAULT '{}'::jsonb,
  sent_at timestamptz DEFAULT now()
);

ALTER TABLE notifications_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read notifications"
  ON notifications_log FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert notifications"
  ON notifications_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update notifications"
  ON notifications_log FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete notifications"
  ON notifications_log FOR DELETE
  TO authenticated
  USING (true);

-- جدول أوراق السماح بالدخول
CREATE TABLE IF NOT EXISTS permit_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL,
  absence_id uuid REFERENCES absences(id) ON DELETE CASCADE,
  issue_date date DEFAULT CURRENT_DATE,
  issued_by text DEFAULT 'الإدارة',
  printed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE permit_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read permits"
  ON permit_tickets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert permits"
  ON permit_tickets FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update permits"
  ON permit_tickets FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete permits"
  ON permit_tickets FOR DELETE
  TO authenticated
  USING (true);

-- إنشاء indexes لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_absences_student_id ON absences(student_id);
CREATE INDEX IF NOT EXISTS idx_absences_date ON absences(date);
CREATE INDEX IF NOT EXISTS idx_absences_status ON absences(status);
CREATE INDEX IF NOT EXISTS idx_notifications_student_id ON notifications_log(student_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications_log(status);
CREATE INDEX IF NOT EXISTS idx_permit_tickets_student_id ON permit_tickets(student_id);