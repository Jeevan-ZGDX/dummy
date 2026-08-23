-- Comp-Dash: Seed Data
-- Run this in Supabase SQL Editor to populate sample data

-- Clear existing data (optional, comment out if you want to keep existing)
TRUNCATE students, advisors, competitions, registrations, winners, audit_logs, notifications, verification_requests, role_access RESTART IDENTITY CASCADE;

-- Students (existing data kept, ensure columns match schema)
-- The following inserts are kept from the original seed file; they already include
-- department, year, section, roll_number, phone, registered_competitions, verified_competitions.
-- created_at and updated_at have default values.

-- Advisors
INSERT INTO advisors (id, name, email, department, assigned_sections, pending_verifications, phone, office_location, experience, publications)
VALUES
  ('adv-001', 'Dr. Priya Sharma', 'priya.sharma@citchennai.net', 'CSE', '{3A,3B,3C}', 4, '9876543210', 'Room 305, CSE Block', 10, 15),
  ('adv-002', 'Mr. Arun Kumar', 'arun.kumar@citchennai.net', 'CSE', '{2A,2B}', 2, '9876543211', 'Room 210, CSE Block', 8, 8),
  ('adv-003', 'Dr. Meena Raj', 'meena.raj@citchennai.net', 'CSE', '{4A,4B}', 7, '9876543212', 'Room 401, CSE Block', 12, 20),
  ('adv-004', 'Dr. Suresh Kumar', 'suresh.kumar@citchennai.net', 'CSE', '{3A,3B}', 3, '9876543213', 'Room 302, CSE Block', 9, 12),
  ('adv-005', 'Mrs. Kavitha R', 'kavitha.r@citchennai.net', 'CSE', '{2A,2B,3A}', 5, '9876543214', 'Room 205, CSE Block', 7, 5),
  ('adv-006', 'Dr. Venkatesh M', 'venkatesh.m@citchennai.net', 'CSE', '{4A,4B}', 1, '9876543215', 'Room 405, CSE Block', 11, 18)
ON CONFLICT (id) DO NOTHING;

-- Competitions
INSERT INTO competitions (id, title, description, short_description, category, scope, mode, organizer, organizer_logo, banner_url, website_url, registration_url, team_size_min, team_size_max, prize_pool, registration_deadline, start_date, end_date, eligibility, tags)
VALUES
  ('comp-001', 'CodeStorm 2026', '24-hour national hackathon focused on innovative coding solutions.', '24-hour national hackathon', 'hackathon', 'national', 'offline', 'CIT Innovation Cell', 'https://example.com/logos/innovationcell.png', 'https://example.com/banners/codestorm2026.png', 'https://codestorm2026.example.com', 'https://reg.codestorm2026.example.com', 2, 4, '₹1,50,000', '2026-10-15 23:59:00+05:30', '2026-10-20 09:00:00+05:30', '2026-10-21 09:00:00+05:30', '{"year": "3rd Year", "department": "CSE"}', '{hackathon,coding,innovation}'),
  ('comp-002', 'InnovateX AI Build-A-Thon', 'AI/ML solution building competition for healthcare applications.', 'AI/ML solution building', 'hackathon', 'national', 'online', 'AIDS Department', 'https://example.com/logos/aids.png', 'https://example.com/banners/innovatexai.png', 'https://innovatexai.example.com', 'https://reg.innovatexai.example.com', 1, 3, '₹75,000', '2026-11-01 23:59:00+05:30', '2026-11-05 10:00:00+05:30', '26-11-06 18:00:00+05:30', '{"year": "2nd Year", "department": "CSE"}', '{ai,ml,healthcare}'),
  ('comp-003', 'Bridgestone World Solar Challenge', 'Design and race solar-powered vehicles.', 'Solar vehicle design', 'project', 'international', 'hybrid', 'CSE Department & Bridgestone', 'https://example.com/logos/bridgestone.png', 'https://example.com/banners/solarchallenge.png', 'https://solarchallenge.example.com', 'https://reg.solarchallenge.example.com', 3, 6, '₹10,00,000', '2026-09-30 23:59:00+05:30', '2026-10-10 08:00:00+05:30', '2026-10-20 18:00:00+05:30', '{"year": "4th Year", "department": "CSE"}', '{solar,robotics,ev}'),
  ('comp-004', 'Smart India Hackathon', 'Government-sponsored hackathon for public sector solutions.', 'Government hackathon', 'project', 'national', 'hybrid', 'Ministry of Education', 'https://example.com/logos/moe.png', 'https://example.com/banners/sih.png', 'https://sih.example.com', 'https://reg.sih.example.com', 4, 6, '₹5,00,000', '2026-08-15 23:59:00+05:30', '2026-08-20 09:00:00+05:30', '2026-08-22 20:00:00+05:30', '{"year": "3rd Year", "department": "ANY"}', '{sih,government,innovation}'),
  ('comp-005', 'HackFusion 2026', 'Blockchain & Web3 hackathon for decentralized applications.', 'Blockchain & Web3 hackathon', 'hackathon', 'national', 'online', 'CSE Department & Blockchain Council', 'https://example.com/logos/blockchaincouncil.png', 'https://example.com/banners/hackfusion.png', 'https://hackfusion2026.example.com', 'https://reg.hackfusion2026.example.com', 2, 4, '₹1,25,000', '2026-09-15 23:59:00+05:30', '2026-09-20 10:00:00+05:30', '2026-09-21 20:00:00+05:30', '{"year": "3rd Year", "department": "CSE"}', '{blockchain,web3,smart-contracts}'),
  ('comp-006', 'Open Source Sprint', 'Contribute to open source projects and earn rewards.', 'Open source contribution', 'project', 'international', 'online', 'GitHub Education & CSE Department', 'https://example.com/logos/github.png', 'https://example.com/banners/ossprint.png', 'https://ossprint.example.com', 'https://reg.ossprint.example.com', 1, 3, '₹50,000', '2026-07-31 23:59:00+05:30', '2026-08-05 00:00:00+05:30', '2026-08-15 23:59:00+05:30', '{"year": "2nd Year", "department": "ANY"}', '{opensource,git,contribution}')
ON CONFLICT (id) DO NOTHING;

-- Registrations (sample data linking first few students to competitions)
INSERT INTO registrations (id, competition_id, user_id, user_name, department, status, registered_at, verified_at, verification_method, extracted_confirmation_id, extracted_email, rejection_reason, notes)
VALUES
  ('reg-001', 'comp-001', 'stu-24CS0001', 'A AARTHI', 'CSE', 'verified', '2026-09-01 10:00:00+05:30', '2026-09-02 14:30:00+05:30', 'email', 'CONF123456', 'a.aarthi@example.com', NULL, 'Verified via email'),
  ('reg-002', 'comp-002', 'stu-24CS0002', 'AARON M', 'CSE', 'pending_verification', '2026-09-02 11:15:00+05:30', NULL, NULL, NULL, NULL, NULL, 'Awaiting proof submission'),
  ('reg-003', 'comp-003', 'stu-24CS0003', 'AARTHI R', 'CSE', 'rejected', '2026-09-03 09:30:00+05:30', NULL, 'email', 'CONF654321', 'aarthi.r@example.com', 'Invalid confirmation ID', 'Confirmation ID does not match records'),
  ('reg-004', 'comp-001', 'stu-24CS0004', 'AARTHI S', 'CSE', 'verified', '2026-09-04 16:45:00+05:30', '2026-09-05 11:20:00+05:30', 'portal', 'CONF987654', 'aarthi.s@example.com', NULL, 'Verified via student portal'),
  ('reg-005', 'comp-004', 'stu-24CS0005', 'AARTHIKA R', 'CSE', 'pending_verification', '2026-09-05 12:00:00+05:30', NULL, NULL, NULL, NULL, NULL, 'Submitted, under review')
ON CONFLICT (id) DO NOTHING;

-- Winners (sample data)
INSERT INTO winners (id, student_name, email, competition, competition_id, department, position, prize, date, verification_date, registration_id)
VALUES
  ('win-001', 'A AARTHI', 'a.aarthi@example.com', 'CodeStorm 2026', 'comp-001', 'CSE', '1st Place', '₹50,000 + Trophy', '2026-10-21', '2026-10-22 10:00:00+05:30', 'reg-001'),
  ('win-002', 'AARON M', 'aaron.m@example.com', 'InnovateX AI Build-A-Thon', 'comp-002', 'CSE', '2nd Place', '₹30,000 + Certificate', '2026-11-06', '2026-11-07 15:30:00+05:30', 'reg-002'),
  ('win-003', 'AARTHI R', 'aarthi.r@example.com', 'Bridgestone World Solar Challenge', 'comp-003', 'CSE', '3rd Place', '₹20,000 + Medal', '2026-10-20', '2026-10-21 09:00:00+05:30', 'reg-003')
ON CONFLICT (id) DO NOTHING;

-- Audit logs (sample)
INSERT INTO audit_logs (id, "user", action, resource, details)
VALUES
  ('audit-001', 'stu-24CS0001', 'REGISTER', 'competition:comp-001', 'Student registered for CodeStorm 2026'),
  ('audit-002', 'stu-24CS0002', 'UPDATE_PROFILE', 'student:stu-24CS0002', 'Updated phone number'),
  ('audit-003', 'adv-001', 'APPROVE_REGISTRATION', 'registration:reg-001', 'Approved registration after verification')
ON CONFLICT (id) DO NOTHING;

-- Notifications (sample)
INSERT INTO notifications (id, user_id, type, title, message, data, is_read)
VALUES
  ('notif-001', 'stu-24CS0001', 'REGISTRATION_CONFIRMED', 'Registration Confirmed', 'Your registration for CodeStorm 2026 has been verified.', '{\"competition_id\":\"comp-001\",\"registration_id\":\"reg-001\"}', false),
  ('notif-002', 'stu-24CS0002', 'REGISTRATION_PENDING', 'Action Required', 'Please submit proof of payment for InnovateX AI Build-A-Thon.', '{\"competition_id\":\"comp-002\",\"registration_id\":\"reg-002\"}', false),
  ('notif-003', 'stu-24CS0003', 'REGISTRATION_REJECTED', 'Registration Rejected', 'Your registration for Bridgestone World Solar Challenge was rejected due to invalid confirmation ID.', '{\"competition_id\":\"comp-003\",\"registration_id\":\"reg-003\",\"reason\":\"Invalid confirmation ID\"}', true)
ON CONFLICT (id) DO NOTHING;

-- Verification requests (sample)
INSERT INTO verification_requests (id, registration_id, student_id, student_name, department, competition_title, advisor_notified, email_proof, status, requested_at, reviewed_at)
VALUES
  ('vr-001', 'reg-001', 'stu-24CS0001', 'A AARTHI', 'CSE', 'CodeStorm 2026', true, 'proof1.pdf', 'approved', '2026-09-01 10:05:00+05:30', '2026-09-02 14:30:00+05:30'),
  ('vr-002', 'reg-002', 'stu-24CS0002', 'AARON M', 'CSE', 'InnovateX AI Build-A-Thon', false, NULL, 'pending', '2026-09-02 11:20:00+05:30', NULL),
  ('vr-003', 'reg-003', 'stu-24CS0003', 'AARTHI R', 'CSE', 'Bridgestone World Solar Challenge', true, 'proof3.pdf', 'rejected', '2026-09-03 09:35:00+05:30', '2026-09-03 10:00:00+05:30')
ON CONFLICT (id) DO NOTHING;

-- Role access (sample)
INSERT INTO role_access (email, role, department, granted, updated_at)
VALUES
  ('priya.sharma@citchennai.net', 'advisor', 'CSE', true, now()),
  ('arun.kumar@citchennai.net', 'advisor', 'CSE', true, now()),
  ('meena.raj@citchennai.net', 'advisor', 'CSE', true, now()),
  ('suresh.kumar@citchennai.net', 'advisor', 'CSE', true, now()),
  ('kavitha.r@citchennai.net', 'advisor', 'CSE', true, now()),
  ('venkatesh.m@citchennai.net', 'advisor', 'CSE', true, now()),
  ('admin@citchennai.net', 'admin', 'CSE', true, now()),
  ('student.office@citchennai.net', 'staff', 'CSE', true, now())
ON CONFLICT (email) DO NOTHING;

-- Ensure students have default values for registered_competitions and verified_competitions (already 0 in seed)
-- No further action needed.
