import { getDocById, fetchRoleAccess, upsertRoleAccess } from './firestore-data'
import { COLLECTIONS } from './firebase/config'

/**
 * Role-access lookups, backed by the `role_access` collection.
 *
 * The previous version of this file was an in-memory object seeded with
 * placeholder `@cit.in` accounts — it never touched a database, so every
 * permission answer it gave was fiction. These read the real collection.
 *
 * Documents are keyed by lowercased email, so the common lookup is a point read.
 */
export interface RoleAccessRecord {
  email: string
  role: string
  department: string
  granted: boolean
}

export async function checkUserAccess(email: string): Promise<RoleAccessRecord> {
  const cleanEmail = email.trim().toLowerCase()
  const doc = await getDocById(COLLECTIONS.roleAccess, cleanEmail)

  if (!doc) {
    // Unknown accounts are reported as ungranted rather than absent, matching
    // the shape callers already branch on.
    return { email: cleanEmail, role: 'student', department: 'CSE', granted: false }
  }

  return {
    email: cleanEmail,
    role: doc.role || 'student',
    department: doc.department || 'CSE',
    granted: Boolean(doc.granted),
  }
}

export async function getAllRoleAccessData(): Promise<RoleAccessRecord[]> {
  const rows = await fetchRoleAccess()
  return rows.map((row) => ({
    email: row.email,
    role: row.role || 'student',
    department: row.department || 'CSE',
    granted: Boolean(row.granted),
  }))
}

export async function setUserAccess(
  email: string,
  data: Partial<RoleAccessRecord>
): Promise<void> {
  const cleanEmail = email.trim().toLowerCase()
  const existing = await checkUserAccess(cleanEmail)

  await upsertRoleAccess({
    email: cleanEmail,
    role: data.role ?? existing.role,
    department: data.department ?? existing.department,
    granted: data.granted ?? existing.granted,
  })
}
