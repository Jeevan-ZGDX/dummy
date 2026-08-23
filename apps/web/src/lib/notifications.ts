import admin from 'firebase-admin'
import { getAdminApp } from './firebase/admin'

if (!admin.apps.length) {
  getAdminApp()
}

interface NotificationData {
  userId: string
  type: string
  title: string
  message: string
  data?: Record<string, any>
}

/**
 * Send a Firebase Cloud Messaging notification to a user.
 * Uses the Admin SDK to send via the FCM topic or direct user notification.
 */
export async function sendNotification(data: NotificationData): Promise<void> {
  const { userId, type, title, message, data: notifData } = data

  try {
    // Get the user's FCM token from Firestore or create a notification document
    const db = getAdminDb()
    if (!db) {
      console.log('Firestore not available, skipping notification')
      return
    }

    // Create notification document in Firestore
    // This can be listened to by the client for real-time updates
    await db.collection('notifications').add({
      user_id: userId,
      type: type,
      title: title,
      message: message,
      data: notifData || {},
      is_read: false,
      created_at: new Date().toISOString(),
    })

    // Optionally, try to send FCM message if user has a topic subscription
    // For now, we just create the Firestore document which the client will listen to
    console.log(`Notification queued for user ${userId}: ${title}`)

  } catch (err) {
    console.error(`Failed to send notification for user ${userId}:`, err)
  }
}

/**
 * Send verification update notifications to student and advisors
 */
export async function sendVerificationUpdate(
  studentEmail: string,
  competitionTitle: string,
  advisorEmails: string[],
  studentName: string
): Promise<void> {
    // Send to student
    await sendNotification({
      userId: studentEmail,
      type: 'verification_update',
      title: 'Registration Verified',
      message: `Your registration for "${competitionTitle}" has been verified!`,
      data: { competitionId: competitionTitle, verified: true },
    })

    // Send to each advisor
    for (const advisorEmail of advisorEmails) {
      await sendNotification({
        userId: advisorEmail,
        type: 'verification_update',
        title: 'New Verified Registration',
        message: `${studentName}'s registration for "${competitionTitle}" has been verified.`,
        data: { competitionId: competitionTitle, studentEmail, verified: true },
      })
    }
  }