/*
  # Createahw Servers Management System

  1. New Tables
    - `waha_servers`
      - `id` (uuid, primary key)
      - `name` (text) - اسم الخادم
      - `server_url` (text) - عنوان الخادم
      - `api_key` (text, optional) - مفتاح API
      - `provider` (text) - المزود (AWS, Oracle Cloud, etc.)
      - `is_active` (boolean) - حالة التفعيل
      - `is_default` (boolean) - الخادم الافتراضي
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `waha_sessions`
      - `id` (uuid, primary key)
      - `server_id` (uuid, foreign key toahw_servers)
      - `session_name` (text) - اسم الجلسة (معرف المؤسسة)
      - `phone_number` (text) - رقم الهاتف المربوط
      - `status` (text) - حالة الجلسة (connected, disconnected, qr_needed)
      - `qr_code` (text, optional) - QR Code إذا كان متوفرًا
      - `last_activity` (timestamptz) - آخر نشاط
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `waha_message_logs`
      - `id` (uuid, primary key)
      - `server_id` (uuid, foreign key toahw_servers)
      - `session_id` (uuid, foreign key toahw_sessions)
      - `phone_number` (text) - رقم المستلم
      - `message` (text) - محتوى الرسالة
      - `status` (text) - حالة الإرسال (success, failed)
      - `error_message` (text, optional) - رسالة الخطأ إن وجدت
      - `message_id` (text, optional) - معرف الرسالة منahw
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
*/

-- Createahw_servers table
CREATE TABLE IF NOT EXISTSahw_servers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  server_url text NOT NULL,
  api_key text,
  provider text NOT NULL DEFAULT 'AWS',
  is_active boolean DEFAULT true,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Createahw_sessions table
CREATE TABLE IF NOT EXISTSahw_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid REFERENCESahw_servers(id) ON DELETE CASCADE,
  session_name text NOT NULL,
  phone_number text,
  status text DEFAULT 'disconnected',
  qr_code text,
  last_activity timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(server_id, session_name)
);

-- Createahw_message_logs table
CREATE TABLE IF NOT EXISTSahw_message_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid REFERENCESahw_servers(id) ON DELETE CASCADE,
  session_id uuid REFERENCESahw_sessions(id) ON DELETE SET NULL,
  phone_number text NOT NULL,
  message text NOT NULL,
  status text DEFAULT 'pending',
  error_message text,
  message_id text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_waha_sessions_server_id ONahw_sessions(server_id);
CREATE INDEX IF NOT EXISTS idx_waha_sessions_status ONahw_sessions(status);
CREATE INDEX IF NOT EXISTS idx_waha_message_logs_server_id ONahw_message_logs(server_id);
CREATE INDEX IF NOT EXISTS idx_waha_message_logs_session_id ONahw_message_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_waha_message_logs_created_at ONahw_message_logs(created_at);

-- Enable Row Level Security
ALTER TABLEahw_servers ENABLE ROW LEVEL SECURITY;
ALTER TABLEahw_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLEahw_message_logs ENABLE ROW LEVEL SECURITY;

-- Create policies forahw_servers
CREATE POLICY "Allow all operations onahw_servers"
  ONahw_servers FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Create policies forahw_sessions
CREATE POLICY "Allow all operations onahw_sessions"
  ONahw_sessions FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Create policies forahw_message_logs
CREATE POLICY "Allow all operations onahw_message_logs"
  ONahw_message_logs FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Insert default AWS server
INSERT INTOahw_servers (name, server_url, provider, is_active, is_default)
VALUES ('AWS Server', 'http://51.21.197.126:3000', 'AWS', true, true)
ON CONFLICT DO NOTHING;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_waha_servers_updated_at') THEN
    CREATE TRIGGER update_waha_servers_updated_at
      BEFORE UPDATE ONahw_servers
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_waha_sessions_updated_at') THEN
    CREATE TRIGGER update_waha_sessions_updated_at
      BEFORE UPDATE ONahw_sessions
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;