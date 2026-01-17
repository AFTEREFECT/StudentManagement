/*
  # إنشاء جدول إدارة العلاقات بين الجداول

  ## الجدول الجديد
  
  ### database_relationships - علاقات قاعدة البيانات
  - `id` (uuid, primary key)
  - `name` (text) - اسم العلاقة
  - `source_table` (text) - الجدول المصدر
  - `source_column` (text) - العمود المصدر
  - `target_table` (text) - الجدول الهدف
  - `target_column` (text) - العمود الهدف
  - `relationship_type` (text) - نوع العلاقة (one-to-many, many-to-one, one-to-one)
  - `on_delete` (text) - سلوك الحذف (CASCADE, SET NULL, RESTRICT)
  - `on_update` (text) - سلوك التحديث (CASCADE, SET NULL, RESTRICT)
  - `is_active` (boolean) - هل العلاقة نشطة
  - `description` (text) - وصف العلاقة
  - `created_at`, `updated_at`

  ## إضافة العلاقات الافتراضية
  يتم إضافة العلاقات الأساسية بين الجداول:
  1. students -> levels (عبر level_id)
  2. students -> sections (عبر section_id)
  3. sections -> levels (عبر level_id)
  4. quiz_results -> quiz_templates
  5. quiz_results -> students
  6. credentials -> students
  7. guidance_data -> students
  8. council_decisions -> students
  9. incoming_students -> levels/sections
  10. outgoing_students -> students

  ## الأمان
  - تفعيل RLS
  - سياسات للقراءة والكتابة
*/

-- جدول إدارة العلاقات
CREATE TABLE IF NOT EXISTS database_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  source_table text NOT NULL,
  source_column text NOT NULL,
  target_table text NOT NULL,
  target_column text NOT NULL,
  relationship_type text DEFAULT 'many-to-one',
  on_delete text DEFAULT 'CASCADE',
  on_update text DEFAULT 'CASCADE',
  is_active boolean DEFAULT true,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- الفهارس
CREATE INDEX IF NOT EXISTS idx_relationships_source ON database_relationships(source_table);
CREATE INDEX IF NOT EXISTS idx_relationships_target ON database_relationships(target_table);
CREATE INDEX IF NOT EXISTS idx_relationships_active ON database_relationships(is_active);

-- تفعيل RLS
ALTER TABLE database_relationships ENABLE ROW LEVEL SECURITY;

-- سياسات الوصول
CREATE POLICY "Allow public read access to database_relationships"
  ON database_relationships FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated users to insert relationships"
  ON database_relationships FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update relationships"
  ON database_relationships FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete relationships"
  ON database_relationships FOR DELETE
  TO authenticated
  USING (true);

-- إضافة العلاقات الافتراضية
INSERT INTO database_relationships (name, source_table, source_column, target_table, target_column, relationship_type, description) VALUES
  ('Students to Levels', 'students', 'level_id', 'levels', 'level_id', 'many-to-one', 'كل تلميذ ينتمي إلى مستوى دراسي واحد'),
  ('Students to Sections', 'students', 'section_id', 'sections', 'class_id', 'many-to-one', 'كل تلميذ ينتمي إلى قسم واحد'),
  ('Sections to Levels', 'sections', 'level_id', 'levels', 'level_id', 'many-to-one', 'كل قسم ينتمي إلى مستوى دراسي'),
  ('Quiz Results to Templates', 'quiz_results', 'template_id', 'quiz_templates', 'id', 'many-to-one', 'كل نتيجة مرتبطة بقالب امتحان'),
  ('Quiz Results to Students', 'quiz_results', 'student_id', 'students', 'student_id', 'many-to-one', 'كل نتيجة مرتبطة بتلميذ'),
  ('Credentials to Students', 'credentials', 'student_id', 'students', 'student_id', 'one-to-one', 'بيانات الدخول لكل تلميذ'),
  ('Guidance Data to Students', 'guidance_data', 'student_id', 'students', 'student_id', 'one-to-one', 'بيانات التوجيه لكل تلميذ'),
  ('Council Decisions to Students', 'council_decisions', 'student_id', 'students', 'student_id', 'many-to-one', 'قرارات المجالس للتلاميذ'),
  ('Schedules to Sections', 'schedules', 'section', 'sections', 'class_name', 'many-to-one', 'جدول الحصص لكل قسم'),
  ('Schedules to Teachers', 'schedules', 'teacher_code', 'teachers', 'code', 'many-to-one', 'الحصص مرتبطة بالأساتذة'),
  ('Absences to Students', 'absences', 'student_id', 'students', 'student_id', 'many-to-one', 'غيابات التلاميذ'),
  ('Permit Tickets to Absences', 'permit_tickets', 'absence_id', 'absences', 'id', 'one-to-one', 'رخص الغياب'),
  ('Notifications Log to Students', 'notifications_log', 'student_id', 'students', 'student_id', 'many-to-one', 'سجل الإشعارات للتلاميذ'),
  ('Incoming Students to Levels', 'incoming_students', 'new_level', 'levels', 'level_name', 'many-to-one', 'المستوى الجديد للتلاميذ الوافدين'),
  ('Outgoing Students Reference', 'outgoing_students', 'student_id', 'students', 'student_id', 'many-to-one', 'التلاميذ المغادرين'),
  ('Dismissed Students Reference', 'dismissed_students', 'student_id', 'students', 'id', 'many-to-one', 'التلاميذ المفصولين'),
  ('Unenrolled Students Reference', 'unenrolled_students', 'student_id', 'students', 'id', 'many-to-one', 'التلاميذ غير الملتحقين')
ON CONFLICT DO NOTHING;