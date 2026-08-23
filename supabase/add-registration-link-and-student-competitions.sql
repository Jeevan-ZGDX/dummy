-- Add registration_link column to competition_dashboard
ALTER TABLE competition_dashboard 
ADD COLUMN IF NOT EXISTS registration_link TEXT;

-- NOTE (2026-08): superseded by phase1-student-competitions.sql, which is the
-- applied live migration. This file is kept as the historical incremental
-- draft with corrected policies (Allow-all, matching every other live table).

-- Create student_competitions table for tracking registrations and verifications
CREATE TABLE IF NOT EXISTS student_competitions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id TEXT NOT NULL,
  student_email TEXT NOT NULL,
  student_name TEXT NOT NULL,
  competition_id TEXT NOT NULL,
  competition_name TEXT NOT NULL,
  registration_link TEXT,
  verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  verification_method TEXT,
  gmail_message_id TEXT,
  gmail_thread_id TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (student_email, competition_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_student_competitions_student_email ON student_competitions(student_email);
CREATE INDEX IF NOT EXISTS idx_student_competitions_competition_id ON student_competitions(competition_id);
CREATE INDEX IF NOT EXISTS idx_student_competitions_verification_status ON student_competitions(verification_status);

-- Create gmail_tokens table for storing OAuth tokens
CREATE TABLE IF NOT EXISTS gmail_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  user_email TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  scope TEXT,
  history_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on new tables
ALTER TABLE student_competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gmail_tokens ENABLE ROW LEVEL SECURITY;

-- RLS policies (Allow-all, matching every other live table). The earlier
-- user_profiles-dependent "Admins can view/update" policies are dropped;
-- the app writes/reads these tables via the service role.
CREATE POLICY "Allow all on student_competitions" ON student_competitions
  FOR ALL USING (true);

-- RLS policies for gmail_tokens
CREATE POLICY "Allow all on gmail_tokens" ON gmail_tokens
  FOR ALL USING (true);