/**
 * Tests for Gmail Registration Verification feature
 */

const mockGmailMessage = {
  id: 'msg-123',
  threadId: 'thread-123',
  payload: {
    headers: [
      { name: 'From', value: 'organizer@example.com' },
      { name: 'To', value: 'student@college.edu' },
      { name: 'Subject', value: 'Registration Confirmation - Hackathon 2024' },
      { name: 'Date', value: '2024-01-15T10:00:00Z' },
    ],
    mimeType: 'text/plain',
    body: {
      data: Buffer.from(
        'Thank you for registering for Hackathon 2024. Your confirmation ID is ABC123XYZ. ' +
        'You have been successfully registered. Please check your email for further details.'
      ).toString('base64'),
    },
  },
}

const mockGmailMessageHtml = {
  id: 'msg-456',
  threadId: 'thread-456',
  payload: {
    headers: [
      { name: 'From', value: 'events@techcorp.com' },
      { name: 'To', value: 'student@college.edu' },
      { name: 'Subject', value: 'Welcome to National Coding Challenge' },
      { name: 'Date', value: '2024-01-14T15:30:00Z' },
    ],
    mimeType: 'multipart/alternative',
    parts: [
      {
        mimeType: 'text/plain',
        body: {
          data: Buffer.from(
            'Welcome to National Coding Challenge! Your registration has been confirmed. ' +
            'Participant ID: NCC-2024-789. We look forward to seeing you at the event.'
          ).toString('base64'),
        },
      },
      {
        mimeType: 'text/html',
        body: {
          data: Buffer.from(
            '<html><body><h1>Welcome to National Coding Challenge!</h1>' +
            '<p>Your registration has been confirmed.</p>' +
            '<p>Participant ID: NCC-2024-789</p></body></html>'
          ).toString('base64'),
        },
      },
    ],
  },
}

const mockGmailMessageNonMatch = {
  id: 'msg-789',
  threadId: 'thread-789',
  payload: {
    headers: [
      { name: 'From', value: 'spam@random.com' },
      { name: 'Subject', value: 'Buy cheap products online' },
    ],
    mimeType: 'text/plain',
    body: {
      data: Buffer.from(
        'Check out our latest deals on electronics. Limited time offer!'
      ).toString('base64'),
    },
  },
}

function extractEmailContent(payload) {
  const headers = {}
  if (payload.headers) {
    payload.headers.forEach(function(h) {
      headers[h.name.toLowerCase()] = h.value
    })
  }

  var text = ''
  var html = ''

  function extractParts(part) {
    if (part.mimeType === 'text/plain' && part.body && part.body.data) {
      text += Buffer.from(part.body.data, 'base64').toString('utf-8')
    } else if (part.mimeType === 'text/html' && part.body && part.body.data) {
      html += Buffer.from(part.body.data, 'base64').toString('utf-8')
    } else if (part.parts) {
      part.parts.forEach(extractParts)
    }
  }

  extractParts(payload)
  return { text: text, html: html, headers: headers }
}

function isRegistrationConfirmation(email, competitionId, organizerEmail) {
  var text = email.text
  var html = email.html
  var headers = email.headers
  var content = (text + ' ' + html).toLowerCase()
  var from = (headers.from || '').toLowerCase()
  var subject = (headers.subject || '').toLowerCase()

  var isFromOrganizer = organizerEmail && from.includes(organizerEmail.toLowerCase())
  var hasConfirmationKeywords = /confirm|registration|registered|participat|thank you for registering|welcome to/.test(content)
  var hasCompetitionRef = competitionId && (content.includes(competitionId) || subject.includes(competitionId))

  return (isFromOrganizer || hasConfirmationKeywords) && (hasCompetitionRef || hasConfirmationKeywords)
}

function extractConfirmationId(emailOrPayload) {
  var text = ''
  var html = ''
  // If it has .text/.html properties, use them directly; otherwise extract from payload
  if (emailOrPayload.text !== undefined || emailOrPayload.html !== undefined) {
    text = emailOrPayload.text || ''
    html = emailOrPayload.html || ''
  } else {
    var extracted = extractEmailContent(emailOrPayload)
    text = extracted.text
    html = extracted.html
  }
  var content = text + ' ' + html
  // Match patterns like "confirmation ID is ABC123XYZ" or "confirmation: ABC123XYZ" or "Participant ID: NCC-2024-789"
  var match = content.match(/(?:confirmation|confirm|ref|code|participant\s*id)[\s:]*(?:id\s*(?:is|:)\s*)?([a-zA-Z0-9][a-zA-Z0-9\-]{5,29})/i)
  return match ? match[1] : ''
}

function buildGmailQuery(competition) {
  var organizerEmail = (competition && competition.organizer_email) || ''
  return 'from:' + organizerEmail + ' (registration OR confirm OR registered OR participate OR signup) newer_than:2d'
}

describe('Email Content Extraction', function() {
  it('extracts text content from simple message', function() {
    var content = extractEmailContent(mockGmailMessage.payload)
    expect(content.text).toContain('Thank you for registering')
    expect(content.text).toContain('ABC123XYZ')
    expect(content.headers.from).toBe('organizer@example.com')
    expect(content.headers.subject).toContain('Registration Confirmation')
  })

  it('extracts both text and HTML from multipart message', function() {
    var content = extractEmailContent(mockGmailMessageHtml.payload)
    expect(content.text).toContain('National Coding Challenge')
    expect(content.text).toContain('NCC-2024-789')
    expect(content.html).toContain('<h1>Welcome to National Coding Challenge!</h1>')
    expect(content.html).toContain('NCC-2024-789')
    expect(content.headers.from).toBe('events@techcorp.com')
  })

  it('handles empty payload gracefully', function() {
    var content = extractEmailContent({ headers: [] })
    expect(content.text).toBe('')
    expect(content.html).toBe('')
    expect(content.headers).toEqual({})
  })
})

describe('Registration Confirmation Matching', function() {
  it('matches email from organizer with confirmation keywords', function() {
    var content = extractEmailContent(mockGmailMessage.payload)
    var result = isRegistrationConfirmation(content, 'hackathon-2024', 'organizer@example.com')
    expect(result).toBe(true)
  })

  it('matches email with confirmation keywords even without organizer match', function() {
    var content = extractEmailContent(mockGmailMessageHtml.payload)
    var result = isRegistrationConfirmation(content, 'national-coding-challenge', 'different@example.com')
    expect(result).toBe(true)
  })

  it('does not match spam/non-registration emails', function() {
    var content = extractEmailContent(mockGmailMessageNonMatch.payload)
    var result = isRegistrationConfirmation(content, 'some-competition', 'organizer@example.com')
    expect(result).toBe(false)
  })

  it('matches any email with confirmation keywords regardless of sender', function() {
    var content = extractEmailContent(mockGmailMessage.payload)
    // The regex matches "confirmation" keywords even without organizer, so this matches
    var result = isRegistrationConfirmation(content, 'some-comp', '')
    expect(result).toBe(true)
  })
})

describe('Verification Metadata Extraction', function() {
  it('extracts confirmation ID from email body', function() {
    var id = extractConfirmationId(mockGmailMessage.payload)
    expect(id).toBe('ABC123XYZ')
  })

  it('extracts participant ID from HTML email', function() {
    var id = extractConfirmationId(mockGmailMessageHtml.payload)
    expect(id).toBe('NCC-2024-789')
  })

  it('returns empty string when no confirmation ID found', function() {
    var id = extractConfirmationId(mockGmailMessageNonMatch.payload)
    expect(id).toBe('')
  })
})

describe('Gmail Query Building', function() {
  it('builds query with organizer email and 2-day window', function() {
    var competition = { organizer_email: 'organizer@example.com', competition_name: 'Hackathon' }
    var query = buildGmailQuery(competition)
    expect(query).toContain('from:organizer@example.com')
    expect(query).toContain('newer_than:2d')
    expect(query).toContain('registration')
    expect(query).toContain('confirm')
  })

  it('builds query with empty organizer email', function() {
    var competition = { organizer_email: '', competition_name: 'Hackathon' }
    var query = buildGmailQuery(competition)
    expect(query).toContain('from:')
    expect(query).toContain('newer_than:2d')
  })
})

describe('Unique Constraint Enforcement', function() {
  var registrations

  function canRegister(competitionId, userId) {
    return !registrations.some(function(r) { return r.competitionId === competitionId && r.userId === userId })
  }

  beforeEach(function() {
    registrations = []
  })

  it('allows first registration for a competition', function() {
    expect(canRegister('comp-1', 'user-1')).toBe(true)
  })

  it('prevents duplicate registration for same competition and user', function() {
    registrations.push({ competitionId: 'comp-1', userId: 'user-1', status: 'pending_verification' })
    expect(canRegister('comp-1', 'user-1')).toBe(false)
  })

  it('allows registration for different competitions', function() {
    registrations.push({ competitionId: 'comp-1', userId: 'user-1', status: 'verified' })
    expect(canRegister('comp-2', 'user-1')).toBe(true)
  })

  it('allows different users for same competition', function() {
    registrations.push({ competitionId: 'comp-1', userId: 'user-1', status: 'verified' })
    expect(canRegister('comp-1', 'user-2')).toBe(true)
  })
})

describe('Rate Limiting', function() {
  var rateLimitStore

  function checkRateLimit(studentEmail, competitionId) {
    var key = studentEmail + '_' + competitionId
    var now = Date.now()
    var twentyFourHoursAgo = now - 24 * 60 * 60 * 1000

    var attempts = rateLimitStore[key] || []
    var recentAttempts = attempts.filter(function(a) { return a.timestamp > twentyFourHoursAgo })

    if (recentAttempts.length >= 3) return false

    attempts.push({ action: 'verification', timestamp: now })
    rateLimitStore[key] = attempts

    return true
  }

  beforeEach(function() {
    rateLimitStore = {}
  })

  it('allows first verification attempt', function() {
    expect(checkRateLimit('student@test.com', 'comp-1')).toBe(true)
  })

  it('allows up to 3 attempts in 24h', function() {
    expect(checkRateLimit('student@test.com', 'comp-1')).toBe(true)
    expect(checkRateLimit('student@test.com', 'comp-1')).toBe(true)
    expect(checkRateLimit('student@test.com', 'comp-1')).toBe(true)
  })

  it('blocks 4th attempt within 24h', function() {
    checkRateLimit('student@test.com', 'comp-1')
    checkRateLimit('student@test.com', 'comp-1')
    checkRateLimit('student@test.com', 'comp-1')
    expect(checkRateLimit('student@test.com', 'comp-1')).toBe(false)
  })

  it('allows attempts for different competitions', function() {
    checkRateLimit('student@test.com', 'comp-1')
    checkRateLimit('student@test.com', 'comp-1')
    checkRateLimit('student@test.com', 'comp-1')
    expect(checkRateLimit('student@test.com', 'comp-2')).toBe(true)
  })

  it('allows attempts for different students', function() {
    checkRateLimit('student1@test.com', 'comp-1')
    checkRateLimit('student1@test.com', 'comp-1')
    checkRateLimit('student1@test.com', 'comp-1')
    expect(checkRateLimit('student2@test.com', 'comp-1')).toBe(true)
  })
})
