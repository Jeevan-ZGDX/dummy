import { getAdminStorage } from './firebase/admin'
import { v4 as uuidv4 } from 'uuid'

/**
 * Resolved per call rather than at module load: the admin SDK returns null when
 * credentials are absent, and a top-level `storage.bucket()` would crash the
 * whole route bundle at import time instead of failing the one request.
 */
function bucket() {
  const storage = getAdminStorage()
  if (!storage) throw new Error('Firebase Storage is not configured')
  return storage.bucket()
}

export interface UploadResult {
  url: string
  path: string
  filename: string
  contentType: string
  size: number
}

export async function uploadFile(
  buffer: Buffer,
  filename: string,
  contentType: string,
  folder: string = 'uploads'
): Promise<UploadResult> {
  const ext = filename.split('.').pop() || ''
  const uniqueName = `${folder}/${uuidv4()}.${ext}`
  const file = bucket().file(uniqueName)

  await file.save(buffer, {
    metadata: { contentType },
    public: true,
    resumable: false,
  })

  await file.makePublic()

  return {
    url: `https://storage.googleapis.com/${bucket().name}/${uniqueName}`,
    path: uniqueName,
    filename,
    contentType,
    size: buffer.length,
  }
}

export async function deleteFile(path: string): Promise<boolean> {
  try {
    await bucket().file(path).delete({ ignoreNotFound: true })
    return true
  } catch {
    return false
  }
}

export async function getSignedUrl(path: string, expiryMinutes: number = 15): Promise<string> {
  const [url] = await bucket().file(path).getSignedUrl({
    action: 'read',
    expires: Date.now() + expiryMinutes * 60 * 1000,
  })
  return url
}