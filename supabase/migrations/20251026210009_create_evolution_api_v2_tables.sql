/*
  # Evolution API v2 - Database Schema for WhatsApp Integration
  
  ## Overview
  This migration creates the essential database tables required by Evolution API v2
  to manage WhatsApp instances, messages, sessions, and related data in Supabase PostgreSQL.
  
  ## New Tables Created
  
  ### 1. `evolution_instances`
  Stores WhatsApp instance configurations
  - `id` (uuid, primary key) - Unique instance identifier
  - `name` (text, unique) - Instance name (e.g., "school_system")
  - `token` (text) - Authentication token for the instance
  - `phone_number` (text) - Connected WhatsApp phone number
  - `status` (text) - Connection status (connected, disconnected, etc.)
  - `qrcode` (text) - QR code data for authentication
  - `profile_name` (text) - WhatsApp profile display name
  - `profile_picture_url` (text) - WhatsApp profile picture URL
  - `created_at` (timestamptz) - Instance creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  
  ### 2. `evolution_messages`
  Logs all sent and received WhatsApp messages
  
  ### 3. `evolution_contacts`
  Stores WhatsApp contacts information
  
  ### 4. `evolution_chats`
  Stores WhatsApp chat conversations
  
  ### 5. `evolution_webhooks`
  Stores webhook configurations for real-time events
  
  ### 6. `evolution_sessions`
  Stores WhatsApp session data (authentication state)
  
  ## Security
  - All tables have Row Level Security (RLS) enabled
  - Public read access (for Evolution API to function)
  - Authenticated write access required for modifications
  
  ## Important Notes
  1. **No Transaction Control**: This migration does NOT use BEGIN/COMMIT/ROLLBACK
  2. **Idempotent**: Uses IF NOT EXISTS to prevent errors on re-run
  3. **Data Safety**: No DROP operations - preserves existing data
  4. **Evolution API Compatibility**: Schema matches Evolution API v2.1.1 requirements
*/

-- =====================================================
-- 1. Create evolution_instances table
-- =====================================================
CREATE TABLE IF NOT EXISTS evolution_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  token text,
  phone_number text,
  status text DEFAULT 'disconnected',
  qrcode text,
  profile_name text,
  profile_picture_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE evolution_instances ENABLE ROW LEVEL SECURITY;

-- RLS Policies for evolution_instances (drop first to avoid conflicts)
DROP POLICY IF EXISTS "Public read access for evolution_instances" ON evolution_instances;
CREATE POLICY "Public read access for evolution_instances"
  ON evolution_instances FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert evolution_instances" ON evolution_instances;
CREATE POLICY "Authenticated users can insert evolution_instances"
  ON evolution_instances FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update evolution_instances" ON evolution_instances;
CREATE POLICY "Authenticated users can update evolution_instances"
  ON evolution_instances FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Indexes for evolution_instances
CREATE INDEX IF NOT EXISTS idx_evolution_instances_name ON evolution_instances(name);
CREATE INDEX IF NOT EXISTS idx_evolution_instances_status ON evolution_instances(status);

-- =====================================================
-- 2. Create evolution_messages table
-- =====================================================
CREATE TABLE IF NOT EXISTS evolution_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid REFERENCES evolution_instances(id) ON DELETE CASCADE,
  message_id text,
  remote_jid text NOT NULL,
  from_me boolean DEFAULT false,
  message_type text DEFAULT 'text',
  message_content jsonb DEFAULT '{}'::jsonb,
  message_text text,
  status text DEFAULT 'pending',
  timestamp timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE evolution_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for evolution_messages
DROP POLICY IF EXISTS "Public read access for evolution_messages" ON evolution_messages;
CREATE POLICY "Public read access for evolution_messages"
  ON evolution_messages FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert evolution_messages" ON evolution_messages;
CREATE POLICY "Authenticated users can insert evolution_messages"
  ON evolution_messages FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update evolution_messages" ON evolution_messages;
CREATE POLICY "Authenticated users can update evolution_messages"
  ON evolution_messages FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Indexes for evolution_messages
CREATE INDEX IF NOT EXISTS idx_evolution_messages_instance_id ON evolution_messages(instance_id);
CREATE INDEX IF NOT EXISTS idx_evolution_messages_remote_jid ON evolution_messages(remote_jid);
CREATE INDEX IF NOT EXISTS idx_evolution_messages_status ON evolution_messages(status);
CREATE INDEX IF NOT EXISTS idx_evolution_messages_timestamp ON evolution_messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_evolution_messages_message_id ON evolution_messages(message_id);

-- =====================================================
-- 3. Create evolution_contacts table
-- =====================================================
CREATE TABLE IF NOT EXISTS evolution_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid REFERENCES evolution_instances(id) ON DELETE CASCADE,
  remote_jid text NOT NULL,
  push_name text,
  profile_picture_url text,
  is_business boolean DEFAULT false,
  last_seen timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add unique constraint if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'evolution_contacts_instance_id_remote_jid_key'
  ) THEN
    ALTER TABLE evolution_contacts ADD CONSTRAINT evolution_contacts_instance_id_remote_jid_key UNIQUE(instance_id, remote_jid);
  END IF;
END $$;

-- Enable RLS
ALTER TABLE evolution_contacts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for evolution_contacts
DROP POLICY IF EXISTS "Public read access for evolution_contacts" ON evolution_contacts;
CREATE POLICY "Public read access for evolution_contacts"
  ON evolution_contacts FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert evolution_contacts" ON evolution_contacts;
CREATE POLICY "Authenticated users can insert evolution_contacts"
  ON evolution_contacts FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update evolution_contacts" ON evolution_contacts;
CREATE POLICY "Authenticated users can update evolution_contacts"
  ON evolution_contacts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Indexes for evolution_contacts
CREATE INDEX IF NOT EXISTS idx_evolution_contacts_instance_id ON evolution_contacts(instance_id);
CREATE INDEX IF NOT EXISTS idx_evolution_contacts_remote_jid ON evolution_contacts(remote_jid);

-- =====================================================
-- 4. Create evolution_chats table
-- =====================================================
CREATE TABLE IF NOT EXISTS evolution_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid REFERENCES evolution_instances(id) ON DELETE CASCADE,
  remote_jid text NOT NULL,
  name text,
  is_group boolean DEFAULT false,
  unread_count integer DEFAULT 0,
  last_message_timestamp timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add unique constraint if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'evolution_chats_instance_id_remote_jid_key'
  ) THEN
    ALTER TABLE evolution_chats ADD CONSTRAINT evolution_chats_instance_id_remote_jid_key UNIQUE(instance_id, remote_jid);
  END IF;
END $$;

-- Enable RLS
ALTER TABLE evolution_chats ENABLE ROW LEVEL SECURITY;

-- RLS Policies for evolution_chats
DROP POLICY IF EXISTS "Public read access for evolution_chats" ON evolution_chats;
CREATE POLICY "Public read access for evolution_chats"
  ON evolution_chats FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert evolution_chats" ON evolution_chats;
CREATE POLICY "Authenticated users can insert evolution_chats"
  ON evolution_chats FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update evolution_chats" ON evolution_chats;
CREATE POLICY "Authenticated users can update evolution_chats"
  ON evolution_chats FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Indexes for evolution_chats
CREATE INDEX IF NOT EXISTS idx_evolution_chats_instance_id ON evolution_chats(instance_id);
CREATE INDEX IF NOT EXISTS idx_evolution_chats_remote_jid ON evolution_chats(remote_jid);
CREATE INDEX IF NOT EXISTS idx_evolution_chats_last_message ON evolution_chats(last_message_timestamp DESC);

-- =====================================================
-- 5. Create evolution_webhooks table
-- =====================================================
CREATE TABLE IF NOT EXISTS evolution_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid REFERENCES evolution_instances(id) ON DELETE CASCADE,
  url text NOT NULL,
  events jsonb DEFAULT '[]'::jsonb,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE evolution_webhooks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for evolution_webhooks
DROP POLICY IF EXISTS "Public read access for evolution_webhooks" ON evolution_webhooks;
CREATE POLICY "Public read access for evolution_webhooks"
  ON evolution_webhooks FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert evolution_webhooks" ON evolution_webhooks;
CREATE POLICY "Authenticated users can insert evolution_webhooks"
  ON evolution_webhooks FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update evolution_webhooks" ON evolution_webhooks;
CREATE POLICY "Authenticated users can update evolution_webhooks"
  ON evolution_webhooks FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete evolution_webhooks" ON evolution_webhooks;
CREATE POLICY "Authenticated users can delete evolution_webhooks"
  ON evolution_webhooks FOR DELETE
  TO authenticated
  USING (true);

-- Indexes for evolution_webhooks
CREATE INDEX IF NOT EXISTS idx_evolution_webhooks_instance_id ON evolution_webhooks(instance_id);
CREATE INDEX IF NOT EXISTS idx_evolution_webhooks_enabled ON evolution_webhooks(enabled);

-- =====================================================
-- 6. Create evolution_sessions table
-- =====================================================
CREATE TABLE IF NOT EXISTS evolution_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid UNIQUE REFERENCES evolution_instances(id) ON DELETE CASCADE,
  session_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE evolution_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for evolution_sessions
DROP POLICY IF EXISTS "Public read access for evolution_sessions" ON evolution_sessions;
CREATE POLICY "Public read access for evolution_sessions"
  ON evolution_sessions FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert evolution_sessions" ON evolution_sessions;
CREATE POLICY "Authenticated users can insert evolution_sessions"
  ON evolution_sessions FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update evolution_sessions" ON evolution_sessions;
CREATE POLICY "Authenticated users can update evolution_sessions"
  ON evolution_sessions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Indexes for evolution_sessions
CREATE INDEX IF NOT EXISTS idx_evolution_sessions_instance_id ON evolution_sessions(instance_id);

-- =====================================================
-- 7. Create helper functions and triggers
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_evolution_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for automatic timestamp updates
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_evolution_instances_timestamp') THEN
    CREATE TRIGGER update_evolution_instances_timestamp
      BEFORE UPDATE ON evolution_instances
      FOR EACH ROW
      EXECUTE FUNCTION update_evolution_timestamp();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_evolution_contacts_timestamp') THEN
    CREATE TRIGGER update_evolution_contacts_timestamp
      BEFORE UPDATE ON evolution_contacts
      FOR EACH ROW
      EXECUTE FUNCTION update_evolution_timestamp();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_evolution_chats_timestamp') THEN
    CREATE TRIGGER update_evolution_chats_timestamp
      BEFORE UPDATE ON evolution_chats
      FOR EACH ROW
      EXECUTE FUNCTION update_evolution_timestamp();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_evolution_webhooks_timestamp') THEN
    CREATE TRIGGER update_evolution_webhooks_timestamp
      BEFORE UPDATE ON evolution_webhooks
      FOR EACH ROW
      EXECUTE FUNCTION update_evolution_timestamp();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_evolution_sessions_timestamp') THEN
    CREATE TRIGGER update_evolution_sessions_timestamp
      BEFORE UPDATE ON evolution_sessions
      FOR EACH ROW
      EXECUTE FUNCTION update_evolution_timestamp();
  END IF;
END $$;