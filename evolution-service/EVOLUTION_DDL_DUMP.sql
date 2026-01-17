-- ================================================================
-- Evolution API v2 - Complete DDL Dump
-- ================================================================
-- Generated: October 26, 2025
-- Database: Supabase PostgreSQL 15
-- Project: benjzaxxkcjwnrfllvel
-- Purpose: WhatsApp Integration via Evolution API v2.1.1
-- ================================================================

-- ================================================================
-- TABLE: evolution_instances
-- Purpose: WhatsApp instance configurations
-- ================================================================
CREATE TABLE IF NOT EXISTS evolution_instances (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text UNIQUE NOT NULL,
  token                 text,
  phone_number          text,
  status                text DEFAULT 'disconnected',
  qrcode                text,
  profile_name          text,
  profile_picture_url   text,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

COMMENT ON TABLE evolution_instances IS 'WhatsApp instance configurations. Each instance represents a separate WhatsApp connection.';
COMMENT ON COLUMN evolution_instances.id IS 'Unique instance identifier';
COMMENT ON COLUMN evolution_instances.name IS 'Instance name (must be unique, e.g., school_system)';
COMMENT ON COLUMN evolution_instances.token IS 'Authentication token for this instance';
COMMENT ON COLUMN evolution_instances.phone_number IS 'Connected WhatsApp phone number';
COMMENT ON COLUMN evolution_instances.status IS 'Connection status: connected, disconnected, connecting, etc.';
COMMENT ON COLUMN evolution_instances.qrcode IS 'QR code data for pairing (if not connected)';
COMMENT ON COLUMN evolution_instances.profile_name IS 'WhatsApp profile display name';
COMMENT ON COLUMN evolution_instances.profile_picture_url IS 'WhatsApp profile picture URL';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_evolution_instances_name ON evolution_instances(name);
CREATE INDEX IF NOT EXISTS idx_evolution_instances_status ON evolution_instances(status);

-- ================================================================
-- TABLE: evolution_messages
-- Purpose: Message logs (sent and received)
-- ================================================================
CREATE TABLE IF NOT EXISTS evolution_messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id      uuid REFERENCES evolution_instances(id) ON DELETE CASCADE,
  message_id       text,
  remote_jid       text NOT NULL,
  from_me          boolean DEFAULT false,
  message_type     text DEFAULT 'text',
  message_content  jsonb DEFAULT '{}'::jsonb,
  message_text     text,
  status           text DEFAULT 'pending',
  timestamp        timestamptz DEFAULT now(),
  created_at       timestamptz DEFAULT now()
);

COMMENT ON TABLE evolution_messages IS 'Logs of all WhatsApp messages (sent and received)';
COMMENT ON COLUMN evolution_messages.instance_id IS 'Reference to evolution_instances';
COMMENT ON COLUMN evolution_messages.message_id IS 'WhatsApp message ID';
COMMENT ON COLUMN evolution_messages.remote_jid IS 'Recipient/sender JID (e.g., 212600000000@s.whatsapp.net)';
COMMENT ON COLUMN evolution_messages.from_me IS 'True if message was sent by us, false if received';
COMMENT ON COLUMN evolution_messages.message_type IS 'Type: text, image, audio, video, document, etc.';
COMMENT ON COLUMN evolution_messages.message_content IS 'Full message content as JSONB';
COMMENT ON COLUMN evolution_messages.message_text IS 'Extracted text content for quick queries';
COMMENT ON COLUMN evolution_messages.status IS 'Message status: pending, sent, delivered, read, error';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_evolution_messages_instance_id ON evolution_messages(instance_id);
CREATE INDEX IF NOT EXISTS idx_evolution_messages_remote_jid ON evolution_messages(remote_jid);
CREATE INDEX IF NOT EXISTS idx_evolution_messages_status ON evolution_messages(status);
CREATE INDEX IF NOT EXISTS idx_evolution_messages_timestamp ON evolution_messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_evolution_messages_message_id ON evolution_messages(message_id);

-- ================================================================
-- TABLE: evolution_contacts
-- Purpose: WhatsApp contacts information
-- ================================================================
CREATE TABLE IF NOT EXISTS evolution_contacts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id           uuid REFERENCES evolution_instances(id) ON DELETE CASCADE,
  remote_jid            text NOT NULL,
  push_name             text,
  profile_picture_url   text,
  is_business           boolean DEFAULT false,
  last_seen             timestamptz,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now(),
  CONSTRAINT evolution_contacts_instance_id_remote_jid_key UNIQUE(instance_id, remote_jid)
);

COMMENT ON TABLE evolution_contacts IS 'WhatsApp contacts database for each instance';
COMMENT ON COLUMN evolution_contacts.remote_jid IS 'Contact JID (e.g., 212600000000@s.whatsapp.net)';
COMMENT ON COLUMN evolution_contacts.push_name IS 'Contact name as shown in WhatsApp';
COMMENT ON COLUMN evolution_contacts.is_business IS 'Whether contact is a business account';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_evolution_contacts_instance_id ON evolution_contacts(instance_id);
CREATE INDEX IF NOT EXISTS idx_evolution_contacts_remote_jid ON evolution_contacts(remote_jid);

-- ================================================================
-- TABLE: evolution_chats
-- Purpose: Chat conversations (individual and group)
-- ================================================================
CREATE TABLE IF NOT EXISTS evolution_chats (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id            uuid REFERENCES evolution_instances(id) ON DELETE CASCADE,
  remote_jid             text NOT NULL,
  name                   text,
  is_group               boolean DEFAULT false,
  unread_count           integer DEFAULT 0,
  last_message_timestamp timestamptz,
  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now(),
  CONSTRAINT evolution_chats_instance_id_remote_jid_key UNIQUE(instance_id, remote_jid)
);

COMMENT ON TABLE evolution_chats IS 'WhatsApp chat conversations (DMs and groups)';
COMMENT ON COLUMN evolution_chats.remote_jid IS 'Chat JID (phone number for DMs, group ID for groups)';
COMMENT ON COLUMN evolution_chats.is_group IS 'True if this is a group chat';
COMMENT ON COLUMN evolution_chats.unread_count IS 'Number of unread messages in this chat';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_evolution_chats_instance_id ON evolution_chats(instance_id);
CREATE INDEX IF NOT EXISTS idx_evolution_chats_remote_jid ON evolution_chats(remote_jid);
CREATE INDEX IF NOT EXISTS idx_evolution_chats_last_message ON evolution_chats(last_message_timestamp DESC);

-- ================================================================
-- TABLE: evolution_webhooks
-- Purpose: Webhook configurations for real-time events
-- ================================================================
CREATE TABLE IF NOT EXISTS evolution_webhooks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid REFERENCES evolution_instances(id) ON DELETE CASCADE,
  url         text NOT NULL,
  events      jsonb DEFAULT '[]'::jsonb,
  enabled     boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

COMMENT ON TABLE evolution_webhooks IS 'Webhook configurations for receiving real-time events';
COMMENT ON COLUMN evolution_webhooks.url IS 'Webhook endpoint URL to receive events';
COMMENT ON COLUMN evolution_webhooks.events IS 'Array of subscribed event types (as JSONB)';
COMMENT ON COLUMN evolution_webhooks.enabled IS 'Whether this webhook is active';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_evolution_webhooks_instance_id ON evolution_webhooks(instance_id);
CREATE INDEX IF NOT EXISTS idx_evolution_webhooks_enabled ON evolution_webhooks(enabled);

-- ================================================================
-- TABLE: evolution_sessions
-- Purpose: WhatsApp session authentication data
-- ================================================================
CREATE TABLE IF NOT EXISTS evolution_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id  uuid UNIQUE REFERENCES evolution_instances(id) ON DELETE CASCADE,
  session_data jsonb DEFAULT '{}'::jsonb,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

COMMENT ON TABLE evolution_sessions IS 'WhatsApp session authentication data (encrypted)';
COMMENT ON COLUMN evolution_sessions.instance_id IS 'Reference to evolution_instances (one session per instance)';
COMMENT ON COLUMN evolution_sessions.session_data IS 'Encrypted session data from Baileys library';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_evolution_sessions_instance_id ON evolution_sessions(instance_id);

-- ================================================================
-- TRIGGERS: Automatic timestamp updates
-- ================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_evolution_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to tables
DROP TRIGGER IF EXISTS update_evolution_instances_timestamp ON evolution_instances;
CREATE TRIGGER update_evolution_instances_timestamp
  BEFORE UPDATE ON evolution_instances
  FOR EACH ROW
  EXECUTE FUNCTION update_evolution_timestamp();

DROP TRIGGER IF EXISTS update_evolution_contacts_timestamp ON evolution_contacts;
CREATE TRIGGER update_evolution_contacts_timestamp
  BEFORE UPDATE ON evolution_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_evolution_timestamp();

DROP TRIGGER IF EXISTS update_evolution_chats_timestamp ON evolution_chats;
CREATE TRIGGER update_evolution_chats_timestamp
  BEFORE UPDATE ON evolution_chats
  FOR EACH ROW
  EXECUTE FUNCTION update_evolution_timestamp();

DROP TRIGGER IF EXISTS update_evolution_webhooks_timestamp ON evolution_webhooks;
CREATE TRIGGER update_evolution_webhooks_timestamp
  BEFORE UPDATE ON evolution_webhooks
  FOR EACH ROW
  EXECUTE FUNCTION update_evolution_timestamp();

DROP TRIGGER IF EXISTS update_evolution_sessions_timestamp ON evolution_sessions;
CREATE TRIGGER update_evolution_sessions_timestamp
  BEFORE UPDATE ON evolution_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_evolution_timestamp();

-- ================================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================================

-- Enable RLS on all tables
ALTER TABLE evolution_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE evolution_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE evolution_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE evolution_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE evolution_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE evolution_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS "Public read access for evolution_instances" ON evolution_instances;
DROP POLICY IF EXISTS "Authenticated users can insert evolution_instances" ON evolution_instances;
DROP POLICY IF EXISTS "Authenticated users can update evolution_instances" ON evolution_instances;

DROP POLICY IF EXISTS "Public read access for evolution_messages" ON evolution_messages;
DROP POLICY IF EXISTS "Authenticated users can insert evolution_messages" ON evolution_messages;
DROP POLICY IF EXISTS "Authenticated users can update evolution_messages" ON evolution_messages;

DROP POLICY IF EXISTS "Public read access for evolution_contacts" ON evolution_contacts;
DROP POLICY IF EXISTS "Authenticated users can insert evolution_contacts" ON evolution_contacts;
DROP POLICY IF EXISTS "Authenticated users can update evolution_contacts" ON evolution_contacts;

DROP POLICY IF EXISTS "Public read access for evolution_chats" ON evolution_chats;
DROP POLICY IF EXISTS "Authenticated users can insert evolution_chats" ON evolution_chats;
DROP POLICY IF EXISTS "Authenticated users can update evolution_chats" ON evolution_chats;

DROP POLICY IF EXISTS "Public read access for evolution_webhooks" ON evolution_webhooks;
DROP POLICY IF EXISTS "Authenticated users can insert evolution_webhooks" ON evolution_webhooks;
DROP POLICY IF EXISTS "Authenticated users can update evolution_webhooks" ON evolution_webhooks;
DROP POLICY IF EXISTS "Authenticated users can delete evolution_webhooks" ON evolution_webhooks;

DROP POLICY IF EXISTS "Public read access for evolution_sessions" ON evolution_sessions;
DROP POLICY IF EXISTS "Authenticated users can insert evolution_sessions" ON evolution_sessions;
DROP POLICY IF EXISTS "Authenticated users can update evolution_sessions" ON evolution_sessions;

-- Create RLS policies for evolution_instances
CREATE POLICY "Public read access for evolution_instances"
  ON evolution_instances FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can insert evolution_instances"
  ON evolution_instances FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update evolution_instances"
  ON evolution_instances FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create RLS policies for evolution_messages
CREATE POLICY "Public read access for evolution_messages"
  ON evolution_messages FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can insert evolution_messages"
  ON evolution_messages FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update evolution_messages"
  ON evolution_messages FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create RLS policies for evolution_contacts
CREATE POLICY "Public read access for evolution_contacts"
  ON evolution_contacts FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can insert evolution_contacts"
  ON evolution_contacts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update evolution_contacts"
  ON evolution_contacts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create RLS policies for evolution_chats
CREATE POLICY "Public read access for evolution_chats"
  ON evolution_chats FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can insert evolution_chats"
  ON evolution_chats FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update evolution_chats"
  ON evolution_chats FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create RLS policies for evolution_webhooks
CREATE POLICY "Public read access for evolution_webhooks"
  ON evolution_webhooks FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can insert evolution_webhooks"
  ON evolution_webhooks FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update evolution_webhooks"
  ON evolution_webhooks FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete evolution_webhooks"
  ON evolution_webhooks FOR DELETE
  TO authenticated
  USING (true);

-- Create RLS policies for evolution_sessions
CREATE POLICY "Public read access for evolution_sessions"
  ON evolution_sessions FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can insert evolution_sessions"
  ON evolution_sessions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update evolution_sessions"
  ON evolution_sessions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ================================================================
-- END OF DDL DUMP
-- ================================================================
-- All tables, indexes, triggers, and RLS policies have been created
-- Database is ready for Evolution API v2 integration
-- ================================================================
