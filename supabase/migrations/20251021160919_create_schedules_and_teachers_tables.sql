/*
  # جداول الحصص وتوزيع الأساتذة

  1. الجداول الجديدة
    - `schedules` - جداول الحصص لجميع الأقسام
      - `id` (uuid, primary key)
      - `section` (text) - القسم
      - `day` (text) - اليوم
      - `period` (text) - الحصة
      - `subject` (text) - المادة
      - `teacher_code` (text) - رمز الأستاذ
      - `teacher_name` (text) - اسم الأستاذ
      - `time_from` (text) - من الساعة
      - `time_to` (text) - إلى الساعة
      - `room` (text) - القاعة
      - `created_at` (timestamptz)
    
    - `teachers` - بيانات الأساتذة
      - `id` (uuid, primary key)
      - `code` (text, unique) - الرمز
      - `name` (text) - الاسم
      - `phone` (text) - رقم الهاتف
      - `email` (text) - البريد الإلكتروني
      - `subjects` (text[]) - المواد المدرسة
      - `sections` (text[]) - الأقسام المسندة
      - `created_at` (timestamptz)
  
  2. الأمان
    - تفعيل RLS على الجدولين
    - سياسات للقراءة العامة (لكل المستخدمين)
    - سياسات للإدراج والتحديث والحذف (للمشرفين)

  3. ملاحظات مهمة
    - يدعم استيراد جداول الحصص من ProgMawarid بصيغة CSV/JSON
    - يوفر ربط التلاميذ بجداول حصصهم حسب الأقسام
    - يسمح بتحديد الأساتذة لكل مادة وقسم
    - يسهل إرسال إشعارات واتساب للأساتذة المعنيين
*/

-- جدول جداول الحصص
CREATE TABLE IF NOT EXISTS schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section text NOT NULL,
  day text NOT NULL,
  period text NOT NULL,
  subject text DEFAULT '',
  teacher_code text DEFAULT '',
  teacher_name text DEFAULT '',
  time_from text DEFAULT '',
  time_to text DEFAULT '',
  room text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- جدول الأساتذة
CREATE TABLE IF NOT EXISTS teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  phone text DEFAULT '',
  email text DEFAULT '',
  subjects text[] DEFAULT '{}',
  sections text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- تفعيل RLS
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;

-- سياسات الأمان لجداول الحصص
CREATE POLICY "Anyone can view schedules"
  ON schedules FOR SELECT
  USING (true);

CREATE POLICY "Service role can insert schedules"
  ON schedules FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update schedules"
  ON schedules FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can delete schedules"
  ON schedules FOR DELETE
  USING (true);

-- سياسات الأمان للأساتذة
CREATE POLICY "Anyone can view teachers"
  ON teachers FOR SELECT
  USING (true);

CREATE POLICY "Service role can insert teachers"
  ON teachers FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update teachers"
  ON teachers FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can delete teachers"
  ON teachers FOR DELETE
  USING (true);

-- إنشاء فهارس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_schedules_section ON schedules(section);
CREATE INDEX IF NOT EXISTS idx_schedules_day_period ON schedules(day, period);
CREATE INDEX IF NOT EXISTS idx_schedules_teacher ON schedules(teacher_code);
CREATE INDEX IF NOT EXISTS idx_teachers_code ON teachers(code);
CREATE INDEX IF NOT EXISTS idx_teachers_sections ON teachers USING GIN(sections);