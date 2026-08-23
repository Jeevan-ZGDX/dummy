import { Worker } from 'bullmq'
import { getAdminDb } from '@/lib/firebase/admin'

const REDIS_HOST = process.env.REDIS_HOST || 'localhost'
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10)
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined

interface DeadlineReminderJobData {
  competitionId: string
  competitionTitle: string
  category: string
  registrationDeadline: string
}

/**
 * Worker that processes deadline reminder jobs.
 * Sends in-app notifications to all students and advisors 3 days before
 * a competition's registration deadline.
 */
const worker = new Worker(
  'competition-notifications',
  async (job) => {
    if (job.name !== 'deadline-reminder') return

    const { competitionId, competitionTitle, category, registrationDeadline } =
      job.data as DeadlineReminderJobData

    console.log(`[DeadlineReminder] Processing reminder for competition ${competitionId}`)

    const db = getAdminDb()
    if (!db) {
      console.error('[DeadlineReminder] Firestore not available, skipping')
      return
    }

    const categoryLabel =
      category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, ' ')
    const deadlineFormatted = new Date(registrationDeadline).toLocaleDateString(
      'en-US',
      { month: 'short', day: 'numeric', year: 'numeric' }
    )

    // Fetch students and advisors in parallel
    const [studentsSnap, advisorsSnap] = await Promise.all([
      db.collection('students').get(),
      db.collection('advisors').get(),
    ])

    const students = studentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
    const advisors = advisorsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

    // Build a set of users who already have a reminder for this competition
    const existingRemindersSnap = await db
      .collection('notifications')
      .where('data.competitionId', '==', competitionId)
      .where('type', '==', 'deadline_reminder')
      .get()

    const alreadyNotified = new Set(
      existingRemindersSnap.docs.map((d) => d.data().user_id)
    )

    // Send reminder to eligible students
    const studentNotifs = students
      .filter((s: any) => !alreadyNotified.has(s.id))
      .map((s: any) => ({
        user_id: s.id,
        type: 'deadline_reminder',
        title: 'Registration Deadline Approaching',
        message: `Reminder: The registration deadline for "${competitionTitle}" (${categoryLabel}) is ${deadlineFormatted}. Register before it's too late!`,
        data: {
          competitionId,
          competitionTitle,
          category,
          deadline: registrationDeadline,
        },
        is_read: false,
        created_at: new Date().toISOString(),
      }))

    // Send reminder to all advisors
    const advisorNotifs = advisors
      .filter((a: any) => !alreadyNotified.has(a.id))
      .map((a: any) => ({
        user_id: a.id,
        type: 'deadline_reminder',
        title: 'Registration Deadline Approaching',
        message: `Reminder: The registration deadline for "${competitionTitle}" (${categoryLabel}) is ${deadlineFormatted}. Ensure your students register before the deadline.`,
        data: {
          competitionId,
          competitionTitle,
          category,
          deadline: registrationDeadline,
        },
        is_read: false,
        created_at: new Date().toISOString(),
      }))

    const allNotifs = [...studentNotifs, ...advisorNotifs]

    if (allNotifs.length > 0) {
      // Batch write in chunks of 500 (Firestore limit)
      const BATCH_SIZE = 500
      for (let i = 0; i < allNotifs.length; i += BATCH_SIZE) {
        const batch = db.batch()
        const chunk = allNotifs.slice(i, i + BATCH_SIZE)
        for (const notif of chunk) {
          const ref = db.collection('notifications').doc()
          batch.set(ref, notif)
        }
        await batch.commit()
      }
      console.log(
        `[DeadlineReminder] Sent ${allNotifs.length} reminders for competition ${competitionId}`
      )
    } else {
      console.log(
        `[DeadlineReminder] No new reminders needed for competition ${competitionId}`
      )
    }
  },
  {
    connection: {
      host: REDIS_HOST,
      port: REDIS_PORT,
      password: REDIS_PASSWORD,
      lazyConnect: true,
    },
    limiter: {
      max: 10,
      duration: 1000,
    },
  }
)

worker.on('completed', (job) => {
  console.log(`[DeadlineReminder] Job ${job.id} completed for ${job.data?.competitionId}`)
})

worker.on('failed', (job, err) => {
  console.error(`[DeadlineReminder] Job ${job?.id} failed:`, err.message)
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[DeadlineReminder] Shutting down worker...')
  await worker.close()
  process.exit(0)
})

export default worker
