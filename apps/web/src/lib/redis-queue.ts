import { Queue } from 'bullmq'

const REDIS_HOST = process.env.REDIS_HOST || 'localhost'
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10)
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined

function createQueue(name: string) {
  return new Queue(name, {
    connection: {
      host: REDIS_HOST,
      port: REDIS_PORT,
      password: REDIS_PASSWORD,
      lazyConnect: true,
    },
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: false,
    },
  })
}

/** Queue for competition-related background jobs (deadline reminders). */
export const competitionQueue = createQueue('competition-notifications')
