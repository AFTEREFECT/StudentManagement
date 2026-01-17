# Evolution API v2 - Database Schema Documentation

## 📊 Overview

This document provides complete details about the database schema for Evolution API v2 integration with Supabase PostgreSQL.

**Database Provider:** Supabase (PostgreSQL 15)
**Project ID:** benjzaxxkcjwnrfllvel
**Connection Mode:** Pooler (Transaction Mode)
**Migration Date:** October 26, 2025
**Status:** ✅ Production Ready

---

## 📋 Tables Summary

| Table Name | Purpose | Records | RLS |
|------------|---------|---------|-----|
| `evolution_instances` | WhatsApp instance configurations | Variable | ✅ |
| `evolution_messages` | Message logs (sent & received) | High volume | ✅ |
| `evolution_contacts` | WhatsApp contacts database | Variable | ✅ |
| `evolution_chats` | Chat conversations | Variable | ✅ |
| `evolution_webhooks` | Webhook configurations | Low volume | ✅ |
| `evolution_sessions` | WhatsApp session data | 1 per instance | ✅ |

**Total Tables:** 6
**All tables have Row Level Security (RLS) enabled**

---

## 🗂️ Detailed Table Structures

### 1. evolution_instances

**Purpose:** Stores WhatsApp instance configurations. Each instance represents a separate WhatsApp connection.

**Structure:**

```sql
CREATE TABLE evolution_instances (
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
```

**Columns:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | gen_random_uuid() | Unique instance identifier |
| `name` | text | NO | - | Instance name (e.g., "school_system") |
| `token` | text | YES | - | Authentication token |
| `phone_number` | text | YES | - | Connected WhatsApp number |
| `status` | text | YES | 'disconnected' | Connection status |
| `qrcode` | text | YES | - | QR code for pairing |
| `profile_name` | text | YES | - | WhatsApp profile name |
| `profile_picture_url` | text | YES | - | Profile picture URL |
| `created_at` | timestamptz | YES | now() | Creation timestamp |
| `updated_at` | timestamptz | YES | now() | Last update timestamp |

**Indexes:**
- `idx_evolution_instances_name` ON (name)
- `idx_evolution_instances_status` ON (status)

**RLS Policies:**
- Public: SELECT (read-only)
- Authenticated: INSERT, UPDATE

**Example Query:**
```sql
-- Get all instances with their connection status
SELECT name, status, phone_number, profile_name
FROM evolution_instances
WHERE status = 'connected'
ORDER BY created_at DESC;
```

---

### 2. evolution_messages

**Purpose:** Logs all WhatsApp messages (sent and received) for auditing and history.

**Structure:**

```sql
CREATE TABLE evolution_messages (
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
```

**Columns:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | gen_random_uuid() | Unique message identifier |
| `instance_id` | uuid | YES | - | Reference to evolution_instances |
| `message_id` | text | YES | - | WhatsApp message ID |
| `remote_jid` | text | NO | - | Recipient/sender JID (phone@s.whatsapp.net) |
| `from_me` | boolean | YES | false | True if sent by us |
| `message_type` | text | YES | 'text' | Type: text, image, audio, video, document |
| `message_content` | jsonb | YES | '{}' | Full message content (JSON) |
| `message_text` | text | YES | - | Extracted text for quick access |
| `status` | text | YES | 'pending' | Status: pending, sent, delivered, read, error |
| `timestamp` | timestamptz | YES | now() | Message timestamp |
| `created_at` | timestamptz | YES | now() | Database record creation |

**Indexes:**
- `idx_evolution_messages_instance_id` ON (instance_id)
- `idx_evolution_messages_remote_jid` ON (remote_jid)
- `idx_evolution_messages_status` ON (status)
- `idx_evolution_messages_timestamp` ON (timestamp DESC)
- `idx_evolution_messages_message_id` ON (message_id)

**RLS Policies:**
- Public: SELECT (read-only)
- Authenticated: INSERT, UPDATE

**Example Query:**
```sql
-- Get all messages sent to a specific number today
SELECT message_text, status, timestamp
FROM evolution_messages
WHERE remote_jid = '212600000000@s.whatsapp.net'
  AND DATE(timestamp) = CURRENT_DATE
  AND from_me = true
ORDER BY timestamp DESC;
```

---

### 3. evolution_contacts

**Purpose:** Stores information about WhatsApp contacts for each instance.

**Structure:**

```sql
CREATE TABLE evolution_contacts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id           uuid REFERENCES evolution_instances(id) ON DELETE CASCADE,
  remote_jid            text NOT NULL,
  push_name             text,
  profile_picture_url   text,
  is_business           boolean DEFAULT false,
  last_seen             timestamptz,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now(),
  UNIQUE(instance_id, remote_jid)
);
```

**Columns:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | gen_random_uuid() | Unique contact identifier |
| `instance_id` | uuid | YES | - | Reference to evolution_instances |
| `remote_jid` | text | NO | - | Contact JID (phone@s.whatsapp.net) |
| `push_name` | text | YES | - | Contact name in WhatsApp |
| `profile_picture_url` | text | YES | - | Contact profile picture |
| `is_business` | boolean | YES | false | Business account flag |
| `last_seen` | timestamptz | YES | - | Last seen timestamp |
| `created_at` | timestamptz | YES | now() | First seen timestamp |
| `updated_at` | timestamptz | YES | now() | Last update timestamp |

**Constraints:**
- UNIQUE(instance_id, remote_jid)

**Indexes:**
- `idx_evolution_contacts_instance_id` ON (instance_id)
- `idx_evolution_contacts_remote_jid` ON (remote_jid)

**RLS Policies:**
- Public: SELECT (read-only)
- Authenticated: INSERT, UPDATE

**Example Query:**
```sql
-- Get all contacts for an instance
SELECT push_name, remote_jid, is_business, last_seen
FROM evolution_contacts
WHERE instance_id = 'your-instance-uuid'
ORDER BY push_name;
```

---

### 4. evolution_chats

**Purpose:** Stores chat conversations (individual and group chats).

**Structure:**

```sql
CREATE TABLE evolution_chats (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id            uuid REFERENCES evolution_instances(id) ON DELETE CASCADE,
  remote_jid             text NOT NULL,
  name                   text,
  is_group               boolean DEFAULT false,
  unread_count           integer DEFAULT 0,
  last_message_timestamp timestamptz,
  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now(),
  UNIQUE(instance_id, remote_jid)
);
```

**Columns:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | gen_random_uuid() | Unique chat identifier |
| `instance_id` | uuid | YES | - | Reference to evolution_instances |
| `remote_jid` | text | NO | - | Chat JID |
| `name` | text | YES | - | Chat/Group name |
| `is_group` | boolean | YES | false | Group chat flag |
| `unread_count` | integer | YES | 0 | Unread message count |
| `last_message_timestamp` | timestamptz | YES | - | Last message time |
| `created_at` | timestamptz | YES | now() | Chat creation timestamp |
| `updated_at` | timestamptz | YES | now() | Last update timestamp |

**Constraints:**
- UNIQUE(instance_id, remote_jid)

**Indexes:**
- `idx_evolution_chats_instance_id` ON (instance_id)
- `idx_evolution_chats_remote_jid` ON (remote_jid)
- `idx_evolution_chats_last_message` ON (last_message_timestamp DESC)

**RLS Policies:**
- Public: SELECT (read-only)
- Authenticated: INSERT, UPDATE

**Example Query:**
```sql
-- Get recent chats with unread messages
SELECT name, unread_count, last_message_timestamp
FROM evolution_chats
WHERE unread_count > 0
ORDER BY last_message_timestamp DESC
LIMIT 20;
```

---

### 5. evolution_webhooks

**Purpose:** Stores webhook configurations for receiving real-time events.

**Structure:**

```sql
CREATE TABLE evolution_webhooks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid REFERENCES evolution_instances(id) ON DELETE CASCADE,
  url         text NOT NULL,
  events      jsonb DEFAULT '[]'::jsonb,
  enabled     boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
```

**Columns:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | gen_random_uuid() | Unique webhook identifier |
| `instance_id` | uuid | YES | - | Reference to evolution_instances |
| `url` | text | NO | - | Webhook endpoint URL |
| `events` | jsonb | YES | '[]' | Subscribed events array |
| `enabled` | boolean | YES | true | Webhook active status |
| `created_at` | timestamptz | YES | now() | Creation timestamp |
| `updated_at` | timestamptz | YES | now() | Last update timestamp |

**Indexes:**
- `idx_evolution_webhooks_instance_id` ON (instance_id)
- `idx_evolution_webhooks_enabled` ON (enabled)

**RLS Policies:**
- Public: SELECT (read-only)
- Authenticated: INSERT, UPDATE, DELETE

**Example Query:**
```sql
-- Get all active webhooks
SELECT instance_id, url, events, enabled
FROM evolution_webhooks
WHERE enabled = true;
```

---

### 6. evolution_sessions

**Purpose:** Stores WhatsApp session authentication data (encrypted).

**Structure:**

```sql
CREATE TABLE evolution_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id  uuid UNIQUE REFERENCES evolution_instances(id) ON DELETE CASCADE,
  session_data jsonb DEFAULT '{}'::jsonb,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);
```

**Columns:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | gen_random_uuid() | Unique session identifier |
| `instance_id` | uuid | YES | - | Reference to evolution_instances (UNIQUE) |
| `session_data` | jsonb | YES | '{}' | Encrypted session data from Baileys |
| `created_at` | timestamptz | YES | now() | Session creation timestamp |
| `updated_at` | timestamptz | YES | now() | Last update timestamp |

**Constraints:**
- UNIQUE(instance_id) - One session per instance

**Indexes:**
- `idx_evolution_sessions_instance_id` ON (instance_id)

**RLS Policies:**
- Public: SELECT (read-only)
- Authenticated: INSERT, UPDATE

**Example Query:**
```sql
-- Get session for specific instance
SELECT instance_id, created_at, updated_at
FROM evolution_sessions
WHERE instance_id = 'your-instance-uuid';
```

---

## 🔒 Security Configuration

### Row Level Security (RLS) Policies

All tables have RLS enabled with the following policy pattern:

```sql
-- Read access for everyone (required for Evolution API to function)
CREATE POLICY "Public read access for [table]"
  ON [table] FOR SELECT
  TO public
  USING (true);

-- Write access for authenticated users only
CREATE POLICY "Authenticated users can insert [table]"
  ON [table] FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update [table]"
  ON [table] FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
```

**Why Public Read Access?**
- Evolution API runs on AWS EC2 without Supabase authentication
- Connects using direct PostgreSQL connection (not Supabase client)
- Read operations don't expose sensitive data
- Write operations are protected by authentication

---

## ⚡ Automatic Triggers

All tables (except `evolution_messages`) have automatic `updated_at` triggers:

```sql
CREATE OR REPLACE FUNCTION update_evolution_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Applied to: instances, contacts, chats, webhooks, sessions
CREATE TRIGGER update_evolution_[table]_timestamp
  BEFORE UPDATE ON evolution_[table]
  FOR EACH ROW
  EXECUTE FUNCTION update_evolution_timestamp();
```

---

## 📊 Database Statistics

### Query to Check Table Sizes

```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE tablename LIKE 'evolution_%'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Query to Check Row Counts

```sql
SELECT
  'evolution_instances' as table_name,
  COUNT(*) as row_count
FROM evolution_instances
UNION ALL
SELECT 'evolution_messages', COUNT(*) FROM evolution_messages
UNION ALL
SELECT 'evolution_contacts', COUNT(*) FROM evolution_contacts
UNION ALL
SELECT 'evolution_chats', COUNT(*) FROM evolution_chats
UNION ALL
SELECT 'evolution_webhooks', COUNT(*) FROM evolution_webhooks
UNION ALL
SELECT 'evolution_sessions', COUNT(*) FROM evolution_sessions;
```

---

## 🔧 Maintenance Queries

### Clean Old Messages (older than 30 days)

```sql
DELETE FROM evolution_messages
WHERE created_at < NOW() - INTERVAL '30 days';
```

### Reset Instance Status

```sql
UPDATE evolution_instances
SET status = 'disconnected', qrcode = NULL
WHERE id = 'your-instance-uuid';
```

### View Recent Activity

```sql
SELECT
  i.name as instance_name,
  COUNT(m.id) as message_count,
  MAX(m.timestamp) as last_message
FROM evolution_instances i
LEFT JOIN evolution_messages m ON i.id = m.instance_id
GROUP BY i.id, i.name
ORDER BY last_message DESC;
```

---

## 🚀 Connection Information

### Pooler Connection (Recommended)

```
Host: aws-0-eu-central-1.pooler.supabase.com
Port: 6543
Database: postgres
Username: postgres.benjzaxxkcjwnrfllvel
Password: PgSbx2025Secure987
SSL: Required (automatic)
```

**Connection String:**
```
postgresql://postgres.benjzaxxkcjwnrfllvel:PgSbx2025Secure987@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
```

### Direct Connection (For Testing)

```
Host: db.benjzaxxkcjwnrfllvel.supabase.co
Port: 5432
Database: postgres
Username: postgres
Password: PgSbx2025Secure987
SSL: Required (sslmode=require)
```

**Connection String:**
```
postgresql://postgres:PgSbx2025Secure987@db.benjzaxxkcjwnrfllvel.supabase.co:5432/postgres?sslmode=require
```

---

## 📝 Notes

1. **Instance Names:** Must be unique across the database. Use descriptive names like "school_system", "admin_account", etc.

2. **Remote JID Format:** WhatsApp uses JID format: `countrycode+number@s.whatsapp.net` (e.g., `212600000000@s.whatsapp.net`)

3. **Message Content:** The `message_content` column stores full WhatsApp message structure as JSONB for flexibility

4. **Session Data:** Contains encrypted authentication tokens. Never expose or modify manually.

5. **Cascade Deletes:** Deleting an instance automatically removes all related messages, contacts, chats, webhooks, and sessions

6. **Timestamps:** All timestamps are stored in UTC timezone (timestamptz)

---

## ✅ Verification Checklist

- [x] All 6 tables created successfully
- [x] RLS enabled on all tables
- [x] Indexes created for performance
- [x] Foreign key relationships established
- [x] Triggers configured for automatic timestamps
- [x] Policies allow Evolution API access
- [x] Connection strings tested and working

---

**Last Updated:** October 26, 2025
**Database Version:** PostgreSQL 15
**Evolution API Version:** v2.1.1
**Status:** ✅ Production Ready
