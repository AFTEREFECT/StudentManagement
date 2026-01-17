/*
  # إنشاء جداول الامتحانات والاختبارات

  ## الجداول الجديدة
  
  ### 1. quiz_templates - قوالب الامتحانات
  - `id` (uuid, primary key)
  - `name` (text) - اسم القالب
  - `subject` (text) - المادة
  - `level_id` (text) - المستوى
  - `section_id` (text) - القسم
  - `total_questions` (integer) - عدد الأسئلة
  - `questions_per_page` (integer) - عدد الأسئلة لكل صفحة
  - `options_count` (integer) - عدد الخيارات (A, B, C, D)
  - `template_config` (jsonb) - إعدادات القالب
  - `created_at`, `updated_at`

  ### 2. quiz_results - نتائج الامتحانات
  - `id` (uuid, primary key)
  - `template_id` (uuid) - معرف القالب
  - `student_id` (text) - الرقم الوطني للتلميذ
  - `student_national_id` (text) - الرقم الوطني
  - `student_name` (text) - اسم التلميذ
  - `answers` (jsonb) - إجابات التلميذ
  - `correct_answers` (jsonb) - الإجابات الصحيحة
  - `score` (numeric) - النقطة
  - `total_questions` (integer) - مجموع الأسئلة
  - `scanned_at` (timestamptz) - تاريخ المسح
  - `created_at`

  ### 3. credentials - بيانات الدخول
  - `id` (uuid, primary key)
  - `student_id` (text) - الرقم المدرسي
  - `national_id` (text) - الرقم الوطني
  - `username` (text) - اسم المستخدم
  - `password` (text) - كلمة المرور
  - `platform` (text) - المنصة (Massar, Moodle, etc)
  - `notes` (text)
  - `created_at`, `updated_at`

  ## الأمان
  - تفعيل RLS على جميع الجداول
  - سياسات وصول للمستخدمين المصادق عليهم
*/

-- جدول قوالب الامتحانات
CREATE TABLE IF NOT EXISTS quiz_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text DEFAULT '',
  level_id text DEFAULT '',
  section_id text DEFAULT '',
  total_questions integer DEFAULT 20,
  questions_per_page integer DEFAULT 5,
  options_count integer DEFAULT 4,
  template_config jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول نتائج الامتحانات
CREATE TABLE IF NOT EXISTS quiz_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid,
  student_id text NOT NULL,
  student_national_id text DEFAULT '',
  student_name text DEFAULT '',
  answers jsonb DEFAULT '{}'::jsonb,
  correct_answers jsonb DEFAULT '{}'::jsonb,
  score numeric DEFAULT 0,
  total_questions integer DEFAULT 0,
  scanned_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- جدول بيانات الدخول
CREATE TABLE IF NOT EXISTS credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL,
  national_id text DEFAULT '',
  username text NOT NULL,
  password text NOT NULL,
  platform text DEFAULT 'Massar',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- الفهارس
CREATE INDEX IF NOT EXISTS idx_quiz_templates_level ON quiz_templates(level_id);
CREATE INDEX IF NOT EXISTS idx_quiz_templates_section ON quiz_templates(section_id);
CREATE INDEX IF NOT EXISTS idx_quiz_results_student ON quiz_results(student_id);
CREATE INDEX IF NOT EXISTS idx_quiz_results_template ON quiz_results(template_id);
CREATE INDEX IF NOT EXISTS idx_credentials_student ON credentials(student_id);
CREATE INDEX IF NOT EXISTS idx_credentials_national_id ON credentials(national_id);

-- تفعيل RLS
ALTER TABLE quiz_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE credentials ENABLE ROW LEVEL SECURITY;

-- سياسات quiz_templates
CREATE POLICY "Allow public read access to quiz_templates"
  ON quiz_templates FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated users to insert quiz_templates"
  ON quiz_templates FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update quiz_templates"
  ON quiz_templates FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete quiz_templates"
  ON quiz_templates FOR DELETE
  TO authenticated
  USING (true);

-- سياسات quiz_results
CREATE POLICY "Allow public read access to quiz_results"
  ON quiz_results FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated users to insert quiz_results"
  ON quiz_results FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update quiz_results"
  ON quiz_results FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete quiz_results"
  ON quiz_results FOR DELETE
  TO authenticated
  USING (true);

-- سياسات credentials
CREATE POLICY "Allow public read access to credentials"
  ON credentials FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated users to insert credentials"
  ON credentials FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update credentials"
  ON credentials FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete credentials"
  ON credentials FOR DELETE
  TO authenticated
  USING (true);