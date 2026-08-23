# Comp-Dash

A production-grade mobile-first SaaS platform for college competition management.

## Architecture

```
comp-dash/
├─ apps/
│  ├─ mobile/          # React Native (Expo) - Student & Advisor app
│  └─ web/             # Next.js 15 - Admin dashboard
├─ packages/
│  ├─ api/             # TanStack Query hooks & API client
│  ├─ design-system/   # Shared UI components (Button, Card, Badge, etc.)
│  ├─ hooks/           # Shared React hooks
│  ├─ i18n/            # Internationalization (en, ta, hi)
│  ├─ types/           # TypeScript type definitions
│  └─ utils/           # Utility functions
└─ locales/            # Translation files
```

## Tech Stack

- **Mobile**: React Native, Expo, React Navigation
- **Web**: Next.js 15, React, Tailwind CSS
- **State**: TanStack Query (React Query)
- **Forms**: React Hook Form + Zod
- **Icons**: Lucide React
- **Animations**: Framer Motion
- **i18n**: i18next + react-i18next

## Getting Started

### Prerequisites

- Node.js >= 20.0.0
- npm or yarn
- Expo CLI (for mobile)
- Android Studio / Xcode (for mobile development)

### Installation

```bash
# Install dependencies
npm install

# Start web dashboard
npm run dev:web

# Start mobile app
npm run dev:mobile
```

### Development

```bash
# Run web app
cd apps/web && npm run dev

# Run mobile app
cd apps/mobile && npm start

# Type checking
npm run typecheck

# Linting
npm run lint

# Formatting
npm run format
```

## Design System

The design system follows Apple-inspired design language with:

- **Colors**: Primary violet (#6C4CF1), semantic colors for status
- **Typography**: Inter font family, clear hierarchy
- **Components**: Button, Card, Badge, Avatar, Input, Skeleton, etc.
- **Spacing**: 8-point grid system
- **Border Radius**: Rounded corners (12-20px)

### Available Components

```tsx
import { Button, Card, Badge, Avatar, Input, Skeleton } from '@comp-dash/design-system'

<Button variant="primary" size="md">Click me</Button>
<Card padding="lg">Content</Card>
<Badge variant="success" dot>Active</Badge>
<Avatar name="John Doe" size="lg" />
<Input label="Email" placeholder="Enter email" />
<Skeleton variant="heading" width="half" />
```

## API Layer

All API calls go through TanStack Query hooks:

```tsx
import { useCompetitions, useRegistrations } from '@comp-dash/api'

const { data, isLoading } = useCompetitions({ category: 'hackathon' })
const { data: registrations } = useRegistrations({ status: 'verified' })
```

## Internationalization

Translations are in `locales/` directory:

- `en.json` - English
- `ta.json` - Tamil
- `hi.json` - Hindi

```tsx
import { useTranslation } from 'react-i18next'

const { t } = useTranslation()
return <h1>{t('home.greeting', { name: 'John' })}</h1>
```

## Features

### Mobile App (Student/Advisor)
- **Home**: Personalized dashboard with stats, deadlines, verified registrations
- **Discover**: Browse and filter competitions
- **Competition Details**: Full competition info with registration
- **History**: Track registration status
- **Profile**: Account settings and preferences
- **Notifications**: Real-time updates

### Web Dashboard (Admin)
- **Dashboard**: Overview with charts and key metrics
- **Competitions**: Manage all competitions
- **Registrations**: Review and verify registrations
- **Students**: Student management
- **Advisors**: Advisor management
- **Departments**: Department overview
- **Winners**: Winner management
- **Analytics**: Detailed analytics
- **Notifications**: Notification management
- **Settings**: System configuration
- **Audit Logs**: Activity tracking

## Environment Variables

### Web App (`apps/web/.env.local`)

```env
# Firebase web config (public)
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=000000000000
NEXT_PUBLIC_FIREBASE_APP_ID=1:000000000000:web:abcdef

# App API base URL
NEXT_PUBLIC_API_URL=http://localhost:3000/api

# Google OAuth (server-only, for Gmail verification)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/gmail/callback

# Real-time webhook secret
REAL_TIME_API_SECRET=change-me-to-a-long-random-string

# Firebase Admin (server-only, JSON string)
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'
```

See `apps/web/.env.example` for the full annotated list.

## Auth & Database (Firebase)

- **Auth** is Firebase Auth (Google + Email/Password). Enable both providers in
  the Firebase console before first use.
- **Database** is Cloud Firestore. Collections are created on first write — run
  the migration below, or seed them yourself.
- Roles are **not** stored on the client. They live in the `role_access`
  collection, are resolved server-side, and ride in the ID token as custom
  claims. Add a `role_access` document to grant staff access.
- Gmail OAuth tokens are stored **server-side** in the `gmail_tokens` collection
  and are only touched via the Admin SDK. Security rules deny all client access
  to that collection. The Gmail OAuth dance runs through `/api/auth/gmail`.

### Google Sign-In (Firebase Auth)

Sign-in runs through **Firebase Auth**, which owns the OAuth handshake with
Google. This app registers no redirect URI of its own:

```
browser -> signInWithPopup(GoogleAuthProvider)   (hd=citchennai.net narrows the picker)
        -> <project>.firebaseapp.com/__/auth/handler
        -> back to the app with a Firebase ID token
        -> POST /api/auth/session  (twice, see below)
        -> /dashboard
```

`/api/auth/session` is the important half:

1. Verifies the ID token with the Admin SDK.
2. **Enforces that the account ends in `@citchennai.net`** — anything else is
   rejected and signed back out. The `hd` parameter is only a UX filter.
3. **Resolves the role from Firestore**: `role_access` (keyed by lowercased
   email; `granted: false` blocks the account) -> `profiles` -> `user_profiles`,
   otherwise `student`.
4. Writes role/department as **custom claims** and answers
   `{ refreshRequired: true }`. Custom claims only appear in a token minted
   *after* they are set, so the client force-refreshes and posts again — that
   second token becomes the `fb_session` cookie. Without the second pass every
   user would read as `student`.

The middleware verifies that cookie in the **Edge** runtime using `jose` against
Google's public JWKS, because the Admin SDK cannot run on Edge. Firebase ID
tokens expire hourly and the SDK refreshes them silently, so `FirebaseAuthSync`
mirrors every refresh back into the cookie — otherwise sessions would die
mid-use while the tab still looked signed in.

**Required setup:**

- Firebase console -> Authentication -> Sign-in method: enable **Google** and
  **Email/Password**.
- Firebase console -> Authentication -> Settings -> Authorized domains: add
  `comp-dash.onrender.com` (`localhost` is there by default).
- Set the `NEXT_PUBLIC_FIREBASE_*` variables (see `apps/web/.env.example`) and
  supply admin credentials via `FIREBASE_SERVICE_ACCOUNT` or a local
  `apps/web/service-account.json`.
- Grant staff access by adding `role_access` documents keyed by email:
  ```js
  // Firestore -> role_access -> document id: "hod@citchennai.net"
  { email: "hod@citchennai.net", role: "hod", department: "CSE", granted: true }
  ```

> Gmail verification (`/api/auth/gmail`) is a **separate** flow that still uses a
> raw Google OAuth client via `GOOGLE_CLIENT_ID` / `GOOGLE_REDIRECT_URI`, and
> still needs its redirect URI authorized in Google Cloud.

### Firestore

Collections mirror the old Postgres tables one-for-one, and documents keep the
original **snake_case** field names (`competition_id`, `registered_competitions`,
…) so the migration was a straight row->document copy:

`students`, `advisors`, `competitions`, `registrations`, `winners`,
`notifications`, `audit_logs`, `verification_requests`, `competition_dashboard`,
`role_access`, `profiles`, `user_profiles`, `student_competitions`, `gmail_tokens`.

Security rules live in [`firestore.rules`](firestore.rules) and are what replaces
Postgres RLS. They apply only to the client SDK — server routes use the Admin
SDK and bypass them. Deploy with `firebase deploy --only firestore:rules`.

Two Firestore behaviours worth knowing, both worked around in code:

- **`orderBy` silently excludes documents missing the sort field**, so a
  nullable sort would quietly drop records. Those sorts are done in memory.
- **No `ilike`, no joins, no SQL aggregates.** Text search and cross-collection
  joins are done in memory after fetching. Fine at current data sizes; it will
  not scale to tens of thousands of documents.

To migrate data from an existing Supabase project:

```bash
npm run migrate:firestore -- --dry-run   # report counts, write nothing
npm run migrate:firestore                # apply; safe to re-run
```

### Mobile App (`apps/mobile/.env`)

```env
EXPO_PUBLIC_API_URL=http://localhost:3001/api
```

## License

Private - All rights reserved.
