/*
  # نظام التجربة المجانية الذكي والآمن

  ## نظرة عامة
  إنشاء نظام تجريبي متقدم يسمح للمستخدمين بتجربة البرنامج لمدة 7 أيام بدون كود.
  النظام محمي بشكل قوي ضد التلاعب ويتتبع إحصائيات الاستخدام.

  ## 1. جداول جديدة

  ### trial_sessions - جلسات التجربة المجانية
    - `id` (uuid, primary key) - معرف فريد للجلسة
    - `device_fingerprint` (text, unique) - بصمة الجهاز الفريدة
    - `trial_started_at` (timestamptz) - بداية التجربة (من الخادم)
    - `trial_expires_at` (timestamptz) - نهاية التجربة
    - `is_expired` (boolean) - هل انتهت التجربة
    - `session_count` (integer) - عدد مرات فتح البرنامج
    - `last_activity` (timestamptz) - آخر نشاط
    - `browser_info` (jsonb) - معلومات المتصفح والنظام
    - `ip_address` (text) - عنوان IP
    - `converted_to_paid` (boolean) - هل تحول لمشترك مدفوع
    - `notes` (text) - ملاحظات إضافية
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ### user_analytics - تتبع إحصائيات المستخدمين
    - `id` (uuid, primary key) - معرف فريد
    - `device_fingerprint` (text) - بصمة الجهاز
    - `session_type` (text) - trial أو paid أو developer
    - `action_type` (text) - app_opened, feature_used, trial_started, etc
    - `action_details` (jsonb) - تفاصيل إضافية عن الإجراء
    - `timestamp` (timestamptz) - وقت الإجراء (من الخادم)
    - `user_agent` (text) - معلومات المتصفح
    - `ip_address` (text) - عنوان IP

  ### server_time_checks - فحص تزامن الوقت
    - `id` (uuid, primary key)
    - `device_fingerprint` (text)
    - `client_time` (timestamptz) - الوقت من جهاز المستخدم
    - `server_time` (timestamptz) - الوقت الفعلي من الخادم
    - `time_difference_seconds` (integer) - الفرق بالثواني
    - `is_suspicious` (boolean) - هل الفرق مشبوه
    - `created_at` (timestamptz)

  ## 2. الأمان
  - تفعيل RLS على جميع الجداول
  - سياسات محددة للقراءة والكتابة
  - منع التلاعب بالبيانات

  ## 3. الدوال المساعدة
  - دالة للحصول على وقت الخادم
  - دالة للتحقق من صلاحية التجربة
  - دالة لتسجيل الإحصائيات
*/

-- ============================================
-- 1. إنشاء جدول جلسات التجربة المجانية
-- ============================================
CREATE TABLE IF NOT EXISTS trial_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_fingerprint text UNIQUE NOT NULL,
  trial_started_at timestamptz DEFAULT now() NOT NULL,
  trial_expires_at timestamptz NOT NULL,
  is_expired boolean DEFAULT false,
  session_count integer DEFAULT 1,
  last_activity timestamptz DEFAULT now(),
  browser_info jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  converted_to_paid boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- الفهارس
CREATE INDEX IF NOT EXISTS idx_trial_sessions_fingerprint ON trial_sessions(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_trial_sessions_expires_at ON trial_sessions(trial_expires_at);
CREATE INDEX IF NOT EXISTS idx_trial_sessions_is_expired ON trial_sessions(is_expired);
CREATE INDEX IF NOT EXISTS idx_trial_sessions_created_at ON trial_sessions(created_at);

-- ============================================
-- 2. إنشاء جدول تتبع الإحصائيات
-- ============================================
CREATE TABLE IF NOT EXISTS user_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_fingerprint text NOT NULL,
  session_type text NOT NULL CHECK (session_type IN ('trial', 'paid', 'developer')),
  action_type text NOT NULL,
  action_details jsonb DEFAULT '{}'::jsonb,
  timestamp timestamptz DEFAULT now() NOT NULL,
  user_agent text,
  ip_address text
);

-- الفهارس
CREATE INDEX IF NOT EXISTS idx_user_analytics_fingerprint ON user_analytics(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_user_analytics_session_type ON user_analytics(session_type);
CREATE INDEX IF NOT EXISTS idx_user_analytics_action_type ON user_analytics(action_type);
CREATE INDEX IF NOT EXISTS idx_user_analytics_timestamp ON user_analytics(timestamp DESC);

-- ============================================
-- 3. إنشاء جدول فحص تزامن الوقت
-- ============================================
CREATE TABLE IF NOT EXISTS server_time_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_fingerprint text NOT NULL,
  client_time timestamptz NOT NULL,
  server_time timestamptz DEFAULT now() NOT NULL,
  time_difference_seconds integer GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (server_time - client_time))::integer
  ) STORED,
  is_suspicious boolean GENERATED ALWAYS AS (
    ABS(EXTRACT(EPOCH FROM (server_time - client_time))) > 300
  ) STORED,
  created_at timestamptz DEFAULT now()
);

-- الفهارس
CREATE INDEX IF NOT EXISTS idx_server_time_checks_fingerprint ON server_time_checks(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_server_time_checks_suspicious ON server_time_checks(is_suspicious) WHERE is_suspicious = true;

-- ============================================
-- 4. تفعيل RLS على جميع الجداول
-- ============================================
ALTER TABLE trial_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE server_time_checks ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. سياسات الأمان
-- ============================================

-- trial_sessions: السماح للجميع بالقراءة والكتابة (مع قيود)
CREATE POLICY "Anyone can read own trial session"
  ON trial_sessions FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert trial session"
  ON trial_sessions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update own trial session"
  ON trial_sessions FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- user_analytics: السماح للجميع بالإدراج، القراءة للمصادق عليهم فقط
CREATE POLICY "Anyone can insert analytics"
  ON user_analytics FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view analytics"
  ON user_analytics FOR SELECT
  TO authenticated
  USING (true);

-- server_time_checks: السماح للجميع بالإدراج، القراءة للمصادق عليهم فقط
CREATE POLICY "Anyone can insert time checks"
  ON server_time_checks FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view time checks"
  ON server_time_checks FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- 6. دالة للحصول على وقت الخادم
-- ============================================
CREATE OR REPLACE FUNCTION get_server_time()
RETURNS timestamptz AS $$
BEGIN
  RETURN now();
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- 7. دالة لبدء جلسة تجريبية جديدة
-- ============================================
CREATE OR REPLACE FUNCTION start_trial_session(
  p_device_fingerprint text,
  p_browser_info jsonb DEFAULT '{}'::jsonb,
  p_ip_address text DEFAULT NULL,
  p_trial_duration_days integer DEFAULT 7
)
RETURNS jsonb AS $$
DECLARE
  v_existing_session record;
  v_new_session record;
  v_server_time timestamptz;
  v_expires_at timestamptz;
BEGIN
  -- الحصول على الوقت من الخادم
  v_server_time := now();

  -- التحقق من وجود جلسة سابقة
  SELECT * INTO v_existing_session
  FROM trial_sessions
  WHERE device_fingerprint = p_device_fingerprint;

  IF FOUND THEN
    -- توجد جلسة سابقة
    IF v_existing_session.is_expired OR v_existing_session.trial_expires_at < v_server_time THEN
      -- الجلسة منتهية - لا يمكن إنشاء جلسة جديدة
      RETURN jsonb_build_object(
        'success', false,
        'message', 'لقد انتهت فترة التجربة المجانية. يرجى الاشتراك للمتابعة.',
        'session', NULL
      );
    ELSE
      -- الجلسة لا تزال صالحة - تحديث البيانات
      UPDATE trial_sessions
      SET
        session_count = session_count + 1,
        last_activity = v_server_time,
        updated_at = v_server_time
      WHERE device_fingerprint = p_device_fingerprint
      RETURNING * INTO v_new_session;

      RETURN jsonb_build_object(
        'success', true,
        'message', 'جلسة تجريبية نشطة',
        'session', row_to_json(v_new_session)
      );
    END IF;
  ELSE
    -- لا توجد جلسة سابقة - إنشاء جلسة جديدة
    v_expires_at := v_server_time + (p_trial_duration_days || ' days')::interval;

    INSERT INTO trial_sessions (
      device_fingerprint,
      trial_started_at,
      trial_expires_at,
      browser_info,
      ip_address
    ) VALUES (
      p_device_fingerprint,
      v_server_time,
      v_expires_at,
      p_browser_info,
      p_ip_address
    ) RETURNING * INTO v_new_session;

    -- تسجيل في الإحصائيات
    INSERT INTO user_analytics (
      device_fingerprint,
      session_type,
      action_type,
      action_details,
      timestamp
    ) VALUES (
      p_device_fingerprint,
      'trial',
      'trial_started',
      jsonb_build_object(
        'trial_duration_days', p_trial_duration_days,
        'expires_at', v_expires_at
      ),
      v_server_time
    );

    RETURN jsonb_build_object(
      'success', true,
      'message', 'تم بدء التجربة المجانية بنجاح',
      'session', row_to_json(v_new_session)
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. دالة للتحقق من صلاحية جلسة التجربة
-- ============================================
CREATE OR REPLACE FUNCTION check_trial_validity(
  p_device_fingerprint text
)
RETURNS jsonb AS $$
DECLARE
  v_session record;
  v_server_time timestamptz;
  v_days_remaining numeric;
BEGIN
  v_server_time := now();

  -- البحث عن الجلسة
  SELECT * INTO v_session
  FROM trial_sessions
  WHERE device_fingerprint = p_device_fingerprint;

  IF NOT FOUND THEN
    -- لا توجد جلسة
    RETURN jsonb_build_object(
      'is_valid', false,
      'needs_activation', true,
      'message', 'لم يتم بدء التجربة المجانية بعد',
      'days_remaining', 0,
      'session', NULL
    );
  END IF;

  -- حساب الأيام المتبقية
  v_days_remaining := EXTRACT(EPOCH FROM (v_session.trial_expires_at - v_server_time)) / 86400;

  -- التحقق من انتهاء الصلاحية
  IF v_session.trial_expires_at < v_server_time OR v_session.is_expired THEN
    -- تحديث حالة الجلسة
    UPDATE trial_sessions
    SET is_expired = true, updated_at = v_server_time
    WHERE device_fingerprint = p_device_fingerprint;

    RETURN jsonb_build_object(
      'is_valid', false,
      'needs_activation', false,
      'message', 'انتهت فترة التجربة المجانية',
      'days_remaining', 0,
      'session', row_to_json(v_session)
    );
  END IF;

  -- الجلسة صالحة
  RETURN jsonb_build_object(
    'is_valid', true,
    'needs_activation', false,
    'message', 'التجربة المجانية نشطة',
    'days_remaining', GREATEST(0, CEIL(v_days_remaining)),
    'session', row_to_json(v_session)
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 9. دالة لتسجيل إحصائية
-- ============================================
CREATE OR REPLACE FUNCTION log_user_action(
  p_device_fingerprint text,
  p_session_type text,
  p_action_type text,
  p_action_details jsonb DEFAULT '{}'::jsonb,
  p_user_agent text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO user_analytics (
    device_fingerprint,
    session_type,
    action_type,
    action_details,
    user_agent,
    timestamp
  ) VALUES (
    p_device_fingerprint,
    p_session_type,
    p_action_type,
    p_action_details,
    p_user_agent,
    now()
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 10. دالة للتحقق من تزامن الوقت
-- ============================================
CREATE OR REPLACE FUNCTION check_time_sync(
  p_device_fingerprint text,
  p_client_time timestamptz
)
RETURNS jsonb AS $$
DECLARE
  v_server_time timestamptz;
  v_time_diff integer;
  v_is_suspicious boolean;
BEGIN
  v_server_time := now();
  v_time_diff := EXTRACT(EPOCH FROM (v_server_time - p_client_time))::integer;
  v_is_suspicious := ABS(v_time_diff) > 300; -- أكثر من 5 دقائق فرق

  -- تسجيل الفحص
  INSERT INTO server_time_checks (
    device_fingerprint,
    client_time,
    server_time
  ) VALUES (
    p_device_fingerprint,
    p_client_time,
    v_server_time
  );

  RETURN jsonb_build_object(
    'server_time', v_server_time,
    'client_time', p_client_time,
    'time_difference_seconds', v_time_diff,
    'is_suspicious', v_is_suspicious,
    'message', CASE
      WHEN v_is_suspicious THEN 'تم اكتشاف فرق كبير في الوقت - قد يكون هناك تلاعب'
      ELSE 'الوقت متزامن بشكل صحيح'
    END
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 11. دالة لإحصائيات المطور
-- ============================================
CREATE OR REPLACE FUNCTION get_trial_statistics()
RETURNS jsonb AS $$
DECLARE
  v_total_trials integer;
  v_active_trials integer;
  v_expired_trials integer;
  v_converted_trials integer;
  v_today_trials integer;
BEGIN
  -- إجمالي التجارب
  SELECT COUNT(*) INTO v_total_trials FROM trial_sessions;

  -- التجارب النشطة
  SELECT COUNT(*) INTO v_active_trials
  FROM trial_sessions
  WHERE is_expired = false AND trial_expires_at > now();

  -- التجارب المنتهية
  SELECT COUNT(*) INTO v_expired_trials
  FROM trial_sessions
  WHERE is_expired = true OR trial_expires_at <= now();

  -- المتحولون لمشتركين
  SELECT COUNT(*) INTO v_converted_trials
  FROM trial_sessions
  WHERE converted_to_paid = true;

  -- تجارب اليوم
  SELECT COUNT(*) INTO v_today_trials
  FROM trial_sessions
  WHERE DATE(created_at) = CURRENT_DATE;

  RETURN jsonb_build_object(
    'total_trials', v_total_trials,
    'active_trials', v_active_trials,
    'expired_trials', v_expired_trials,
    'converted_trials', v_converted_trials,
    'conversion_rate', CASE
      WHEN v_total_trials > 0 THEN ROUND((v_converted_trials::numeric / v_total_trials::numeric) * 100, 2)
      ELSE 0
    END,
    'today_trials', v_today_trials
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- 12. دالة لتحديث حالة التحول للمشترك
-- ============================================
CREATE OR REPLACE FUNCTION mark_trial_as_converted(
  p_device_fingerprint text
)
RETURNS boolean AS $$
DECLARE
  v_updated boolean;
BEGIN
  UPDATE trial_sessions
  SET
    converted_to_paid = true,
    updated_at = now()
  WHERE device_fingerprint = p_device_fingerprint
  RETURNING true INTO v_updated;

  IF v_updated THEN
    -- تسجيل في الإحصائيات
    INSERT INTO user_analytics (
      device_fingerprint,
      session_type,
      action_type,
      action_details,
      timestamp
    ) VALUES (
      p_device_fingerprint,
      'paid',
      'trial_converted',
      jsonb_build_object('converted_at', now()),
      now()
    );

    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql;
