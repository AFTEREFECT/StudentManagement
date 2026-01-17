/*
  # إنشاء جداول التوجيه والتنقل والمجالس

  ## الجداول الجديدة
  
  ### 1. guidance_data - بيانات التوجيه
  - `id` (uuid, primary key)
  - `student_id` (text) - الرقم المدرسي
  - `national_id` (text) - الرقم الوطني
  - `student_name` (text) - اسم التلميذ
  - `current_level` (text) - المستوى الحالي
  - `current_section` (text) - القسم الحالي
  - `guidance_choice_1` (text) - الاختيار الأول
  - `guidance_choice_2` (text) - الاختيار الثاني
  - `guidance_choice_3` (text) - الاختيار الثالث
  - `council_decision` (text) - قرار المجلس
  - `academic_year` (text) - السنة الدراسية
  - `notes` (text)
  - `created_at`, `updated_at`

  ### 2. council_decisions - قرارات المجالس
  - `id` (uuid, primary key)
  - `student_id` (text)
  - `national_id` (text)
  - `student_name` (text)
  - `current_level` (text)
  - `decision` (text) - القرار (ناجح، راسب، موجه...)
  - `next_level` (text) - المستوى القادم
  - `notes` (text)
  - `academic_year` (text)
  - `decision_date` (date)
  - `created_at`, `updated_at`

  ### 3. incoming_students - التلاميذ الوافدين
  - `id` (uuid, primary key)
  - `student_id` (text)
  - `national_id` (text)
  - `first_name`, `last_name` (text)
  - `gender` (text)
  - `date_of_birth` (date)
  - `previous_institution` (text) - المؤسسة السابقة
  - `previous_level` (text) - المستوى السابق
  - `transfer_date` (date) - تاريخ الانتقال
  - `new_level` (text) - المستوى الجديد
  - `new_section` (text) - القسم الجديد
  - `request_number` (text) - رقم الطلب
  - `status` (text) - حالة الطلب
  - `documents` (jsonb) - الوثائق المطلوبة
  - `notes` (text)
  - `academic_year` (text)
  - `created_at`, `updated_at`

  ### 4. outgoing_students - التلاميذ المغادرين
  - `id` (uuid, primary key)
  - `student_id` (text)
  - `national_id` (text)
  - `first_name`, `last_name` (text)
  - `gender` (text)
  - `current_level` (text)
  - `current_section` (text)
  - `destination_institution` (text) - المؤسسة المستقبلة
  - `transfer_date` (date)
  - `reason` (text) - سبب المغادرة
  - `request_number` (text)
  - `status` (text)
  - `documents_sent` (boolean)
  - `notes` (text)
  - `academic_year` (text)
  - `created_at`, `updated_at`

  ### 5. dismissed_students - التلاميذ المفصولين
  - `id` (uuid, primary key)
  - `student_id` (text)
  - `dismissal_date` (date)
  - `reason` (text)
  - `metadata` (jsonb)
  - `created_at`

  ### 6. unenrolled_students - التلاميذ غير الملتحقين
  - `id` (uuid, primary key)
  - `student_id` (text)
  - `expected_level` (text)
  - `contact_attempts` (integer)
  - `last_contact_date` (date)
  - `reason` (text)
  - `metadata` (jsonb)
  - `created_at`, `updated_at`

  ## الأمان
  - تفعيل RLS على جميع الجداول
  - سياسات للمستخدمين المصادق عليهم
*/

-- جدول بيانات التوجيه
CREATE TABLE IF NOT EXISTS guidance_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL,
  national_id text DEFAULT '',
  student_name text DEFAULT '',
  current_level text DEFAULT '',
  current_section text DEFAULT '',
  guidance_choice_1 text DEFAULT '',
  guidance_choice_2 text DEFAULT '',
  guidance_choice_3 text DEFAULT '',
  council_decision text DEFAULT '',
  academic_year text DEFAULT '2025/2026',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول قرارات المجالس
CREATE TABLE IF NOT EXISTS council_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL,
  national_id text DEFAULT '',
  student_name text DEFAULT '',
  current_level text DEFAULT '',
  decision text DEFAULT '',
  next_level text DEFAULT '',
  notes text DEFAULT '',
  academic_year text DEFAULT '2025/2026',
  decision_date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول التلاميذ الوافدين
CREATE TABLE IF NOT EXISTS incoming_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text DEFAULT '',
  national_id text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  gender text DEFAULT 'ذكر',
  date_of_birth date,
  previous_institution text DEFAULT '',
  previous_level text DEFAULT '',
  transfer_date date DEFAULT CURRENT_DATE,
  new_level text DEFAULT '',
  new_section text DEFAULT '',
  request_number text DEFAULT '',
  status text DEFAULT 'قيد المعالجة',
  documents jsonb DEFAULT '{}'::jsonb,
  notes text DEFAULT '',
  academic_year text DEFAULT '2025/2026',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول التلاميذ المغادرين
CREATE TABLE IF NOT EXISTS outgoing_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL,
  national_id text DEFAULT '',
  first_name text NOT NULL,
  last_name text NOT NULL,
  gender text DEFAULT 'ذكر',
  current_level text DEFAULT '',
  current_section text DEFAULT '',
  destination_institution text DEFAULT '',
  transfer_date date DEFAULT CURRENT_DATE,
  reason text DEFAULT '',
  request_number text DEFAULT '',
  status text DEFAULT 'قيد المعالجة',
  documents_sent boolean DEFAULT false,
  notes text DEFAULT '',
  academic_year text DEFAULT '2025/2026',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول التلاميذ المفصولين
CREATE TABLE IF NOT EXISTS dismissed_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL,
  dismissal_date date DEFAULT CURRENT_DATE,
  reason text DEFAULT '',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- جدول التلاميذ غير الملتحقين
CREATE TABLE IF NOT EXISTS unenrolled_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL,
  expected_level text DEFAULT '',
  contact_attempts integer DEFAULT 0,
  last_contact_date date,
  reason text DEFAULT '',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- الفهارس
CREATE INDEX IF NOT EXISTS idx_guidance_student ON guidance_data(student_id);
CREATE INDEX IF NOT EXISTS idx_guidance_national_id ON guidance_data(national_id);
CREATE INDEX IF NOT EXISTS idx_council_student ON council_decisions(student_id);
CREATE INDEX IF NOT EXISTS idx_incoming_national_id ON incoming_students(national_id);
CREATE INDEX IF NOT EXISTS idx_incoming_status ON incoming_students(status);
CREATE INDEX IF NOT EXISTS idx_outgoing_student ON outgoing_students(student_id);
CREATE INDEX IF NOT EXISTS idx_outgoing_status ON outgoing_students(status);
CREATE INDEX IF NOT EXISTS idx_dismissed_student ON dismissed_students(student_id);
CREATE INDEX IF NOT EXISTS idx_unenrolled_student ON unenrolled_students(student_id);

-- تفعيل RLS
ALTER TABLE guidance_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE council_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE incoming_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE outgoing_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE dismissed_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE unenrolled_students ENABLE ROW LEVEL SECURITY;

-- سياسات guidance_data
CREATE POLICY "Allow public read access to guidance_data"
  ON guidance_data FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated users to manage guidance_data"
  ON guidance_data FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- سياسات council_decisions
CREATE POLICY "Allow public read access to council_decisions"
  ON council_decisions FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated users to manage council_decisions"
  ON council_decisions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- سياسات incoming_students
CREATE POLICY "Allow public read access to incoming_students"
  ON incoming_students FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated users to manage incoming_students"
  ON incoming_students FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- سياسات outgoing_students
CREATE POLICY "Allow public read access to outgoing_students"
  ON outgoing_students FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated users to manage outgoing_students"
  ON outgoing_students FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- سياسات dismissed_students
CREATE POLICY "Allow public read access to dismissed_students"
  ON dismissed_students FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated users to manage dismissed_students"
  ON dismissed_students FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- سياسات unenrolled_students
CREATE POLICY "Allow public read access to unenrolled_students"
  ON unenrolled_students FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated users to manage unenrolled_students"
  ON unenrolled_students FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);