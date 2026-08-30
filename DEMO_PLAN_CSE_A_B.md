# Demo Map — 3rd Year CSE, Sections A & B

**Scope:** student side + advisor side, sections A and B of 3rd Year CSE
**Verified against:** `compdash-bf688`, live, 30 Aug 2026
**Status:** ✅ **Seeded and verified.** All blockers in §4 are applied. Remaining human step: §4.5 rehearsal.

---

## TL;DR — what was broken, and what was done

Three things would each have broken the demo on stage. All three are now fixed and verified against the live project.

| # | Problem | Status |
|---|---|---|
| 1 | Section B had all 32 registrations; **section A had zero** | ✅ Seeded 15 to section A (7 verified / 5 pending / 3 rejected) |
| 2 | Section B's advisors had **no `role_access`** → would sign in as `student` | ✅ Granted advisor role to all 3 missing advisors |
| 3 | Every registration pointed at **`dash-002`, which did not exist** | ✅ Created as "HACK CORE 2026", `eligible_year: III` |
| 4 | **First-ever sign-in resolved everyone as `student`** (two-pass auth flow was missing) | ✅ Restored and verified end-to-end |

**Live-verified** via `/api/advisor/summary` as the section-A advisor: 65 students, 15 registered, 7 verified / 5 pending / 3 rejected, section label rendering as bare `A`.

Item 4 deserves a note: both `session/route.ts` and `establish-session.ts` *documented* a two-pass exchange, but neither implemented it. The session cookie held a token minted **before** the role claim was written, and the Edge middleware reads the role straight out of that token. Any advisor signing in for the first time — which is all three of the newly granted ones — would have landed in the student UI. Proven fixed with a disposable account: pass 1 `role: null → refreshRequired: true`, pass 2 `role: "advisor" → refreshRequired: false`, cookie carries `advisor`.

---

## 1. The cast

### Students — 130 total, all with clean `@citchennai.net` addresses

| Section | Stored as | Count | Registrations today |
|---|---|---:|---:|
| 3rd Year CSE **A** | `3%A` | **65** | **15** ✅ *(seeded)* |
| 3rd Year CSE **B** | `3%B` | **65** | **32** ✅ |

Sample A: `agayathiridevi.cse2024@citchennai.net` · `alogessh.cse2024@citchennai.net`
Sample B: `anushkanh.cse2024@citchennai.net` · `architajb.cse2024@citchennai.net`

> `section` is stored **year-prefixed** (`3%A`), while advisors' `assigned_sections` hold **bare** labels (`A`). `normalizeSection()` bridges them. Don't "fix" either one before the demo.

### Advisors — 4 assigned, all 4 now usable

| Advisor | Section | `role_access` | Firebase Auth | Role on sign-in | Usable? |
|---|---|---|---|---|---|
| **Ms. Nagomiya** `nagomiyas@citchennai.net` | **A** | ✅ granted | ✅ exists | `advisor` | ✅ **Yes** |
| **Ms. Hemalatha** `hemalathar.cse@citchennai.net` | A | ✅ granted | on first sign-in | `advisor` | ✅ Yes |
| **Mr. Santhoshkumar** `santhoshkumarr.cse@citchennai.net` | **B** | ✅ granted | on first sign-in | `advisor` | ✅ **Yes** |
| **Ms. Dev sri** `devsris.cse@citchennai.net` | B | ✅ granted | on first sign-in | `advisor` | ✅ Yes |

**Why three of them were broken (now fixed):** `resolveUserFromDatabase()` checks `role_access`, then `profiles`, then `user_profiles` — all three were empty for these addresses. It then falls back to guessing the role from the email prefix, which only recognises `admin@`, `hod@`, `advisor@`, `faculty@`. `santhoshkumarr.cse@…` matches none, so it defaulted to **`student`**: they would have signed in successfully and landed in the wrong app. The `role_access` grants in §4.2 close this.

*(Missing Firebase Auth users are **not** a blocker — Google sign-in creates those on first login, and with the §4 auth fix the role is correct on that very first session.)*

---

## 2. Competitions

`dash-002` — **"HACK CORE 2026"**, `eligible_year: III` — now exists and is the competition the demo runs on.

The other 8 documents in `competition_dashboard` are pre-existing test junk and were **left untouched** (deleting live data is not mine to do):

| id | name | eligible_year |
|---|---|---|
| `106826de…` | `ddd` | `""` |
| `230e9655…` | `get` | `""` |
| `ae4443bf…` | `xfg` | `""` |
| `comp-1787237934939` | `xfg` | `""` |
| `comp-1787477707774` | `hi` | `""` |
| `comp-1787851682014` | `ddd` | `""` |

⚠️ **These will still appear in the competitions list during the demo**, and their blank `eligible_year` reads as *open to all years*, so 3rd-years see every one of them. If "ddd" and "xfg" on a projector is unacceptable, say so and I will either delete them or set `eligible_year: "I"` to hide them from 3rd-years — both are one command, but both touch existing data, so I have not done it unasked.

### The dangling reference — resolved

All 47 registrations point at `competition_id: "dash-002"` with `competition_name: "HACK CORE 2026"`. That document **did not exist** in either collection, so every registration referenced a competition that wasn't there. Creating it properly turned all of them into valid demo data at once.

---

## 3. What actually works (verified)

- ✅ `/api/advisor/summary` **exists** and is what `AdvisorDashboard.tsx` consumes — returns `{ advisor, totals, sections, recentRegistrations, yearScope }`.
- ✅ Verification flow: `/api/verification-requests` and `/api/verification-requests/{id}/verify` are handled by the catch-all route.
- ✅ 3rd Year is in `ACTIVE_YEAR_NUMBERS = [2, 3]`, so section A/B students are in scope everywhere.
- ✅ Registration statuses span all three states — section A: **7 verified, 5 pending, 3 rejected**; section B: **22 verified, 6 pending, 4 rejected**.
- ✅ All 130 A/B student emails pass the `@citchennai.net` domain gate — none of the 60 bad addresses from the extradb import are in these two sections.

> ⚠️ Do **not** demo the advisor *roster* screen. `/api/advisor/competitions/{id}/roster` and `/api/competitions/{id}/sections` **do not exist** (404). The e2e specs target them, which is why 16 tests fail. The advisor **summary/dashboard** is the working surface — build the demo on that.

---

## 4. Seed plan — ✅ APPLIED

Applied via `scripts/seed-demo-ab.mjs --commit` (19 documents, tagged `seeded_by: demo-ab-2026-08-30`).
The script is **additive only** — it never edits or deletes existing documents, and
`node --env-file=.env scripts/seed-demo-ab.mjs --undo --commit` removes exactly what it wrote.

### 4.1 Create the competition `dash-002` — fixes two problems at once

```
collection: competition_dashboard
doc id:     dash-002          ← reuse the id the 32 registrations already reference
{
  competition_name: "HACK CORE 2026",   ← matches the existing registration rows
  eligible_year:    "III",              ← so year-scoping is demonstrable
  category:         "hackathon",
  organizer:        "Chennai Institute of Technology",
  registration_deadline: <a future date>,
  serial_no:        1
}
```

This makes all 30 section-B registrations resolve correctly **and** gives you a presentable name on screen.

### 4.2 Grant the three advisors their role — unblocks section B

Three docs in `role_access`, keyed by email:

```
santhoshkumarr.cse@citchennai.net  → { role: "advisor", department: "CSE", granted: true }
devsris.cse@citchennai.net         → { role: "advisor", department: "CSE", granted: true }
hemalathar.cse@citchennai.net      → { role: "advisor", department: "CSE", granted: true }
```

Without this, **section B cannot be demoed from the advisor side at all.**

### 4.3 Give section A some registrations — so both sections have a story

Seed ~15 registrations for 3%A students against `dash-002`:

| Status | Count | What it demonstrates |
|---|---:|---|
| `verified` | 7 | The happy path, already approved |
| `pending` | 5 | **What the advisor approves live on stage** |
| `rejected` | 3 | The negative path renders correctly |

Leave **at least 2 pending** untouched so there is something to approve during the demo.

### 4.4 Optional — a second competition to show year filtering

One more competition with `eligible_year: "II"` proves 3rd-years are correctly *excluded* from something. Nice-to-have, not required.

### 4.5 Rehearse one real Google sign-in

Pick one section-A student and one section-B student and **actually sign them in once before the demo.** Their Firebase Auth user and custom claims are created on first login — you do not want that happening for the first time in front of an audience.

---

## 5. Demo run sheet

### Act 1 — Student side (section A)

1. Sign in with a **3rd-year CSE A** Google account (e.g. `agayathiridevi.cse2024@citchennai.net`).
2. Dashboard → **HACK CORE 2026** is visible (eligible: III).
3. Register for it → status shows **Pending**.
4. Point out: the student sees only their own registration.

### Act 2 — Advisor side, section A (live approval)

1. Sign in as **Ms. Nagomiya** (`nagomiyas@citchennai.net`) — the account that already works.
2. Advisor dashboard → section **A**, 65 students, totals rolled up.
3. Open verification requests → the registration just created in Act 1 is **Pending**.
4. **Approve it.**
5. Switch back to the student → now **Verified**. *This is the money shot — the two sides connecting live.*

### Act 3 — Advisor side, section B (volume)

1. Sign in as **Mr. Santhoshkumar** (`santhoshkumarr.cse@citchennai.net`) — *requires §4.2*.
2. Section **B**, 65 students, **30 registrations** already spanning verified / pending / rejected.
3. Shows the dashboard with real volume rather than a single row.

### Act 4 — HOD roll-up (optional)

1. Sign in as `hod@citchennai.net`.
2. Both sections A and B roll up in one view, section labels rendering as bare letters (`A`, `B`) — not `3%A`.

---

## 6. Risks & fallbacks

| Risk | Likelihood | Fallback |
|---|---|---|
| ~~§4.2 skipped → section B advisor in student UI~~ | ✅ Resolved | — |
| Live Google sign-in fails on stage | Low | Rehearse per §4.5; keep a signed-in tab warm |
| Render free tier cold-start (~30 s blank screen) | **High** | Hit the site 5 min before; or upgrade off free tier |
| Firestore daily read quota exhausted mid-demo | Medium | Check the usage console beforehand; move to Blaze |
| Someone clicks into the advisor **roster** screen | Medium | Avoid it — endpoint doesn't exist (§3). Stay on the dashboard |
| ~~`dash-002` missing → blank competition~~ | ✅ Resolved | — |
| **Auth fix not deployed** to the demo environment | **High** | Build + deploy before the demo; verify one advisor sign-in |

---

## 7. Checklist

- [x] Create `competition_dashboard/dash-002` — "HACK CORE 2026", `eligible_year: "III"` *(§4.1)*
- [x] Add 3 `role_access` docs for Santhoshkumar, Dev sri, Hemalatha *(§4.2)*
- [x] Seed 15 section-A registrations, 5 left pending *(§4.3)*
- [x] Fix the first-sign-in role bug (two-pass session flow)
- [ ] **Deploy the auth fix** — it is a code change, so it must reach the demo environment
- [ ] Rehearse one student + one advisor Google sign-in *(§4.5)*
- [ ] Warm the Render instance ~5 min before *(§6)*
- [ ] Confirm Firestore quota headroom in the Firebase console *(§6)*
- [ ] Agree to stay off the advisor roster screen *(§3)*

---

### Notes

- `sellamuthur.cse2024@citchennai.net` — the account in your mobile screenshots — is section **3%O**, not A or B, and its claims carry `department: ""`. It is **not** usable for this demo without moving the student or picking a different one.
- The 4 malformed faculty emails and 60 personal-Gmail students found in the extradb import are **all outside sections A and B**. They do not affect this demo.
