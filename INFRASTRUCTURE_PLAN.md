# Comp-Dash — Capacity, Cost & Platform Decision

**Date:** 27 August 2026
**Target scale:** 7,000 active students · 2–3 competitions released per day · every student notified per release
**Question:** stay on Firebase, or migrate to Supabase / AWS / something else?

---

## Verdict first

**Stay on Firebase. Do not migrate.**

Migration is the wrong lever, because **not one of the three things that will actually break is a database problem.** They are:

1. **Email sending** — the Gmail API caps you at ~2,000 recipients/day. You need ~21,000/day. You are **10× over a hard ceiling**, today, on any database.
2. **Hosting** — Render's free tier sleeps when idle and runs a single instance. It cannot serve 7,000 users regardless of where the data lives.
3. **Notification fan-out design** — writing one notification document per student per competition is what generates ~99.96% of your write volume. This is an application design choice, and it costs the same on Firestore, Postgres, or DynamoDB.

Moving to Supabase would cost roughly the same per month (see §5), take weeks of engineering to rewrite auth and the data layer, and **would not fix any of the three problems above**. You would arrive at the same wall having spent the time.

The honest summary: **Firestore is not your bottleneck, and your bill at this scale is small.** Fix the fan-out, add a real email provider, and pay for hosting.

---

## 1. Where you are today

Measured directly against `compdash-bf688` on 27 Aug 2026:

| Collection | Documents |
|---|---:|
| `students` | 2,207 |
| `notifications` | 6,624 |
| `student_competitions` | 32 |
| `audit_logs` | 12 |
| `competition_dashboard` | 6 |
| `advisors` | 36 |

You are at **2,207 students, heading to 7,000** — roughly 3.2× growth. That multiplier matters less than the fan-out multiplier below.

---

## 2. The math that decides everything

### 2.1 Writes — the fan-out problem

Current design: one notification document per student, per competition.

```
3 competitions/day × 7,000 students   = 21,000 notification writes/day
                                      = 630,000 writes/month
```

Firestore's free allowance is **20,000 writes/day**. You exceed it *on day one, every day.*

- On the **Spark (free) plan this hard-fails.** Writes are rejected once the daily quota is hit. This is almost certainly what caused the limit problems you already hit.
- On **Blaze**, the overage is billed: 30,000 billable writes/day × 30 × $0.18/100k = **≈ $0.05/month.**

Read that twice. The fan-out **breaks the free plan completely** while costing **five cents** on the paid plan. Your "Firebase limits" problem is not a cost problem — it is a **plan** problem.

**But the fan-out is still worth removing**, because it drives unbounded storage growth:

```
630,000 docs/month × ~400 bytes ≈ 250 MB/month ≈ 3 GB/year
```

Every unscoped query over that collection gets more expensive forever.

### 2.2 The fix — stop fanning out

Write the competition **once**, and derive each student's unread state:

| | Current (fan-out) | Proposed (derived) |
|---|---:|---:|
| Writes per competition | 7,000 | **1** |
| Writes/day | 21,000 | **3** |
| Writes/month | 630,000 | **~90** |
| Storage growth/year | ~3 GB | **~1 MB** |

Implementation: keep one `competitions` document, and one `last_seen_at` timestamp per student. "Unread" is `competitions.created_at > student.last_seen_at` — a single indexed query, no per-student rows. Write a per-student row **only** when a student actually interacts (registers, dismisses).

This is a **~7,000× write reduction** and it is platform-independent. Do this regardless of what you decide about hosting.

### 2.3 Reads — the real recurring cost

Assume 7,000 students × ~2.5 sessions/day, and ~50 document reads per session (realistic *after* the scoped-read and `count()` work already done):

```
7,000 × 2.5 × 50   = 875,000 reads/day
                   ≈ 26,000,000 reads/month
free allowance      = 50,000/day = 1,500,000/month
billable            ≈ 24,500,000 × $0.06/100k  ≈ $15/month
```

**≈ $15/month.** This is your dominant Firestore line item, and it is comfortably affordable.

⚠️ The number that must not regress: the old `ensureLoaded()` pattern read entire collections (~17,500 docs) on every cold start. At 7,000 users that pattern returns costs in the **thousands of dollars per month**. The scoped-read fix is not an optimisation — it is load-bearing. Guard it with a test.

### 2.4 Concurrency

Peak is not the daily average — it is the minutes after a competition drops.

```
2,000 students opening within 5 minutes ≈ 7 req/s sustained, ~50 req/s spike
```

Firestore absorbs this without configuration. **Render's free tier does not** — one instance, cold starts, sleeps when idle. Hosting is your concurrency ceiling, not the database.

---

## 3. Email — the actual blocker

This is the part that fails hardest and soonest, and it is unrelated to your database.

**Requirement:** ~21,000 emails/day (or ~7,000/day if you send one digest instead of one email per competition).

| Path | Daily ceiling | Verdict |
|---|---:|---|
| Gmail free account | 500 | ✗ 42× short |
| **Google Workspace + Gmail API** | **~2,000 external recipients** | ✗ **10× short — your current path** |
| Amazon SES | effectively unlimited | ✓ |
| Resend / SendGrid | unlimited (priced per email) | ✓ |

Google Workspace allows ~2,000 external recipients/day on a rolling 24-hour window, and the Gmail API caps a single message at 100 recipients. **Your `api/gmail/*` integration cannot deliver this volume and never will.** No amount of batching fixes a per-account daily cap.

### Cost at volume

| Provider | 210k emails/mo (daily digest) | 630k emails/mo (per competition) |
|---|---:|---:|
| **Amazon SES** ($0.10/1k) | **$21** | **$63** |
| Resend (~$0.40/1k over free) | ~$85 | ~$250 |
| SendGrid (~$0.40/1k over free) | ~$85 | ~$250 |

**Recommendation: Amazon SES, sending one daily digest rather than one email per competition.** That is **$21/month** and cuts email volume 3×. SES needs DNS verification (SPF/DKIM) and a sandbox-exit request — budget half a day.

> **Deliverability note:** sending 7,000 emails/day to a single domain (`@citchennai.net`) from a new sender will be throttled or spam-filed unless SPF, DKIM and DMARC are configured and volume is ramped up over ~2 weeks. Start now; this has a lead time you cannot compress.

### "Each email wired perfectly" — the data-quality half

From the `extradb` import dry run, this is already broken in the source data:

- **60 of 1,143 students** have personal Gmail addresses, not `@citchennai.net`. The domain gate in `isAllowedEmail()` rejects them — **these 60 cannot sign in at all**, and will never receive a notification.
- **4 of 36 faculty** addresses are malformed: `citcehnnai.net` (×2, transposed), `citchennai.cit`, and a trailing `@`. All four advisors are locked out.

Email is your join key *and* your identity. Fix these 64 rows before scaling, or they become 64 silent failures that look like bugs.

---

## 4. Hosting

Render's free tier is not a candidate at this scale — it sleeps when idle, cold-starts on every wake, and runs one instance.

| Tier | Cost | Fit |
|---|---:|---|
| Free | $0 | ✗ Sleeps; single instance; cold starts |
| Starter | ~$7/mo | Minimum viable; no headroom for launch spikes |
| **Standard (2 instances)** | **~$25/mo** | ✓ Recommended — survives the post-release spike |

Also worth doing: your `next.config` sets `output: standalone`, but the deploy runs `next start`, which prints a warning that the two are mismatched. Serve `node .next/standalone/server.js` instead — smaller image, faster boot.

---

## 5. Platform comparison, honestly

| | **Firebase (Blaze)** | **Supabase Pro** | **AWS (RDS + Lambda)** |
|---|---|---|---|
| Monthly DB cost at this scale | **~$15–35** | $25 + $15 compute = **$40+** | **$50–90** |
| Migration effort | **none** | 3–6 weeks | 6–10 weeks |
| Auth rewrite | none | full (custom claims → RLS/JWT) | full |
| Data layer rewrite | none | full (Firestore → SQL) | full |
| Fixes the email blocker? | **no** | **no** | **no** |
| Fixes the hosting blocker? | **no** | **no** | partly |
| Ops burden | lowest | low | highest |
| Real strength | zero migration cost | SQL, joins, aggregates | full control |
| Real weakness | no joins/aggregates | you already left it | complexity |

Supabase Pro is $25/month for 8 GB, 100k MAU and 250 GB egress — but **compute is billed separately** ($10 Micro / $15 Small, with $10 credit included). Realistically $40+/month, i.e. *more* than Firestore at your read volume, plus weeks of rewrite.

**The migration case does not close.** You already migrated off Supabase once. Migrating back to solve a problem that is neither a database problem nor a cost problem would be motion, not progress.

### When to revisit

Reopen this decision if **any** becomes true:

- Sustained reads exceed **~50M/month** (~$30+/mo) and profiling shows they are structural, not a caching bug
- You need genuine relational joins or SQL aggregates often enough that client-side assembly is the main source of bugs
- You need row-level multi-tenancy across departments that custom claims cannot express cleanly

---

## 6. Recommended monthly budget

| Line | Cost |
|---|---:|
| Firebase Blaze (reads ~$15, writes ~$0, storage ~$1) | **~$16–35** |
| Render Standard (2 instances) | **~$25** |
| Amazon SES (daily digest, ~210k emails) | **~$21** |
| **Total** | **≈ $62–81/month** |

For 7,000 users that is **under $0.012 per student per month.** Cost is not your constraint. Design and delivery limits are.

---

## 7. Action plan

### Immediately (this week) — unblocks everything

1. **Move to the Blaze plan** and set a **budget alert at $50 and a hard cap at $150.** This alone resolves the "hitting limits" problem — Spark's daily quotas are what is failing, not cost.
2. **Start Amazon SES setup.** Verify the domain, configure SPF/DKIM/DMARC, request sandbox exit. *Do this first — it has the longest lead time.*
3. **Upgrade Render** off the free tier.

### Before onboarding 7,000 students

4. **Remove the notification fan-out** (§2.2). Biggest single structural win; ~7,000× fewer writes.
5. **Switch to one daily digest email** instead of one per competition. 3× less email, 3× lower cost, and far better for students.
6. **Fix the 64 broken email addresses** (60 student Gmails, 4 malformed faculty) before they become silent failures.
7. **Add a TTL / archive policy on `notifications`** so the collection stops growing without bound.

### Ongoing

8. **Add a read-count regression guard.** The scoped-read fix is load-bearing; if it silently regresses, costs go from ~$15/month to thousands.
9. **Ramp email volume over ~2 weeks** rather than sending 7,000 on day one.
10. Re-examine the platform question against the §5 triggers — not before.

---

## 8. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Gmail API cap blocks all notifications | **Certain** at this volume | Critical | Move to SES now (§3) |
| Read-cost regression from an unscoped query | Medium | Critical ($1,000s/mo) | Regression guard (§7.8) |
| Free-tier host collapses at launch spike | **High** | High | Render Standard (§4) |
| New-domain email lands in spam | High | High | SPF/DKIM/DMARC + ramp (§3) |
| `notifications` grows without bound | Certain | Medium | Remove fan-out + TTL (§7.4, §7.7) |
| 64 broken addresses silently drop users | **Certain** | Medium | Data fix (§3) |

---

## Sources

- [Firebase pricing (2026)](https://blog.back4app.com/firebase-pricing/) · [Firestore pricing breakdown](https://toolradar.com/tools/firebase-firestore/pricing) · [Firebase: what you actually pay](https://www.budgetforge.dev/tools/firebase-pricing-2026)
- [Supabase pricing 2026 guide](https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/) · [Supabase pricing explained](https://schematichq.com/blog/supabase-pricing) · [The real 30-day bill](https://www.budgetforge.dev/tools/supabase-pricing-2026)
- [Gmail API usage limits (Google)](https://developers.google.com/workspace/gmail/api/reference/quota) · [Google Workspace sending limits](https://www.mailreach.co/blog/google-workspace-email-sending-limits)
- [Email API pricing comparison](https://www.buildmvpfast.com/api-costs/email) · [Amazon SES vs SendGrid at 100k](https://xmit.sh/versus/amazon-ses-vs-sendgrid) · [Resend vs SendGrid vs SES for Next.js](https://reactemailspro.com/blog/resend-vs-sendgrid-vs-ses-nextjs)

*Firestore rates used: $0.06/100k reads, $0.18/100k writes, $0.18/GiB-month; free tier 50k reads + 20k writes/day.*
