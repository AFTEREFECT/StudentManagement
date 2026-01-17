/*
  # إنشاء جداول نظام إدارة التلاميذ

  ## الجداول الجديدة
  
  ### 1. students - جدول التلاميذ الرئيسي
  يحتوي على:
  - `id` (uuid, primary key) - المعرف الفريد
  - `national_id` (text, unique) - الرقم الوطني
  - `student_id` (text, unique) - الرقم المدرسي
  - `first_name` (text) - الاسم الشخصي
  - `last_name` (text) - الاسم العائلي
  - `gender` (text) - النوع (ذكر/أنثى)
  - `date_of_birth` (date) - تاريخ الميلاد
  - `birth_place` (text) - مكان الازدياد
  - `age_group` (text) - الفئة العمرية
  - `email` (text) - البريد الإلكتروني
  - `phone` (text) - رقم الهاتف
  - `address` (text) - العنوان
  - `level_id` (uuid) - المستوى الدراسي
  - `section_id` (uuid) - القسم
  - `grade` (text) - الصف
  - `enrollment_date` (date) - تاريخ التسجيل
  - `academic_year` (text) - السنة الدراسية
  - `school_type` (text) - نوع المدرسة
  - `status` (text) - حالة التلميذ
  - `region` (text) - الجهة
  - `province` (text) - الإقليم/العمالة
  - `municipality` (text) - الجماعة
  - `institution` (text) - المؤسسة
  - `guardian_name` (text) - اسم ولي الأمر
  - `guardian_phone` (text) - هاتف ولي الأمر
  - `guardian_relation` (text) - صلة القرابة
  - `emergency_contact` (text) - جهة اتصال الطوارئ
  - `emergency_phone` (text) - هاتف الطوارئ
  - `social_support` (boolean) - الدعم الاجتماعي
  - `transport_service` (boolean) - خدمة النقل
  - `medical_info` (text) - المعلومات الطبية
  - `notes` (text) - ملاحظات
  - `created_at`, `updated_at` (timestamptz)

  ### 2. levels - جدول المستويات الدراسية
  - `id` (uuid, primary key)
  - `level_id` (text, unique) - معرف المستوى
  - `level_name` (text) - اسم المستوى
  - `level_code` (text) - رمز المستوى
  - `order_index` (integer) - ترتيب المستوى
  - `created_at`, `updated_at`

  ### 3. sections - جدول الأقسام
  - `id` (uuid, primary key)
  - `class_id` (text, unique) - معرف القسم
  - `class_name` (text) - اسم القسم
  - `level_id` (text) - معرف المستوى المرتبط
  - `created_at`, `updated_at`

  ## الأمان
  - تفعيل RLS على جميع الجداول
  - سياسات للقراءة والكتابة للمستخدمين المصادق عليهم
  - فهارس للبحث السريع
*/

-- جدول المستويات الدراسية
CREATE TABLE IF NOT EXISTS levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id text UNIQUE NOT NULL,
  level_name text NOT NULL,
  level_code text,
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول الأقسام
CREATE TABLE IF NOT EXISTS sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id text UNIQUE NOT NULL,
  class_name text NOT NULL,
  level_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول التلاميذ الرئيسي
CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  national_id text UNIQUE NOT NULL,
  student_id text UNIQUE NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  gender text DEFAULT 'ذكر',
  date_of_birth date,
  birth_place text DEFAULT '',
  age_group text DEFAULT '',
  email text DEFAULT '',
  phone text DEFAULT '',
  address text DEFAULT '',
  level_id text,
  section_id text,
  grade text DEFAULT '',
  enrollment_date date DEFAULT CURRENT_DATE,
  academic_year text DEFAULT '2025/2026',
  school_type text DEFAULT '',
  status text DEFAULT 'متمدرس',
  region text DEFAULT '',
  province text DEFAULT '',
  municipality text DEFAULT '',
  institution text DEFAULT '',
  guardian_name text DEFAULT '',
  guardian_phone text DEFAULT '',
  guardian_relation text DEFAULT '',
  emergency_contact text DEFAULT '',
  emergency_phone text DEFAULT '',
  social_support boolean DEFAULT false,
  transport_service boolean DEFAULT false,
  medical_info text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- الفهارس للبحث السريع
CREATE INDEX IF NOT EXISTS idx_students_national_id ON students(national_id);
CREATE INDEX IF NOT EXISTS idx_students_student_id ON students(student_id);
CREATE INDEX IF NOT EXISTS idx_students_level_id ON students(level_id);
CREATE INDEX IF NOT EXISTS idx_students_section_id ON students(section_id);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
CREATE INDEX IF NOT EXISTS idx_students_academic_year ON students(academic_year);
CREATE INDEX IF NOT EXISTS idx_sections_level_id ON sections(level_id);

-- تفعيل RLS
ALTER TABLE levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- سياسات للمستويات
CREATE POLICY "Allow public read access to levels"
  ON levels FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated users to insert levels"
  ON levels FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update levels"
  ON levels FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete levels"
  ON levels FOR DELETE
  TO authenticated
  USING (true);

-- سياسات للأقسام
CREATE POLICY "Allow public read access to sections"
  ON sections FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated users to insert sections"
  ON sections FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update sections"
  ON sections FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete sections"
  ON sections FOR DELETE
  TO authenticated
  USING (true);

-- سياسات للتلاميذ
CREATE POLICY "Allow public read access to students"
  ON students FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated users to insert students"
  ON students FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update students"
  ON students FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete students"
  ON students FOR DELETE
  TO authenticated
  USING (true);